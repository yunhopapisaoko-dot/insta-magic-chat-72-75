import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface NewMessageIndicator {
  senderId: string;
  timestamp: string;
  messageId: string;
}

export const useNewMessageIndicator = (conversationId: string) => {
  const { user } = useAuth();
  const [newMessageIndicators, setNewMessageIndicators] = useState<NewMessageIndicator[]>([]);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    if (!conversationId || !user) return;

    // Listen for new messages in real time
    const channel = supabase
      .channel(`new_messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const newMessage = payload.new as any;
          
          // Only show indicator for messages from other users
          if (newMessage.sender_id !== user.id) {
            const indicator: NewMessageIndicator = {
              senderId: newMessage.sender_id,
              timestamp: new Date().toISOString(),
              messageId: newMessage.id
            };

            setNewMessageIndicators(prev => [...prev, indicator]);

            // Remove indicator after 5 seconds
            const timeout = setTimeout(() => {
              setNewMessageIndicators(prev => 
                prev.filter(ind => ind.messageId !== indicator.messageId)
              );
              timeoutsRef.current.delete(indicator.messageId);
            }, 5000);

            timeoutsRef.current.set(indicator.messageId, timeout);
          }
        }
      )
      .subscribe();

    return () => {
      // Clear all timeouts
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      timeoutsRef.current.clear();
      
      supabase.removeChannel(channel);
    };
  }, [conversationId, user?.id]);

  const hasNewMessageFrom = (senderId: string) => {
    return newMessageIndicators.some(indicator => indicator.senderId === senderId);
  };

  const clearIndicatorsFromSender = (senderId: string) => {
    const indicatorsToRemove = newMessageIndicators.filter(ind => ind.senderId === senderId);
    
    // Clear timeouts for these indicators
    indicatorsToRemove.forEach(indicator => {
      const timeout = timeoutsRef.current.get(indicator.messageId);
      if (timeout) {
        clearTimeout(timeout);
        timeoutsRef.current.delete(indicator.messageId);
      }
    });

    setNewMessageIndicators(prev => 
      prev.filter(indicator => indicator.senderId !== senderId)
    );
  };

  const clearAllIndicators = () => {
    // Clear all timeouts
    timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    timeoutsRef.current.clear();
    
    setNewMessageIndicators([]);
  };

  return {
    hasNewMessageFrom,
    clearIndicatorsFromSender,
    clearAllIndicators,
    newMessageIndicators
  };
};