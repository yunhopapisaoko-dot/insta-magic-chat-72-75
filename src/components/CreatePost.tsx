import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Image, X, Send, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { useVideoValidation } from '@/hooks/useVideoValidation';
import VideoValidationStatus from '@/components/ui/VideoValidationStatus';
import { useVideoCompression } from '@/hooks/useVideoCompression';
import { useVideoCache } from '@/hooks/useVideoCache';
import { useDeviceOptimization } from '@/hooks/useDeviceOptimization';
import { useMemoryManager } from '@/hooks/useMemoryManager';
import VideoOptimizerService from '@/services/VideoOptimizerService';
import { Loader2, Zap, HardDrive, Cpu } from 'lucide-react';

interface CreatePostProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPostCreated: () => void;
}

const CreatePost = ({ open, onOpenChange, onPostCreated }: CreatePostProps) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'media' | 'caption'>('media');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [processedVideoBlob, setProcessedVideoBlob] = useState<Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  
  const { 
    validateAndShowFeedback, 
    isValidating, 
    validationProgress 
  } = useVideoValidation();
  
  const {
    compressVideo,
    isCompressing,
    compressionProgress,
    compressionStats,
    getRecommendedSettings
  } = useVideoCompression();
  
  const {
    addToCache,
    getFromCacheByFile,
    getCacheStats
  } = useVideoCache();
  
  const {
    optimizationSettings,
    deviceCapabilities,
    networkStatus,
    shouldPreloadVideo,
    getOptimalVideoFormat
  } = useDeviceOptimization();
  
  const {
    memoryStats,
    registerResource,
    createManagedURL,
    getMemoryRecommendations
  } = useMemoryManager();
  
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState(0);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check memory before processing
    const memoryRecommendations = getMemoryRecommendations();
    if (memoryRecommendations.shouldReduceQuality) {
      toast({
        title: "⚠️ Memória baixa",
        description: "Algumas funcionalidades podem ser limitadas",
        variant: "destructive",
      });
    }

    if (file.type.startsWith('image/')) {
      // Basic image validation with device-specific limits
      const maxSize = optimizationSettings.maxVideoSize / 5; // Images can be smaller
      if (file.size > maxSize) {
        toast({
          title: "Imagem muito grande",
          description: `A imagem deve ter no máximo ${(maxSize / 1024 / 1024).toFixed(1)}MB`,
          variant: "destructive",
        });
        return;
      }

      setImageFile(file);
      
      // Check cache first
      const cached = getFromCacheByFile(file);
      if (cached?.preview) {
        setImagePreview(cached.preview);
        setStep('caption');
        return;
      }

      // Create managed URL for memory efficiency
      const { url } = createManagedURL(file, 'high');
      setImagePreview(url);
      
      // Cache image for future use
      addToCache(file, undefined, { generateThumbnail: true });
      
      setStep('caption');
    } else if (file.type.startsWith('video/')) {
      // Check if file exceeds device-specific limits
      if (file.size > optimizationSettings.maxVideoSize) {
        toast({
          title: "Vídeo muito grande",
          description: `O vídeo deve ter no máximo ${(optimizationSettings.maxVideoSize / 1024 / 1024).toFixed(1)}MB para este dispositivo`,
          variant: "destructive",
        });
        return;
      }

      // Check cache first
      const cached = getFromCacheByFile(file);
      if (cached) {
        setVideoFile(file);
        setValidationResult({ isValid: true, errors: [], warnings: [] });
        
        if (cached.preview) {
          setVideoPreview(cached.preview);
        } else {
          const { url } = createManagedURL(file, 'high');
          setVideoPreview(url);
        }
        
        setStep('caption');
        return;
      }

      // Comprehensive video validation
      setIsOptimizing(true);
      setOptimizationProgress(10);

      try {
        const result = await validateAndShowFeedback(file);
        setValidationResult(result);
        
        if (result.isValid) {
          setOptimizationProgress(30);
          
          // Pre-optimize video based on device capabilities
          const shouldCompress = file.size > optimizationSettings.maxVideoSize * 0.7;
          const recommendedSettings = getRecommendedSettings(file.size, result.fileInfo?.duration || 0);
          
          if (shouldCompress && !memoryRecommendations.shouldReduceQuality) {
            setOptimizationProgress(50);
            
            try {
              const compressedBlob = await compressVideo(file, {
                ...recommendedSettings,
                format: getOptimalVideoFormat()
              });
              
              // Cache both original and compressed versions
              await addToCache(file, compressedBlob, {
                generateThumbnail: shouldPreloadVideo(file.size),
                generatePreview: shouldPreloadVideo(file.size)
              });
              
              setVideoFile(file);
              setProcessedVideoBlob(compressedBlob);
              
              const { url } = createManagedURL(compressedBlob, 'high');
              setVideoPreview(url);
              
              toast({
                title: "✅ Vídeo otimizado",
                description: `Tamanho reduzido em ${compressionStats?.compressionRatio || 0}%`,
              });
              
            } catch (compressionError) {
              console.warn('Compression failed, using original:', compressionError);
              
              setVideoFile(file);
              const { url } = createManagedURL(file, 'high');
              setVideoPreview(url);
              
              // Cache original file
              addToCache(file, undefined, { generateThumbnail: true });
            }
          } else {
            setVideoFile(file);
            const { url } = createManagedURL(file, 'high');
            setVideoPreview(url);
            
            // Cache original file
            addToCache(file, undefined, { generateThumbnail: true });
          }
          
          setOptimizationProgress(100);
          setStep('caption'); // Pular diretamente para caption, sem edição
        } else {
          // Reset video input
          if (videoInputRef.current) {
            videoInputRef.current.value = '';
          }
        }
      } catch (error) {
        console.error('Video processing error:', error);
        toast({
          title: "❌ Erro no processamento",
          description: "Não foi possível processar o vídeo",
          variant: "destructive",
        });
      } finally {
        setIsOptimizing(false);
        setTimeout(() => setOptimizationProgress(0), 2000);
      }
    } else {
      toast({
        title: "Formato não suportado",
        description: "Selecione uma imagem ou vídeo válido",
        variant: "destructive",
      });
    }
  };

  const uploadMedia = async (file: File | Blob, isVideo = false) => {
    if (!user) return null;

    const fileExt = isVideo ? 'webm' : (file instanceof File ? file.name.split('.').pop() : 'jpg');
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('posts')
      .upload(fileName, file);

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('posts')
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!user || (!imageFile && !processedVideoBlob && !videoFile)) {
      toast({
        title: "Mídia obrigatória",
        description: "Selecione uma foto ou vídeo para continuar",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      let mediaUrl = null;
      let mediaType = 'image';

      // Upload progress simulation
      setUploadProgress(25);

      if (imageFile) {
        mediaUrl = await uploadMedia(imageFile, false);
        mediaType = 'image';
      } else if (processedVideoBlob) {
        mediaUrl = await uploadMedia(processedVideoBlob, true);
        mediaType = 'video';
      } else if (videoFile) {
        mediaUrl = await uploadMedia(videoFile, true);
        mediaType = 'video';
      }

      setUploadProgress(75);

      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: content.trim() || '',
          image_url: mediaUrl,
          media_type: mediaType,
        });

      if (error) throw error;

      setUploadProgress(100);

      toast({
        title: "✅ Post criado com sucesso!",
        description: "Seu conteúdo foi compartilhado no feed",
      });

      // Reset form
      resetForm();
      onPostCreated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: "❌ Erro ao criar post",
        description: "Não foi possível publicar. Verifique sua conexão e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const resetForm = () => {
    setStep('media');
    setContent('');
    setImageFile(null);
    setVideoFile(null);
    setProcessedVideoBlob(null);
    setImagePreview(null);
    setVideoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const removeMedia = () => {
    resetForm();
  };


  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="mobile-container max-w-lg mx-auto">
        <DialogHeader>
          <DialogTitle className="text-center">
            {step === 'media' ? 'Escolher Mídia' : 'Adicionar Legenda'}
          </DialogTitle>
          
          {/* Performance indicators */}
          {(memoryStats.isLowMemory || deviceCapabilities?.isLowEndDevice) && (
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mt-2">
              {memoryStats.isLowMemory && (
                <div className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  <span>Memória: {memoryStats.percentage.toFixed(0)}%</span>
                </div>
              )}
              {deviceCapabilities?.isLowEndDevice && (
                <div className="flex items-center gap-1">
                  <Cpu className="w-3 h-3" />
                  <span>Dispositivo limitado</span>
                </div>
              )}
              {!networkStatus.isOnline && (
                <div className="flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  <span>Offline</span>
                </div>
              )}
            </div>
          )}
        </DialogHeader>

        <div className="space-y-6 py-4">
          {step === 'media' ? (
            // Media Selection Step
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-muted-foreground mb-6">
                  Selecione uma foto ou vídeo para seu post
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="h-32 rounded-xl flex flex-col items-center justify-center space-y-3 bg-gradient-to-br from-primary/10 to-accent/10 hover:from-primary/20 hover:to-accent/20 border-2 border-dashed border-primary/30"
                    variant="ghost"
                  >
                    <Image className="w-8 h-8 text-primary" />
                    <div className="text-center">
                      <p className="font-semibold text-primary text-sm">Foto</p>
                      <p className="text-xs text-muted-foreground">Galeria</p>
                    </div>
                  </Button>
                  
                  <Button
                    onClick={() => videoInputRef.current?.click()}
                    className="h-32 rounded-xl flex flex-col items-center justify-center space-y-3 bg-gradient-to-br from-secondary/10 to-accent/10 hover:from-secondary/20 hover:to-accent/20 border-2 border-dashed border-secondary/30"
                    variant="ghost"
                  >
                    <Video className="w-8 h-8 text-secondary" />
                    <div className="text-center">
                      <p className="font-semibold text-secondary text-sm">Vídeo</p>
                      <p className="text-xs text-muted-foreground">Máx. 10 min</p>
                    </div>
                  </Button>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => handleDialogOpenChange(false)}
                  className="rounded-xl"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            // Caption Step
            <div className="space-y-6">
              {/* User Info */}
              <div className="flex items-center space-x-3">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={user?.avatar_url || ''} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white font-semibold">
                    {user?.display_name?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{user?.display_name}</p>
                  <p className="text-sm text-muted-foreground">@{user?.username}</p>
                </div>
              </div>

              {/* Media Preview */}
              {imagePreview && (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full max-h-64 object-cover rounded-xl"
                  />
                  <button
                    onClick={removeMedia}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              
              {(processedVideoBlob || videoFile) && (
                <div className="relative">
                  <video
                    src={processedVideoBlob ? URL.createObjectURL(processedVideoBlob) : (videoFile ? URL.createObjectURL(videoFile) : '')}
                    className="w-full max-h-64 object-cover rounded-xl"
                    controls
                  />
                  <button
                    onClick={removeMedia}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Caption */}
              <Textarea
                placeholder="Escreva uma legenda..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                className="rounded-xl resize-none border-border"
                maxLength={500}
              />
              
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>{content.length}/500</span>
              </div>

              {/* Actions */}
              <div className="flex space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={removeMedia}
                  disabled={loading}
                  className="flex-1 rounded-xl"
                >
                  Voltar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading || isUploading || (!imageFile && !processedVideoBlob && !videoFile)}
                  className="flex-1 rounded-xl magic-button"
                >
                  {loading || isUploading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {isUploading ? `Enviando... ${uploadProgress}%` : 'Processando...'}
                    </div>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Publicar
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePost;