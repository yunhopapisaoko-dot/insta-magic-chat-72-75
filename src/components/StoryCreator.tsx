import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { X, Send, Image, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface StoryCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStoryCreated: () => void;
}

const StoryCreator = ({ open, onOpenChange, onStoryCreated }: StoryCreatorProps) => {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#667eea');
  const [textColor, setTextColor] = useState('#ffffff');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setText('');
      setMediaFile(null);
      setMediaPreview(null);
      setUploadError(null);
      setUploadProgress(0);
      setBackgroundColor('#667eea');
      setTextColor('#ffffff');
    }
  }, [open]);

  const backgroundColors = [
    '#667eea', '#764ba2', '#f093fb', '#f5576c', 
    '#4facfe', '#43e97b', '#fa709a', '#ffecd2',
    '#a8edea', '#fed6e3', '#d299c2', '#fef9d7'
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // File size validation
    if (file.size > 15 * 1024 * 1024) { // 15MB limit for stories
      setUploadError("O arquivo deve ter no máximo 15MB");
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 15MB",
        variant: "destructive",
      });
      return;
    }

    // File type validation
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
    if (!validTypes.includes(file.type)) {
      setUploadError("Tipo de arquivo não suportado");
      toast({
        title: "Tipo de arquivo inválido",
        description: "Apenas imagens (JPG, PNG, GIF, WebP) e vídeos (MP4, WebM) são aceitos",
        variant: "destructive",
      });
      return;
    }

    setMediaFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadstart = () => setUploadProgress(0);
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        setUploadProgress((e.loaded / e.total) * 100);
      }
    };
    reader.onload = (e) => {
      setMediaPreview(e.target?.result as string);
      setUploadProgress(100);
    };
    reader.onerror = () => {
      setUploadError("Erro ao carregar arquivo");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!text.trim() && !mediaFile) {
      toast({
        title: "Conteúdo necessário",
        description: "Adicione texto ou uma mídia para seu story",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Erro de autenticação",
        description: "Você precisa estar logado para criar stories",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let mediaUrl = null;
      let mediaType = null;

      // Upload media if exists
      if (mediaFile) {
        const fileExt = mediaFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('stories')
          .upload(fileName, mediaFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('stories')
          .getPublicUrl(uploadData.path);

        mediaUrl = urlData.publicUrl;
        mediaType = mediaFile.type.startsWith('image/') ? 'image' : 'video';
      }

      // Create story in database
      const { error: insertError } = await supabase
        .from('stories')
        .insert({
          user_id: user.id,
          content: text.trim() || null,
          media_url: mediaUrl,
          media_type: mediaType,
          background_color: backgroundColor,
          text_color: textColor,
        });

      if (insertError) throw insertError;
      
      toast({
        title: "Story criado",
        description: "Seu story foi publicado com sucesso!",
      });

      onStoryCreated();
      onOpenChange(false);
      
      // Reset form
      setText('');
      setMediaFile(null);
      setMediaPreview(null);
      setBackgroundColor('#667eea');
    } catch (error) {
      console.error('Error creating story:', error);
      toast({
        title: "Erro ao criar story",
        description: "Não foi possível criar seu story. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-sm mx-auto p-0 bg-transparent border-0" aria-describedby="story-creator-description">
        <div id="story-creator-description" className="sr-only">Criar um novo story</div>
        <div className="relative w-full h-[600px] rounded-2xl overflow-hidden">
        {/* Story Preview */}
          <div 
            className="w-full h-full relative flex items-center justify-center overflow-hidden"
            style={{
              background: mediaPreview ? 'transparent' : `linear-gradient(135deg, ${backgroundColor}, ${backgroundColor}dd)`,
            }}
          >
            {mediaPreview ? (
              <>
                {mediaFile?.type.startsWith('video/') ? (
                  <video
                    src={mediaPreview}
                    className="w-full h-full object-cover"
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                ) : (
                  <img
                    src={mediaPreview}
                    alt="Story media"
                    className="w-full h-full object-cover animate-fade-in"
                  />
                )}
                
                {/* Upload progress overlay */}
                {uploadProgress < 100 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-center">
                      <LoadingSpinner size="lg" variant="white" />
                      <p className="text-white mt-2 text-sm">{Math.round(uploadProgress)}%</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-transparent" />
            )}

            {/* User Info Overlay */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Avatar className="w-8 h-8 border-2 border-white">
                  <AvatarImage src={user?.avatar_url || ''} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-sm font-semibold">
                    {user?.display_name?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-white font-medium text-sm drop-shadow-lg">
                  {user?.display_name}
                </span>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-white hover:bg-white/20 w-8 h-8 p-0 rounded-full"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Text Content */}
            {text && (
              <div
                className="absolute inset-0 flex items-center justify-center p-8"
                style={{ color: textColor }}
              >
                <p className="text-2xl font-bold text-center drop-shadow-lg leading-tight">
                  {text}
                </p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 space-y-4">
            {/* Error message */}
            {uploadError && (
              <div className="flex items-center space-x-2 bg-red-500/20 border border-red-500/30 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-red-400 text-sm">{uploadError}</span>
              </div>
            )}

            {/* Text Input */}
            <div className="relative">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Digite seu texto..."
                className={cn(
                  "bg-white/20 border-white/30 text-white placeholder:text-white/70 rounded-xl pr-12",
                  "focus:bg-white/30 focus:border-white/50 transition-all duration-200"
                )}
                maxLength={150}
              />
              {text && (
                <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-400" />
              )}
            </div>

            {/* Tools */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {/* Media Upload */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className={cn(
                    "text-white hover:bg-white/20 w-10 h-10 p-0 rounded-full transition-all duration-200",
                    mediaFile && "bg-green-500/20 border border-green-500/30"
                  )}
                >
                  {uploadProgress > 0 && uploadProgress < 100 ? (
                    <LoadingSpinner size="sm" variant="white" />
                  ) : mediaFile ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <Image className="w-5 h-5" />
                  )}
                </Button>

                {/* Background Colors */}
                <div className="flex space-x-1">
                  {backgroundColors.slice(0, 4).map((color) => (
                    <button
                      key={color}
                      onClick={() => setBackgroundColor(color)}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all duration-200",
                        backgroundColor === color 
                          ? "border-white scale-110" 
                          : "border-white/30 hover:scale-110"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Publish Button */}
              <Button
                onClick={handleSubmit}
                disabled={loading || (!text.trim() && !mediaFile) || uploadError !== null}
                className={cn(
                  "bg-white text-black hover:bg-white/90 rounded-full px-6 transition-all duration-200",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  (text.trim() || mediaFile) && !uploadError && "hover:scale-105 shadow-lg"
                )}
                size="sm"
              >
                {loading ? (
                  <div className="flex items-center">
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Publicando...</span>
                  </div>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Story
                  </>
                )}
              </Button>
            </div>

            {/* Character Count & Status */}
            <div className="flex items-center justify-between text-xs">
              <div className="text-white/70">
                {text.length}/150 caracteres
              </div>
              {(text.trim() || mediaFile) && (
                <div className="flex items-center space-x-1 text-green-400">
                  <CheckCircle className="w-3 h-3" />
                  <span>Pronto para publicar</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </DialogContent>
    </Dialog>
  );
};

export default StoryCreator;