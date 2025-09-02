import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useStoryViews } from './useStoryViews';

interface Story {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  background_color: string;
  text_color: string;
  text_position: string;
  text_size: number;
  created_at: string;
  expires_at: string;
  profiles: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
}

interface StoryGroup {
  user_id: string;
  user: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
  stories: Story[];
  hasViewed: boolean;
  lastViewedAt?: string;
}

interface CacheEntry {
  data: StoryGroup[];
  userStories: Story[];
  timestamp: number;
  preloadedMedia: Set<string>;
  viewedStories: Set<string>;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const PRELOAD_LIMIT = 15; // Increased preload limit for better performance
const PRIORITY_PRELOAD_LIMIT = 5; // Preload próximas 5 stories com prioridade alta

export const useStoriesCache = (userId?: string) => {
  const [stories, setStories] = useState<StoryGroup[]>([]);
  const [userStories, setUserStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getViewedStories } = useStoryViews(userId || null);
  const cacheRef = useRef<CacheEntry | null>(null);
  const preloadQueueRef = useRef<Set<string>>(new Set());

  // Preload media files with priority system
  const preloadMedia = useCallback(async (mediaUrls: string[], priority: boolean = false) => {
    const limit = priority ? PRIORITY_PRELOAD_LIMIT : PRELOAD_LIMIT;
    const toPreload = mediaUrls
      .filter(url => url && !cacheRef.current?.preloadedMedia.has(url))
      .slice(0, limit);

    for (const url of toPreload) {
      if (preloadQueueRef.current.has(url)) continue;
      
      preloadQueueRef.current.add(url);
      
      try {
        if (url.includes('video') || url.match(/\.(mp4|webm|ogg)$/i)) {
          // Preload video with priority
          const video = document.createElement('video');
          video.preload = priority ? 'auto' : 'metadata';
          video.src = url;
          
          // For priority videos, load a bit more
          if (priority) {
            video.currentTime = 0.1;
          }
        } else {
          // Preload image
          const img = new Image();
          img.loading = priority ? 'eager' : 'lazy';
          img.src = url;
          
          // Add to cache immediately for images
          img.onload = () => {
            if (cacheRef.current) {
              cacheRef.current.preloadedMedia.add(url);
            }
          };
        }
        
        if (cacheRef.current) {
          cacheRef.current.preloadedMedia.add(url);
        }
      } catch (error) {
        console.warn('Failed to preload media:', url, error);
      } finally {
        preloadQueueRef.current.delete(url);
      }
    }
  }, []);

  // Calculate time remaining until expiry
  const getTimeRemaining = useCallback((expiresAt: string) => {
    const now = new Date().getTime();
    const expiry = new Date(expiresAt).getTime();
    const remaining = expiry - now;
    
    if (remaining <= 0) return { expired: true, hours: 0, minutes: 0 };
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    return { expired: false, hours, minutes };
  }, []);

  // Fetch stories from database
  const fetchStories = useCallback(async (forceRefresh = false) => {
    if (!userId) return;

    // Check cache first
    const now = Date.now();
    if (!forceRefresh && cacheRef.current && (now - cacheRef.current.timestamp) < CACHE_DURATION) {
      setStories(cacheRef.current.data);
      setUserStories(cacheRef.current.userStories);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch user's own stories
      const { data: userStoriesData, error: userError } = await supabase
        .from('stories')
        .select('*, profiles(display_name, username, avatar_url)')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString()) // Only non-expired stories
        .order('created_at', { ascending: false });

      if (userError) throw userError;

      // Get user profile
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('display_name, username, avatar_url')
        .eq('id', userId)
        .single();

      const userStoriesWithProfile = userStoriesData?.map(story => ({
        ...story,
        profiles: userProfile || {
          display_name: 'Unknown',
          username: 'unknown',
          avatar_url: null,
        }
      })) || [];

      // Fetch stories from followed users
      const { data: followedUsers, error: followError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);

      if (followError) throw followError;

      let groupedStories: StoryGroup[] = [];

      if (followedUsers && followedUsers.length > 0) {
        const followedUserIds = followedUsers.map(f => f.following_id);

        // Get stories from followed users
        const { data: followedStories, error: followedError } = await supabase
          .from('stories')
          .select('*, profiles(display_name, username, avatar_url)')
          .in('user_id', followedUserIds)
          .gt('expires_at', new Date().toISOString()) // Only non-expired stories
          .order('created_at', { ascending: false });

        if (followedError) throw followedError;

        // Get profiles for the followed users
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .in('id', followedUserIds);

        if (profilesError) throw profilesError;

        // Create a map of user profiles
        const profilesMap = profiles?.reduce((acc, profile) => {
          acc[profile.id] = {
            display_name: profile.display_name,
            username: profile.username,
            avatar_url: profile.avatar_url,
          };
          return acc;
        }, {} as Record<string, { display_name: string; username: string; avatar_url: string | null }>) || {};

        // Group stories by user
        const storyGroups: { [key: string]: StoryGroup } = {};
        
        followedStories?.forEach((story) => {
          const profile = profilesMap[story.user_id];
          if (profile) {
            const storyWithProfile = {
              ...story,
              profiles: profile,
            };

            if (!storyGroups[story.user_id]) {
            storyGroups[story.user_id] = {
                user_id: story.user_id,
                user: profile,
                stories: [],
                hasViewed: false, // Will be calculated below
              };
            }
            storyGroups[story.user_id].stories.push(storyWithProfile);
          }
        });

        groupedStories = Object.values(storyGroups);
      }

      // Get viewed stories and calculate hasViewed
      const viewedStoriesSet = await getViewedStories();
      groupedStories.forEach(group => {
        // Para stories próprios, sempre considera como visualizado (stories próprios não precisam de bolinha)
        // Para stories de outros usuários, considera visualizado se TODOS foram vistos
        if (group.user_id === userId) {
          // Stories próprios: sempre visualizado (sem bolinha vermelha)
          group.hasViewed = true;
        } else {
          // Stories de outros: considera visualizado se TODOS foram vistos
          group.hasViewed = group.stories.every(story => viewedStoriesSet.has(story.id));
        }
      });

      // Update cache
      cacheRef.current = {
        data: groupedStories,
        userStories: userStoriesWithProfile,
        timestamp: now,
        preloadedMedia: cacheRef.current?.preloadedMedia || new Set(),
        viewedStories: viewedStoriesSet,
      };

      setStories(groupedStories);
      setUserStories(userStoriesWithProfile);

      // Preload media for recently added stories with priority
      const allMediaUrls = [
        ...userStoriesWithProfile.map(s => s.media_url).filter(Boolean),
        ...groupedStories.flatMap(g => g.stories.map(s => s.media_url)).filter(Boolean),
      ] as string[];

      if (allMediaUrls.length > 0) {
        // Priority preload for first few stories
        const priorityUrls = allMediaUrls.slice(0, PRIORITY_PRELOAD_LIMIT);
        const regularUrls = allMediaUrls.slice(PRIORITY_PRELOAD_LIMIT);
        
        preloadMedia(priorityUrls, true);
        
        // Regular preload for the rest after a short delay
        setTimeout(() => preloadMedia(regularUrls, false), 1000);
      }

    } catch (error) {
      console.error('Error fetching stories:', error);
      setError('Failed to load stories');
    } finally {
      setLoading(false);
    }
  }, [userId, preloadMedia, getViewedStories]);

  // Set up real-time updates for stories and story views
  useEffect(() => {
    if (!userId) return;

    fetchStories();

    const channel = supabase
      .channel('stories-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stories'
        },
        (payload) => {
          console.log('New story added:', payload);
          fetchStories(true); // Force refresh
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'stories'
        },
        () => {
          fetchStories(true); // Force refresh
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'story_views'
        },
        async (payload) => {
          console.log('🔴 Real-time story view event received:', payload);
          // Instant update - don't wait for re-fetch
          if (cacheRef.current && payload.new.user_id === userId) {
            console.log('📱 Processing story view for current user');
            const viewedStoryId = payload.new.story_id;
            
            // Update viewed stories set immediately
            const currentViewedSet = cacheRef.current.viewedStories || new Set();
            currentViewedSet.add(viewedStoryId);
            console.log('🎯 Story added to viewed set:', viewedStoryId);
            
            // Update groups with new viewed status
            const updatedGroups = cacheRef.current.data.map(group => {
              const hasStoryInGroup = group.stories.some(story => story.id === viewedStoryId);
              if (hasStoryInGroup) {
                let newHasViewed;
                // Para stories próprios, sempre considera como visualizado (sem bolinha)
                // Para stories de outros usuários, considera visualizado se TODOS foram vistos
                if (group.user_id === userId) {
                  newHasViewed = true;
                } else {
                  newHasViewed = group.stories.every(story => currentViewedSet.has(story.id));
                }
                console.log(`🔄 Group ${group.user.display_name} hasViewed: ${group.hasViewed} -> ${newHasViewed}`);
                return {
                  ...group,
                  hasViewed: newHasViewed
                };
              }
              return group;
            });

            // Update cache and state immediately
            cacheRef.current = {
              ...cacheRef.current,
              data: updatedGroups,
              viewedStories: currentViewedSet
            };
            
            console.log('✅ Stories state updated in real-time - red dot should disappear');
            setStories(updatedGroups);
          } else {
            console.log('❌ Story view not for current user or cache not ready');
          }
        }
      )
      .subscribe();

    // Clean up expired stories every minute
    const cleanupInterval = setInterval(() => {
      if (cacheRef.current) {
        const now = new Date().toISOString();
        
        // Filter out expired user stories
        const validUserStories = cacheRef.current.userStories.filter(
          story => story.expires_at > now
        );
        
        // Filter out expired group stories
        const validGroupStories = cacheRef.current.data
          .map(group => ({
            ...group,
            stories: group.stories.filter(story => story.expires_at > now)
          }))
          .filter(group => group.stories.length > 0);
        
        if (validUserStories.length !== cacheRef.current.userStories.length ||
            validGroupStories.length !== cacheRef.current.data.length) {
          cacheRef.current.userStories = validUserStories;
          cacheRef.current.data = validGroupStories;
          setUserStories(validUserStories);
          setStories(validGroupStories);
        }
      }
    }, 60000); // Check every minute

    return () => {
      supabase.removeChannel(channel);
      clearInterval(cleanupInterval);
    };
  }, [userId, fetchStories]);

  const refreshStories = useCallback(() => {
    fetchStories(true);
  }, [fetchStories]);

  const preloadStoryMedia = useCallback((storyGroup: Story[], priority: boolean = true) => {
    const mediaUrls = storyGroup
      .map(story => story.media_url)
      .filter(Boolean) as string[];
    
    if (mediaUrls.length > 0) {
      preloadMedia(mediaUrls, priority);
    }
  }, [preloadMedia]);

  return {
    stories,
    userStories,
    loading,
    error,
    refreshStories,
    preloadStoryMedia,
    getTimeRemaining,
  };
};