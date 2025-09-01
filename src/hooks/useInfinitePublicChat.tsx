import { useState, useEffect, useCallback, useRef } from 'react';
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

interface TypingUser {
  user_id: string;
  display_name: string;
  is_typing: boolean;
}

interface UseInfinitePublicChatOptions {
  pageSize?: number;
  enableAutoScroll?: boolean;
}

export const useInfinitePublicChat = (options: UseInfinitePublicChatOptions = {}) => {
  const { pageSize = 20, enableAutoScroll = true } = options;
  const { user } = useAuth();
  
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  const scrollElementRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);
  const isInitialLoadRef = useRef(true);

  // Fetch messages with pagination
  const fetchMessages = useCallback(async (cursor?: string, append = false) => {
    if (!user) return;

    try {
      const query = supabase
        .from('public_chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(pageSize);

      if (cursor) {
        query.lt('created_at', cursor);
      }

      const { data: messagesData, error } = await query;
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

        // Add sender info to messages (keep DESC order for now)
        const messagesWithSenders = messagesData.map(message => ({
          ...message,
          sender: profilesMap[message.sender_id]
        }));

        if (append) {
          setMessages(prev => {
            // Reverse new messages to maintain chronological order when prepending
            const reversedNew = [...messagesWithSenders].reverse();
            return [...reversedNew, ...prev];
          });
        } else {
          // Reverse for chronological order (oldest first)
          setMessages([...messagesWithSenders].reverse());
        }

        setHasMore(messagesData.length === pageSize);
      } else {
        if (!append) {
          setMessages([]);
        }
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error fetching public messages:', error);
      toast({
        title: "Erro ao carregar mensagens",
        description: "Não foi possível carregar as mensagens.",
        variant: "destructive",
      });
    }
  }, [user, pageSize]);

  // Load more messages (older ones)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;

    setLoadingMore(true);
    try {
      const oldestMessage = messages[0];
      await fetchMessages(oldestMessage.created_at, true);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, messages, fetchMessages]);

  // Send message
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

  // Send typing indicator
  const sendTypingIndicator = useCallback(async (isTyping: boolean) => {
    if (!user) return;

    console.log('Sending typing indicator:', { isTyping, userId: user.id, displayName: user.display_name });

    try {
      const channel = supabase.channel('public_chat_typing');
      await channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          user_id: user.id,
          display_name: user.display_name,
          is_typing: isTyping
        }
      });
      console.log('Typing indicator sent successfully');
    } catch (error) {
      console.error('Error sending typing indicator:', error);
    }
  }, [user]);

  // Fetch user profile
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

  // Auto-scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    if (scrollElementRef.current) {
      scrollElementRef.current.scrollTo({
        top: scrollElementRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  }, []);

  // Check if user is near bottom
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const threshold = 100;
    const isNear = element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
    setIsNearBottom(isNear);

    // Load more when near top
    if (element.scrollTop < 100 && hasMore && !loadingMore) {
      loadMore();
    }
  }, [hasMore, loadingMore, loadMore]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const messagesChannel = supabase
      .channel('infinite_public_chat')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'public_chat_messages',
        },
        async (payload) => {
          const newMessage = payload.new as PublicMessage;
          console.log('Nova mensagem pública recebida (infinito):', {
            content: newMessage.content,
            time: new Date(newMessage.created_at).toLocaleTimeString(),
            sender: newMessage.sender_id === user?.id ? 'eu' : 'outro'
          });
          
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
            const updated = [...prev, newMessage].sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            
            console.log('Chat público (infinito) após ordenação:', updated.slice(-5).map((m, index) => ({
              index,
              time: new Date(m.created_at).toLocaleTimeString(),
              content: m.content?.slice(0, 20) || 'media',
              sender: m.sender_id === user?.id ? 'eu' : 'outro'
            })));
            
            return updated;
          });
        }
      )
      .subscribe();

    // Typing indicator subscription
    const typingChannel = supabase
      .channel('public_chat_typing')
      .on(
        'broadcast',
        { event: 'typing' },
        (payload) => {
          console.log('Typing event received:', payload);
          const { user_id, display_name, is_typing } = payload.payload;
          
          if (user_id === user.id) {
            console.log('Ignoring own typing indicator');
            return; // Ignore own typing
          }
          
          console.log('Processing typing from user:', { user_id, display_name, is_typing });
          
          setTypingUsers(prev => {
            const filtered = prev.filter(u => u.user_id !== user_id);
            
            if (is_typing) {
              const newTypingUsers = [...filtered, { user_id, display_name, is_typing }];
              console.log('Updated typing users (adding):', newTypingUsers);
              return newTypingUsers;
            }
            
            console.log('Updated typing users (removing):', filtered);
            return filtered;
          });

          // Clear typing after timeout
          if (is_typing) {
            setTimeout(() => {
              console.log('Clearing typing indicator after timeout for user:', user_id);
              setTypingUsers(prev => prev.filter(u => u.user_id !== user_id));
            }, 5000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(typingChannel);
    };
  }, [user]);

  // Auto-scroll effect for new messages - DISABLED for static behavior
  // Auto-scroll to bottom only on initial load - start from bottom
  useEffect(() => {
    if (messages.length > lastMessageCountRef.current) {
      lastMessageCountRef.current = messages.length;

      if (isInitialLoadRef.current && messages.length > 0) {
        // Only scroll to bottom on initial load, no animation
        setTimeout(() => scrollToBottom(false), 100);
        isInitialLoadRef.current = false;
      }
      // No auto-scroll for new messages to keep screen position fixed
    }
  }, [messages.length, scrollToBottom]);

  // Initial load
  useEffect(() => {
    if (user) {
      setLoading(true);
      Promise.all([
        fetchMessages(),
        fetchUserProfile()
      ]).finally(() => {
        setLoading(false);
      });
    }
  }, [user, fetchMessages, fetchUserProfile]);

  return {
    messages,
    loading,
    loadingMore,
    sending,
    hasMore,
    userProfile,
    isNearBottom,
    typingUsers,
    sendMessage,
    sendTypingIndicator,
    loadMore,
    scrollToBottom,
    scrollElementRef,
    handleScroll,
  };
};
