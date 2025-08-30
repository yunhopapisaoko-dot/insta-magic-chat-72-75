import { useState, useCallback, useRef, useEffect } from 'react';
import { Conversation } from '@/hooks/useConversations';
import { useMemoryManager } from '@/hooks/useMemoryManager';
import { useDeviceOptimization } from '@/hooks/useDeviceOptimization';

interface ConversationsCacheOptions {
  maxConversations?: number;
  ttl?: number;
  preloadCount?: number;
  enableBackgroundSync?: boolean;
}

interface CachedConversation extends Conversation {
  cached_at: number;
  last_accessed: number;
  is_preloaded: boolean;
}

export const useConversationsCache = (options: ConversationsCacheOptions = {}) => {
  const {
    maxConversations = 50,
    ttl = 12 * 60 * 60 * 1000, // 12 hours
    preloadCount = 10,
    enableBackgroundSync = true
  } = options;

  const [cache, setCache] = useState<Map<string, CachedConversation>>(new Map());
  const [recentConversations, setRecentConversations] = useState<string[]>([]);
  const [loading, setLoading] = useState<Set<string>>(new Set());
  
  const memoryManager = useMemoryManager();
  const deviceOptimization = useDeviceOptimization();
  const lastSync = useRef<number>(0);
  const syncIntervalRef = useRef<NodeJS.Timeout>();

  // Load cache from storage on mount
  useEffect(() => {
    loadFromStorage();
  }, []);

  // Auto-save cache changes
  useEffect(() => {
    if (cache.size > 0) {
      saveToStorage();
    }
  }, [cache]);

  // Background sync setup
  useEffect(() => {
    if (!enableBackgroundSync) return;

    const startBackgroundSync = () => {
      syncIntervalRef.current = setInterval(() => {
        if (!document.hidden) {
          performBackgroundSync();
        }
      }, 5 * 60 * 1000); // Every 5 minutes
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
        }
      } else {
        startBackgroundSync();
        // Sync immediately when app becomes visible
        performBackgroundSync();
      }
    };

    startBackgroundSync();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enableBackgroundSync, deviceOptimization]);

  const loadFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem('conversations_cache');
      if (stored) {
        const { conversations, recent } = JSON.parse(stored);
        const restoredCache = new Map();
        
        Object.entries(conversations || {}).forEach(([id, conv]: [string, any]) => {
          const age = Date.now() - conv.cached_at;
          if (age < ttl) {
            restoredCache.set(id, conv);
          }
        });

        setCache(restoredCache);
        setRecentConversations(recent || []);
      }
    } catch (error) {
      console.warn('Failed to load conversations cache:', error);
    }
  }, [ttl]);

  const saveToStorage = useCallback(() => {
    try {
      const data = {
        conversations: Object.fromEntries(cache),
        recent: recentConversations.slice(0, 20) // Keep only last 20
      };
      localStorage.setItem('conversations_cache', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save conversations cache:', error);
      // Clear cache if storage is full
      cleanupCache(true);
    }
  }, [cache, recentConversations]);

  const cleanupCache = useCallback((aggressive = false) => {
    const now = Date.now();
    const newCache = new Map();
    const sortedEntries = Array.from(cache.entries())
      .filter(([_, conv]) => !aggressive && (now - conv.cached_at < ttl))
      .sort(([_, a], [__, b]) => b.last_accessed - a.last_accessed)
      .slice(0, aggressive ? Math.floor(maxConversations * 0.5) : maxConversations);

    sortedEntries.forEach(([id, conv]) => {
      newCache.set(id, conv);
    });

    setCache(newCache);
    // Memory cleanup handled by the hook internally
  }, [cache, ttl, maxConversations, memoryManager]);

  const getCachedConversation = useCallback((conversationId: string): CachedConversation | null => {
    const conv = cache.get(conversationId);
    if (conv) {
      // Update last accessed time
      updateLastAccessed(conversationId);
      return conv;
    }
    return null;
  }, [cache]);

  const setCachedConversation = useCallback((conversation: Conversation, preloaded = false) => {
    const now = Date.now();
    const cachedConv: CachedConversation = {
      ...conversation,
      cached_at: now,
      last_accessed: now,
      is_preloaded: preloaded
    };

    setCache(prev => {
      const newCache = new Map(prev);
      newCache.set(conversation.id, cachedConv);
      
      // Cleanup if over limit
      if (newCache.size > maxConversations) {
        const oldest = Array.from(newCache.entries())
          .sort(([_, a], [__, b]) => a.last_accessed - b.last_accessed)[0];
        newCache.delete(oldest[0]);
      }
      
      return newCache;
    });

    // Update recent conversations list
    setRecentConversations(prev => {
      const filtered = prev.filter(id => id !== conversation.id);
      return [conversation.id, ...filtered].slice(0, 20);
    });
  }, [maxConversations]);

  const updateLastAccessed = useCallback((conversationId: string) => {
    setCache(prev => {
      const newCache = new Map(prev);
      const conv = newCache.get(conversationId);
      if (conv) {
        newCache.set(conversationId, {
          ...conv,
          last_accessed: Date.now()
        });
      }
      return newCache;
    });
  }, []);

  const preloadConversations = useCallback(async (conversationIds: string[], fetchFn: (id: string) => Promise<Conversation | null>) => {
    if (document.hidden) return;

    const idsToPreload = conversationIds
      .slice(0, preloadCount)
      .filter(id => !cache.has(id) && !loading.has(id));

    if (idsToPreload.length === 0) return;

    setLoading(prev => {
      const newSet = new Set(prev);
      idsToPreload.forEach(id => newSet.add(id));
      return newSet;
    });

    try {
      const preloadPromises = idsToPreload.map(async (id) => {
        try {
          const conversation = await fetchFn(id);
          if (conversation) {
            setCachedConversation(conversation, true);
          }
        } catch (error) {
          console.warn(`Failed to preload conversation ${id}:`, error);
        }
      });

      await Promise.allSettled(preloadPromises);
    } finally {
      setLoading(prev => {
        const newSet = new Set(prev);
        idsToPreload.forEach(id => newSet.delete(id));
        return newSet;
      });
    }
  }, [cache, loading, preloadCount, deviceOptimization, setCachedConversation]);

  const performBackgroundSync = useCallback(async () => {
    const now = Date.now();
    const timeSinceLastSync = now - lastSync.current;
    
    // Don't sync too frequently
    if (timeSinceLastSync < 2 * 60 * 1000) return; // 2 minutes

    lastSync.current = now;

    // Check for stale conversations in recent list
    const staleConversations = recentConversations
      .slice(0, 5) // Only check top 5 recent
      .filter(id => {
        const conv = cache.get(id);
        return conv && (now - conv.cached_at) > 5 * 60 * 1000; // 5 minutes old
      });

    if (staleConversations.length > 0) {
      console.log('Background sync updating stale conversations:', staleConversations.length);
      // Emit event for parent to handle background sync
      window.dispatchEvent(new CustomEvent('conversations-background-sync', {
        detail: { conversationIds: staleConversations }
      }));
    }
  }, [recentConversations, cache]);

  const invalidateConversation = useCallback((conversationId: string) => {
    setCache(prev => {
      const newCache = new Map(prev);
      newCache.delete(conversationId);
      return newCache;
    });
  }, []);

  const getCacheStats = useCallback(() => {
    const conversations = Array.from(cache.values());
    const preloadedCount = conversations.filter(c => c.is_preloaded).length;
    const avgAge = conversations.length > 0 
      ? conversations.reduce((sum, c) => sum + (Date.now() - c.cached_at), 0) / conversations.length
      : 0;

    return {
      totalConversations: cache.size,
      preloadedConversations: preloadedCount,
      recentConversationsCount: recentConversations.length,
      averageAge: avgAge,
      memoryUsage: JSON.stringify(Object.fromEntries(cache)).length,
      isLoadingCount: loading.size
    };
  }, [cache, recentConversations, loading]);

  // Cleanup on memory pressure
  useEffect(() => {
    const handleMemoryPressure = () => {
      cleanupCache(true);
    };

    // Memory pressure handling simplified
    return () => {};
  }, [memoryManager, cleanupCache]);

  return {
    getCachedConversation,
    setCachedConversation,
    preloadConversations,
    invalidateConversation,
    updateLastAccessed,
    getCacheStats,
    cleanupCache,
    recentConversations,
    isLoading: (id: string) => loading.has(id),
    hasCache: cache.size > 0
  };
};