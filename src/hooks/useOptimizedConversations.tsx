import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Conversation } from '@/hooks/useConversations';

interface OptimizedConversationsOptions {
  enablePreloading?: boolean;
  enableBackgroundSync?: boolean;
  maxPreloadCount?: number;
}

// Cache para conversas com persistência no localStorage
const CACHE_KEY = 'magic-talk-conversations-cache';
let conversationsCache: Conversation[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 5000; // 5 segundos

// Load cache from localStorage on module load
try {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const { conversations, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < 60000) { // 1 minute validity for localStorage cache
      conversationsCache = conversations;
      lastFetchTime = timestamp;
    }
  }
} catch (error) {
  console.error('Error loading conversations cache:', error);
}

// Save cache to localStorage
const saveCache = (conversations: Conversation[]) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      conversations,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error('Error saving conversations cache:', error);
  }
};

export const useOptimizedConversations = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Otimized fetch with cache and parallel queries
  const fetchConversations = useCallback(async (useCache: boolean = true) => {
    if (!user) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const now = Date.now();
    
    // Use cache if available and recent
    if (useCache && conversationsCache.length > 0 && (now - lastFetchTime) < CACHE_DURATION) {
      setConversations(conversationsCache);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Simplified: Just get user's conversations first
      const { data: participantData, error: participantError } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversations:conversation_id (
            id,
            name,
            description,
            photo_url,
            creator_id,
            is_public,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id);

      if (participantError) throw participantError;

      if (!participantData?.length) {
        setConversations([]);
        conversationsCache = [];
        lastFetchTime = now;
        return;
      }

      const conversationIds = participantData.map(p => p.conversation_id);

      
      // Get other participants only for user's conversations (much simpler)
      const { data: otherParticipants, error: participantsError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', conversationIds)
        .neq('user_id', user.id);

      if (participantsError) throw participantsError;

      // Get unique user IDs from participants
      const userIds = [...new Set(otherParticipants?.map(p => p.user_id) || [])];
      
      let profilesData: any = { data: [], error: null };
      if (userIds.length > 0) {
        profilesData = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .in('id', userIds);
      }

      if (profilesData.error) throw profilesData.error;

      // Simplified message fetching - just get latest per conversation
      const messagesPromises = conversationIds.map(async (convId) => {
        const { data: lastMessage } = await supabase
          .from('messages')
          .select('id, conversation_id, content, created_at, sender_id, read_at, media_url, media_type, story_id')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        const { data: unreadMessages } = await supabase
          .from('messages')
          .select('id')
          .eq('conversation_id', convId)
          .neq('sender_id', user.id)
          .is('read_at', null);

        return {
          conversationId: convId,
          lastMessage,
          unreadCount: unreadMessages?.length || 0
        };
      });

      const conversationDetails = await Promise.all(messagesPromises);

      // Create lookup maps for performance
      const profilesMap = (profilesData.data || []).reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {} as Record<string, any>);

      const lastMessageMap: Record<string, any> = {};
      const unreadCountMap: Record<string, number> = {};
      
      conversationDetails.forEach(detail => {
        if (detail.lastMessage) {
          lastMessageMap[detail.conversationId] = detail.lastMessage;
        }
        unreadCountMap[detail.conversationId] = detail.unreadCount;
      });

      // Build conversations list (simplified)
      const conversationsMap = new Map<string, Conversation>();
      
      // Build conversations from user's private conversations
      for (const participant of (participantData || [])) {
        const conv = participant.conversations;
        if (!conv) continue;

        const lastMessage = lastMessageMap[conv.id];
        const otherParticipant = (otherParticipants || []).find(
          p => p.conversation_id === participant.conversation_id
        );
        
        // Check if this is a group with custom name (private group)
        if (conv.name) {
          // This is a group with custom name and potentially custom photo
          conversationsMap.set(conv.id, {
            id: conv.id,
            created_at: conv.created_at,
            updated_at: conv.updated_at,
            other_user: {
              id: 'group',
              display_name: conv.name,
              username: conv.description || 'Grupo privado',
              avatar_url: conv.photo_url,
            },
            last_message: lastMessage ? {
              id: lastMessage.id,
              conversation_id: conv.id,
              content: lastMessage.content,
              created_at: lastMessage.created_at,
              sender_id: lastMessage.sender_id,
              media_url: lastMessage.media_url,
              media_type: lastMessage.media_type,
              story_id: lastMessage.story_id,
              read_at: lastMessage.read_at
            } : undefined,
            unread_count: unreadCountMap[conv.id] || 0,
          });
        } else if (otherParticipant) {
          // Regular 1-on-1 conversation with other participants
          const profile = profilesMap[otherParticipant.user_id];
          
          if (profile) {
            conversationsMap.set(conv.id, {
              id: conv.id,
              created_at: conv.created_at,
              updated_at: conv.updated_at,
              other_user: {
                id: otherParticipant.user_id,
                display_name: profile.display_name,
                username: profile.username,
                avatar_url: profile.avatar_url,
              },
              last_message: lastMessage ? {
                id: lastMessage.id,
                conversation_id: conv.id,
                content: lastMessage.content,
                created_at: lastMessage.created_at,
                sender_id: lastMessage.sender_id,
                media_url: lastMessage.media_url,
                media_type: lastMessage.media_type,
                story_id: lastMessage.story_id,
                read_at: lastMessage.read_at
              } : undefined,
              unread_count: unreadCountMap[conv.id] || 0,
            });
          } else {
            // Profile not found, fetch it directly
            try {
              const { data: directProfile } = await supabase
                .from('profiles')
                .select('id, display_name, username, avatar_url')
                .eq('id', otherParticipant.user_id)
                .maybeSingle();
              
              if (directProfile) {
                conversationsMap.set(conv.id, {
                  id: conv.id,
                  created_at: conv.created_at,
                  updated_at: conv.updated_at,
                  other_user: {
                    id: otherParticipant.user_id,
                    display_name: directProfile.display_name,
                    username: directProfile.username,
                    avatar_url: directProfile.avatar_url,
                  },
                  last_message: lastMessage ? {
                    id: lastMessage.id,
                    conversation_id: conv.id,
                    content: lastMessage.content,
                    created_at: lastMessage.created_at,
                    sender_id: lastMessage.sender_id,
                    media_url: lastMessage.media_url,
                    media_type: lastMessage.media_type,
                    story_id: lastMessage.story_id,
                    read_at: lastMessage.read_at
                  } : undefined,
                  unread_count: unreadCountMap[conv.id] || 0,
                });
              }
            } catch (err) {
              console.error('Error fetching profile:', err);
            }
          }
        }
      }

      
      // Sort by last activity and cache
      const sortedConversations = Array.from(conversationsMap.values())
        .sort((a, b) => {
          const aTime = a.last_message?.created_at || a.updated_at;
          const bTime = b.last_message?.created_at || b.updated_at;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });

      // Clear old cache and update with new data
      localStorage.removeItem(CACHE_KEY);
      conversationsCache = sortedConversations;
      lastFetchTime = now;
      saveCache(sortedConversations);
      
      setConversations(sortedConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setError('Erro ao carregar conversas');
      
      // Don't show toast if we have cached data
      if (conversationsCache.length === 0) {
        toast({
          title: "Erro",
          description: "Não foi possível carregar as conversas. Tente novamente.",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial load and realtime setup with instant cache loading
  useEffect(() => {
    if (!user?.id) {
      console.log('No user ID available, skipping conversations setup');
      return;
    }
    
    console.log('Setting up conversations for user:', user.id);
    
    // Load from cache immediately if available
    if (conversationsCache.length > 0) {
      setConversations(conversationsCache);
      setLoading(false);
    }
    
    // Then fetch fresh data
    fetchConversations(false); // Don't use cache for initial load

    // Set up optimized realtime with incremental updates
    const conversationsChannel = supabase
      .channel(`conversations-user-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          console.log('New message:', payload);
          // Update conversations incrementally instead of full refetch
          const message = payload.new as any;
          setConversations(prev => {
            const updated = prev.map(conv => {
              if (conv.id === message.conversation_id) {
                return {
                  ...conv,
                  last_message: {
                    id: message.id,
                    conversation_id: message.conversation_id,
                    content: message.content,
                    created_at: message.created_at,
                    sender_id: message.sender_id,
                    media_url: message.media_url,
                    media_type: message.media_type,
                    story_id: message.story_id,
                    read_at: message.read_at
                  },
                  unread_count: message.sender_id === user.id ? conv.unread_count : conv.unread_count + 1,
                  updated_at: message.created_at
                };
              }
              return conv;
            });
            
            // Update cache
            conversationsCache = updated;
            saveCache(updated);
            return updated.sort((a, b) => {
              const aTime = a.last_message?.created_at || a.updated_at;
              const bTime = b.last_message?.created_at || b.updated_at;
              return new Date(bTime).getTime() - new Date(aTime).getTime();
            });
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          console.log('Message update:', payload);
          const message = payload.new as any;
          // Update read status
          if (message.read_at) {
            setConversations(prev => {
              const updated = prev.map(conv => {
                if (conv.id === message.conversation_id) {
                  return {
                    ...conv,
                    unread_count: Math.max(0, conv.unread_count - 1)
                  };
                }
                return conv;
              });
              conversationsCache = updated;
              saveCache(updated);
              return updated;
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },
        () => {
          // Only refetch for conversation changes (new chats, etc)
          setTimeout(() => fetchConversations(false), 500);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_participants'
        },
        () => {
          // Only refetch for participant changes
          setTimeout(() => fetchConversations(false), 500);
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      console.log('Cleaning up realtime subscription');
      supabase.removeChannel(conversationsChannel);
    };
  }, [user?.id]); // Removed fetchConversations dependency to avoid loops


  // Create or get conversation simplified
  const createOrGetConversation = useCallback(async (otherUserId: string, storyId?: string) => {
    if (!user) return null;

    try {
      // Check for existing conversation
      const { data: existingParticipants, error: checkError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (checkError) throw checkError;

      if (existingParticipants?.length) {
        const conversationIds = existingParticipants.map(p => p.conversation_id);
        
        const { data: otherUserParticipants, error: otherCheckError } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', otherUserId)
          .in('conversation_id', conversationIds);

        if (otherCheckError) throw otherCheckError;

        if (otherUserParticipants?.length) {
          return otherUserParticipants[0].conversation_id;
        }
      }

      // Create new conversation
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({})
        .select()
        .single();

      if (convError) throw convError;

      // Add participants
      const { error: participantsError } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: newConv.id, user_id: user.id },
          { conversation_id: newConv.id, user_id: otherUserId }
        ]);

      if (participantsError) throw participantsError;

      // Add initial message if story context
      if (storyId) {
        const { error: messageError } = await supabase
          .from('messages')
          .insert({
            conversation_id: newConv.id,
            sender_id: user.id,
            content: 'Oi! Vi seu story 👋',
            story_id: storyId
          });

        if (messageError) console.error('Error sending initial message:', messageError);
      }

      // Refresh conversations to include new one
      await fetchConversations(false); // Don't use cache for new conversations
      return newConv.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      return null;
    }
  }, [user, fetchConversations]);

  // Function to mark messages as read
  const markMessagesAsRead = useCallback(async (conversationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .is('read_at', null);

      if (error) throw error;
      
      // Update conversations locally to reflect the change immediately
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, unread_count: 0 }
          : conv
      ));
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [user]);

  return {
    conversations,
    loading,
    error,
    fetchConversations,
    createOrGetConversation,
    markMessagesAsRead
  };
};
