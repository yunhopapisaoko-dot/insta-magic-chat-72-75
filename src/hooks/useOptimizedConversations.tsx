import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useConversationsCache } from '@/hooks/useConversationsCache';
import { useDeviceOptimization } from '@/hooks/useDeviceOptimization';
import { useMemoryManager } from '@/hooks/useMemoryManager';
import { useWebSocketConnection } from '@/hooks/useWebSocketConnection';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Conversation } from '@/hooks/useConversations';

interface OptimizedConversationsOptions {
  enablePreloading?: boolean;
  enableBackgroundSync?: boolean;
  maxPreloadCount?: number;
}

export const useOptimizedConversations = (options: OptimizedConversationsOptions = {}) => {
  const {
    enablePreloading = true,
    enableBackgroundSync = true,
    maxPreloadCount = 10
  } = options;

  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Optimization hooks
  const deviceOptimization = useDeviceOptimization();
  const memoryManager = useMemoryManager();
  const wsConnection = useWebSocketConnection({
    enableMobileOptimizations: true,
    maxReconnectAttempts: 5
  });

  // Cache management
  const conversationsCache = useConversationsCache({
    maxConversations: 50,
    ttl: 12 * 60 * 60 * 1000, // 12h
    preloadCount: Math.min(maxPreloadCount, 10),
    enableBackgroundSync
  });

  const fetchTimeoutRef = useRef<NodeJS.Timeout>();
  const backgroundSyncRef = useRef<NodeJS.Timeout>();

  // Fetch single conversation with caching
  const fetchConversation = useCallback(async (conversationId: string): Promise<Conversation | null> => {
    try {
      // Check cache first
      const cached = conversationsCache.getCachedConversation(conversationId);
      if (cached) {
        return cached;
      }

      console.log('Fetching conversation from server:', conversationId);

      // Get conversation participants
      const { data: participants, error: participantsError } = await supabase
        .from('conversation_participants')
        .select(`
          user_id,
          conversations:conversation_id (
            id,
            created_at,
            updated_at
          )
        `)
        .eq('conversation_id', conversationId);

      if (participantsError) throw participantsError;

      const conversation = participants?.[0]?.conversations;
      if (!conversation) return null;

      // Get other participant info
      const otherParticipant = participants?.find(p => p.user_id !== user?.id);
      if (!otherParticipant) return null;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .eq('id', otherParticipant.user_id)
        .single();

      if (profileError) throw profileError;

      // Get last message and unread count
      const [lastMessageQuery, unreadCountQuery] = await Promise.all([
        supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        
        supabase
          .from('messages')
          .select('id')
          .eq('conversation_id', conversationId)
          .neq('sender_id', user?.id)
          .is('read_at', null)
      ]);

      const conversationData: Conversation = {
        id: conversation.id,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        other_user: {
          id: profile.id,
          display_name: profile.display_name,
          username: profile.username,
          avatar_url: profile.avatar_url,
        },
        last_message: lastMessageQuery.data || undefined,
        unread_count: unreadCountQuery.data?.length || 0,
      };

      // Cache the conversation
      conversationsCache.setCachedConversation(conversationData);
      
      return conversationData;
    } catch (error) {
      console.error('Error fetching conversation:', error);
      return null;
    }
  }, [user, conversationsCache]);

  // Optimized fetch with progressive loading
  const fetchConversations = useCallback(async (forceRefresh = false) => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Get from cache first if not forcing refresh
      if (!forceRefresh && conversationsCache.hasCache) {
        const recentIds = conversationsCache.recentConversations.slice(0, 10);
        const cachedConversations = recentIds
          .map(id => conversationsCache.getCachedConversation(id))
          .filter(Boolean) as Conversation[];

        if (cachedConversations.length > 0) {
          setConversations(cachedConversations);
          setLoading(false);
          
          // Fetch fresh data in background
          if (!document.hidden) {
            setTimeout(() => fetchConversations(true), 2000);
          }
          return;
        }
      }

      // Get user's conversation participants
      const { data: participantData, error: participantError } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversations:conversation_id (
            id,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id);

      if (participantError) throw participantError;

      if (!participantData?.length) {
        setConversations([]);
        return;
      }

      const conversationIds = participantData.map(p => p.conversation_id);

      // Progressive loading strategy
      const primaryBatch = conversationIds.slice(0, 10);
      const secondaryBatch = conversationIds.slice(primaryBatch.length);

      // Load primary batch immediately
      const primaryConversations = await Promise.all(
        primaryBatch.map(id => fetchConversation(id))
      );

      const validPrimaryConversations = primaryConversations
        .filter(Boolean) as Conversation[];

      // Sort by last activity
      const sortedPrimary = validPrimaryConversations.sort((a, b) => {
        const aTime = a.last_message?.created_at || a.updated_at;
        const bTime = b.last_message?.created_at || b.updated_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      setConversations(sortedPrimary);
      setLoading(false);

      // Preload secondary batch in background if enabled
      if (enablePreloading &&
          secondaryBatch.length > 0 &&
          !document.hidden) {
        
        conversationsCache.preloadConversations(secondaryBatch, fetchConversation);

        // Load secondary batch progressively
        setTimeout(async () => {
          const secondaryConversations = await Promise.all(
            secondaryBatch.slice(0, 5).map(id => fetchConversation(id))
          );

          const validSecondary = secondaryConversations
            .filter(Boolean) as Conversation[];

          if (validSecondary.length > 0) {
            setConversations(prev => {
              const combined = [...prev, ...validSecondary];
              return combined.sort((a, b) => {
                const aTime = a.last_message?.created_at || a.updated_at;
                const bTime = b.last_message?.created_at || b.updated_at;
                return new Date(bTime).getTime() - new Date(aTime).getTime();
              });
            });
          }
        }, 1000);
      }

    } catch (error) {
      console.error('Error fetching conversations:', error);
      setError('Erro ao carregar conversas');
      
      // Fallback to cached data
      const recentIds = conversationsCache.recentConversations.slice(0, 5);
      const cachedConversations = recentIds
        .map(id => conversationsCache.getCachedConversation(id))
        .filter(Boolean) as Conversation[];

      if (cachedConversations.length > 0) {
        setConversations(cachedConversations);
        toast({
          title: "Modo offline",
          description: "Mostrando conversas em cache. Algumas podem estar desatualizadas.",
          variant: "default"
        });
      }
    } finally {
      setLoading(false);
    }
  }, [user, conversationsCache, fetchConversation, enablePreloading, deviceOptimization]);

  // Real-time subscriptions with optimization
  useEffect(() => {
    if (!user || wsConnection.status === 'disconnected') return;

    const channelId = 'optimized_conversations_realtime';
    
    const handlers = {
      'postgres_changes:INSERT:messages': (payload: any) => {
        console.log('New message - updating conversations');
        
        // Immediate local update for better UX
        const newMessage = payload.new;
        setConversations(prev => prev.map(conv => {
          if (conv.id === newMessage.conversation_id) {
            return {
              ...conv,
              last_message: newMessage,
              unread_count: newMessage.sender_id !== user.id ? 
                conv.unread_count + 1 : conv.unread_count,
              updated_at: newMessage.created_at
            };
          }
          return conv;
        }));

        // Update cache
        conversationsCache.invalidateConversation(newMessage.conversation_id);
        
        // Refresh specific conversation in background
        if (!document.hidden) {
          setTimeout(() => {
            fetchConversation(newMessage.conversation_id);
          }, 500);
        }
      },
      
      'postgres_changes:UPDATE:messages': (payload: any) => {
        console.log('Message updated - refreshing conversations');
        
        // Throttled refresh to avoid too many updates
        if (fetchTimeoutRef.current) {
          clearTimeout(fetchTimeoutRef.current);
        }
        
        fetchTimeoutRef.current = setTimeout(() => {
        if (!document.hidden) {
            fetchConversations();
          }
        }, 2000);
      }
    };

    wsConnection.createChannel(channelId, {}, handlers);

    return () => {
      wsConnection.removeChannel(channelId);
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [user, wsConnection, fetchConversations, fetchConversation, conversationsCache, deviceOptimization]);

  // Background sync listener
  useEffect(() => {
    if (!enableBackgroundSync) return;

    const handleBackgroundSync = (event: CustomEvent) => {
      const { conversationIds } = event.detail;
      console.log('Background sync requested for conversations:', conversationIds);
      
      if (!document.hidden) {
        conversationIds.forEach((id: string) => {
          setTimeout(() => fetchConversation(id), Math.random() * 1000);
        });
      }
    };

    window.addEventListener('conversations-background-sync', handleBackgroundSync as EventListener);
    
    return () => {
      window.removeEventListener('conversations-background-sync', handleBackgroundSync as EventListener);
    };
  }, [enableBackgroundSync, fetchConversation, deviceOptimization]);

  // Memory management
  useEffect(() => {
    const handleMemoryPressure = () => {
      console.log('Memory pressure - cleaning conversations cache');
      conversationsCache.cleanupCache(true);
      
      // Keep only most recent conversations
      setConversations(prev => prev.slice(0, 10));
    };

    // Memory pressure handling simplified
    return () => {};
  }, [memoryManager, conversationsCache]);

  // Initial load
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Create or get conversation with optimization
  const createOrGetConversation = useCallback(async (otherUserId: string, storyId?: string) => {
    if (!user) return null;

    try {
      // Check cache first for existing conversation
      const cachedConversations = conversationsCache.recentConversations
        .map(id => conversationsCache.getCachedConversation(id))
        .filter(Boolean) as Conversation[];

      const existingConversation = cachedConversations.find(
        conv => conv.other_user.id === otherUserId
      );

      if (existingConversation) {
        return existingConversation.id;
      }

      // Check database for existing conversation
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
          const conversationId = otherUserParticipants[0].conversation_id;
          
          // Fetch and cache the conversation
          const conversation = await fetchConversation(conversationId);
          if (conversation) {
            setConversations(prev => {
              const exists = prev.find(c => c.id === conversationId);
              return exists ? prev : [conversation, ...prev];
            });
          }
          
          return conversationId;
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
            story_id: storyId,
            message_status: 'sent'
          });

        if (messageError) console.error('Error sending initial message:', messageError);
      }

      // Refresh conversations to include new one
      await fetchConversations(true);
      return newConv.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      return null;
    }
  }, [user, conversationsCache, fetchConversation, fetchConversations]);

  return {
    conversations,
    loading,
    error,
    fetchConversations,
    createOrGetConversation,
    cacheStats: conversationsCache.getCacheStats(),
    deviceOptimization: {
      isLowEndDevice: false,
      isMobile: true,
      connectionQuality: 'good',
      canPerformBackgroundTask: true
    },
    connectionStatus: wsConnection.status,
    isOnline: wsConnection.isOnline
  };
};
