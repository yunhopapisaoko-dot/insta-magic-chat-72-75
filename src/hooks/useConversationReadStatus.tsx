import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ReadStatus {
  isCurrentlyReading: boolean;
  lastReadTimestamp: string | null;
}

export const useConversationReadStatus = (conversationId: string) => {
  const { user } = useAuth();
  const [readStatus, setReadStatus] = useState<Record<string, ReadStatus>>({});

  useEffect(() => {
    if (!conversationId || !user) return;

    // Listen for read status changes
    const channel = supabase.channel(`conversation_read:${conversationId}`);
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const newReadStatus: Record<string, ReadStatus> = {};
        
        Object.entries(presenceState).forEach(([key, presences]) => {
          const presence = presences[0] as any;
          if (presence?.user_id && presence.user_id !== user.id) {
            newReadStatus[presence.user_id] = {
              isCurrentlyReading: presence.reading || false,
              lastReadTimestamp: presence.timestamp || null
            };
          }
        });
        
        setReadStatus(newReadStatus);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach((presence: any) => {
          if (presence.user_id && presence.user_id !== user.id) {
            setReadStatus(prev => ({
              ...prev,
              [presence.user_id]: {
                isCurrentlyReading: presence.reading || false,
                lastReadTimestamp: presence.timestamp || null
              }
            }));
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((presence: any) => {
          if (presence.user_id && presence.user_id !== user.id) {
            setReadStatus(prev => ({
              ...prev,
              [presence.user_id]: {
                isCurrentlyReading: false,
                lastReadTimestamp: presence.timestamp || null
              }
            }));
          }
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user?.id]);

  const getReadingUsers = () => {
    return Object.entries(readStatus)
      .filter(([_, status]) => status.isCurrentlyReading)
      .map(([userId]) => userId);
  };

  const isAnyoneReading = () => {
    return Object.values(readStatus).some(status => status.isCurrentlyReading);
  };

  return {
    readStatus,
    getReadingUsers,
    isAnyoneReading
  };
};