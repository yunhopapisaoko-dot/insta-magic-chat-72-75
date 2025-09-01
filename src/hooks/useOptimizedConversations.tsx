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
      // Execute all queries in parallel
      const [
        participantData,
        publicChats,
        allMessages,
        allUnreadMessages
      ] = await Promise.all([
        // Get user's conversation participants
        supabase
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
          .eq('user_id', user.id)
          .then(result => ({ data: result.data, error: result.error })),
        
        // Get public chats
        supabase
          .from('conversations')
          .select(`
            id,
            name,
            description,
            photo_url,
            creator_id,
            is_public,
            created_at,
            updated_at
          `)
          .eq('is_public', true)
          .then(result => ({ data: result.data, error: result.error })),

        // Get all messages with sender info in one query
        supabase
          .from('messages')
          .select(`
            id,
            conversation_id,
            content,
            created_at,
            sender_id,
            read_at,
            media_url,
            media_type,
            story_id
          `)
          .order('created_at', { ascending: false })
          .then(result => ({ data: result.data, error: result.error })),

        // Get all unread messages
        supabase
          .from('messages')
          .select('id, conversation_id, sender_id')
          .neq('sender_id', user.id)
          .is('read_at', null)
          .then(result => ({ data: result.data, error: result.error }))
      ]);

      if (participantData.error) throw participantData.error;
      if (publicChats.error) throw publicChats.error;
      if (allMessages.error) throw allMessages.error;
      if (allUnreadMessages.error) throw allUnreadMessages.error;

      // Combine all conversation IDs
      const allConversationIds = new Set([
        ...(participantData.data?.map(p => p.conversation_id) || []),
        ...(publicChats.data?.map(p => p.id) || [])
      ]);

      if (allConversationIds.size === 0) {
        setConversations([]);
        conversationsCache = [];
        lastFetchTime = now;
        return;
      }

      const conversationIds = Array.from(allConversationIds);

      // Get all participants and profiles in parallel
      const [otherParticipants, profilesData] = await Promise.all([
        supabase
          .from('conversation_participants')
          .select('conversation_id, user_id')
          .in('conversation_id', conversationIds)
          .neq('user_id', user.id),
        
        // Get all unique user IDs from messages and participants
        (() => {
          const userIds = new Set<string>();
          allMessages.data?.forEach(msg => userIds.add(msg.sender_id));
          return supabase
            .from('profiles')
            .select('id, display_name, username, avatar_url')
            .in('id', Array.from(userIds));
        })()
      ]);

      if (otherParticipants.error) throw otherParticipants.error;
      if (profilesData.error) throw profilesData.error;

      // Create lookup maps for performance
      const messagesMap: Record<string, any[]> = {};
      const lastMessageMap: Record<string, any> = {};
      const unreadCountMap: Record<string, number> = {};
      const profilesMap = (profilesData.data || []).reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {} as Record<string, any>);

      // Process messages
      (allMessages.data || []).forEach(msg => {
        if (!messagesMap[msg.conversation_id]) {
          messagesMap[msg.conversation_id] = [];
        }
        messagesMap[msg.conversation_id].push(msg);
        
        // Get the latest message for each conversation
        if (!lastMessageMap[msg.conversation_id] || 
            new Date(msg.created_at) > new Date(lastMessageMap[msg.conversation_id].created_at)) {
          lastMessageMap[msg.conversation_id] = msg;
        }
      });

      // Process unread counts
      (allUnreadMessages.data || []).forEach(msg => {
        unreadCountMap[msg.conversation_id] = (unreadCountMap[msg.conversation_id] || 0) + 1;
      });

      // Build conversations list
      const conversationsMap = new Map<string, Conversation>();
      
      // Build conversations from user's private conversations
      (participantData.data || []).forEach((participant) => {
        const conv = participant.conversations;
        if (!conv) return;

        const lastMessage = lastMessageMap[conv.id];
        const otherParticipant = (otherParticipants.data || []).find(
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
              id: 'temp',
              conversation_id: conv.id,
              content: lastMessage.content,
              created_at: lastMessage.created_at,
              sender_id: lastMessage.sender_id,
              media_url: null,
              media_type: null,
              story_id: null,
              read_at: null
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
                id: 'temp',
                conversation_id: conv.id,
                content: lastMessage.content,
                created_at: lastMessage.created_at,
                sender_id: lastMessage.sender_id,
                media_url: null,
                media_type: null,
                story_id: null,
                read_at: null
              } : undefined,
              unread_count: unreadCountMap[conv.id] || 0,
            });
          }
        } else {
          // Solo conversation (user left) - try to find the other user from message history
          const messages = messagesMap[conv.id] || [];
          const otherUserMessage = messages.find(msg => msg.sender_id !== user.id);
          
          if (otherUserMessage) {
            const profile = profilesMap[otherUserMessage.sender_id];
            if (profile) {
              conversationsMap.set(conv.id, {
                id: conv.id,
                created_at: conv.created_at,
                updated_at: conv.updated_at,
                other_user: {
                  id: otherUserMessage.sender_id,
                  display_name: profile.display_name,
                  username: profile.username,
                  avatar_url: profile.avatar_url,
                },
                last_message: lastMessage ? {
                  id: 'temp',
                  conversation_id: conv.id,
                  content: lastMessage.content,
                  created_at: lastMessage.created_at,
                  sender_id: lastMessage.sender_id,
                  media_url: null,
                  media_type: null,
                  story_id: null,
                  read_at: null
                } : undefined,
                unread_count: unreadCountMap[conv.id] || 0,
              });
            }
          } else {
            // Truly new chat without messages
            conversationsMap.set(conv.id, {
              id: conv.id,
              created_at: conv.created_at,
              updated_at: conv.updated_at,
              other_user: {
                id: 'group',
                display_name: 'Novo Chat',
                username: 'new_chat',
                avatar_url: null,
              },
              last_message: lastMessage ? {
                id: 'temp',
                conversation_id: conv.id,
                content: lastMessage.content,
                created_at: lastMessage.created_at,
                sender_id: lastMessage.sender_id,
                media_url: null,
                media_type: null,
                story_id: null,
                read_at: null
              } : undefined,
              unread_count: unreadCountMap[conv.id] || 0,
            });
          }
        }
      });

      // Add public chats that aren't already in user's conversations
      (publicChats.data || []).forEach((publicChat) => {
        if (conversationsMap.has(publicChat.id)) return;

        const lastMessage = lastMessageMap[publicChat.id];
        
        conversationsMap.set(publicChat.id, {
          id: publicChat.id,
          created_at: publicChat.created_at,
          updated_at: publicChat.updated_at,
          other_user: {
            id: 'public',
            display_name: `🌐 ${publicChat.name || 'Chat Público'}`,
            username: 'public_chat',
            avatar_url: publicChat.photo_url,
          },
          last_message: lastMessage ? {
            id: 'temp',
            conversation_id: publicChat.id,
            content: lastMessage.content,
            created_at: lastMessage.created_at,
            sender_id: 'system',
            media_url: null,
            media_type: null,
            story_id: null,
            read_at: null
          } : {
            id: 'temp',
            conversation_id: publicChat.id,
            content: 'Chat público disponível para todos',
            created_at: publicChat.created_at,
            sender_id: 'system',
            media_url: null,
            media_type: null,
            story_id: null,
            read_at: null
          },
          unread_count: unreadCountMap[publicChat.id] || 0,
        });
      });

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
