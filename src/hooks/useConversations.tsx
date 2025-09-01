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
  message_type?: string;
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

      // Get other participants for each conversation (only active participants)
      const { data: otherParticipants, error: otherError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', conversationIds)
        .neq('user_id', user.id);

      if (otherError) throw otherError;

      // For conversations without other participants (when they left), get from messages
      const conversationsWithoutParticipants = conversationIds.filter(convId => 
        !otherParticipants?.some(p => p.conversation_id === convId)
      );

      let additionalUserIds: string[] = [];
      if (conversationsWithoutParticipants.length > 0) {
        const { data: messages } = await supabase
          .from('messages')
          .select('sender_id')
          .in('conversation_id', conversationsWithoutParticipants)
          .neq('sender_id', user.id)
          .not('message_type', 'eq', 'system');

        if (messages) {
          additionalUserIds = [...new Set(messages.map(m => m.sender_id))];
        }
      }

      // Get profile data for all participants (active and those who left)
      const allUserIds = [...new Set([
        ...(otherParticipants?.map(p => p.user_id) || []),
        ...additionalUserIds
      ])];
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', allUserIds);

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
      
      for (const participant of participantData) {
        const conv = participant.conversations;
        if (!conv) continue;

        // Try to find active participant first
        let otherUserId: string | null = null;
        const otherParticipant = otherParticipants?.find(
          p => p.conversation_id === participant.conversation_id
        );
        
        if (otherParticipant) {
          otherUserId = otherParticipant.user_id;
        } else {
          // If no active participant, get from message history to find who the other user was
          const { data: messages } = await supabase
            .from('messages')
            .select('sender_id')
            .eq('conversation_id', participant.conversation_id)
            .neq('sender_id', user.id)
            .not('message_type', 'eq', 'system')
            .order('created_at', { ascending: false })
            .limit(10);
          
          if (messages && messages.length > 0) {
            // Get the most frequent sender (the other user)
            const senderCounts = messages.reduce((acc, msg) => {
              acc[msg.sender_id] = (acc[msg.sender_id] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);
            
            otherUserId = Object.keys(senderCounts).reduce((a, b) => 
              senderCounts[a] > senderCounts[b] ? a : b
            );
          }
        }

        if (otherUserId) {
          const profile = profilesMap[otherUserId];
          const details = conversationDetails.find(d => d.conversationId === conv.id);
          
          // If profile is not found, try to get it directly from database
          let finalProfile = profile;
          if (!profile) {
            const { data: directProfile } = await supabase
              .from('profiles')
              .select('id, display_name, username, avatar_url')
              .eq('id', otherUserId)
              .maybeSingle();
            
            if (directProfile) {
              finalProfile = {
                display_name: directProfile.display_name,
                username: directProfile.username,
                avatar_url: directProfile.avatar_url,
              };
            }
          }
          
          if (finalProfile) {
            conversationsMap.set(conv.id, {
              id: conv.id,
              created_at: conv.created_at,
              updated_at: conv.updated_at,
              other_user: {
                id: otherUserId,
                display_name: finalProfile.display_name,
                username: finalProfile.username,
                avatar_url: finalProfile.avatar_url,
              },
              last_message: details?.lastMessage || undefined,
              unread_count: details?.unreadCount || 0,
            });
          }
        }
      }

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
      // First check if conversation exists (even if user left)
      const { data: allConversations } = await supabase
        .from('messages')
        .select('conversation_id')
        .or(`sender_id.eq.${user.id},sender_id.eq.${otherUserId}`)
        .not('message_type', 'eq', 'system');

      let existingConversationId: string | null = null;

      if (allConversations?.length) {
        // Check which conversations have messages between these two users
        for (const conv of allConversations) {
          const { data: msgs } = await supabase
            .from('messages')
            .select('sender_id')
            .eq('conversation_id', conv.conversation_id)
            .in('sender_id', [user.id, otherUserId])
            .not('message_type', 'eq', 'system')
            .limit(2);

          if (msgs?.some(m => m.sender_id === user.id) && msgs?.some(m => m.sender_id === otherUserId)) {
            // Check if it's a private conversation
            const { data: convData } = await supabase
              .from('conversations')
              .select('is_public')
              .eq('id', conv.conversation_id)
              .single();

            if (convData && !convData.is_public) {
              existingConversationId = conv.conversation_id;
              break;
            }
          }
        }
      }

      // Check if user is currently in the conversation
      if (existingConversationId) {
        const { data: isParticipant } = await supabase
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', existingConversationId)
          .eq('user_id', user.id)
          .single();

        if (!isParticipant) {
          // User left previously, rejoin them
          console.log('User rejoining conversation:', existingConversationId);
          
          // Add user back as participant
          await supabase
            .from('conversation_participants')
            .insert({
              conversation_id: existingConversationId,
              user_id: user.id
            });

          // Get user profile for the system message
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', user.id)
            .single();

          // Send system message that user joined back
          await supabase
            .from('messages')
            .insert({
              conversation_id: existingConversationId,
              sender_id: user.id,
              content: `👋 ${userProfile?.display_name || 'Usuário'} entrou na conversa`,
              message_type: 'system'
            });

          fetchConversations();
          return existingConversationId;
        }

        // User is already in the conversation
        return existingConversationId;
      }

      // Check if private conversation already exists between exactly these two users
      console.log('Checking for existing private conversations...');
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
        
        // Check which of these conversations also include the other user
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
          // Filter for private conversations with exactly 2 participants
          for (const participant of otherUserParticipants) {
            const { data: participantCount, error: countError } = await supabase
              .from('conversation_participants')
              .select('user_id')
              .eq('conversation_id', participant.conversation_id);

            if (countError) continue;

            // Check if it's a private conversation (not public) with exactly 2 participants
            const { data: conversationData, error: convError } = await supabase
              .from('conversations')
              .select('is_public')
              .eq('id', participant.conversation_id)
              .single();

            if (convError) continue;

            if (!conversationData.is_public && participantCount?.length === 2) {
              console.log('Found existing private conversation:', participant.conversation_id);
              return participant.conversation_id;
            }
          }
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