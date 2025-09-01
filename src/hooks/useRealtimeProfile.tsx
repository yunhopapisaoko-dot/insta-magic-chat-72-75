import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ProfileUpdate {
  id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  followers_count: number;
  following_count: number;
}

interface UseRealtimeProfileProps {
  userId: string | null;
  onProfileUpdate: (profile: ProfileUpdate) => void;
}

export const useRealtimeProfile = ({ userId, onProfileUpdate }: UseRealtimeProfileProps) => {
  const handleProfileChange = useCallback((payload: any) => {
    console.log('Profile realtime change:', payload);
    if (payload.eventType === 'UPDATE' && payload.new?.id === userId) {
      console.log('Processing profile update for user:', userId);
      onProfileUpdate({
        id: payload.new.id,
        display_name: payload.new.display_name,
        bio: payload.new.bio,
        avatar_url: payload.new.avatar_url,
        followers_count: payload.new.followers_count || 0,
        following_count: payload.new.following_count || 0,
      });
    }
  }, [userId, onProfileUpdate]);

  useEffect(() => {
    if (!userId) return;

    console.log('Setting up realtime profile listener for user:', userId);

    const channel = supabase
      .channel(`profile_changes_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        handleProfileChange
      )
      .subscribe((status) => {
        console.log('Profile realtime subscription status:', status);
      });

    return () => {
      console.log('Cleaning up profile realtime listener');
      supabase.removeChannel(channel);
    };
  }, [userId, handleProfileChange]);
};