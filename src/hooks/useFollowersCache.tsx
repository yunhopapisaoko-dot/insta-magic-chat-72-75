import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FollowerUser {
  id: string;
  username: string;
  display_name: string;
  bio?: string | null;
  avatar_url?: string | null;
  followers_count: number;
  following_count: number;
}

interface FollowersCache {
  followers: FollowerUser[];
  following: FollowerUser[];
  followersLoading: boolean;
  followingLoading: boolean;
  refreshFollowers: () => void;
  refreshFollowing: () => void;
}

export const useFollowersCache = (userId: string | undefined): FollowersCache => {
  const [followers, setFollowers] = useState<FollowerUser[]>([]);
  const [following, setFollowing] = useState<FollowerUser[]>([]);
  const [followersLoading, setFollowersLoading] = useState(true);
  const [followingLoading, setFollowingLoading] = useState(true);

  const fetchFollowers = useCallback(async () => {
    if (!userId) return;
    
    setFollowersLoading(true);
    try {
      const { data, error } = await supabase
        .from('follows')
        .select(`
          follower_id,
          profiles!follows_follower_id_fkey (
            id,
            username,
            display_name,
            bio,
            avatar_url,
            followers_count,
            following_count
          )
        `)
        .eq('following_id', userId);

      if (error) throw error;

      const followersData = data?.map(f => f.profiles).filter(Boolean) as FollowerUser[];
      setFollowers(followersData || []);
    } catch (error) {
      console.error('Error fetching followers:', error);
      setFollowers([]);
    } finally {
      setFollowersLoading(false);
    }
  }, [userId]);

  const fetchFollowing = useCallback(async () => {
    if (!userId) return;
    
    setFollowingLoading(true);
    try {
      const { data, error } = await supabase
        .from('follows')
        .select(`
          following_id,
          profiles!follows_following_id_fkey (
            id,
            username,
            display_name,
            bio,
            avatar_url,
            followers_count,
            following_count
          )
        `)
        .eq('follower_id', userId);

      if (error) throw error;

      const followingData = data?.map(f => f.profiles).filter(Boolean) as FollowerUser[];
      setFollowing(followingData || []);
    } catch (error) {
      console.error('Error fetching following:', error);
      setFollowing([]);
    } finally {
      setFollowingLoading(false);
    }
  }, [userId]);

  const refreshFollowers = useCallback(() => {
    fetchFollowers();
  }, [fetchFollowers]);

  const refreshFollowing = useCallback(() => {
    fetchFollowing();
  }, [fetchFollowing]);

  useEffect(() => {
    if (userId) {
      fetchFollowers();
      fetchFollowing();
    }
  }, [userId, fetchFollowers, fetchFollowing]);

  return {
    followers,
    following,
    followersLoading,
    followingLoading,
    refreshFollowers,
    refreshFollowing,
  };
};