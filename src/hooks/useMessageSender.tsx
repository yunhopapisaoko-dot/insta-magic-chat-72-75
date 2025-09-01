import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MessageSenderInfo {
  display_name: string;
  username: string;
}

export const useMessageSender = (senderId: string | null) => {
  const [senderInfo, setSenderInfo] = useState<MessageSenderInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!senderId) {
      setSenderInfo(null);
      return;
    }

    const fetchSenderInfo = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('display_name, username')
          .eq('id', senderId)
          .single();

        if (error) throw error;
        setSenderInfo(data);
      } catch (error) {
        console.error('Error fetching sender info:', error);
        setSenderInfo(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSenderInfo();
  }, [senderId]);

  return { senderInfo, loading };
};