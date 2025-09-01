import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { X, Send, Image, Upload, CheckCircle, AlertCircle, Video, Clock, Tag } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useVideoValidation, VideoValidationResult } from '@/hooks/useVideoValidation';
import VideoValidationStatus from '@/components/ui/VideoValidationStatus';
import { UserTagSelector } from '@/components/UserTagSelector';

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
  const [isDragging, setIsDragging] = useState(false);
  const [validationResult, setValidationResult] = useState<VideoValidationResult | null>(null);
  const [taggedUsers, setTaggedUsers] = useState<any[]>([]);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { 
    validateVideo, 
    isValidating,
    validationProgress
  } = useVideoValidation({
    maxSizeBytes: 10 * 1024 * 1024, // 10MB for stories
    maxDurationSeconds: 60, // 1 minute max
    allowedFormats: ['video/mp4', 'video/webm', 'video/quicktime']
  });

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
      setIsDragging(false);
      setValidationResult(null);
      setTaggedUsers([]);
      setShowTagSelector(false);
    }
  }, [open]);

  const backgroundColors = [
    '#667eea', '#764ba2', '#f093fb', '#f5576c', 
    '#4facfe', '#43e97b', '#fa709a', '#ffecd2',
    '#a8edea', '#fed6e3', '#d299c2', '#fef9d7',
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'
  ];

  const validateAndSetFile = async (file: File) => {
    setUploadError(null);
    setValidationResult(null);

    // File size validation (10MB for stories - smaller than posts)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Arquivo deve ter no máximo 10MB para stories");
      toast({
        title: "Arquivo muito grande",
        description: "Stories devem ter no máximo 10MB",
        variant: "destructive",
      });
      return false;
    }

    // File type validation
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
      setUploadError("Tipo de arquivo não suportado");
      toast({
        title: "Formato inválido",
        description: "Use: JPG, PNG, GIF, WebP, MP4, WebM ou MOV",
        variant: "destructive",
      });
      return false;
    }

    // Video specific validation
    if (file.type.startsWith('video/')) {
      const result = await validateVideo(file);
      setValidationResult(result);
      
      if (!result.isValid) {
        setUploadError(result.errors.join(', ') || "Vídeo inválido");
        return false;
      }
    }

    setMediaFile(file);
    
    // Create preview with smooth progress
    const reader = new FileReader();
    reader.onloadstart = () => setUploadProgress(0);
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const progress = (e.loaded / e.total) * 100;
        setUploadProgress(progress);
      }
    };
    reader.onload = (e) => {
      setMediaPreview(e.target?.result as string);
      setUploadProgress(100);
      
      // Show success feedback
      toast({
        title: "Arquivo carregado",
        description: file.type.startsWith('video/') ? 
          `Vídeo de ${validationResult?.fileInfo?.duration.toFixed(1)}s pronto` : 
          "Imagem carregada com sucesso",
      });
    };
    reader.onerror = () => {
      setUploadError("Erro ao processar arquivo");
    };
    reader.readAsDataURL(file);
    
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
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
      const { data: storyData, error: insertError } = await supabase
        .from('stories')
        .insert({
          user_id: user.id,
          content: text.trim() || null,
          media_url: mediaUrl,
          media_type: mediaType,
          background_color: backgroundColor,
          text_color: textColor,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Insert tagged users
      if (taggedUsers.length > 0 && storyData) {
        const tags = taggedUsers.map(taggedUser => ({
          story_id: storyData.id,
          user_id: taggedUser.id,
          tagged_by: user.id
        }));

        const { error: tagsError } = await supabase
          .from('story_tags')
          .insert(tags);

        if (tagsError) {
          console.error('Error creating story tags:', tagsError);
          // Don't fail the whole story creation for tag errors
        }
      }
      
      toast({
        title: "Story criado",
        description: `Seu story foi publicado com sucesso!${taggedUsers.length > 0 ? ` ${taggedUsers.length} pessoa${taggedUsers.length > 1 ? 's foram marcadas' : ' foi marcada'}` : ''}`,
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
        <div className="relative w-full h-[600px] rounded-2xl overflow-hidden bg-gradient-to-br from-background to-muted">
        {/* Story Preview */}
          <div 
            className="w-full h-full relative flex items-center justify-center overflow-hidden transition-all duration-500"
            style={{
              background: mediaPreview ? 'transparent' : `linear-gradient(135deg, ${backgroundColor}, ${backgroundColor}dd)`,
            }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {mediaPreview ? (
              <>
                {mediaFile?.type.startsWith('video/') ? (
                  <video
                    src={mediaPreview}
                    className="w-full h-full object-cover transition-opacity duration-300"
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                ) : (
                  <img
                    src={mediaPreview}
                    alt="Story media"
                    className="w-full h-full object-cover transition-opacity duration-300"
                  />
                )}
                
                {/* Upload progress overlay */}
                {uploadProgress < 100 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                    <div className="text-center">
                      <LoadingSpinner size="lg" variant="white" />
                      <div className="mt-4 bg-white/20 rounded-full h-2 w-32 overflow-hidden">
                        <div 
                          className="h-full bg-white transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-white mt-2 text-sm font-medium">{Math.round(uploadProgress)}%</p>
                    </div>
                  </div>
                )}

                {/* Video validation status */}
                {mediaFile?.type.startsWith('video/') && (
                  <VideoValidationStatus 
                    isValidating={isValidating}
                    validationProgress={validationProgress}
                    validationResult={validationResult || undefined}
                    className="absolute bottom-20 left-4 right-4"
                  />
                )}
              </>
            ) : (
              <>
                <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-transparent" />
                
                {/* Drag and drop area */}
                <div className={cn(
                  "absolute inset-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all duration-300",
                  isDragging 
                    ? "border-primary bg-primary/5 scale-105" 
                    : "border-white/30 hover:border-white/50"
                )}>
                  {isDragging ? (
                    <>
                      <Upload className="w-12 h-12 text-primary mb-4 animate-bounce" />
                      <p className="text-primary font-medium">Solte aqui!</p>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
                        <Image className="w-8 h-8 text-white" />
                      </div>
                      <p className="text-white/70 text-center text-sm">
                        Arraste uma foto ou vídeo aqui
                        <br />
                        <span className="text-xs">ou toque no botão abaixo</span>
                      </p>
                    </>
                  )}
                </div>
              </>
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
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 space-y-4">
            {/* Error message */}
            {uploadError && (
              <div className="flex items-center space-x-2 bg-destructive/20 border border-destructive/30 rounded-lg p-3 backdrop-blur-sm">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <span className="text-destructive text-sm">{uploadError}</span>
              </div>
            )}

            {/* Video duration indicator */}
            {mediaFile?.type.startsWith('video/') && validationResult?.fileInfo?.duration && (
              <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-2 backdrop-blur-sm">
                <Clock className="w-4 h-4 text-white" />
                <span className="text-white text-sm">
                  {validationResult.fileInfo.duration.toFixed(1)}s / 60s
                </span>
                <div className="flex-1 bg-white/20 rounded-full h-1">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((validationResult.fileInfo.duration / 60) * 100, 100)}%` }}
                  />
                </div>
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
                    "text-white hover:bg-white/20 w-10 h-10 p-0 rounded-full transition-all duration-200 backdrop-blur-sm",
                    mediaFile && "bg-green-500/20 border border-green-500/30",
                    loading && "animate-pulse"
                  )}
                >
                  {uploadProgress > 0 && uploadProgress < 100 ? (
                    <div className="relative">
                      <LoadingSpinner size="sm" variant="white" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full border border-white/30">
                          <div 
                            className="h-full bg-white rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : mediaFile ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <div className="flex items-center">
                      <Image className="w-4 h-4 mr-1" />
                      <Video className="w-3 h-3" />
                    </div>
                  )}
                </Button>

                {/* Tag Users */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTagSelector(true)}
                  disabled={loading}
                  className={cn(
                    "text-white hover:bg-white/20 w-10 h-10 p-0 rounded-full transition-all duration-200 backdrop-blur-sm",
                    taggedUsers.length > 0 && "bg-blue-500/20 border border-blue-500/30",
                    loading && "animate-pulse"
                  )}
                >
                  <Tag className="w-4 h-4" />
                  {taggedUsers.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full text-xs flex items-center justify-center">
                      {taggedUsers.length}
                    </span>
                  )}
                </Button>

                {/* Background Colors */}
                <div className="flex space-x-1 overflow-x-auto">
                  {backgroundColors.slice(0, 6).map((color) => (
                    <button
                      key={color}
                      onClick={() => setBackgroundColor(color)}
                      className={cn(
                        "flex-shrink-0 w-8 h-8 rounded-full border-2 transition-all duration-200 hover:scale-110",
                        backgroundColor === color 
                          ? "border-white scale-110 shadow-lg" 
                          : "border-white/30"
                      )}
                      style={{ 
                        backgroundColor: color,
                        boxShadow: backgroundColor === color ? `0 0 20px ${color}40` : 'none'
                      }}
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
              <div className="text-white/70 flex items-center gap-2">
                <span>{text.length}/150 caracteres</span>
                {taggedUsers.length > 0 && (
                  <span>• {taggedUsers.length} marcado{taggedUsers.length > 1 ? 's' : ''}</span>
                )}
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
          accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
          onChange={handleFileChange}
          className="hidden"
        />
        
        {/* User Tag Selector */}
        <UserTagSelector
          open={showTagSelector}
          onOpenChange={setShowTagSelector}
          selectedUsers={taggedUsers}
          onUsersChange={setTaggedUsers}
          maxTags={3}
        />
      </DialogContent>
    </Dialog>
  );
};

export default StoryCreator;