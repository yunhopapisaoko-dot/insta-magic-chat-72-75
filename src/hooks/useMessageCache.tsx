import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CacheOptions {
  maxSize?: number;
  ttl?: number; // Time to live in milliseconds
  persistToStorage?: boolean;
}

interface CachedMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  delivered_at?: string | null;
  read_at?: string | null;
  message_status?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  story_id?: string | null;
  cached_at: number;
}

export const useMessageCache = (options: CacheOptions = {}) => {
  const {
    maxSize = 1000,
    ttl = 24 * 60 * 60 * 1000, // 24 hours
    persistToStorage = true
  } = options;

  const [cache, setCache] = useState<Map<string, CachedMessage[]>>(new Map());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const lastFetch = useRef<Map<string, number>>(new Map());

  // Load cache from localStorage on mount
  useEffect(() => {
    if (!persistToStorage) return;

    try {
      const stored = localStorage.getItem('message_cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        const restoredCache = new Map();
        
        Object.entries(parsed).forEach(([key, messages]: [string, any]) => {
          const validMessages = messages.filter((msg: any) => {
            const age = Date.now() - msg.cached_at;
            return age < ttl;
          });
          
          if (validMessages.length > 0) {
            restoredCache.set(key, validMessages);
          }
        });
        
        setCache(restoredCache);
      }
    } catch (error) {
      console.warn('Failed to load message cache:', error);
    }
  }, [persistToStorage, ttl]);

  // Save cache to localStorage when it changes
  useEffect(() => {
    if (!persistToStorage || cache.size === 0) return;

    try {
      const cacheObject = Object.fromEntries(cache);
      localStorage.setItem('message_cache', JSON.stringify(cacheObject));
    } catch (error) {
      console.warn('Failed to save message cache:', error);
    }
  }, [cache, persistToStorage]);

  const cleanupCache = useCallback(() => {
    const now = Date.now();
    const newCache = new Map();
    
    cache.forEach((messages, key) => {
      const validMessages = messages
        .filter(msg => now - msg.cached_at < ttl)
        .slice(-maxSize); // Keep only the most recent messages
      
      if (validMessages.length > 0) {
        newCache.set(key, validMessages);
      }
    });
    
    setCache(newCache);
  }, [cache, ttl, maxSize]);

  // Cleanup cache periodically
  useEffect(() => {
    const interval = setInterval(cleanupCache, 5 * 60 * 1000); // Every 5 minutes
    return () => clearInterval(interval);
  }, [cleanupCache]);

  const getCachedMessages = useCallback((conversationId: string): CachedMessage[] => {
    return cache.get(conversationId) || [];
  }, [cache]);

  const setCachedMessages = useCallback((conversationId: string, messages: CachedMessage[]) => {
    setCache(prev => {
      const newCache = new Map(prev);
      const cachedMessages = messages.map(msg => ({
        ...msg,
        cached_at: Date.now()
      }));
      newCache.set(conversationId, cachedMessages);
      return newCache;
    });
  }, []);

  const addMessage = useCallback((conversationId: string, message: Omit<CachedMessage, 'cached_at'>) => {
    setCache(prev => {
      const newCache = new Map(prev);
      const existing = newCache.get(conversationId) || [];
      
      const messageWithCache = {
        ...message,
        cached_at: Date.now()
      };
      
      // Check if message already exists
      const existingIndex = existing.findIndex(m => m.id === message.id);
      if (existingIndex >= 0) {
        existing[existingIndex] = messageWithCache;
      } else {
        existing.push(messageWithCache);
      }
      
      // Keep only the most recent messages, sorted chronologically
      const sorted = existing
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .slice(-maxSize);
      
      newCache.set(conversationId, sorted);
      return newCache;
    });
  }, [maxSize]);

  const updateMessage = useCallback((conversationId: string, messageId: string, updates: Partial<CachedMessage>) => {
    setCache(prev => {
      const newCache = new Map(prev);
      const existing = newCache.get(conversationId) || [];
      
      const updatedMessages = existing.map(msg => 
        msg.id === messageId 
          ? { ...msg, ...updates, cached_at: Date.now() }
          : msg
      );
      
      newCache.set(conversationId, updatedMessages);
      return newCache;
    });
  }, []);

  const fetchAndCacheMessages = useCallback(async (conversationId: string, force = false) => {
    const lastFetchTime = lastFetch.current.get(conversationId) || 0;
    const timeSinceLastFetch = Date.now() - lastFetchTime;
    
    // Don't fetch if we fetched recently (unless forced)
    if (!force && timeSinceLastFetch < 30000) { // 30 seconds
      return getCachedMessages(conversationId);
    }

    if (loading.has(conversationId)) {
      return getCachedMessages(conversationId);
    }

    setLoading(prev => new Set(prev).add(conversationId));

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const cachedMessages = (data || []).map(msg => ({
        ...msg,
        cached_at: Date.now()
      }));

      setCachedMessages(conversationId, cachedMessages);
      lastFetch.current.set(conversationId, Date.now());
      
      return cachedMessages;
    } catch (error) {
      console.error('Error fetching messages:', error);
      return getCachedMessages(conversationId); // Return cached data on error
    } finally {
      setLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(conversationId);
        return newSet;
      });
    }
  }, [getCachedMessages, setCachedMessages, loading]);

  const clearCache = useCallback((conversationId?: string) => {
    if (conversationId) {
      setCache(prev => {
        const newCache = new Map(prev);
        newCache.delete(conversationId);
        return newCache;
      });
    } else {
      setCache(new Map());
      if (persistToStorage) {
        localStorage.removeItem('message_cache');
      }
    }
  }, [persistToStorage]);

  const isLoading = useCallback((conversationId: string) => {
    return loading.has(conversationId);
  }, [loading]);

  const getCacheStats = useCallback(() => {
    const totalMessages = Array.from(cache.values()).reduce((sum, messages) => sum + messages.length, 0);
    const oldestMessage = Math.min(
      ...Array.from(cache.values())
        .flat()
        .map(msg => msg.cached_at)
    );
    
    return {
      conversationCount: cache.size,
      totalMessages,
      oldestCacheTime: oldestMessage,
      memoryUsage: JSON.stringify(Object.fromEntries(cache)).length
    };
  }, [cache]);

  return {
    getCachedMessages,
    setCachedMessages,
    addMessage,
    updateMessage,
    fetchAndCacheMessages,
    clearCache,
    isLoading,
    getCacheStats,
    cleanupCache
  };
};
