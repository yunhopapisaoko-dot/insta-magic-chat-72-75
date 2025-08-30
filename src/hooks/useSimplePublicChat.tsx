import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export interface PublicMessage {
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

export const useSimplePublicChat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  const fetchMessages = async () => {
    if (!user) return;

    try {
      // Buscar apenas as últimas 15 mensagens para caber numa tela
      const { data: messagesData, error } = await supabase
        .from('public_chat_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15);

      if (error) throw error;

      if (messagesData?.length) {
        // Reverter ordem para mostrar mais antigas primeiro
        const reversedMessages = messagesData.reverse();
        
        // Get unique sender IDs
        const senderIds = [...new Set(reversedMessages.map(m => m.sender_id))];
        
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
        const messagesWithSenders = reversedMessages.map(message => ({
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
  };

  const sendMessage = async (content: string) => {
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
  };

  const fetchUserProfile = async () => {
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
  };

  // Set up real-time subscriptions (simplified)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('simple_public_chat')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'public_chat_messages',
        },
        async (payload) => {
          const newMessage = payload.new as PublicMessage;
          
          // Get sender profile
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
            // Manter apenas as últimas 15 mensagens
            const newMessages = [...prev, newMessage];
            return newMessages.slice(-15);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Fetch initial data
  useEffect(() => {
    if (user) {
      fetchMessages();
      fetchUserProfile();
    }
  }, [user]);

  return {
    messages,
    loading,
    sending,
    sendMessage,
    fetchMessages,
    userProfile,
  };
};