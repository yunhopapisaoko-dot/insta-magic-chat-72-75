import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface PublicMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
}

interface TypingUser {
  user_id: string;
  display_name: string;
  is_typing: boolean;
}

export const useRealtimePublicChat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  const fetchMessages = useCallback(async () => {
    if (!user) return;

    try {
      const { data: messagesData, error } = await supabase
        .from('public_chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;

      if (messagesData?.length) {
        // Get unique sender IDs
        const senderIds = [...new Set(messagesData.map(m => m.sender_id))];
        
        // Fetch sender profiles
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .in('id', senderIds);

        if (profilesError) throw profilesError;

        // Create profiles map
        const profilesMap = profiles?.reduce((acc, profile) => {
          acc[profile.id] = {
            display_name: profile.display_name,
            username: profile.username,
            avatar_url: profile.avatar_url,
          };
          return acc;
        }, {} as Record<string, any>) || {};

        // Add sender info to messages
        const messagesWithSenders = messagesData.map(message => ({
          ...message,
          sender: profilesMap[message.sender_id]
        }));

        setMessages(messagesWithSenders);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('Error fetching public messages:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const sendMessage = useCallback(async (content: string) => {
    if (!user || !content.trim() || sending) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('public_chat_messages')
        .insert({
          sender_id: user.id,
          content: content.trim()
        });

      if (error) throw error;

      // Show success toast
      toast({
        title: "Mensagem enviada",
        description: "Sua mensagem foi enviada com sucesso!",
      });

    } catch (error) {
      console.error('Error sending public message:', error);
      toast({
        title: "Erro ao enviar mensagem",
        description: "Não foi possível enviar sua mensagem. Tente novamente.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setSending(false);
    }
  }, [user, sending]);

  const sendTypingIndicator = useCallback(async (isTyping: boolean, displayName: string) => {
    if (!user) return;

    try {
      const channel = supabase.channel('public_typing');
      await channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          user_id: user.id,
          display_name: displayName,
          is_typing: isTyping
        }
      });
    } catch (error) {
      console.error('Error sending typing indicator:', error);
    }
  }, [user]);

  const fetchUserProfile = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, username, avatar_url')
        .eq('id', user.id)
        .single();
      
      setUserProfile(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  }, [user]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user) return;

    // Messages subscription
    const messagesChannel = supabase
      .channel('public_chat_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'public_chat_messages',
        },
        async (payload) => {
          const newMessage = payload.new as PublicMessage;
          console.log('New public message received:', newMessage);
          
          // Get sender profile for new message
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, username, avatar_url')
            .eq('id', newMessage.sender_id)
            .single();

          if (profile) {
            newMessage.sender = {
              display_name: profile.display_name,
              username: profile.username,
              avatar_url: profile.avatar_url,
            };
          }

          setMessages(prev => {
            // Avoid duplicates
            if (prev.find(m => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });

          // Show notification for other users' messages
          if (newMessage.sender_id !== user.id && profile) {
            toast({
              title: `Nova mensagem de ${profile.display_name}`,
              description: newMessage.content,
            });
          }
        }
      )
      .subscribe();

    // Typing indicators subscription
    const typingChannel = supabase
      .channel('public_typing')
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
  }, [user]);

  // Fetch initial data
  useEffect(() => {
    fetchMessages();
    fetchUserProfile();
  }, [fetchMessages, fetchUserProfile]);

  return {
    messages,
    typingUsers,
    loading,
    sending,
    sendMessage,
    sendTypingIndicator,
    fetchMessages,
    userProfile,
  };
};