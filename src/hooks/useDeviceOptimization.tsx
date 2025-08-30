import { useState, useEffect, useCallback } from 'react';

interface DeviceCapabilities {
  isMobile: boolean;
  isLowEndDevice: boolean;
  hasHardwareAcceleration: boolean;
  supportedVideoFormats: string[];
  maxVideoResolution: { width: number; height: number };
  availableMemory?: number;
  connectionType?: string;
  connectionSpeed?: 'slow' | 'fast' | 'unknown';
}

interface OptimizationSettings {
  maxVideoSize: number;
  maxVideoResolution: { width: number; height: number };
  compressionQuality: number;
  enablePreloading: boolean;
  enableCaching: boolean;
  maxCacheSize: number;
  chunkSize: number;
  maxConcurrentUploads: number;
}

const DEFAULT_SETTINGS: OptimizationSettings = {
  maxVideoSize: 50 * 1024 * 1024, // 50MB
  maxVideoResolution: { width: 1920, height: 1080 },
  compressionQuality: 0.8,
  enablePreloading: true,
  enableCaching: true,
  maxCacheSize: 100 * 1024 * 1024, // 100MB
  chunkSize: 1024 * 1024, // 1MB
  maxConcurrentUploads: 2
};

export const useDeviceOptimization = () => {
  const [deviceCapabilities, setDeviceCapabilities] = useState<DeviceCapabilities | null>(null);
  const [optimizationSettings, setOptimizationSettings] = useState<OptimizationSettings>(DEFAULT_SETTINGS);
  const [networkStatus, setNetworkStatus] = useState<{
    isOnline: boolean;
    connectionType?: string;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  }>({ isOnline: navigator.onLine });

  // Detect device capabilities
  useEffect(() => {
    const detectCapabilities = async () => {
      const capabilities: DeviceCapabilities = {
        isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
        isLowEndDevice: navigator.hardwareConcurrency <= 2,
        hasHardwareAcceleration: false,
        supportedVideoFormats: [],
        maxVideoResolution: { width: 1920, height: 1080 }
      };

      // Check for hardware acceleration
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        capabilities.hasHardwareAcceleration = !!gl;
      } catch (e) {
        capabilities.hasHardwareAcceleration = false;
      }

      // Detect supported video formats
      const video = document.createElement('video');
      const formats = [
        { mime: 'video/webm; codecs="vp9"', format: 'webm-vp9' },
        { mime: 'video/webm; codecs="vp8"', format: 'webm-vp8' },
        { mime: 'video/mp4; codecs="avc1.42E01E"', format: 'mp4-h264' },
        { mime: 'video/mp4; codecs="hev1.1.6.L93.B0"', format: 'mp4-h265' }
      ];

      capabilities.supportedVideoFormats = formats
        .filter(({ mime }) => video.canPlayType(mime) === 'probably')
        .map(({ format }) => format);

      // Estimate memory (approximate)
      if ('memory' in navigator) {
        capabilities.availableMemory = (navigator as any).memory?.jsHeapSizeLimit;
      }

      // Detect connection type
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        capabilities.connectionType = connection?.effectiveType;
      }

      setDeviceCapabilities(capabilities);
    };

    detectCapabilities();
  }, []);

  // Monitor network status
  useEffect(() => {
    const updateNetworkStatus = () => {
      const status = { isOnline: navigator.onLine };
      
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        Object.assign(status, {
          connectionType: connection?.type,
          effectiveType: connection?.effectiveType,
          downlink: connection?.downlink,
          rtt: connection?.rtt
        });
      }
      
      setNetworkStatus(status);
    };

    updateNetworkStatus();
    
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    
    if ('connection' in navigator) {
      (navigator as any).connection?.addEventListener('change', updateNetworkStatus);
    }

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
      if ('connection' in navigator) {
        (navigator as any).connection?.removeEventListener('change', updateNetworkStatus);
      }
    };
  }, []);

  // Generate optimized settings based on device capabilities
  useEffect(() => {
    if (!deviceCapabilities) return;

    let settings = { ...DEFAULT_SETTINGS };

    // Mobile optimizations
    if (deviceCapabilities.isMobile) {
      settings.maxVideoSize = 30 * 1024 * 1024; // 30MB
      settings.maxVideoResolution = { width: 1280, height: 720 };
      settings.compressionQuality = 0.75;
      settings.maxCacheSize = 50 * 1024 * 1024; // 50MB
      settings.chunkSize = 512 * 1024; // 512KB
      settings.maxConcurrentUploads = 1;
    }

    // Low-end device optimizations
    if (deviceCapabilities.isLowEndDevice) {
      settings.maxVideoSize = 20 * 1024 * 1024; // 20MB
      settings.maxVideoResolution = { width: 960, height: 540 };
      settings.compressionQuality = 0.7;
      settings.enablePreloading = false;
      settings.maxCacheSize = 25 * 1024 * 1024; // 25MB
      settings.chunkSize = 256 * 1024; // 256KB
      settings.maxConcurrentUploads = 1;
    }

    // Network-based optimizations
    const effectiveType = networkStatus.effectiveType;
    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      settings.maxVideoSize = 10 * 1024 * 1024; // 10MB
      settings.maxVideoResolution = { width: 640, height: 360 };
      settings.compressionQuality = 0.6;
      settings.enablePreloading = false;
      settings.enableCaching = false;
      settings.chunkSize = 128 * 1024; // 128KB
    } else if (effectiveType === '3g') {
      settings.maxVideoSize = 25 * 1024 * 1024; // 25MB
      settings.maxVideoResolution = { width: 960, height: 540 };
      settings.compressionQuality = 0.7;
      settings.chunkSize = 512 * 1024; // 512KB
    }

    // Hardware acceleration optimizations
    if (!deviceCapabilities.hasHardwareAcceleration) {
      settings.compressionQuality = Math.min(settings.compressionQuality, 0.75);
      settings.maxConcurrentUploads = 1;
    }

    setOptimizationSettings(settings);
  }, [deviceCapabilities, networkStatus]);

  const getOptimalVideoFormat = useCallback(() => {
    if (!deviceCapabilities) return 'mp4';
    
    // Prefer WebM VP9 for modern browsers with hardware acceleration
    if (deviceCapabilities.supportedVideoFormats.includes('webm-vp9') && 
        deviceCapabilities.hasHardwareAcceleration) {
      return 'webm';
    }
    
    // Fallback to MP4 H.264 for broader compatibility
    if (deviceCapabilities.supportedVideoFormats.includes('mp4-h264')) {
      return 'mp4';
    }
    
    return 'webm'; // Default fallback
  }, [deviceCapabilities]);

  const shouldPreloadVideo = useCallback((fileSize: number) => {
    if (!optimizationSettings.enablePreloading) return false;
    if (!networkStatus.isOnline) return false;
    
    // Don't preload on slow connections or for large files
    const effectiveType = networkStatus.effectiveType;
    if (effectiveType === 'slow-2g' || effectiveType === '2g') return false;
    if (fileSize > optimizationSettings.maxVideoSize * 0.5) return false;
    
    return true;
  }, [optimizationSettings, networkStatus]);

  const getChunkSize = useCallback((fileSize: number) => {
    // Adjust chunk size based on file size and network conditions
    let chunkSize = optimizationSettings.chunkSize;
    
    if (fileSize < 5 * 1024 * 1024) { // < 5MB
      chunkSize = Math.min(chunkSize, 256 * 1024); // 256KB
    } else if (fileSize > 50 * 1024 * 1024) { // > 50MB
      chunkSize = Math.max(chunkSize, 2 * 1024 * 1024); // 2MB
    }
    
    // Adjust for network speed
    const effectiveType = networkStatus.effectiveType;
    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      chunkSize = Math.min(chunkSize, 128 * 1024); // 128KB
    } else if (effectiveType === '4g') {
      chunkSize = Math.max(chunkSize, 1024 * 1024); // 1MB
    }
    
    return chunkSize;
  }, [optimizationSettings, networkStatus]);

  const getPerformanceMetrics = useCallback(() => {
    return {
      deviceCapabilities,
      optimizationSettings,
      networkStatus,
      recommendations: {
        optimalFormat: getOptimalVideoFormat(),
        shouldEnablePreloading: optimizationSettings.enablePreloading,
        shouldEnableCaching: optimizationSettings.enableCaching,
        maxRecommendedFileSize: optimizationSettings.maxVideoSize,
        recommendedResolution: optimizationSettings.maxVideoResolution
      }
    };
  }, [deviceCapabilities, optimizationSettings, networkStatus, getOptimalVideoFormat]);

  return {
    deviceCapabilities,
    optimizationSettings,
    networkStatus,
    getOptimalVideoFormat,
    shouldPreloadVideo,
    getChunkSize,
    getPerformanceMetrics
  };
};