import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Message } from '@/hooks/useConversations';
import { useWebSocketConnection } from '@/hooks/useWebSocketConnection';
import { useMessageCache } from '@/hooks/useMessageCache';

interface RealtimeMessage extends Message {
  delivered_at?: string | null;
  message_status?: string | null;
}

interface TypingUser {
  user_id: string;
  display_name: string;
  is_typing: boolean;
}

export const useRealtimeMessages = (conversationId: string) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<RealtimeMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  // WebSocket connection management
  const wsConnection = useWebSocketConnection({
    maxReconnectAttempts: 5,
    reconnectInterval: 2000,
    heartbeatInterval: 30000,
    enableMobileOptimizations: true
  });

  // Message cache management
  const messageCache = useMessageCache({
    maxSize: 500,
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    persistToStorage: true
  });

  // Fetch initial messages with cache
  const fetchMessages = useCallback(async (forceRefresh = false) => {
    if (!conversationId || !user) return;

    setLoading(true);

    try {
      // Try to get cached messages first
      const cachedMessages = messageCache.getCachedMessages(conversationId);
      
      if (cachedMessages.length > 0 && !forceRefresh) {
        setMessages(cachedMessages as RealtimeMessage[]);
        setLoading(false);
        
        // Fetch fresh data in background if cache is old
        setTimeout(() => {
          messageCache.fetchAndCacheMessages(conversationId);
        }, 1000);
      } else {
        // Fetch from server
        const freshMessages = await messageCache.fetchAndCacheMessages(conversationId, forceRefresh);
        setMessages(freshMessages as RealtimeMessage[]);
      }
      
      // Mark messages as delivered when fetched
      const undeliveredMessages = messages.filter(
        msg => msg.sender_id !== user.id && !msg.delivered_at
      );

      if (undeliveredMessages.length > 0) {
        await markMessagesAsDelivered(undeliveredMessages.map(m => m.id));
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      // Fallback to cached data on error
      const cachedMessages = messageCache.getCachedMessages(conversationId);
      if (cachedMessages.length > 0) {
        setMessages(cachedMessages as RealtimeMessage[]);
      }
    } finally {
      setLoading(false);
    }
  }, [conversationId, user, messageCache, messages]);

  // Mark messages as delivered
  const markMessagesAsDelivered = async (messageIds: string[]) => {
    try {
      await supabase
        .from('messages')
        .update({ 
          delivered_at: new Date().toISOString(),
          message_status: 'delivered'
        })
        .in('id', messageIds);
    } catch (error) {
      console.error('Error marking messages as delivered:', error);
    }
  };

  // Mark messages as read
  const markMessagesAsRead = useCallback(async (messageIds: string[]) => {
    if (!messageIds.length) return;

    try {
      await supabase
        .from('messages')
        .update({ 
          read_at: new Date().toISOString(),
          message_status: 'read'
        })
        .in('id', messageIds);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, []);

  // Send message with real-time feedback
  const sendMessage = useCallback(async (content: string) => {
    if (!user || !content.trim() || sending) return null;

    setSending(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: content.trim(),
          message_status: 'sent'
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Erro ao enviar mensagem",
        description: "Não foi possível enviar sua mensagem. Tente novamente.",
        variant: "destructive",
      });
      return null;
    } finally {
      setSending(false);
    }
  }, [conversationId, user, sending]);

  // Send typing indicator
  const sendTypingIndicator = useCallback(async (isTyping: boolean) => {
    if (!user) return;

    try {
      const channel = supabase.channel(`typing:${conversationId}`);
      await channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          user_id: user.id,
          display_name: user.display_name,
          is_typing: isTyping,
          conversation_id: conversationId
        }
      });
    } catch (error) {
      console.error('Error sending typing indicator:', error);
    }
  }, [conversationId, user]);

  // Set up real-time subscriptions with connection management
  useEffect(() => {
    if (!conversationId || !user || wsConnection.status === 'disconnected') return;

    const messagesChannelId = `messages:${conversationId}`;
    const typingChannelId = `typing:${conversationId}`;

    const messageHandlers = {
      'postgres_changes:INSERT:messages': async (payload: any) => {
        const newMessage = payload.new as RealtimeMessage;
        console.log('New message received:', newMessage);
        
        // Add to cache
        messageCache.addMessage(conversationId, newMessage);
        
        setMessages(prev => {
          // Avoid duplicates
          if (prev.find(m => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });

        // Auto-mark as delivered if not sender
        if (newMessage.sender_id !== user.id) {
          await markMessagesAsDelivered([newMessage.id]);
          
          // Show toast notification only if not in foreground
          if (document.hidden) {
            toast({
              title: "Nova mensagem",
              description: newMessage.content || "Mensagem recebida",
            });
          }
        }
      },
      'postgres_changes:UPDATE:messages': (payload: any) => {
        const updatedMessage = payload.new as RealtimeMessage;
        console.log('Message updated:', updatedMessage);
        
        // Update cache
        messageCache.updateMessage(conversationId, updatedMessage.id, updatedMessage);
        
        setMessages(prev => prev.map(msg => 
          msg.id === updatedMessage.id ? updatedMessage : msg
        ));
      }
    };

    const typingHandlers = {
      'broadcast:typing': (payload: any) => {
        const { user_id, display_name, is_typing } = payload.payload;
        
        if (user_id === user.id) return; // Ignore own typing
        
        setTypingUsers(prev => {
          const filtered = prev.filter(u => u.user_id !== user_id);
          
          if (is_typing) {
            return [...filtered, { user_id, display_name, is_typing }];
          }
          
          return filtered;
        });

        // Clear typing after timeout
        if (is_typing) {
          setTimeout(() => {
            setTypingUsers(prev => prev.filter(u => u.user_id !== user_id));
          }, 5000);
        }
      }
    };

    // Create channels with connection management
    wsConnection.createChannel(messagesChannelId, {
      filter: `conversation_id=eq.${conversationId}`
    }, messageHandlers);

    wsConnection.createChannel(typingChannelId, {}, typingHandlers);

    return () => {
      wsConnection.removeChannel(messagesChannelId);
      wsConnection.removeChannel(typingChannelId);
    };
  }, [conversationId, user, wsConnection, messageCache]);

  // Auto-mark visible messages as read
  useEffect(() => {
    const unreadMessages = messages.filter(
      msg => msg.sender_id !== user?.id && msg.message_status !== 'read'
    );
    
    if (unreadMessages.length > 0) {
      const timer = setTimeout(() => {
        markMessagesAsRead(unreadMessages.map(m => m.id));
      }, 1000); // Mark as read after 1 second of being visible
      
      return () => clearTimeout(timer);
    }
  }, [messages, user, markMessagesAsRead]);

  // Fetch messages on mount
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  return {
    messages,
    typingUsers,
    loading,
    sending,
    sendMessage,
    sendTypingIndicator,
    markMessagesAsRead,
    fetchMessages,
    connectionStatus: wsConnection.status,
    isOnline: wsConnection.isOnline,
    reconnectAttempts: wsConnection.reconnectAttempts,
    reconnectChannels: wsConnection.reconnectChannels,
    cacheStats: messageCache.getCacheStats()
  };
};