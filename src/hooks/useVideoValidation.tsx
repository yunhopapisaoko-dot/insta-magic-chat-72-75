import { useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

export interface VideoValidationConfig {
  maxSizeBytes?: number;
  maxDurationSeconds?: number;
  allowedFormats?: string[];
  minDurationSeconds?: number;
}

export interface VideoValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileInfo?: {
    size: number;
    duration: number;
    format: string;
    width: number;
    height: number;
  };
}

const DEFAULT_CONFIG: VideoValidationConfig = {
  maxSizeBytes: 500 * 1024 * 1024, // 500MB
  maxDurationSeconds: 600, // 10 minutes
  minDurationSeconds: 0.5, // 0.5 seconds
  allowedFormats: ['video/mp4', 'video/webm', 'video/mov', 'video/avi', 'video/quicktime']
};

export const useVideoValidation = (config: VideoValidationConfig = {}) => {
  const [isValidating, setIsValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState(0);
  
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const validateVideo = useCallback(async (file: File): Promise<VideoValidationResult> => {
    setIsValidating(true);
    setValidationProgress(0);
    
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Step 1: Basic file validation (10%)
      setValidationProgress(10);
      
      if (!file) {
        errors.push('Nenhum arquivo selecionado');
        return { isValid: false, errors, warnings };
      }

      // Step 2: File size validation (20%)
      setValidationProgress(20);
      
      if (file.size > finalConfig.maxSizeBytes!) {
        errors.push(`Arquivo muito grande. Máximo: ${(finalConfig.maxSizeBytes! / (1024 * 1024)).toFixed(0)}MB`);
      }

      // Step 3: File format validation (30%)
      setValidationProgress(30);
      
      if (!finalConfig.allowedFormats!.includes(file.type)) {
        errors.push(`Formato não suportado. Formatos aceitos: ${finalConfig.allowedFormats!.map(f => f.split('/')[1]).join(', ')}`);
      }

      // Step 4: Video metadata validation (40%)
      setValidationProgress(40);
      
      const videoElement = document.createElement('video');
      videoElement.preload = 'metadata';
      
      const videoInfo = await new Promise<{
        duration: number;
        width: number;
        height: number;
      }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout ao carregar metadados do vídeo'));
        }, 10000);

        videoElement.onloadedmetadata = () => {
          clearTimeout(timeout);
          resolve({
            duration: videoElement.duration,
            width: videoElement.videoWidth,
            height: videoElement.videoHeight
          });
        };

        videoElement.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Erro ao carregar o vídeo. Arquivo pode estar corrompido.'));
        };

        videoElement.src = URL.createObjectURL(file);
      });

      // Step 5: Duration validation (60%)
      setValidationProgress(60);
      
      if (!Number.isFinite(videoInfo.duration) || videoInfo.duration <= 0) {
        errors.push('Não foi possível determinar a duração do vídeo');
      } else {
        if (videoInfo.duration > finalConfig.maxDurationSeconds!) {
          errors.push(`Vídeo muito longo. Máximo: ${finalConfig.maxDurationSeconds}s (${Math.floor(finalConfig.maxDurationSeconds! / 60)}:${(finalConfig.maxDurationSeconds! % 60).toString().padStart(2, '0')})`);
        }
        
        if (videoInfo.duration < finalConfig.minDurationSeconds!) {
          errors.push(`Vídeo muito curto. Mínimo: ${finalConfig.minDurationSeconds}s`);
        }
      }

      // Step 6: Resolution validation (80%)
      setValidationProgress(80);
      
      if (videoInfo.width === 0 || videoInfo.height === 0) {
        errors.push('Não foi possível determinar a resolução do vídeo');
      } else {
        // Add resolution warnings/recommendations
        if (videoInfo.width < 480 || videoInfo.height < 480) {
          warnings.push('Resolução baixa. Recomendado: mínimo 480p');
        }
        
        if (videoInfo.width > 4096 || videoInfo.height > 4096) {
          warnings.push('Resolução muito alta. Pode afetar o desempenho.');
        }
      }

      // Step 7: Additional checks (90%)
      setValidationProgress(90);
      
      // Check aspect ratio for mobile optimization
      const aspectRatio = videoInfo.width / videoInfo.height;
      if (aspectRatio < 0.5 || aspectRatio > 2) {
        warnings.push('Proporção incomum. Melhor experiência com proporções entre 1:2 e 2:1');
      }

      // Step 8: Final validation (100%)
      setValidationProgress(100);
      
      const fileInfo = {
        size: file.size,
        duration: videoInfo.duration,
        format: file.type,
        width: videoInfo.width,
        height: videoInfo.height
      };

      // Clean up
      URL.revokeObjectURL(videoElement.src);

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        fileInfo
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao validar vídeo';
      errors.push(errorMessage);
      
      return {
        isValid: false,
        errors,
        warnings
      };
    } finally {
      setIsValidating(false);
      setValidationProgress(0);
    }
  }, [finalConfig]);

  const validateAndShowFeedback = useCallback(async (file: File): Promise<VideoValidationResult> => {
    const result = await validateVideo(file);
    
    // Show validation feedback
    if (result.errors.length > 0) {
      toast({
        title: "Vídeo inválido",
        description: result.errors[0],
        variant: "destructive",
      });
    } else if (result.warnings.length > 0) {
      toast({
        title: "Vídeo válido com avisos",
        description: result.warnings[0],
        variant: "default",
      });
    } else {
      toast({
        title: "Vídeo válido",
        description: "Arquivo pronto para edição",
        variant: "default",
      });
    }
    
    return result;
  }, [validateVideo]);

  return {
    validateVideo,
    validateAndShowFeedback,
    isValidating,
    validationProgress,
    config: finalConfig
  };
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};