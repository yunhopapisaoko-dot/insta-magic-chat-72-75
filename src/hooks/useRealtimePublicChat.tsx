import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { useWebSocketConnection } from '@/hooks/useWebSocketConnection';
import { useMessageCache } from '@/hooks/useMessageCache';

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
  
  // WebSocket connection management
  const wsConnection = useWebSocketConnection({
    maxReconnectAttempts: 3,
    reconnectInterval: 2000,
    heartbeatInterval: 60000, // Longer interval for public chat
    enableMobileOptimizations: true
  });

  // Use a special cache key for public chat
  const publicChatCache = useMessageCache({
    maxSize: 200, // Keep fewer messages for public chat
    ttl: 4 * 60 * 60 * 1000, // 4 hours
    persistToStorage: true
  });

  const fetchMessages = useCallback(async (forceRefresh = false) => {
    if (!user) return;

    setLoading(true);

    try {
      // Try to get cached messages first (using a special key for public chat)
      const cachedMessages = publicChatCache.getCachedMessages('public_chat');
      
      if (cachedMessages.length > 0 && !forceRefresh) {
        // Convert cached messages to public messages format
        const publicMessages = cachedMessages.map(msg => ({
          id: msg.id,
          sender_id: msg.sender_id,
          content: msg.content,
          created_at: msg.created_at,
          sender: undefined // Will be fetched if needed
        }));
        
        setMessages(publicMessages);
        setLoading(false);
        
        // Fetch fresh data in background
        setTimeout(() => {
          fetchFreshMessages();
        }, 1000);
      } else {
        await fetchFreshMessages();
      }
    } catch (error) {
      console.error('Error fetching public messages:', error);
      // Fallback to cached data on error
      const cachedMessages = publicChatCache.getCachedMessages('public_chat');
      if (cachedMessages.length > 0) {
        const publicMessages = cachedMessages.map(msg => ({
          id: msg.id,
          sender_id: msg.sender_id,
          content: msg.content,
          created_at: msg.created_at,
          sender: undefined
        }));
        setMessages(publicMessages);
      }
    } finally {
      setLoading(false);
    }
  }, [user, publicChatCache]);

  const fetchFreshMessages = async () => {
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
      
      // Cache the messages (convert to cache format)
      const cachedMessages = messagesData.map(msg => ({
        ...msg,
        conversation_id: 'public_chat', // Special ID for public chat
        delivered_at: null,
        read_at: null,
        message_status: null,
        media_url: null,
        media_type: null,
        story_id: null,
        cached_at: Date.now()
      }));
      
      publicChatCache.setCachedMessages('public_chat', cachedMessages);
    } else {
      setMessages([]);
    }
  };

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

  // Set up real-time subscriptions with connection management
  useEffect(() => {
    if (!user || wsConnection.status === 'disconnected') return;

    const messagesChannelId = 'public_chat_realtime';
    const typingChannelId = 'public_typing';

    const messageHandlers = {
      'postgres_changes:INSERT:public_chat_messages': async (payload: any) => {
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

        // Add to cache
        const cachedMessage = {
          ...newMessage,
          conversation_id: 'public_chat',
          delivered_at: null,
          read_at: null,
          message_status: null,
          media_url: null,
          media_type: null,
          story_id: null,
          cached_at: Date.now()
        };
        publicChatCache.addMessage('public_chat', cachedMessage);

        setMessages(prev => {
          // Avoid duplicates
          if (prev.find(m => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });

        // Show notification for other users' messages (only if not in foreground)
        if (newMessage.sender_id !== user.id && profile && document.hidden) {
          toast({
            title: `Nova mensagem de ${profile.display_name}`,
            description: newMessage.content,
          });
        }
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
    wsConnection.createChannel(messagesChannelId, {}, messageHandlers);
    wsConnection.createChannel(typingChannelId, {}, typingHandlers);

    return () => {
      wsConnection.removeChannel(messagesChannelId);
      wsConnection.removeChannel(typingChannelId);
    };
  }, [user, wsConnection, publicChatCache]);

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
    connectionStatus: wsConnection.status,
    isOnline: wsConnection.isOnline,
    reconnectAttempts: wsConnection.reconnectAttempts,
    reconnectChannels: wsConnection.reconnectChannels
  };
};