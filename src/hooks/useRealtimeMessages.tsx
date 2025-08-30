import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Message } from '@/hooks/useConversations';

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

  // Fetch initial messages
  const fetchMessages = useCallback(async () => {
    if (!conversationId || !user) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages((data as RealtimeMessage[]) || []);
      
      // Mark messages as delivered when fetched
      const undeliveredMessages = data?.filter(
        msg => msg.sender_id !== user.id && !msg.delivered_at
      );

      if (undeliveredMessages?.length) {
        await markMessagesAsDelivered(undeliveredMessages.map(m => m.id));
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, user]);

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

  // Set up real-time subscriptions
  useEffect(() => {
    if (!conversationId || !user) return;

    // Messages subscription
    const messagesChannel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMessage = payload.new as RealtimeMessage;
          console.log('New message received:', newMessage);
          
          setMessages(prev => {
            // Avoid duplicates
            if (prev.find(m => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });

          // Auto-mark as delivered if not sender
          if (newMessage.sender_id !== user.id) {
            await markMessagesAsDelivered([newMessage.id]);
            
            // Show toast notification
            toast({
              title: "Nova mensagem",
              description: newMessage.content || "Mensagem recebida",
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as RealtimeMessage;
          console.log('Message updated:', updatedMessage);
          
          setMessages(prev => prev.map(msg => 
            msg.id === updatedMessage.id ? updatedMessage : msg
          ));
        }
      )
      .subscribe();

    // Typing indicators subscription
    const typingChannel = supabase
      .channel(`typing:${conversationId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { user_id, display_name, is_typing } = payload.payload;
        
        if (user_id === user.id) return; // Ignore own typing
        
        setTypingUsers(prev => {
          const filtered = prev.filter(u => u.user_id !== user_id);
          
          if (is_typing) {
            return [...filtered, { user_id, display_name, is_typing }];
          }
          
          return filtered;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(typingChannel);
    };
  }, [conversationId, user, markMessagesAsDelivered]);

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
    fetchMessages
  };
};