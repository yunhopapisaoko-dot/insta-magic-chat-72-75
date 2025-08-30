import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Message } from '@/hooks/useConversations';
import { useWebSocketConnection } from '@/hooks/useWebSocketConnection';
import { useMessageCache } from '@/hooks/useMessageCache';
import { useConnectionValidator } from '@/hooks/useConnectionValidator';
import { useMessageTimeout } from '@/hooks/useMessageTimeout';

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
  
  // Connection and validation management
  const wsConnection = useWebSocketConnection({
    maxReconnectAttempts: 5,
    reconnectInterval: 2000,
    heartbeatInterval: 30000,
    enableMobileOptimizations: true
  });

  const connectionValidator = useConnectionValidator();
  
  // Message cache management
  const messageCache = useMessageCache({
    maxSize: 500,
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    persistToStorage: true
  });

  // Timeout and retry management
  const messageTimeout = useMessageTimeout({
    sendTimeout: 30000,
    deliveryTimeout: 60000,
    maxRetries: 3,
    retryDelay: 2000
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
        return;
      } 
      
      // Fetch from server
      const freshMessages = await messageCache.fetchAndCacheMessages(conversationId, forceRefresh);
      setMessages(freshMessages as RealtimeMessage[]);
      
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
  }, [conversationId, user, messageCache]);

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

  // Send message with enhanced validation and timeout handling
  const sendMessage = useCallback(async (content: string, mediaUrl?: string, mediaType?: string) => {
    if (!user || (!content.trim() && !mediaUrl) || sending) return null;

    // Validate connection before sending
    const connectionInfo = connectionValidator.getConnectionInfo();
    if (!connectionInfo.isHealthy && connectionInfo.quality === 'offline') {
      toast({
        title: "Sem conexão",
        description: "Não é possível enviar mensagens sem conexão com a internet.",
        variant: "destructive",
      });
      return null;
    }

    // Generate temporary message ID
    const tempMessageId = `temp_${Date.now()}_${Math.random()}`;
    
    setSending(true);
    
    try {
      // Add to timeout monitoring
      messageTimeout.addPendingMessage(
        tempMessageId,
        content,
        (messageId) => {
          console.warn('Message timeout:', messageId);
          toast({
            title: "Timeout na mensagem",
            description: "A mensagem está demorando para ser enviada. Verificando conexão...",
            variant: "destructive",
          });
        },
        async (messageId) => {
          // Retry logic
          console.log('Retrying message:', messageId);
          try {
            const result = await sendMessageToServer(content, mediaUrl, mediaType);
            return result ? true : false;
          } catch (error) {
            console.error('Retry failed:', error);
            return false;
          }
        }
      );

      const result = await sendMessageToServer(content, mediaUrl, mediaType);
      
      if (result) {
        messageTimeout.markMessageSent(tempMessageId);
        return result;
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Enhanced error feedback based on connection quality
      const connectionInfo = connectionValidator.getConnectionInfo();
      let errorMessage = "Não foi possível enviar sua mensagem.";
      
      if (connectionInfo.quality === 'poor') {
        errorMessage = "Conexão instável. A mensagem será enviada quando a conexão melhorar.";
      } else if (connectionInfo.quality === 'offline') {
        errorMessage = "Sem conexão. A mensagem será enviada quando a conexão for restabelecida.";
      }
      
      toast({
        title: "Erro ao enviar mensagem",
        description: errorMessage,
        variant: "destructive",
      });
      
      return null;
    } finally {
      setSending(false);
    }
  }, [user, sending, connectionValidator, messageTimeout]);

  // Helper function to send message to server
  const sendMessageToServer = async (content: string, mediaUrl?: string, mediaType?: string) => {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user!.id,
        content: content.trim() || null,
        media_url: mediaUrl || null,
        media_type: mediaType || null,
        message_status: 'sent'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  };

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
          
          // Insert message in correct chronological order
          const newMessages = [...prev, newMessage];
          return newMessages.sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
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
    cacheStats: messageCache.getCacheStats(),
    // Enhanced validation data
    connectionQuality: connectionValidator.getConnectionInfo().quality,
    networkMetrics: connectionValidator.getConnectionInfo(),
    // Timeout management
    pendingMessages: messageTimeout.pendingMessages,
    hasTimeouts: messageTimeout.hasTimeouts,
    retryMessage: messageTimeout.retryMessage,
    getMessageStatus: messageTimeout.getMessageStatus,
    getRetryCount: messageTimeout.getRetryCount
  };
};