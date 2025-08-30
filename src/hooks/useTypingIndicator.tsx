import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface TypingUser {
  user_id: string;
  display_name: string;
  timestamp: number;
}

export const useTypingIndicator = () => {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  
  // Cleanup old typing indicators (older than 3 seconds)
  const cleanupOldTyping = useCallback(() => {
    const now = Date.now();
    setTypingUsers(prev => prev.filter(u => now - u.timestamp < 3000));
  }, []);

  useEffect(() => {
    if (!user) return;

    // Set up real-time subscription for typing events
    const channel = supabase
      .channel('typing_indicator')
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { user_id, display_name, is_typing } = payload.payload;
        
        // Don't show own typing
        if (user_id === user.id) return;

        setTypingUsers(prev => {
          const filtered = prev.filter(u => u.user_id !== user_id);
          
          if (is_typing) {
            return [...filtered, { 
              user_id, 
              display_name, 
              timestamp: Date.now() 
            }];
          }
          
          return filtered;
        });
      })
      .subscribe();

    // Cleanup interval
    const interval = setInterval(cleanupOldTyping, 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user, cleanupOldTyping]);

  const sendTypingStatus = useCallback(async (isTyping: boolean, displayName: string) => {
    if (!user) return;

    try {
      const channel = supabase.channel('typing_indicator');
      await channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          user_id: user.id,
          display_name: displayName,
          is_typing: isTyping
        }
      });
    } catch (error) {
      console.error('Error sending typing status:', error);
    }
  }, [user]);

  return {
    typingUsers,
    sendTypingStatus,
  };
};