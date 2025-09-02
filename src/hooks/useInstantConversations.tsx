import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Conversation } from '@/hooks/useConversations';

// Instant loading cache
const INSTANT_CACHE_KEY = 'instant_conversations';
let instantCache: Conversation[] = [];
let cacheTimestamp = 0;

// Load cache immediately on module load
try {
  const cached = localStorage.getItem(INSTANT_CACHE_KEY);
  if (cached) {
    const data = JSON.parse(cached);
    if (Date.now() - data.timestamp < 300000) { // 5 minutes
      instantCache = data.conversations;
      cacheTimestamp = data.timestamp;
    }
  }
} catch (error) {
  console.error('Cache load error:', error);
}

export const useInstantConversations = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>(instantCache);
  const [loading, setLoading] = useState(instantCache.length === 0);
  const [error, setError] = useState<string | null>(null);

  const saveToCache = useCallback((convs: Conversation[]) => {
    try {
      localStorage.setItem(INSTANT_CACHE_KEY, JSON.stringify({
        conversations: convs,
        timestamp: Date.now()
      }));
      instantCache = convs;
      cacheTimestamp = Date.now();
    } catch (error) {
      console.error('Cache save error:', error);
    }
  }, []);

  const fetchConversationsManual = useCallback(async (silent = false) => {
    if (!user) return;

    try {
      // Get user's conversations with group info
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversations:conversation_id (
            id,
            name,
            description,
            photo_url,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id);

      if (conversationsError) throw conversationsError;

      if (!conversationsData?.length) {
        setConversations([]);
        saveToCache([]);
        return;
      }

      const conversationIds = conversationsData.map(p => p.conversation_id);

      // Batch all queries in parallel
      const [otherParticipants, lastMessages, unreadCounts, profiles] = await Promise.all([
        // Get other participants
        supabase
          .from('conversation_participants')
          .select('conversation_id, user_id')
          .in('conversation_id', conversationIds)
          .neq('user_id', user.id),
        
        // Get latest message for each conversation
        supabase
          .from('messages')
          .select('*')
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false }),
        
        // Get unread counts
        supabase
          .from('messages')
          .select('conversation_id')
          .in('conversation_id', conversationIds)
          .neq('sender_id', user.id)
          .is('read_at', null),

        // Get all profiles we'll need
        supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
      ]);

      // Process data efficiently
      const participantsMap = new Map();
      otherParticipants.data?.forEach(p => {
        participantsMap.set(p.conversation_id, p.user_id);
      });

      const profilesMap = new Map();
      profiles.data?.forEach(p => {
        profilesMap.set(p.id, p);
      });

      const lastMessageMap = new Map();
      lastMessages.data?.forEach(msg => {
        if (!lastMessageMap.has(msg.conversation_id)) {
          lastMessageMap.set(msg.conversation_id, msg);
        }
      });

      const unreadCountMap = new Map();
      unreadCounts.data?.forEach(msg => {
        const count = unreadCountMap.get(msg.conversation_id) || 0;
        unreadCountMap.set(msg.conversation_id, count + 1);
      });

      // Build conversations
      const conversations: Conversation[] = conversationsData
        .map(participant => {
          const conv = participant.conversations;
          if (!conv) return null;

          // Check if this is a group conversation with custom name
          if (conv.name) {
            const lastMessage = lastMessageMap.get(conv.id);
            const unreadCount = unreadCountMap.get(conv.id) || 0;

            return {
              id: conv.id,
              created_at: conv.created_at,
              updated_at: conv.updated_at,
              other_user: {
                id: 'group',
                display_name: conv.name,
                username: conv.description || 'Grupo',
                avatar_url: conv.photo_url,
              },
              last_message: lastMessage ? {
                id: lastMessage.id,
                conversation_id: lastMessage.conversation_id,
                content: lastMessage.content,
                created_at: lastMessage.created_at,
                sender_id: lastMessage.sender_id,
                media_url: lastMessage.media_url,
                media_type: lastMessage.media_type,
                story_id: lastMessage.story_id,
                read_at: lastMessage.read_at
              } : undefined,
              unread_count: unreadCount,
            };
          }

          // Regular 1-on-1 conversation
          const otherUserId = participantsMap.get(conv.id);
          if (!otherUserId) return null;

          const profile = profilesMap.get(otherUserId);
          if (!profile) return null;

          const lastMessage = lastMessageMap.get(conv.id);
          const unreadCount = unreadCountMap.get(conv.id) || 0;

          return {
            id: conv.id,
            created_at: conv.created_at,
            updated_at: conv.updated_at,
            other_user: {
              id: otherUserId,
              display_name: profile.display_name,
              username: profile.username,
              avatar_url: profile.avatar_url,
            },
            last_message: lastMessage ? {
              id: lastMessage.id,
              conversation_id: lastMessage.conversation_id,
              content: lastMessage.content,
              created_at: lastMessage.created_at,
              sender_id: lastMessage.sender_id,
              media_url: lastMessage.media_url,
              media_type: lastMessage.media_type,
              story_id: lastMessage.story_id,
              read_at: lastMessage.read_at
            } : undefined,
            unread_count: unreadCount,
          };
        })
        .filter(Boolean) as Conversation[];

      // Sort by last activity
      conversations.sort((a, b) => {
        const aTime = a.last_message?.created_at || a.updated_at;
        const bTime = b.last_message?.created_at || b.updated_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      setConversations(conversations);
      saveToCache(conversations);
    } catch (error) {
      console.error('Manual fetch error:', error);
      if (!silent && instantCache.length === 0) {
        setError('Erro ao carregar conversas');
      }
    }
  }, [user, saveToCache]);

  const fetchConversations = useCallback(async (silent = false) => {
    if (!user) {
      setConversations([]);
      setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
    setError(null);

    try {
      // Direct optimized manual query - faster and more reliable
      await fetchConversationsManual(silent);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      if (!silent && instantCache.length === 0) {
        setError('Erro ao carregar conversas');
      }
    } finally {
      setLoading(false);
    }
  }, [user, fetchConversationsManual]);

  const markMessagesAsRead = useCallback(async (conversationId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .is('read_at', null);

      // Update local state immediately
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, unread_count: 0 }
          : conv
      ));
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [user]);

  // Instant setup
  useEffect(() => {
    if (!user?.id) return;

    // Use cache immediately
    if (instantCache.length > 0) {
      setConversations(instantCache);
      setLoading(false);
      // Background refresh
      setTimeout(() => fetchConversations(true), 50);
    } else {
      fetchConversations(false);
    }

    // Realtime updates
    const channel = supabase
      .channel(`fast-conversations-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages'
      }, () => {
        // Immediate refresh on any message change
        fetchConversations(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchConversations]);

  const createOrGetConversation = useCallback(async (otherUserId: string, storyId?: string) => {
    if (!user) return null;

    try {
      // Check for existing conversation first (optimized)
      const { data: existingConvs } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (existingConvs?.length) {
        const convIds = existingConvs.map(c => c.conversation_id);
        const { data: otherConvs } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', otherUserId)
          .in('conversation_id', convIds);

        if (otherConvs?.length) {
          // Check if it's a private 1-on-1 conversation
          for (const conv of otherConvs) {
            const { data: participants } = await supabase
              .from('conversation_participants')
              .select('user_id')
              .eq('conversation_id', conv.conversation_id);

            if (participants?.length === 2) {
              return conv.conversation_id;
            }
          }
        }
      }

      // Create new conversation
      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({})
        .select()
        .single();

      if (error) throw error;

      // Add participants
      await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: newConv.id, user_id: user.id },
          { conversation_id: newConv.id, user_id: otherUserId }
        ]);

      // Add initial message if from story
      if (storyId) {
        await supabase
          .from('messages')
          .insert({
            conversation_id: newConv.id,
            sender_id: user.id,
            content: 'Oi! Vi seu story 👋',
            story_id: storyId,
            message_status: 'sent'
          });
      }

      // Update cache immediately with new conversation
      const { data: otherProfile } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .eq('id', otherUserId)
        .single();

      if (otherProfile) {
        const newConversation: Conversation = {
          id: newConv.id,
          created_at: newConv.created_at,
          updated_at: newConv.updated_at,
          other_user: {
            id: otherProfile.id,
            display_name: otherProfile.display_name,
            username: otherProfile.username,
            avatar_url: otherProfile.avatar_url,
          },
          last_message: storyId ? {
            id: '',
            conversation_id: newConv.id,
            content: 'Oi! Vi seu story 👋',
            created_at: new Date().toISOString(),
            sender_id: user.id,
            media_url: null,
            media_type: null,
            story_id: storyId,
            read_at: null
          } : undefined,
          unread_count: 0,
        };

        setConversations(prev => [newConversation, ...prev]);
        saveToCache([newConversation, ...conversations]);
      }

      return newConv.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      return null;
    }
  }, [user, conversations, saveToCache]);

  return {
    conversations,
    loading,
    error,
    fetchConversations,
    markMessagesAsRead,
    createOrGetConversation,
  };
};