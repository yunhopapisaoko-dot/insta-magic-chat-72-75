import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SenderInfo {
  display_name: string;
  avatar_url: string | null;
}

export const useMessageSenders = (messages: any[]) => {
  const [sendersInfo, setSendersInfo] = useState<Record<string, SenderInfo>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!messages.length) return;

    const fetchSendersInfo = async () => {
      setLoading(true);
      try {
        // Get unique sender IDs from messages
        const senderIds = [...new Set(messages.map(m => m.sender_id).filter(Boolean))];
        
        if (senderIds.length === 0) return;

        const { data, error } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', senderIds);

        if (error) throw error;

        // Create a map of sender ID to sender info
        const sendersMap = data.reduce((acc, sender) => {
          acc[sender.id] = {
            display_name: sender.display_name,
            avatar_url: sender.avatar_url
          };
          return acc;
        }, {} as Record<string, SenderInfo>);

        setSendersInfo(sendersMap);
      } catch (error) {
        console.error('Error fetching senders info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSendersInfo();
  }, [messages]);

  const getSenderInfo = (senderId: string): SenderInfo | undefined => {
    return sendersInfo[senderId];
  };

  return { sendersInfo, getSenderInfo, loading };
};