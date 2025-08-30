import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ProfileData {
  id: string;
  display_name: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  followers_count: number;
  following_count: number;
}

interface CachedProfile extends ProfileData {
  lastAccessed: number;
  isFollowing?: boolean;
}

interface ConversationCache {
  conversationId: string;
  lastMessageTime: number;
  otherUser: ProfileData;
}

export const useProfileNavigation = () => {
  const [profileCache, setProfileCache] = useState<Map<string, CachedProfile>>(new Map());
  const [conversationCache, setConversationCache] = useState<Map<string, ConversationCache>>(new Map());
  const [loading, setLoading] = useState<Map<string, boolean>>(new Map());
  const [currentProfile, setCurrentProfile] = useState<ProfileData | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchProfile = useCallback(async (username: string, userId?: string): Promise<ProfileData | null> => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    // Check cache first
    const cached = profileCache.get(username);
    if (cached && Date.now() - cached.lastAccessed < 5 * 60 * 1000) { // 5 minutes cache
      setCurrentProfile(cached);
      return cached;
    }

    setLoading(prev => new Map(prev.set(username, true)));

    try {
      let query = supabase
        .from('profiles')
        .select('id, display_name, username, bio, avatar_url, followers_count, following_count');

      if (userId) {
        query = query.eq('id', userId);
      } else {
        query = query.eq('username', username);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;

      if (data) {
        const profileData: ProfileData = {
          id: data.id,
          display_name: data.display_name,
          username: data.username,
          bio: data.bio,
          avatar_url: data.avatar_url,
          followers_count: data.followers_count || 0,
          following_count: data.following_count || 0,
        };

        // Update cache
        const cachedProfile: CachedProfile = {
          ...profileData,
          lastAccessed: Date.now(),
        };

        setProfileCache(prev => {
          const newCache = new Map(prev);
          newCache.set(username, cachedProfile);
          
          // Keep only last 20 profiles in cache
          if (newCache.size > 20) {
            const entries = Array.from(newCache.entries());
            entries.sort((a, b) => b[1].lastAccessed - a[1].lastAccessed);
            newCache.clear();
            entries.slice(0, 20).forEach(([key, value]) => newCache.set(key, value));
          }
          
          return newCache;
        });

        setCurrentProfile(profileData);
        return profileData;
      }

      return null;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return null; // Request was aborted
      }
      console.error('Error fetching profile:', error);
      return null;
    } finally {
      setLoading(prev => {
        const newLoading = new Map(prev);
        newLoading.delete(username);
        return newLoading;
      });
    }
  }, [profileCache]);

  const navigateToProfile = useCallback(async (username: string, userId?: string) => {
    const profile = await fetchProfile(username, userId);
    return profile;
  }, [fetchProfile]);

  const cacheConversation = useCallback((userId: string, conversationId: string, otherUser: ProfileData) => {
    setConversationCache(prev => {
      const newCache = new Map(prev);
      newCache.set(userId, {
        conversationId,
        lastMessageTime: Date.now(),
        otherUser,
      });

      // Keep only last 10 conversations in cache
      if (newCache.size > 10) {
        const entries = Array.from(newCache.entries());
        entries.sort((a, b) => b[1].lastMessageTime - a[1].lastMessageTime);
        newCache.clear();
        entries.slice(0, 10).forEach(([key, value]) => newCache.set(key, value));
      }

      return newCache;
    });
  }, []);

  const getCachedConversation = useCallback((userId: string) => {
    return conversationCache.get(userId);
  }, [conversationCache]);

  const getRecentProfiles = useCallback(() => {
    const profiles = Array.from(profileCache.values());
    return profiles
      .sort((a, b) => b.lastAccessed - a.lastAccessed)
      .slice(0, 10);
  }, [profileCache]);

  const getRecentConversations = useCallback(() => {
    const conversations = Array.from(conversationCache.values());
    return conversations
      .sort((a, b) => b.lastMessageTime - a.lastMessageTime)
      .slice(0, 5);
  }, [conversationCache]);

  const isLoading = useCallback((username: string) => {
    return loading.get(username) || false;
  }, [loading]);

  const clearCache = useCallback(() => {
    setProfileCache(new Map());
    setConversationCache(new Map());
  }, []);

  return {
    currentProfile,
    fetchProfile,
    navigateToProfile,
    cacheConversation,
    getCachedConversation,
    getRecentProfiles,
    getRecentConversations,
    isLoading,
    clearCache,
  };
};
