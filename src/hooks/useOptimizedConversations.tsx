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

export const useOptimizedConversations = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simple fetch conversations without complex optimizations
  const fetchConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get user's private conversation participants
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

      // Get all public chats for all users
      const { data: publicChats, error: publicError } = await supabase
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
        .eq('is_public', true);

      if (publicError) throw publicError;

      // Combine participant conversations with public chats
      const allConversationIds = new Set([
        ...(participantData?.map(p => p.conversation_id) || []),
        ...(publicChats?.map(p => p.id) || [])
      ]);

      if (allConversationIds.size === 0) {
        setConversations([]);
        return;
      }

      const conversationIds = Array.from(allConversationIds);

      // Get other participants for each conversation
      const { data: otherParticipants, error: otherError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', conversationIds)
        .neq('user_id', user.id);

      if (otherError) throw otherError;

      // Get profile data for other participants (if any)
      const otherUserIds = otherParticipants?.map(p => p.user_id) || [];
      let profiles: any[] = [];
      
      if (otherUserIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .in('id', otherUserIds);

        if (profilesError) throw profilesError;
        profiles = profilesData || [];
      }

      // Get last messages for each conversation to identify chat names
      const lastMessagePromises = conversationIds.map(async (convId) => {
        const { data: lastMessageData, error } = await supabase
          .from('messages')
          .select('conversation_id, content, created_at, sender_id')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
          
        if (error) {
          console.error('Error fetching last message for conversation:', convId, error);
          return { conversationId: convId, lastMessage: null };
        }
        
        return { 
          conversationId: convId, 
          lastMessage: lastMessageData 
        };
      });

      const lastMessagesResults = await Promise.all(lastMessagePromises);
      const lastMessageMap = lastMessagesResults.reduce((acc, result) => {
        if (result.lastMessage) {
          acc[result.conversationId] = result.lastMessage;
        }
        return acc;
      }, {} as Record<string, any>);

      // Get unread count for each conversation
      const unreadCountMap: Record<string, number> = {};
      for (const convId of conversationIds) {
        const { data: unreadMessages, error: unreadError } = await supabase
          .from('messages')
          .select('id')
          .eq('conversation_id', convId)
          .neq('sender_id', user.id)
          .is('read_at', null);

        if (unreadError) {
          console.error('Error fetching unread count:', unreadError);
          unreadCountMap[convId] = 0;
        } else {
          unreadCountMap[convId] = unreadMessages?.length || 0;
        }
      }

      // Build conversations list
      const conversationsMap = new Map<string, Conversation>();
      const profilesMap = profiles.reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {} as Record<string, any>);
      
      // Build conversations from user's private conversations
      participantData?.forEach((participant) => {
        const conv = participant.conversations;
        if (!conv) return;

        const lastMessage = lastMessageMap[conv.id];
        const otherParticipant = otherParticipants?.find(
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
          // Solo conversation (newly created chat without other participants yet)
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
      });

      // Add public chats that aren't already in user's conversations
      publicChats?.forEach((publicChat) => {
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

      // Sort by last activity
      const sortedConversations = Array.from(conversationsMap.values())
        .sort((a, b) => {
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });

      setConversations(sortedConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setError('Erro ao carregar conversas');
      
      toast({
        title: "Erro",
        description: "Não foi possível carregar as conversas. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial load and realtime setup
  useEffect(() => {
    if (!user?.id) {
      console.log('No user ID available, skipping conversations setup');
      return;
    }
    
    console.log('Setting up conversations for user:', user.id);
    
    // Add small delay to ensure user is fully loaded
    const timer = setTimeout(() => {
      fetchConversations();
    }, 100);

    // Set up realtime subscriptions with more specific channel name
    const conversationsChannel = supabase
      .channel(`conversations-user-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },
        (payload) => {
          console.log('Conversation change:', payload);
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_participants'
        },
        (payload) => {
          console.log('Participants change:', payload);
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          console.log('Profile update:', payload);
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          console.log('New message:', payload);
          // Refresh conversations when new messages arrive to update unread counts
          fetchConversations();
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
          // Refresh conversations when messages are marked as read
          fetchConversations();
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      console.log('Cleaning up realtime subscription');
      clearTimeout(timer);
      supabase.removeChannel(conversationsChannel);
    };
  }, [fetchConversations, user?.id]);


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
      await fetchConversations();
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
