import { useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  bitrate?: number;
  fps?: number;
  format?: string;
}

export interface CompressionProgress {
  stage: 'analyzing' | 'compressing' | 'finalizing';
  progress: number;
  estimatedTimeLeft?: number;
}

const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
  maxWidth: 1280,
  maxHeight: 720,
  quality: 0.8,
  bitrate: 1000000, // 1Mbps
  fps: 30,
  format: 'webm'
};

export const useVideoCompression = () => {
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState<CompressionProgress | null>(null);
  const [compressionStats, setCompressionStats] = useState<{
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    timeTaken: number;
  } | null>(null);

  const compressVideo = useCallback(async (
    file: File,
    options: CompressionOptions = {}
  ): Promise<Blob> => {
    const opts = { ...DEFAULT_COMPRESSION_OPTIONS, ...options };
    const startTime = Date.now();
    
    setIsCompressing(true);
    setCompressionProgress({ stage: 'analyzing', progress: 0 });
    setCompressionStats(null);

    try {
      // Check if device supports hardware acceleration
      const isLowEndDevice = navigator.hardwareConcurrency <= 2;
      if (isLowEndDevice) {
        opts.maxWidth = Math.min(opts.maxWidth || 1280, 960);
        opts.maxHeight = Math.min(opts.maxHeight || 720, 540);
        opts.quality = Math.min(opts.quality || 0.8, 0.7);
      }

      // Step 1: Analyze video
      setCompressionProgress({ stage: 'analyzing', progress: 10 });
      
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      const videoInfo = await new Promise<{
        duration: number;
        width: number;
        height: number;
      }>((resolve, reject) => {
        video.onloadedmetadata = () => {
          resolve({
            duration: video.duration,
            width: video.videoWidth,
            height: video.videoHeight
          });
        };
        video.onerror = reject;
        video.src = URL.createObjectURL(file);
      });

      setCompressionProgress({ stage: 'analyzing', progress: 30 });

      // Calculate optimal dimensions
      const aspectRatio = videoInfo.width / videoInfo.height;
      let targetWidth = opts.maxWidth!;
      let targetHeight = opts.maxHeight!;

      if (aspectRatio > 1) {
        // Landscape
        targetHeight = Math.round(targetWidth / aspectRatio);
      } else {
        // Portrait or square
        targetWidth = Math.round(targetHeight * aspectRatio);
      }

      // Ensure dimensions are even (required for some codecs)
      targetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth - 1;
      targetHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight - 1;

      setCompressionProgress({ stage: 'compressing', progress: 40 });

      // Step 2: Compress using Canvas and MediaRecorder API
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d')!;

      const stream = canvas.captureStream(opts.fps);
      const recorder = new MediaRecorder(stream, {
        mimeType: `video/${opts.format}; codecs=${opts.format === 'webm' ? 'vp9' : 'avc1'}`,
        videoBitsPerSecond: opts.bitrate
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);

      const compressionPromise = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          const compressedBlob = new Blob(chunks, { type: `video/${opts.format}` });
          resolve(compressedBlob);
        };
      });

      recorder.start();

      // Step 3: Process video frames
      video.currentTime = 0;
      let processedFrames = 0;
      const totalFrames = Math.ceil(videoInfo.duration * opts.fps!);

      const processFrame = () => {
        if (video.currentTime >= videoInfo.duration) {
          recorder.stop();
          return;
        }

        // Draw frame to canvas
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
        
        processedFrames++;
        const progress = 40 + Math.round((processedFrames / totalFrames) * 50);
        const estimatedTimeLeft = ((Date.now() - startTime) / processedFrames) * (totalFrames - processedFrames);
        
        setCompressionProgress({ 
          stage: 'compressing', 
          progress,
          estimatedTimeLeft 
        });

        // Move to next frame
        video.currentTime += 1 / opts.fps!;
      };

      video.onseeked = processFrame;
      video.currentTime = 0;

      const compressedBlob = await compressionPromise;

      setCompressionProgress({ stage: 'finalizing', progress: 95 });

      // Clean up
      URL.revokeObjectURL(video.src);

      // Calculate compression stats
      const endTime = Date.now();
      const stats = {
        originalSize: file.size,
        compressedSize: compressedBlob.size,
        compressionRatio: Math.round(((file.size - compressedBlob.size) / file.size) * 100),
        timeTaken: endTime - startTime
      };

      setCompressionStats(stats);
      setCompressionProgress({ stage: 'finalizing', progress: 100 });

      // Show success message
      toast({
        title: "✅ Vídeo comprimido com sucesso",
        description: `Redução: ${stats.compressionRatio}% (${(stats.originalSize / 1024 / 1024).toFixed(1)}MB → ${(stats.compressedSize / 1024 / 1024).toFixed(1)}MB)`,
      });

      return compressedBlob;

    } catch (error) {
      console.error('Compression error:', error);
      toast({
        title: "❌ Erro na compressão",
        description: "Não foi possível comprimir o vídeo. Usando arquivo original.",
        variant: "destructive",
      });
      
      // Return original file if compression fails
      return file;
    } finally {
      setIsCompressing(false);
      setTimeout(() => {
        setCompressionProgress(null);
      }, 2000);
    }
  }, []);

  const getRecommendedSettings = useCallback((fileSize: number, duration: number) => {
    const megabytes = fileSize / (1024 * 1024);
    
    // Aggressive compression for large files
    if (megabytes > 50 || duration > 30) {
      return {
        maxWidth: 960,
        maxHeight: 540,
        quality: 0.7,
        bitrate: 800000,
        fps: 24
      };
    }
    
    // Moderate compression for medium files
    if (megabytes > 20) {
      return {
        maxWidth: 1280,
        maxHeight: 720,
        quality: 0.75,
        bitrate: 1200000,
        fps: 30
      };
    }

    // Light compression for small files
    return DEFAULT_COMPRESSION_OPTIONS;
  }, []);

  return {
    compressVideo,
    isCompressing,
    compressionProgress,
    compressionStats,
    getRecommendedSettings
  };
};