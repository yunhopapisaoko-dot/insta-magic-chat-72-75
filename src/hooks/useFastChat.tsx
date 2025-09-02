import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useFastChat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const startChat = useCallback(async (otherUserId: string, displayName?: string) => {
    if (!user) {
      toast({
        title: "Login necessário",
        description: "Faça login para enviar mensagens",
        variant: "destructive",
      });
      return null;
    }

    if (otherUserId === user.id) {
      toast({
        title: "Ação inválida",
        description: "Você não pode conversar consigo mesmo",
        variant: "destructive",
      });
      return null;
    }

    setCreating(true);

    try {
      // Ultra-fast conversation creation with minimal queries
      const conversationId = await createConversationFast(otherUserId);
      
      if (conversationId) {
        // Navigate immediately for instant feel
        navigate(`/messages?chat=${conversationId}`);
        return conversationId;
      }
      
      return null;
    } catch (error) {
      console.error('Error starting chat:', error);
      toast({
        title: "Erro",
        description: "Não foi possível iniciar a conversa. Tente novamente.",
        variant: "destructive",
      });
      return null;
    } finally {
      setCreating(false);
    }
  }, [user, navigate]);

  const createConversationFast = async (otherUserId: string) => {
    if (!user) return null;

    try {
      // Direct fallback method for speed
      return await createConversationFallback(otherUserId);
    } catch (error) {
      console.error('Fast creation failed:', error);
      return null;
    }
  };

  const createConversationFallback = async (otherUserId: string) => {
    if (!user) return null;

    try {
      // Fallback method - check existing conversations
      const { data: userConvs } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (userConvs?.length) {
        const convIds = userConvs.map(c => c.conversation_id);
        
        const { data: otherConvs } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', otherUserId)
          .in('conversation_id', convIds);

        if (otherConvs?.length) {
          // Return first matching conversation (assuming 1-on-1)
          return otherConvs[0].conversation_id;
        }
      }

      // Create new conversation
      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({})
        .select('id')
        .single();

      if (error) throw error;

      await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: newConv.id, user_id: user.id },
          { conversation_id: newConv.id, user_id: otherUserId }
        ]);

      return newConv.id;
    } catch (error) {
      console.error('Fallback creation failed:', error);
      return null;
    }
  };

  return {
    startChat,
    creating,
  };
};