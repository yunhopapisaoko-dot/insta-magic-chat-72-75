import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Conversation } from '@/hooks/useConversations';

export { type Conversation } from '@/hooks/useConversations';

export const useRealtimeConversations = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) return;

    try {
      // Get user's conversations with enhanced data
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

      // Get other participants for each conversation
      const { data: otherParticipants, error: otherError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', conversationIds)
        .neq('user_id', user.id);

      if (otherError) throw otherError;

      // Get profile data for other participants
      const otherUserIds = otherParticipants?.map(p => p.user_id) || [];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', otherUserIds);

      if (profilesError) throw profilesError;

      // Get last message and unread count for each conversation
      const conversationQueries = conversationIds.map(async (convId) => {
        const [lastMessageQuery, unreadCountQuery] = await Promise.all([
          // Get last message
          supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', convId)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle(),
          
          // Get unread count
          supabase
            .from('messages')
            .select('id')
            .eq('conversation_id', convId)
            .neq('sender_id', user.id)
            .is('read_at', null)
        ]);

        return {
          conversationId: convId,
          lastMessage: lastMessageQuery.data,
          unreadCount: unreadCountQuery.data?.length || 0
        };
      });

      const conversationDetails = await Promise.all(conversationQueries);

      // Build conversations list
      const conversationsMap = new Map<string, Conversation>();
      const profilesMap = profiles?.reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {} as Record<string, any>) || {};
      
      participantData.forEach((participant) => {
        const conv = participant.conversations;
        const otherParticipant = otherParticipants?.find(
          p => p.conversation_id === participant.conversation_id
        );
        
        if (conv && otherParticipant) {
          const profile = profilesMap[otherParticipant.user_id];
          const details = conversationDetails.find(d => d.conversationId === conv.id);
          
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
              last_message: details?.lastMessage || undefined,
              unread_count: details?.unreadCount || 0,
            });
          }
        }
      });

      // Sort by last activity
      const sortedConversations = Array.from(conversationsMap.values())
        .sort((a, b) => {
          const aTime = a.last_message?.created_at || a.updated_at;
          const bTime = b.last_message?.created_at || b.updated_at;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });

      setConversations(sortedConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createOrGetConversation = async (otherUserId: string, storyId?: string) => {
    if (!user) return null;

    try {
      // Check if conversation already exists between these users
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
            story_id: storyId,
            message_status: 'sent'
          });

        if (messageError) console.error('Error sending initial message:', messageError);
      }

      // Refresh conversations list
      await fetchConversations();
      return newConv.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      return null;
    }
  };

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('conversations_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          console.log('New message in conversation:', payload);
          // Refresh conversations to update last message and counts
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          console.log('Message status updated:', payload);
          // Refresh conversations to update unread counts
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          console.log('Conversation updated:', payload);
          // Update specific conversation
          setConversations(prev => prev.map(conv => 
            conv.id === payload.new.id 
              ? { ...conv, updated_at: payload.new.updated_at }
              : conv
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchConversations]);

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return {
    conversations,
    loading,
    fetchConversations,
    createOrGetConversation,
  };
};