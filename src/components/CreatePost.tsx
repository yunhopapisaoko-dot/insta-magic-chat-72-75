import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Image, X, Send, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import VideoEditor from './VideoEditor';

interface CreatePostProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPostCreated: () => void;
}

const CreatePost = ({ open, onOpenChange, onPostCreated }: CreatePostProps) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'media' | 'video-edit' | 'caption'>('media');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [processedVideoBlob, setProcessedVideoBlob] = useState<Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) { // 50MB limit for videos
        toast({
          title: "Arquivo muito grande",
          description: "O arquivo deve ter no máximo 50MB",
          variant: "destructive",
        });
        return;
      }

      if (file.type.startsWith('image/')) {
        setImageFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreview(e.target?.result as string);
          setStep('caption');
        };
        reader.readAsDataURL(file);
      } else if (file.type.startsWith('video/')) {
        // Validate video duration before proceeding
        const video = document.createElement('video');
        video.preload = 'metadata';
        
        video.onloadedmetadata = () => {
          window.URL.revokeObjectURL(video.src);
          
          // Check if video is longer than 60 seconds
          if (video.duration > 60) {
            toast({
              title: "Vídeo muito longo",
              description: "O vídeo deve ter no máximo 1 minuto de duração",
              variant: "destructive",
            });
            return;
          }
          
          // Video is valid, proceed
          setVideoFile(file);
          const reader = new FileReader();
          reader.onload = (e) => {
            setVideoPreview(e.target?.result as string);
            setStep('video-edit');
          };
          reader.readAsDataURL(file);
        };
        
        video.onerror = () => {
          toast({
            title: "Erro no vídeo",
            description: "Não foi possível carregar o vídeo. Tente outro arquivo.",
            variant: "destructive",
          });
        };
        
        video.src = URL.createObjectURL(file);
      }
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
    if (!user || (!imageFile && !processedVideoBlob)) {
      toast({
        title: "Mídia obrigatória",
        description: "Selecione uma foto ou vídeo para continuar",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let mediaUrl = null;
      let mediaType = 'image';

      if (imageFile) {
        mediaUrl = await uploadMedia(imageFile, false);
      } else if (processedVideoBlob) {
        mediaUrl = await uploadMedia(processedVideoBlob, true);
        mediaType = 'video';
      }

      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: content.trim() || '',
          image_url: mediaUrl,
          media_type: mediaType,
        });

      if (error) throw error;

      toast({
        title: "Post criado",
        description: "Seu post foi compartilhado com sucesso!",
      });

      // Reset form
      resetForm();
      onPostCreated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: "Erro ao criar post",
        description: "Não foi possível criar seu post. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

  const handleVideoEditorSave = (editedBlob: Blob) => {
    setProcessedVideoBlob(editedBlob);
    setStep('caption');
  };

  const handleVideoEditorCancel = () => {
    setVideoFile(null);
    setVideoPreview(null);
    setStep('media');
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
            {step === 'media' ? 'Escolher Mídia' : 
             step === 'video-edit' ? 'Editar Vídeo' : 'Adicionar Legenda'}
          </DialogTitle>
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
                      <p className="text-xs text-muted-foreground">Máx. 1 min</p>
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
          ) : step === 'video-edit' && videoFile ? (
            // Video Editor Step
            <VideoEditor
              videoFile={videoFile}
              onSave={handleVideoEditorSave}
              onCancel={handleVideoEditorCancel}
            />
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
              
              {processedVideoBlob && (
                <div className="relative">
                  <video
                    src={URL.createObjectURL(processedVideoBlob)}
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
                  disabled={loading || (!imageFile && !processedVideoBlob)}
                  className="flex-1 rounded-xl magic-button"
                >
                  {loading ? (
                    'Publicando...'
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