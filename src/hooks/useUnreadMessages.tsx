import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export const useUnreadMessages = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadByConversation, setUnreadByConversation] = useState<Record<string, number>>({});

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;

    try {
      // Get user's conversations
      const { data: participantData, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (participantError || !participantData) return;

      const conversationIds = participantData.map(p => p.conversation_id);

      if (conversationIds.length === 0) {
        setUnreadCount(0);
        setUnreadByConversation({});
        return;
      }

      // Count unread messages in user's conversations
      const { data: unreadMessages, error: unreadError } = await supabase
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', conversationIds)
        .neq('sender_id', user.id)
        .is('read_at', null);

      if (unreadError) throw unreadError;

      const totalUnread = unreadMessages?.length || 0;
      
      // Group by conversation
      const unreadByConv = (unreadMessages || []).reduce((acc, msg) => {
        acc[msg.conversation_id] = (acc[msg.conversation_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      setUnreadCount(totalUnread);
      setUnreadByConversation(unreadByConv);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, [user]);

  const markConversationAsRead = useCallback(async (conversationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .is('read_at', null);

      if (error) throw error;

      // Update local state
      setUnreadByConversation(prev => {
        const updated = { ...prev };
        const wasUnread = updated[conversationId] || 0;
        delete updated[conversationId];
        setUnreadCount(current => Math.max(0, current - wasUnread));
        return updated;
      });
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  }, [user]);

  const showMessageNotification = useCallback((message: any, senderName: string) => {
    if (document.hidden) {
      // Show system notification if page is hidden
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`Nova mensagem de ${senderName}`, {
          body: message.content || 'Mensagem de mídia',
          icon: '/favicon.ico'
        });
      }
    }

    // Always show toast notification
    toast({
      title: `Nova mensagem de ${senderName}`,
      description: message.content || 'Mensagem de mídia',
      duration: 5000,
    });
  }, []);

  // Set up real-time subscription for new messages
  useEffect(() => {
    if (!user) return;

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    fetchUnreadCount();

    const channel = supabase
      .channel('unread-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const newMessage = payload.new;
          
          // Check if this message is in one of user's conversations and not from user
          if (newMessage.sender_id !== user.id) {
            const { data: isParticipant } = await supabase
              .from('conversation_participants')
              .select('conversation_id')
              .eq('conversation_id', newMessage.conversation_id)
              .eq('user_id', user.id)
              .single();

            if (isParticipant) {
              // Get sender info for notification
              const { data: senderProfile } = await supabase
                .from('profiles')
                .select('display_name')
                .eq('id', newMessage.sender_id)
                .single();

              const senderName = senderProfile?.display_name || 'Usuário';
              
              // Update unread count
              setUnreadCount(prev => prev + 1);
              setUnreadByConversation(prev => ({
                ...prev,
                [newMessage.conversation_id]: (prev[newMessage.conversation_id] || 0) + 1
              }));

              // Show notification
              showMessageNotification(newMessage, senderName);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const updatedMessage = payload.new;
          
          // If message was marked as read and it's not from current user
          if (updatedMessage.read_at && updatedMessage.sender_id !== user.id) {
            setUnreadByConversation(prev => {
              const updated = { ...prev };
              if (updated[updatedMessage.conversation_id] > 0) {
                updated[updatedMessage.conversation_id]--;
                if (updated[updatedMessage.conversation_id] === 0) {
                  delete updated[updatedMessage.conversation_id];
                }
                setUnreadCount(current => Math.max(0, current - 1));
              }
              return updated;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUnreadCount, showMessageNotification]);

  return {
    unreadCount,
    unreadByConversation,
    markConversationAsRead,
    fetchUnreadCount,
  };
};