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
}

interface TypingUser {
  user_id: string;
  display_name: string;
  is_typing: boolean;
}

export const useRealtimeChat = (conversationId: string) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  const messagesChannelRef = useRef<any>(null);
  const typingChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  // Fetch initial messages
  const fetchMessages = useCallback(async () => {
    if (!conversationId || !user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, replied_message:replied_to_message_id(id, content, media_url, media_type, sender_id)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      setMessages(data || []);
      
      // Mark unread messages as delivered
      const unreadMessages = data?.filter(
        msg => msg.sender_id !== user.id && !msg.delivered_at
      ) || [];
      
      if (unreadMessages.length > 0) {
        await supabase
          .from('messages')
          .update({ 
            delivered_at: new Date().toISOString(),
            message_status: 'delivered'
          })
          .in('id', unreadMessages.map(m => m.id));
      }
      
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Erro ao carregar mensagens",
        description: "Não foi possível carregar as mensagens.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [conversationId, user]);

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

  // Reconnect channels function
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

    // Recreate channels after a short delay
    setTimeout(() => {
      setupChannels();
    }, 1000);
  }, [conversationId, user]);

  const setupChannels = useCallback(() => {
    if (!conversationId || !user) return;

    console.log('Setting up realtime channels for conversation:', conversationId);

    // Messages channel for real-time message updates
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
          console.log('New message received:', payload.new);
          const newMessage = payload.new as Message;
          
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
              try {
                await supabase
                  .from('messages')
                  .update({ 
                    delivered_at: new Date().toISOString(),
                    message_status: 'delivered'
                  })
                  .eq('id', newMessage.id);
              } catch (error) {
                console.error('Error marking message as delivered:', error);
              }
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
          console.log('Message updated:', payload.new);
          const updatedMessage = payload.new as Message;
          
          setMessages(prev => prev.map(msg => 
            msg.id === updatedMessage.id ? updatedMessage : msg
          ));
        }
      )
      .subscribe((status) => {
        console.log('Messages channel status:', status);
        setConnectionStatus(status === 'SUBSCRIBED' ? 'connected' : 'connecting');
        
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionStatus('disconnected');
          
          // Auto-reconnect after 3 seconds if online and attempts < 5
          if (isOnline && reconnectAttempts < 5) {
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectChannels();
            }, 3000);
          }
        }
      });

    // Typing channel for typing indicators
    typingChannelRef.current = supabase
      .channel(`typing:${conversationId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { user_id, display_name, is_typing } = payload.payload;
        
        // Ignore own typing indicators
        if (user_id === user.id) return;
        
        console.log('Typing indicator received:', { user_id, display_name, is_typing });

        setTypingUsers(prev => {
          const filtered = prev.filter(u => u.user_id !== user_id);
          
          if (is_typing) {
            // Clear existing timeout for this user
            if (typingTimeoutRef.current[user_id]) {
              clearTimeout(typingTimeoutRef.current[user_id]);
            }
            
            // Set timeout to automatically remove typing indicator
            typingTimeoutRef.current[user_id] = setTimeout(() => {
              setTypingUsers(prev => prev.filter(u => u.user_id !== user_id));
              delete typingTimeoutRef.current[user_id];
            }, 3000);
            
            return [...filtered, { user_id, display_name, is_typing }];
          } else {
            // Clear timeout when user stops typing
            if (typingTimeoutRef.current[user_id]) {
              clearTimeout(typingTimeoutRef.current[user_id]);
              delete typingTimeoutRef.current[user_id];
            }
            return filtered;
          }
        });
      })
      .subscribe((status) => {
        console.log('Typing channel status:', status);
      });
  }, [conversationId, user, isOnline, reconnectAttempts, reconnectChannels]);

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

  // Setup real-time subscriptions
  useEffect(() => {
    if (!conversationId || !user) return;

    setupChannels();

    // Cleanup function
    return () => {
      console.log('Cleaning up realtime channels');
      
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
      
      // Clear all typing timeouts
      Object.values(typingTimeoutRef.current).forEach(timeout => clearTimeout(timeout));
      typingTimeoutRef.current = {};
      
      setConnectionStatus('disconnected');
    };
  }, [setupChannels]);

  // Auto-mark messages as read when component is visible
  useEffect(() => {
    const timer = setTimeout(() => {
      markMessagesAsRead();
    }, 1000);

    return () => clearTimeout(timer);
  }, [messages, markMessagesAsRead]);

  // Load initial messages
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  return {
    messages,
    typingUsers,
    loading,
    sending,
    connectionStatus,
    isOnline,
    reconnectAttempts,
    sendMessage,
    sendTypingIndicator,
    markMessagesAsRead,
    fetchMessages,
    reconnectChannels,
  };
};