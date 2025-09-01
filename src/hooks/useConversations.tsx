import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  story_id: string | null;
  created_at: string;
  read_at: string | null;
  sender?: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
}

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  other_user: {
    id: string;
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
  last_message?: Message;
  unread_count: number;
}

export const useConversations = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    if (!user) return;

    try {
      // Get user's conversations
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
            .order('created_at', { ascending: false })
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
        acc[profile.id] = {
          display_name: profile.display_name,
          username: profile.username,
          avatar_url: profile.avatar_url,
        };
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
  };

  const createOrGetConversation = async (otherUserId: string, storyId?: string) => {
    console.log('createOrGetConversation called with:', { otherUserId, storyId, currentUser: user?.id });
    
    if (!user) {
      console.error('No user available for conversation creation');
      return null;
    }

    try {
      // Check if conversation already exists
      console.log('Checking for existing conversations...');
      const { data: existingParticipants, error: checkError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (checkError) {
        console.error('Error checking existing participants:', checkError);
        throw checkError;
      }

      console.log('Existing participants for current user:', existingParticipants);

      if (existingParticipants?.length) {
        const conversationIds = existingParticipants.map(p => p.conversation_id);
        console.log('Found conversation IDs for current user:', conversationIds);
        
        const { data: otherUserParticipants, error: otherCheckError } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', otherUserId)
          .in('conversation_id', conversationIds);

        if (otherCheckError) {
          console.error('Error checking other user participants:', otherCheckError);
          throw otherCheckError;
        }

        console.log('Other user participants in same conversations:', otherUserParticipants);

        if (otherUserParticipants?.length) {
          console.log('Found existing conversation:', otherUserParticipants[0].conversation_id);
          return otherUserParticipants[0].conversation_id;
        }
      }

      // Create new conversation
      console.log('Creating new conversation...');
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({})
        .select()
        .single();

      if (convError) {
        console.error('Error creating conversation:', convError);
        throw convError;
      }

      console.log('New conversation created:', newConv);

      // Add participants
      console.log('Adding participants to conversation...');
      const { error: participantsError } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: newConv.id, user_id: user.id },
          { conversation_id: newConv.id, user_id: otherUserId }
        ]);

      if (participantsError) {
        console.error('Error adding participants:', participantsError);
        throw participantsError;
      }

      console.log('Participants added successfully');

      // Add initial message if story context
      if (storyId) {
        console.log('Adding initial story message...');
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

      console.log('Refreshing conversations list...');
      fetchConversations();
      console.log('Returning new conversation ID:', newConv.id);
      return newConv.id;
    } catch (error) {
      console.error('Error in createOrGetConversation:', error);
      return null;
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [user]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('conversations')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
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
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    conversations,
    loading,
    fetchConversations,
    createOrGetConversation,
  };
};