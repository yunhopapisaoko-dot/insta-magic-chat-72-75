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
    if (!user) return;

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
      const { data: lastMessages, error: messagesError } = await supabase
        .from('messages')
        .select('conversation_id, content, created_at')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: true });

      if (messagesError) console.error('Error fetching messages:', messagesError);

      // Group messages by conversation and get the latest one
      const lastMessageMap = (lastMessages || []).reduce((acc, message) => {
        if (!acc[message.conversation_id]) {
          acc[message.conversation_id] = message;
        }
        return acc;
      }, {} as Record<string, any>);

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
              sender_id: user.id,
              media_url: null,
              media_type: null,
              story_id: null,
              read_at: null
            } : undefined,
            unread_count: 0,
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
                sender_id: user.id,
                media_url: null,
                media_type: null,
                story_id: null,
                read_at: null
              } : undefined,
              unread_count: 0,
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
              sender_id: user.id,
              media_url: null,
              media_type: null,
              story_id: null,
              read_at: null
            } : undefined,
            unread_count: 0,
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
          unread_count: 0,
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
    fetchConversations();

    // Set up realtime subscriptions
    const conversationsChannel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },
        () => {
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
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationsChannel);
    };
  }, [fetchConversations]);


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

  return {
    conversations,
    loading,
    error,
    fetchConversations,
    createOrGetConversation
  };
};
