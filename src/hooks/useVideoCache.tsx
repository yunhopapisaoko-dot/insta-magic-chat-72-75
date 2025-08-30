import { useState, useCallback, useEffect } from 'react';

interface CachedVideo {
  id: string;
  file: File;
  compressedBlob?: Blob;
  thumbnail?: string;
  preview?: string;
  metadata: {
    duration: number;
    size: number;
    width: number;
    height: number;
    format: string;
  };
  timestamp: number;
  uploadStatus?: 'pending' | 'uploading' | 'completed' | 'failed';
}

const CACHE_KEY = 'video_upload_cache';
const MAX_CACHE_SIZE = 5; // Maximum number of cached videos
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_MEMORY_USAGE = 100 * 1024 * 1024; // 100MB

export const useVideoCache = () => {
  const [cache, setCache] = useState<Map<string, CachedVideo>>(new Map());
  const [memoryUsage, setMemoryUsage] = useState(0);

  // Load cache from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const cacheMap = new Map<string, CachedVideo>();
        let totalMemory = 0;

        Object.entries(data).forEach(([key, value]: [string, any]) => {
          // Check if cached item is still valid
          if (Date.now() - value.timestamp < CACHE_EXPIRY) {
            cacheMap.set(key, value);
            totalMemory += value.metadata.size;
          }
        });

        setCache(cacheMap);
        setMemoryUsage(totalMemory);
      }
    } catch (error) {
      console.error('Error loading video cache:', error);
    }
  }, []);

  // Save cache to localStorage whenever it changes
  useEffect(() => {
    try {
      const cacheObj = Object.fromEntries(cache);
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheObj));
    } catch (error) {
      console.error('Error saving video cache:', error);
    }
  }, [cache]);

  const generateVideoId = useCallback((file: File): string => {
    return `${file.name}_${file.size}_${file.lastModified}`;
  }, []);

  const addToCache = useCallback(async (
    file: File,
    compressedBlob?: Blob,
    options?: {
      generateThumbnail?: boolean;
      generatePreview?: boolean;
    }
  ): Promise<string> => {
    const id = generateVideoId(file);
    
    try {
      // Create video element to extract metadata
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      const metadata = await new Promise<CachedVideo['metadata']>((resolve, reject) => {
        video.onloadedmetadata = () => {
          resolve({
            duration: video.duration,
            size: file.size,
            width: video.videoWidth,
            height: video.videoHeight,
            format: file.type
          });
        };
        video.onerror = reject;
        video.src = URL.createObjectURL(file);
      });

      let thumbnail: string | undefined;
      let preview: string | undefined;

      // Generate thumbnail if requested
      if (options?.generateThumbnail) {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext('2d')!;
        
        video.currentTime = metadata.duration * 0.1; // 10% into the video
        await new Promise(resolve => {
          video.onseeked = resolve;
        });
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        thumbnail = canvas.toDataURL('image/jpeg', 0.7);
      }

      // Generate preview if requested (short clip)
      if (options?.generatePreview) {
        // For now, use thumbnail as preview placeholder
        // In a real implementation, you'd create a short video clip
        preview = thumbnail;
      }

      URL.revokeObjectURL(video.src);

      const cachedVideo: CachedVideo = {
        id,
        file,
        compressedBlob,
        thumbnail,
        preview,
        metadata,
        timestamp: Date.now(),
        uploadStatus: 'pending'
      };

      // Check memory usage and clean if necessary
      const newMemoryUsage = memoryUsage + metadata.size;
      if (newMemoryUsage > MAX_MEMORY_USAGE) {
        await cleanup();
      }

      setCache(prevCache => {
        const newCache = new Map(prevCache);
        
        // Remove oldest entries if cache is full
        if (newCache.size >= MAX_CACHE_SIZE) {
          const oldestKey = Array.from(newCache.keys())[0];
          newCache.delete(oldestKey);
        }
        
        newCache.set(id, cachedVideo);
        return newCache;
      });

      setMemoryUsage(prev => prev + metadata.size);
      
      return id;
    } catch (error) {
      console.error('Error adding video to cache:', error);
      throw error;
    }
  }, [generateVideoId, memoryUsage]);

  const getFromCache = useCallback((id: string): CachedVideo | null => {
    const cached = cache.get(id);
    
    if (!cached) return null;
    
    // Check if cache entry is still valid
    if (Date.now() - cached.timestamp > CACHE_EXPIRY) {
      removeFromCache(id);
      return null;
    }
    
    return cached;
  }, [cache]);

  const getFromCacheByFile = useCallback((file: File): CachedVideo | null => {
    const id = generateVideoId(file);
    return getFromCache(id);
  }, [generateVideoId, getFromCache]);

  const removeFromCache = useCallback((id: string) => {
    setCache(prevCache => {
      const newCache = new Map(prevCache);
      const cached = newCache.get(id);
      
      if (cached) {
        setMemoryUsage(prev => prev - cached.metadata.size);
        newCache.delete(id);
      }
      
      return newCache;
    });
  }, []);

  const updateCacheStatus = useCallback((id: string, status: CachedVideo['uploadStatus']) => {
    setCache(prevCache => {
      const newCache = new Map(prevCache);
      const cached = newCache.get(id);
      
      if (cached) {
        newCache.set(id, { ...cached, uploadStatus: status });
      }
      
      return newCache;
    });
  }, []);

  const cleanup = useCallback(async () => {
    const now = Date.now();
    let freedMemory = 0;
    
    setCache(prevCache => {
      const newCache = new Map();
      const sortedEntries = Array.from(prevCache.entries())
        .sort(([, a], [, b]) => b.timestamp - a.timestamp); // Sort by timestamp, newest first
      
      let currentMemory = 0;
      
      for (const [id, cached] of sortedEntries) {
        // Remove expired entries
        if (now - cached.timestamp > CACHE_EXPIRY) {
          freedMemory += cached.metadata.size;
          continue;
        }
        
        // Keep entries that fit within memory limit
        if (currentMemory + cached.metadata.size <= MAX_MEMORY_USAGE) {
          newCache.set(id, cached);
          currentMemory += cached.metadata.size;
        } else {
          freedMemory += cached.metadata.size;
        }
      }
      
      return newCache;
    });
    
    setMemoryUsage(prev => prev - freedMemory);
  }, []);

  const clearCache = useCallback(() => {
    setCache(new Map());
    setMemoryUsage(0);
    localStorage.removeItem(CACHE_KEY);
  }, []);

  const getCacheStats = useCallback(() => {
    return {
      totalItems: cache.size,
      memoryUsage,
      memoryUsageFormatted: `${(memoryUsage / 1024 / 1024).toFixed(1)}MB`,
      maxMemoryUsage: MAX_MEMORY_USAGE,
      maxItems: MAX_CACHE_SIZE,
      utilizationPercent: Math.round((memoryUsage / MAX_MEMORY_USAGE) * 100)
    };
  }, [cache.size, memoryUsage]);

  const getRecentUploads = useCallback(() => {
    return Array.from(cache.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
  }, [cache]);

  return {
    addToCache,
    getFromCache,
    getFromCacheByFile,
    removeFromCache,
    updateCacheStatus,
    cleanup,
    clearCache,
    getCacheStats,
    getRecentUploads,
    cache: Array.from(cache.values())
  };
};
