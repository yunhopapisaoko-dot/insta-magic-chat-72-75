import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Image, Video, X, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useVideoValidation } from '@/hooks/useVideoValidation';
import VideoValidationStatus from '@/components/ui/VideoValidationStatus';

interface MediaUploadProps {
  onMediaSelected: (url: string, type: 'image' | 'video') => void;
  className?: string;
  disabled?: boolean;
}

const MediaUpload = ({ onMediaSelected, className, disabled }: MediaUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { validateVideo, isValidating, validationProgress } = useVideoValidation({
    maxSizeBytes: 50 * 1024 * 1024, // 50MB for messages
    maxDurationSeconds: 300, // 5 minutes max
    allowedFormats: ['video/mp4', 'video/webm', 'video/quicktime']
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    validateAndSetFile(file);
  };

  const validateAndSetFile = async (file: File) => {
    // Basic validation
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 50MB",
        variant: "destructive",
      });
      return;
    }

    const validTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime'
    ];
    
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Use: JPG, PNG, GIF, WebP, MP4, WebM ou MOV",
        variant: "destructive",
      });
      return;
    }

    // Video-specific validation
    if (file.type.startsWith('video/')) {
      const result = await validateVideo(file);
      if (!result.isValid) {
        toast({
          title: "Vídeo inválido",
          description: result.errors.join(', '),
          variant: "destructive",
        });
        return;
      }
    }

    setSelectedFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `conversations/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('posts') // Using posts bucket for now
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('posts')
        .getPublicUrl(uploadData.path);

      const mediaType = selectedFile.type.startsWith('video/') ? 'video' : 'image';
      
      onMediaSelected(urlData.publicUrl, mediaType);
      
      // Reset state
      setSelectedFile(null);
      setPreview(null);
      setUploadProgress(0);
      
      toast({
        title: "Upload concluído",
        description: `${mediaType === 'video' ? 'Vídeo' : 'Imagem'} enviado com sucesso!`,
      });
      
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Erro no upload",
        description: "Não foi possível enviar o arquivo. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreview(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (selectedFile && preview) {
    return (
      <div className={cn("space-y-3 p-4 border rounded-lg", className)}>
        {/* Preview */}
        <div className="relative rounded-lg overflow-hidden bg-muted">
          {selectedFile.type.startsWith('video/') ? (
            <video
              src={preview}
              className="w-full h-40 object-cover"
              controls
              playsInline
            />
          ) : (
            <img
              src={preview}
              alt="Preview"
              className="w-full h-40 object-cover"
            />
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSelection}
            className="absolute top-2 right-2 w-8 h-8 p-0 bg-black/50 hover:bg-black/70 text-white"
            disabled={uploading}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Validation Status for Videos */}
        {selectedFile.type.startsWith('video/') && (
          <VideoValidationStatus
            isValidating={isValidating}
            validationProgress={validationProgress}
            className="text-xs"
          />
        )}

        {/* Upload Progress */}
        {uploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Enviando...</span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleUpload}
            disabled={uploading || isValidating}
            className="flex-1"
            size="sm"
          >
            {uploading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Enviar
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            onClick={clearSelection}
            disabled={uploading}
            size="sm"
          >
            Cancelar
          </Button>
        </div>

        {/* File Info */}
        <div className="text-xs text-muted-foreground">
          <div>{selectedFile.name}</div>
          <div>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || uploading}
        className={cn("w-9 h-9 p-0", className)}
      >
        {selectedFile?.type.startsWith('video/') ? (
          <Video className="w-4 h-4" />
        ) : (
          <Image className="w-4 h-4" />
        )}
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />
    </>
  );
};

export default MediaUpload;