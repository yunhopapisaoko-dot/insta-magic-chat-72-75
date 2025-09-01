import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X, Save, Palette } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Story {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  background_color: string;
  text_color: string;
  created_at: string;
  expires_at: string;
  profiles: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
}

interface StoryEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  story: Story | null;
  onStoryUpdated: () => void;
}

const StoryEditor = ({ open, onOpenChange, story, onStoryUpdated }: StoryEditorProps) => {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#667eea');
  const [textColor, setTextColor] = useState('#ffffff');
  const [loading, setLoading] = useState(false);

  const backgroundColors = [
    '#667eea', '#764ba2', '#f093fb', '#f5576c', 
    '#4facfe', '#43e97b', '#fa709a', '#ffecd2',
    '#a8edea', '#fed6e3', '#d299c2', '#fef9d7',
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'
  ];

  const textColors = [
    '#ffffff', '#000000', '#333333', '#666666',
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
    '#667eea', '#764ba2', '#f093fb', '#f5576c'
  ];

  // Initialize form when story changes
  useEffect(() => {
    if (story && open) {
      setText(story.content || '');
      setBackgroundColor(story.background_color);
      setTextColor(story.text_color);
    }
  }, [story, open]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setText('');
      setBackgroundColor('#667eea');
      setTextColor('#ffffff');
    }
  }, [open]);

  const handleSave = async () => {
    if (!story || !user || story.user_id !== user.id) return;

    // Validate that we have some content
    if (!text.trim()) {
      toast({
        title: "Texto necessário",
        description: "Adicione algum texto para seu story",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('stories')
        .update({
          content: text.trim(),
          background_color: backgroundColor,
          text_color: textColor,
        })
        .eq('id', story.id)
        .eq('user_id', user.id);

      if (error) throw error;
      
      toast({
        title: "Story atualizado",
        description: "Suas alterações foram salvas com sucesso!",
      });

      onStoryUpdated();
      onOpenChange(false);
      
    } catch (error) {
      console.error('Error updating story:', error);
      toast({
        title: "Erro ao atualizar story",
        description: "Não foi possível salvar as alterações. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!story) return null;

  // Only allow editing text stories and photo stories (not videos)
  const canEdit = story.user_id === user?.id && story.media_type !== 'video';

  if (!canEdit) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-sm mx-auto p-0 bg-transparent border-0">
        <DialogTitle className="sr-only">
          Editando story de {story.profiles.display_name}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Edite o texto e as cores do seu story
        </DialogDescription>
        
        <div className="relative w-full h-[600px] rounded-2xl overflow-hidden bg-gradient-to-br from-background to-muted">
          {/* Story Preview */}
          <div 
            className="w-full h-full relative flex items-center justify-center overflow-hidden transition-all duration-500"
            style={{
              background: story.media_url ? 'transparent' : `linear-gradient(135deg, ${backgroundColor}, ${backgroundColor}dd)`,
            }}
          >
            {/* Media Background */}
            {story.media_url && (
              <div className="w-full h-full animate-fade-in">
                <img
                  src={story.media_url}
                  alt="Story media"
                  className="w-full h-full object-cover transition-opacity duration-300"
                />
              </div>
            )}

            {/* Overlay for better text readability */}
            {text && story.media_url && (
              <div className="absolute inset-0 bg-black/30" />
            )}

            {/* User Info Overlay */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Avatar className="w-8 h-8 border-2 border-white">
                  <AvatarImage src={story.profiles.avatar_url || ''} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-sm font-semibold">
                    {story.profiles.display_name[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="text-white font-medium text-sm drop-shadow-lg">
                  {story.profiles.display_name}
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
                className="absolute inset-0 flex items-center justify-center p-8 z-10"
                style={{ color: textColor }}
              >
                <p className="text-2xl font-bold text-center drop-shadow-lg leading-tight">
                  {text}
                </p>
              </div>
            )}
          </div>

          {/* Edit Controls */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 space-y-4">
            {/* Text Input */}
            <div className="relative">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Digite seu texto..."
                className={cn(
                  "bg-white/20 border-white/30 text-white placeholder:text-white/70 rounded-xl",
                  "focus:bg-white/30 focus:border-white/50 transition-all duration-200"
                )}
                maxLength={150}
              />
            </div>

            {/* Color Controls */}
            <div className="space-y-3">
              {/* Background Colors - only show for text-only stories */}
              {!story.media_url && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Palette className="w-4 h-4 text-white/70" />
                    <span className="text-white/70 text-xs font-medium">Cor de fundo</span>
                  </div>
                  <div className="flex space-x-2 overflow-x-auto">
                    {backgroundColors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setBackgroundColor(color)}
                        className={cn(
                          "flex-shrink-0 w-8 h-8 rounded-full border-2 transition-all duration-200 hover:scale-110",
                          backgroundColor === color 
                            ? "border-white scale-110 shadow-lg" 
                            : "border-white/30"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Text Colors */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Palette className="w-4 h-4 text-white/70" />
                  <span className="text-white/70 text-xs font-medium">Cor do texto</span>
                </div>
                <div className="flex space-x-2 overflow-x-auto">
                  {textColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setTextColor(color)}
                      className={cn(
                        "flex-shrink-0 w-8 h-8 rounded-full border-2 transition-all duration-200 hover:scale-110",
                        textColor === color 
                          ? "border-white scale-110 shadow-lg" 
                          : "border-white/30",
                        color === '#ffffff' && "bg-white",
                        color === '#000000' && "bg-black"
                      )}
                      style={{ 
                        backgroundColor: color === '#ffffff' || color === '#000000' ? color : color,
                        border: color === '#ffffff' ? '2px solid #666' : undefined
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={loading || !text.trim()}
              className="w-full bg-white text-black hover:bg-white/90 rounded-xl font-semibold transition-all duration-200"
              size="lg"
            >
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StoryEditor;