import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
  message_status: string | null;
  message_type?: string;
  replied_to_message_id?: string | null;
}

interface TypingUser {
  user_id: string;
  display_name: string;
  is_typing: boolean;
}

interface OptimizedMessagesOptions {
  pageSize?: number;
  preloadPages?: number;
}

export const useOptimizedRealtimeMessages = (
  conversationId: string, 
  options: OptimizedMessagesOptions = {}
) => {
  const { pageSize = 25, preloadPages = 2 } = options;
  const { user } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [oldestMessageId, setOldestMessageId] = useState<string | null>(null);
  
  const messagesChannelRef = useRef<any>(null);
  const typingChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const isLoadingOlderRef = useRef(false);

  // Load initial messages (most recent)
  const loadInitialMessages = useCallback(async () => {
    if (!conversationId || !user) return;

    setLoading(true);
    try {
      console.log(`Carregando últimas ${pageSize} mensagens...`);
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(pageSize);

      if (error) throw error;
      
      const reversedMessages = (data || []).reverse();
      console.log(`${reversedMessages.length} mensagens iniciais carregadas`);
      
      setMessages(reversedMessages);
      setHasMoreMessages((data || []).length === pageSize);
      
      if (reversedMessages.length > 0) {
        setOldestMessageId(reversedMessages[0].id);
      }
      
      // Mark unread messages as delivered
      const unreadMessages = reversedMessages.filter(
        msg => msg.sender_id !== user.id && !msg.delivered_at
      );
      
      if (unreadMessages.length > 0) {
        await markMessagesAsDelivered(unreadMessages.map(m => m.id));
      }
      
    } catch (error) {
      console.error('Error loading initial messages:', error);
      toast({
        title: "Erro ao carregar mensagens",
        description: "Não foi possível carregar as mensagens.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [conversationId, user, pageSize]);

  // Load older messages for infinite scroll
  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || !user || !hasMoreMessages || isLoadingOlderRef.current || !oldestMessageId) {
      return;
    }

    isLoadingOlderRef.current = true;
    setLoadingOlder(true);
    
    try {
      console.log(`Carregando mensagens mais antigas antes de ${oldestMessageId}...`);
      
      // Get the timestamp of the oldest message we have
      const oldestMessage = messages[0];
      if (!oldestMessage) return;
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .lt('created_at', oldestMessage.created_at)
        .order('created_at', { ascending: false })
        .limit(pageSize);

      if (error) throw error;
      
      const olderMessages = (data || []).reverse();
      console.log(`${olderMessages.length} mensagens antigas carregadas`);
      
      if (olderMessages.length > 0) {
        setMessages(prev => [...olderMessages, ...prev]);
        setOldestMessageId(olderMessages[0].id);
        setHasMoreMessages(olderMessages.length === pageSize);
      } else {
        setHasMoreMessages(false);
      }
      
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      setLoadingOlder(false);
      isLoadingOlderRef.current = false;
    }
  }, [conversationId, user, hasMoreMessages, oldestMessageId, messages, pageSize]);

  // Mark messages as delivered
  const markMessagesAsDelivered = useCallback(async (messageIds: string[]) => {
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
  }, []);

  // Send message
  const sendMessage = useCallback(async (content: string, mediaUrl?: string, mediaType?: string, repliedToMessageId?: string) => {
    if (!user || (!content.trim() && !mediaUrl) || sending) return false;

    setSending(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: content.trim() || null,
          media_url: mediaUrl || null,
          media_type: mediaType || null,
          message_status: 'sent',
          replied_to_message_id: repliedToMessageId || null
        })
        .select()
        .single();

      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Erro ao enviar mensagem",
        description: "Não foi possível enviar sua mensagem. Tente novamente.",
        variant: "destructive",
      });
      return false;
    } finally {
      setSending(false);
    }
  }, [conversationId, user, sending]);

  // Send typing indicator
  const sendTypingIndicator = useCallback(async (isTyping: boolean) => {
    if (!user || !typingChannelRef.current) return;

    try {
      await typingChannelRef.current.send({
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

  // Online/offline status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setReconnectAttempts(0);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setConnectionStatus('disconnected');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Setup real-time channels
  const setupChannels = useCallback(() => {
    if (!conversationId || !user) return;

    console.log('Setting up optimized realtime channels for conversation:', conversationId);

    // Messages channel
    messagesChannelRef.current = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const newMessage = payload.new as Message;
          console.log('Nova mensagem recebida:', newMessage.content);
          
          setMessages(prev => {
            // Avoid duplicates
            if (prev.find(m => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });

          // Show notification for messages from others
          if (newMessage.sender_id !== user.id && document.hidden) {
            toast({
              title: "Nova mensagem",
              description: newMessage.content || "Mensagem recebida",
            });
          }

          // Auto-mark as delivered if not the sender
          if (newMessage.sender_id !== user.id) {
            setTimeout(async () => {
              await markMessagesAsDelivered([newMessage.id]);
            }, 500);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const updatedMessage = payload.new as Message;
          
          setMessages(prev => prev.map(msg => 
            msg.id === updatedMessage.id ? updatedMessage : msg
          ));
        }
      )
      .subscribe((status) => {
        console.log('Messages channel status:', status);
        setConnectionStatus(status === 'SUBSCRIBED' ? 'connected' : 'connecting');
      });

    // Typing channel
    typingChannelRef.current = supabase
      .channel(`typing:${conversationId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { user_id, display_name, is_typing } = payload.payload;
        
        if (user_id === user.id) return;

        setTypingUsers(prev => {
          const filtered = prev.filter(u => u.user_id !== user_id);
          
          if (is_typing) {
            if (typingTimeoutRef.current[user_id]) {
              clearTimeout(typingTimeoutRef.current[user_id]);
            }
            
            typingTimeoutRef.current[user_id] = setTimeout(() => {
              setTypingUsers(prev => prev.filter(u => u.user_id !== user_id));
              delete typingTimeoutRef.current[user_id];
            }, 3000);
            
            return [...filtered, { user_id, display_name, is_typing }];
          } else {
            if (typingTimeoutRef.current[user_id]) {
              clearTimeout(typingTimeoutRef.current[user_id]);
              delete typingTimeoutRef.current[user_id];
            }
            return filtered;
          }
        });
      })
      .subscribe();
  }, [conversationId, user, markMessagesAsDelivered]);

  // Reconnect channels
  const reconnectChannels = useCallback(() => {
    if (!conversationId || !user) return;

    setReconnectAttempts(prev => prev + 1);
    setConnectionStatus('connecting');

    // Clear existing channels
    if (messagesChannelRef.current) {
      supabase.removeChannel(messagesChannelRef.current);
    }
    if (typingChannelRef.current) {
      supabase.removeChannel(typingChannelRef.current);
    }

    setTimeout(() => {
      setupChannels();
    }, 1000);
  }, [setupChannels]);

  // Mark messages as read
  const markMessagesAsRead = useCallback(async () => {
    if (!user) return;

    const unreadMessages = messages.filter(
      msg => msg.sender_id !== user.id && msg.message_status !== 'read'
    );

    if (unreadMessages.length > 0) {
      try {
        await supabase
          .from('messages')
          .update({ 
            read_at: new Date().toISOString(),
            message_status: 'read'
          })
          .in('id', unreadMessages.map(m => m.id));
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    }
  }, [messages, user]);

  // Setup channels effect
  useEffect(() => {
    if (!conversationId || !user) return;

    setupChannels();

    return () => {
      if (messagesChannelRef.current) {
        supabase.removeChannel(messagesChannelRef.current);
        messagesChannelRef.current = null;
      }
      
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current);
        typingChannelRef.current = null;
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      Object.values(typingTimeoutRef.current).forEach(timeout => clearTimeout(timeout));
      typingTimeoutRef.current = {};
      
      setConnectionStatus('disconnected');
    };
  }, [setupChannels]);

  // Auto-mark messages as read
  useEffect(() => {
    const timer = setTimeout(() => {
      markMessagesAsRead();
    }, 1000);

    return () => clearTimeout(timer);
  }, [messages, markMessagesAsRead]);

  // Load initial messages
  useEffect(() => {
    loadInitialMessages();
  }, [loadInitialMessages]);

  return {
    messages,
    typingUsers,
    loading,
    loadingOlder,
    sending,
    connectionStatus,
    isOnline,
    reconnectAttempts,
    hasMoreMessages,
    sendMessage,
    sendTypingIndicator,
    markMessagesAsRead,
    loadOlderMessages,
    reconnectChannels,
    refreshMessages: loadInitialMessages
  };
};