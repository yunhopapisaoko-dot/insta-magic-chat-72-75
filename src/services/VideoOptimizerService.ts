import { toast } from '@/hooks/use-toast';

interface OptimizationResult {
  optimizedBlob: Blob;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  processingTime: number;
  thumbnail?: string;
  preview?: string;
}

interface OptimizationOptions {
  targetSize?: number;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  fps?: number;
  generateThumbnail?: boolean;
  generatePreview?: boolean;
  onProgress?: (progress: number, stage: string) => void;
}

class VideoOptimizerService {
  private static instance: VideoOptimizerService;
  private processingQueue: Array<{ id: string; promise: Promise<any> }> = [];
  private maxConcurrentProcessing = 2;

  static getInstance(): VideoOptimizerService {
    if (!VideoOptimizerService.instance) {
      VideoOptimizerService.instance = new VideoOptimizerService();
    }
    return VideoOptimizerService.instance;
  }

  async optimizeVideo(
    file: File,
    options: OptimizationOptions = {}
  ): Promise<OptimizationResult> {
    const startTime = Date.now();
    const onProgress = options.onProgress || (() => {});

    try {
      onProgress(5, 'Iniciando análise do vídeo...');

      // Check if we need to queue this processing
      if (this.processingQueue.length >= this.maxConcurrentProcessing) {
        onProgress(10, 'Aguardando processamento...');
        await this.waitForProcessingSlot();
      }

      const processingId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const processingPromise = this.performOptimization(file, options, onProgress);
      this.processingQueue.push({ id: processingId, promise: processingPromise });

      try {
        const result = await processingPromise;
        result.processingTime = Date.now() - startTime;
        return result;
      } finally {
        // Remove from queue
        this.processingQueue = this.processingQueue.filter(item => item.id !== processingId);
      }

    } catch (error) {
      console.error('Video optimization failed:', error);
      throw error;
    }
  }

  private async waitForProcessingSlot(): Promise<void> {
    while (this.processingQueue.length >= this.maxConcurrentProcessing) {
      await Promise.race(this.processingQueue.map(item => item.promise));
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
    }
  }

  private async performOptimization(
    file: File,
    options: OptimizationOptions,
    onProgress: (progress: number, stage: string) => void
  ): Promise<OptimizationResult> {
    onProgress(15, 'Carregando metadados do vídeo...');

    // Load video to get metadata
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    const videoMetadata = await new Promise<{
      duration: number;
      width: number;
      height: number;
    }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout loading video metadata')), 30000);
      
      video.onloadedmetadata = () => {
        clearTimeout(timeout);
        resolve({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight
        });
      };
      
      video.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Failed to load video metadata'));
      };
      
      video.src = URL.createObjectURL(file);
    });

    onProgress(25, 'Analisando configurações ótimas...');

    // Calculate optimal settings
    const optimalSettings = await this.calculateOptimalSettings(file, videoMetadata, options);
    
    onProgress(35, 'Configurando processamento...');

    // Create canvas for processing
    const canvas = document.createElement('canvas');
    canvas.width = optimalSettings.targetWidth;
    canvas.height = optimalSettings.targetHeight;
    const ctx = canvas.getContext('2d')!;

    // Setup video processing stream
    const stream = canvas.captureStream(optimalSettings.fps);
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: optimalSettings.mimeType,
      videoBitsPerSecond: optimalSettings.bitrate
    });

    onProgress(45, 'Iniciando compressão...');

    // Process video
    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

    const compressionPromise = new Promise<Blob>((resolve) => {
      mediaRecorder.onstop = () => {
        const optimizedBlob = new Blob(chunks, { type: optimalSettings.mimeType });
        resolve(optimizedBlob);
      };
    });

    mediaRecorder.start();

    // Process frames
    await this.processVideoFrames(
      video,
      canvas,
      ctx,
      videoMetadata,
      optimalSettings,
      (frameProgress) => {
        const totalProgress = 45 + (frameProgress * 0.4); // 45% to 85%
        onProgress(totalProgress, 'Processando frames...');
      }
    );

    mediaRecorder.stop();
    const optimizedBlob = await compressionPromise;

    onProgress(90, 'Gerando thumbnail...');

    // Generate thumbnail and preview if requested
    let thumbnail: string | undefined;
    let preview: string | undefined;

    if (options.generateThumbnail) {
      thumbnail = await this.generateThumbnail(video, videoMetadata);
    }

    if (options.generatePreview) {
      preview = await this.generatePreview(video, videoMetadata);
    }

    onProgress(100, 'Finalizado!');

    // Cleanup
    URL.revokeObjectURL(video.src);

    const result: OptimizationResult = {
      optimizedBlob,
      originalSize: file.size,
      optimizedSize: optimizedBlob.size,
      compressionRatio: Math.round(((file.size - optimizedBlob.size) / file.size) * 100),
      processingTime: 0, // Will be set by caller
      thumbnail,
      preview
    };

    return result;
  }

  private async calculateOptimalSettings(
    file: File,
    metadata: { duration: number; width: number; height: number },
    options: OptimizationOptions
  ) {
    // Device capability detection
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isLowEnd = navigator.hardwareConcurrency <= 2;
    
    // Base settings
    let targetWidth = options.maxWidth || 1280;
    let targetHeight = options.maxHeight || 720;
    let quality = options.quality || 0.8;
    let fps = options.fps || 30;
    let bitrate = 1500000; // 1.5 Mbps default

    // Adjust for device capabilities
    if (isMobile) {
      targetWidth = Math.min(targetWidth, 1280);
      targetHeight = Math.min(targetHeight, 720);
      quality = Math.min(quality, 0.75);
      fps = Math.min(fps, 30);
      bitrate = Math.min(bitrate, 1200000);
    }

    if (isLowEnd) {
      targetWidth = Math.min(targetWidth, 960);
      targetHeight = Math.min(targetHeight, 540);
      quality = Math.min(quality, 0.7);
      fps = Math.min(fps, 24);
      bitrate = Math.min(bitrate, 800000);
    }

    // Calculate optimal dimensions maintaining aspect ratio
    const aspectRatio = metadata.width / metadata.height;
    
    if (aspectRatio > 1) {
      // Landscape
      if (metadata.width > targetWidth) {
        targetHeight = Math.round(targetWidth / aspectRatio);
      } else {
        targetWidth = metadata.width;
        targetHeight = metadata.height;
      }
    } else {
      // Portrait or square
      if (metadata.height > targetHeight) {
        targetWidth = Math.round(targetHeight * aspectRatio);
      } else {
        targetWidth = metadata.width;
        targetHeight = metadata.height;
      }
    }

    // Ensure even dimensions (required for some codecs)
    targetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth - 1;
    targetHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight - 1;

    // Detect best supported format
    const video = document.createElement('video');
    let mimeType = 'video/webm; codecs=vp9';
    
    if (video.canPlayType('video/webm; codecs=vp9') !== 'probably') {
      if (video.canPlayType('video/webm; codecs=vp8') === 'probably') {
        mimeType = 'video/webm; codecs=vp8';
      } else if (video.canPlayType('video/mp4; codecs="avc1.42E01E"') === 'probably') {
        mimeType = 'video/mp4; codecs="avc1.42E01E"';
        bitrate = bitrate * 1.2; // H.264 typically needs higher bitrate
      }
    }

    // Adjust bitrate based on resolution and duration
    const pixelCount = targetWidth * targetHeight;
    const basePixelCount = 1280 * 720;
    const resolutionFactor = pixelCount / basePixelCount;
    
    bitrate = Math.round(bitrate * resolutionFactor);
    
    // Adjust for video duration (longer videos can use lower bitrate)
    if (metadata.duration > 30) {
      bitrate = Math.round(bitrate * 0.8);
    }

    // Target size constraint
    if (options.targetSize) {
      const targetBitrate = (options.targetSize * 8) / metadata.duration;
      bitrate = Math.min(bitrate, targetBitrate);
    }

    return {
      targetWidth,
      targetHeight,
      quality,
      fps,
      bitrate,
      mimeType
    };
  }

  private async processVideoFrames(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    metadata: { duration: number; width: number; height: number },
    settings: any,
    onProgress: (progress: number) => void
  ): Promise<void> {
    return new Promise((resolve) => {
      let currentTime = 0;
      const frameInterval = 1 / settings.fps;
      let processedFrames = 0;
      const totalFrames = Math.ceil(metadata.duration * settings.fps);

      const processNextFrame = () => {
        if (currentTime >= metadata.duration) {
          resolve();
          return;
        }

        video.currentTime = currentTime;
      };

      video.onseeked = () => {
        // Draw current frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        processedFrames++;
        const progress = (processedFrames / totalFrames) * 100;
        onProgress(progress);

        currentTime += frameInterval;
        
        // Use requestAnimationFrame for smooth processing
        requestAnimationFrame(processNextFrame);
      };

      // Start processing
      processNextFrame();
    });
  }

  private async generateThumbnail(
    video: HTMLVideoElement,
    metadata: { duration: number; width: number; height: number }
  ): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const ctx = canvas.getContext('2d')!;

    // Seek to 10% of the video for thumbnail
    video.currentTime = metadata.duration * 0.1;
    
    await new Promise(resolve => {
      video.onseeked = resolve;
    });

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  }

  private async generatePreview(
    video: HTMLVideoElement,
    metadata: { duration: number; width: number; height: number }
  ): Promise<string> {
    // For now, return the thumbnail as preview
    // In a real implementation, you might create a short video clip or animated GIF
    return this.generateThumbnail(video, metadata);
  }

  // Utility method to estimate processing time
  estimateProcessingTime(fileSize: number, duration: number): number {
    // Rough estimation based on file size and duration
    // This is device-dependent and should be calibrated based on real measurements
    const baseMsPerMB = 3000; // 3 seconds per MB baseline
    const durationFactor = Math.max(1, duration / 10); // Scale with duration
    const deviceFactor = navigator.hardwareConcurrency / 4; // Scale with CPU cores
    
    const estimatedMs = (fileSize / (1024 * 1024)) * baseMsPerMB * durationFactor / deviceFactor;
    return Math.max(5000, estimatedMs); // Minimum 5 seconds
  }

  // Get processing queue status
  getProcessingStatus() {
    return {
      queueLength: this.processingQueue.length,
      maxConcurrent: this.maxConcurrentProcessing,
      isProcessing: this.processingQueue.length > 0
    };
  }
}

export default VideoOptimizerService;