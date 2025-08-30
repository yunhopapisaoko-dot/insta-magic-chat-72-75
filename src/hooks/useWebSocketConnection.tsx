import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

interface WebSocketConnectionOptions {
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  enableMobileOptimizations?: boolean;
}

export const useWebSocketConnection = (options: WebSocketConnectionOptions = {}) => {
  const {
    maxReconnectAttempts = 5,
    reconnectInterval = 1000,
    heartbeatInterval = 30000,
    enableMobileOptimizations = true
  } = options;

  const { user } = useAuth();
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const channelsRef = useRef<Map<string, any>>(new Map());
  const heartbeatRef = useRef<NodeJS.Timeout>();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const lastActivityRef = useRef<number>(Date.now());

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (status === 'disconnected') {
        setStatus('connecting');
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setStatus('disconnected');
      cleanupChannels();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [status]);

  // Mobile optimizations
  useEffect(() => {
    if (!enableMobileOptimizations) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Reduce activity when app is in background
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
        }
      } else {
        // Resume activity when app comes back to foreground
        startHeartbeat();
        lastActivityRef.current = Date.now();
      }
    };

    const handleFocus = () => {
      // Check if we need to reconnect when app regains focus
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      if (timeSinceLastActivity > 60000) { // 1 minute
        reconnectChannels();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [enableMobileOptimizations]);

  const cleanupChannels = useCallback(() => {
    channelsRef.current.forEach((channel) => {
      supabase.removeChannel(channel);
    });
    channelsRef.current.clear();
    
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }

    heartbeatRef.current = setInterval(() => {
      // Send heartbeat to maintain connection
      channelsRef.current.forEach((channel) => {
        try {
          channel.send({
            type: 'broadcast',
            event: 'heartbeat',
            payload: { timestamp: Date.now() }
          });
        } catch (error) {
          console.warn('Heartbeat failed:', error);
        }
      });
    }, heartbeatInterval);
  }, [heartbeatInterval]);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttempts >= maxReconnectAttempts) {
      setStatus('error');
      toast({
        title: "Conexão perdida",
        description: "Não foi possível reconectar. Recarregue a página.",
        variant: "destructive",
      });
      return;
    }

    setStatus('reconnecting');
    setReconnectAttempts(prev => prev + 1);

    const delay = Math.min(reconnectInterval * Math.pow(2, reconnectAttempts), 30000);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (isOnline && user) {
        reconnectChannels();
      }
    }, delay);
  }, [reconnectAttempts, maxReconnectAttempts, reconnectInterval, isOnline, user]);

  const reconnectChannels = useCallback(() => {
    // This will be called by components to trigger reconnection
    const channelConfigs = Array.from(channelsRef.current.entries());
    cleanupChannels();
    
    // Re-establish connections
    channelConfigs.forEach(([channelId, config]) => {
      createChannel(channelId, config.options, config.handlers);
    });
  }, []);

  const createChannel = useCallback((
    channelId: string,
    options: any,
    handlers: Record<string, Function>
  ) => {
    if (!user || !isOnline) return null;

    try {
      setStatus('connecting');
      
      const channel = supabase.channel(channelId, options);
      
      // Add all handlers
      Object.entries(handlers).forEach(([event, handler]) => {
        if (event.startsWith('postgres_changes')) {
          const [, eventType, table] = event.split(':');
          channel.on('postgres_changes', {
            event: eventType as any,
            schema: 'public',
            table: table,
            ...options.filter
          }, handler as any);
        } else if (event.startsWith('broadcast')) {
          const [, broadcastEvent] = event.split(':');
          channel.on('broadcast', { event: broadcastEvent }, handler as any);
        }
      });

      const subscription = channel.subscribe((status) => {
        console.log(`Channel ${channelId} status:`, status);
        
        switch (status) {
          case 'SUBSCRIBED':
            setStatus('connected');
            setReconnectAttempts(0);
            startHeartbeat();
            lastActivityRef.current = Date.now();
            break;
          case 'CHANNEL_ERROR':
          case 'TIMED_OUT':
          case 'CLOSED':
            setStatus('disconnected');
            attemptReconnect();
            break;
        }
      });

      // Store channel config for reconnection
      channelsRef.current.set(channelId, {
        channel,
        options,
        handlers,
        subscription
      });

      return channel;
    } catch (error) {
      console.error(`Error creating channel ${channelId}:`, error);
      setStatus('error');
      attemptReconnect();
      return null;
    }
  }, [user, isOnline, attemptReconnect, startHeartbeat]);

  const removeChannel = useCallback((channelId: string) => {
    const channelConfig = channelsRef.current.get(channelId);
    if (channelConfig) {
      supabase.removeChannel(channelConfig.channel);
      channelsRef.current.delete(channelId);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupChannels();
    };
  }, [cleanupChannels]);

  return {
    status,
    isOnline,
    reconnectAttempts,
    createChannel,
    removeChannel,
    reconnectChannels,
    cleanupChannels
  };
};