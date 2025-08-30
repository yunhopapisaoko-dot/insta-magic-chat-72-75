import { useState, useEffect, useCallback, useRef } from 'react';

interface MemoryStats {
  used: number;
  total: number;
  limit: number;
  percentage: number;
  isLowMemory: boolean;
  isCriticalMemory: boolean;
}

interface ManagedResource {
  id: string;
  type: 'video' | 'image' | 'blob' | 'url';
  size: number;
  data: any;
  lastAccessed: number;
  priority: 'low' | 'medium' | 'high';
}

const MEMORY_WARNING_THRESHOLD = 0.7; // 70%
const MEMORY_CRITICAL_THRESHOLD = 0.9; // 90%
const CLEANUP_INTERVAL = 30000; // 30 seconds
const MAX_IDLE_TIME = 300000; // 5 minutes

export const useMemoryManager = () => {
  const [memoryStats, setMemoryStats] = useState<MemoryStats>({
    used: 0,
    total: 0,
    limit: 0,
    percentage: 0,
    isLowMemory: false,
    isCriticalMemory: false
  });
  
  const resourcesRef = useRef<Map<string, ManagedResource>>(new Map());
  const urlObjectsRef = useRef<Set<string>>(new Set());
  const cleanupIntervalRef = useRef<NodeJS.Timeout>();

  // Monitor memory usage
  const updateMemoryStats = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const stats: MemoryStats = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        percentage: memory.usedJSHeapSize / memory.jsHeapSizeLimit,
        isLowMemory: memory.usedJSHeapSize / memory.jsHeapSizeLimit > MEMORY_WARNING_THRESHOLD,
        isCriticalMemory: memory.usedJSHeapSize / memory.jsHeapSizeLimit > MEMORY_CRITICAL_THRESHOLD
      };
      setMemoryStats(stats);
      return stats;
    }
    
    // Fallback estimation
    const resourcesSize = Array.from(resourcesRef.current.values())
      .reduce((total, resource) => total + resource.size, 0);
    
    const estimatedLimit = 100 * 1024 * 1024; // 100MB estimate
    const stats: MemoryStats = {
      used: resourcesSize,
      total: resourcesSize,
      limit: estimatedLimit,
      percentage: resourcesSize / estimatedLimit,
      isLowMemory: resourcesSize / estimatedLimit > MEMORY_WARNING_THRESHOLD,
      isCriticalMemory: resourcesSize / estimatedLimit > MEMORY_CRITICAL_THRESHOLD
    };
    
    setMemoryStats(stats);
    return stats;
  }, []);

  // Register a resource for memory management
  const registerResource = useCallback((
    id: string,
    type: ManagedResource['type'],
    data: any,
    size?: number,
    priority: ManagedResource['priority'] = 'medium'
  ) => {
    let estimatedSize = size;
    
    if (!estimatedSize) {
      // Estimate size based on type and data
      switch (type) {
        case 'video':
        case 'blob':
          estimatedSize = data instanceof Blob ? data.size : 0;
          break;
        case 'image':
          estimatedSize = data instanceof File ? data.size : 
                        typeof data === 'string' ? data.length : 1024; // Base64 estimate
          break;
        case 'url':
          estimatedSize = 100; // Minimal overhead for URL objects
          break;
        default:
          estimatedSize = 1024; // Default estimate
      }
    }

    const resource: ManagedResource = {
      id,
      type,
      size: estimatedSize,
      data,
      lastAccessed: Date.now(),
      priority
    };

    resourcesRef.current.set(id, resource);
    
    // Track URL objects for cleanup
    if (type === 'url' && typeof data === 'string' && data.startsWith('blob:')) {
      urlObjectsRef.current.add(data);
    }

    updateMemoryStats();
  }, [updateMemoryStats]);

  // Access a resource (updates last accessed time)
  const accessResource = useCallback((id: string) => {
    const resource = resourcesRef.current.get(id);
    if (resource) {
      resource.lastAccessed = Date.now();
      return resource.data;
    }
    return null;
  }, []);

  // Release a specific resource
  const releaseResource = useCallback((id: string) => {
    const resource = resourcesRef.current.get(id);
    if (resource) {
      // Clean up URL objects
      if (resource.type === 'url' && typeof resource.data === 'string') {
        try {
          URL.revokeObjectURL(resource.data);
          urlObjectsRef.current.delete(resource.data);
        } catch (error) {
          console.warn('Failed to revoke URL object:', error);
        }
      }
      
      resourcesRef.current.delete(id);
      updateMemoryStats();
      return true;
    }
    return false;
  }, [updateMemoryStats]);

  // Automatic cleanup of old resources
  const performCleanup = useCallback((force = false) => {
    const now = Date.now();
    const stats = updateMemoryStats();
    const shouldCleanup = force || stats.isLowMemory;
    
    if (!shouldCleanup) return { cleaned: 0, freedMemory: 0 };

    let cleaned = 0;
    let freedMemory = 0;
    const resourcesToDelete: string[] = [];

    // Collect resources to delete
    resourcesRef.current.forEach((resource, id) => {
      const idleTime = now - resource.lastAccessed;
      const shouldDelete = force || 
        (stats.isCriticalMemory) ||
        (stats.isLowMemory && idleTime > MAX_IDLE_TIME) ||
        (resource.priority === 'low' && idleTime > MAX_IDLE_TIME / 2);

      if (shouldDelete) {
        resourcesToDelete.push(id);
        freedMemory += resource.size;
      }
    });

    // Sort by priority (low priority first) and age
    resourcesToDelete.sort((a, b) => {
      const resourceA = resourcesRef.current.get(a)!;
      const resourceB = resourcesRef.current.get(b)!;
      
      // Priority order: low -> medium -> high
      const priorityOrder = { low: 0, medium: 1, high: 2 };
      const priorityDiff = priorityOrder[resourceA.priority] - priorityOrder[resourceB.priority];
      
      if (priorityDiff !== 0) return priorityDiff;
      
      // If same priority, delete oldest first
      return resourceA.lastAccessed - resourceB.lastAccessed;
    });

    // Delete resources
    resourcesToDelete.forEach(id => {
      if (releaseResource(id)) {
        cleaned++;
      }
    });

    console.log(`Memory cleanup: released ${cleaned} resources, freed ${(freedMemory / 1024 / 1024).toFixed(2)}MB`);
    
    return { cleaned, freedMemory };
  }, [updateMemoryStats, releaseResource]);

  // Force garbage collection if available
  const forceGarbageCollection = useCallback(() => {
    if ('gc' in window && typeof (window as any).gc === 'function') {
      try {
        (window as any).gc();
        console.log('Forced garbage collection');
      } catch (error) {
        console.warn('Failed to force garbage collection:', error);
      }
    }
    
    // Cleanup our managed resources
    performCleanup(true);
    
    // Update stats after cleanup
    setTimeout(updateMemoryStats, 100);
  }, [performCleanup, updateMemoryStats]);

  // Get memory usage recommendations
  const getMemoryRecommendations = useCallback(() => {
    const stats = updateMemoryStats();
    const recommendations: string[] = [];

    if (stats.isCriticalMemory) {
      recommendations.push('Memória crítica: libere recursos imediatamente');
      recommendations.push('Desative pré-carregamento de vídeos');
      recommendations.push('Limpe o cache de uploads');
    } else if (stats.isLowMemory) {
      recommendations.push('Memória baixa: considere reduzir qualidade de vídeo');
      recommendations.push('Limite uploads simultâneos');
    }

    if (stats.percentage > 0.5) {
      recommendations.push('Considere comprimir vídeos antes do upload');
    }

    if (resourcesRef.current.size > 50) {
      recommendations.push('Muitos recursos em memória: limpeza recomendada');
    }

    return {
      stats,
      recommendations,
      shouldCleanup: stats.isLowMemory,
      shouldReduceQuality: stats.isCriticalMemory
    };
  }, [updateMemoryStats]);

  // Create URL with automatic cleanup
  const createManagedURL = useCallback((blob: Blob, priority: ManagedResource['priority'] = 'medium') => {
    const url = URL.createObjectURL(blob);
    const id = `url_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    registerResource(id, 'url', url, blob.size, priority);
    
    return { url, id };
  }, [registerResource]);

  // Setup cleanup interval
  useEffect(() => {
    const startCleanupInterval = () => {
      cleanupIntervalRef.current = setInterval(() => {
        performCleanup();
      }, CLEANUP_INTERVAL);
    };

    startCleanupInterval();
    updateMemoryStats(); // Initial update

    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
      
      // Cleanup all URL objects on unmount
      urlObjectsRef.current.forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch (error) {
          console.warn('Failed to cleanup URL on unmount:', error);
        }
      });
    };
  }, [performCleanup, updateMemoryStats]);

  // Listen for memory pressure events
  useEffect(() => {
    const handleMemoryPressure = () => {
      console.warn('Memory pressure detected, performing cleanup');
      performCleanup(true);
    };

    // Listen for various memory pressure indicators
    if ('memory' in performance) {
      const checkMemoryPressure = () => {
        const stats = updateMemoryStats();
        if (stats.isCriticalMemory) {
          handleMemoryPressure();
        }
      };
      
      const pressureInterval = setInterval(checkMemoryPressure, 5000);
      
      return () => clearInterval(pressureInterval);
    }
  }, [performCleanup, updateMemoryStats]);

  return {
    memoryStats,
    registerResource,
    accessResource,
    releaseResource,
    performCleanup,
    forceGarbageCollection,
    getMemoryRecommendations,
    createManagedURL,
    totalManagedResources: resourcesRef.current.size
  };
};