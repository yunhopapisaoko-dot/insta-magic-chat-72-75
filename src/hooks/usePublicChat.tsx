import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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

export const usePublicChat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

  const fetchMessages = async () => {
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
  };

  const sendMessage = async (content: string) => {
    if (!user || !content.trim()) return;

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
      throw error;
    }
  };

  useEffect(() => {
    fetchMessages();
    fetchUserProfile();
  }, [user]);

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

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('public_chat')
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
            // Adicionar nova mensagem no final (mantém ordem cronológica)
            const updated = [...prev, newMessage];
            return updated.sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    messages,
    loading,
    sendMessage,
    fetchMessages,
    userProfile,
  };
};