import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X, ChevronLeft, ChevronRight, MessageCircle, Volume2, VolumeX, MoreVertical, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import StoryEditor from '@/components/StoryEditor';

interface Story {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  background_color: string;
  text_color: string;
  text_position: string;
  text_size: number;
  created_at: string;
  expires_at: string;
  profiles: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
}

interface StoryGroup {
  user_id: string;
  user: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
  stories: Story[];
  hasViewed: boolean;
}

interface StoryViewerEnhancedProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storyGroups: StoryGroup[];
  currentGroupIndex: number;
  currentStoryIndex: number;
  onGroupChange: (groupIndex: number) => void;
  onStoryChange: (storyIndex: number) => void;
  onStartChat?: (userId: string, story: Story) => void;
  onStoryDeleted?: () => void;
}

const StoryViewerEnhanced = ({ 
  open, 
  onOpenChange, 
  storyGroups,
  currentGroupIndex,
  currentStoryIndex,
  onGroupChange,
  onStoryChange,
  onStartChat,
  onStoryDeleted 
}: StoryViewerEnhancedProps) => {
  const { user } = useAuth();
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; time: number } | null>(null);
  const [isEditingStory, setIsEditingStory] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  const STORY_DURATION = 5000; // 5 segundos por story
  const SWIPE_THRESHOLD = 50;
  const TAP_THRESHOLD = 10;

  const currentGroup = storyGroups[currentGroupIndex];
  const currentStory = currentGroup?.stories[currentStoryIndex];
  const allStories = currentGroup?.stories || [];

  // Função para avançar para o próximo story/grupo
  const handleNext = useCallback(() => {
    if (currentStoryIndex < allStories.length - 1) {
      // Próximo story do mesmo grupo
      onStoryChange(currentStoryIndex + 1);
    } else if (currentGroupIndex < storyGroups.length - 1) {
      // Primeiro story do próximo grupo
      onGroupChange(currentGroupIndex + 1);
      onStoryChange(0);
    } else {
      // Fim de todos os stories
      onOpenChange(false);
    }
  }, [currentStoryIndex, currentGroupIndex, allStories.length, storyGroups.length, onStoryChange, onGroupChange, onOpenChange]);

  // Função para voltar para o story anterior
  const handlePrevious = useCallback(() => {
    if (currentStoryIndex > 0) {
      // Story anterior do mesmo grupo
      onStoryChange(currentStoryIndex - 1);
    } else if (currentGroupIndex > 0) {
      // Último story do grupo anterior
      const prevGroup = storyGroups[currentGroupIndex - 1];
      onGroupChange(currentGroupIndex - 1);
      onStoryChange(prevGroup.stories.length - 1);
    }
  }, [currentStoryIndex, currentGroupIndex, storyGroups, onStoryChange, onGroupChange]);

  // Gerenciamento da progressão automática
  useEffect(() => {
    if (open && !isPaused) {
      setProgress(0);
      const increment = 100 / (STORY_DURATION / 50); // Atualiza a cada 50ms

      intervalRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            handleNext();
            return 0;
          }
          return prev + increment;
        });
      }, 50);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [open, isPaused, currentGroupIndex, currentStoryIndex, handleNext]);

  // Reset progress quando o story muda
  useEffect(() => {
    setProgress(0);
  }, [currentStoryIndex, currentGroupIndex]);

  // Controles de toque
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ 
      x: touch.clientX, 
      y: touch.clientY, 
      time: Date.now() 
    });
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart || !containerRef.current) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    const deltaTime = Date.now() - touchStart.time;

    // Para vídeos, desabilita navegação por toque para evitar conflitos com controles
    if (currentStory?.media_type === 'video') {
      setTouchStart(null);
      return;
    }

    // Se foi um toque rápido (não um arraste longo)
    if (deltaTime < 300) {
      // Se foi um swipe horizontal
      if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0) {
          // Swipe direita - voltar
          handlePrevious();
        } else {
          // Swipe esquerda - avançar
          handleNext();
        }
      } 
      // Se foi um tap (movimento mínimo)
      else if (Math.abs(deltaX) < TAP_THRESHOLD && Math.abs(deltaY) < TAP_THRESHOLD) {
        const rect = containerRef.current.getBoundingClientRect();
        const tapX = touch.clientX - rect.left;
        const width = rect.width;
        
        // Divide a tela em 3 partes: esquerda (30%), centro (40%), direita (30%)
        if (tapX < width * 0.3) {
          // Tap no lado esquerdo - voltar
          handlePrevious();
        } else if (tapX > width * 0.7) {
          // Tap no lado direito - avançar
          handleNext();
        }
        // Tap no centro não faz nada (permite interação com controles)
      }
    }

    setTouchStart(null);
  }, [touchStart, handlePrevious, handleNext, currentStory?.media_type]);

  // Pausar/retomar com mouse/toque longo
  const handlePointerDown = useCallback(() => {
    setIsPaused(true);
  }, []);

  const handlePointerUp = useCallback(() => {
    setIsPaused(false);
  }, []);

  // Chat handler
  const handleStartChat = useCallback((userId: string, story: Story) => {
    if (onStartChat) {
      onStartChat(userId, story);
      onOpenChange(false);
    }
  }, [onStartChat, onOpenChange]);

  // Controle de volume
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      if (videoRef.current) {
        videoRef.current.muted = !prev;
      }
      return !prev;
    });
  }, []);

  // Formatação de tempo
  const formatTimeAgo = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMilliseconds = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMilliseconds / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'agora';
    if (diffInHours < 24) return `${diffInHours}h`;
    return `${Math.floor(diffInHours / 24)}d`;
  }, []);

  // Deletar story
  const handleDeleteStory = useCallback(async () => {
    console.log('handleDeleteStory called');
    console.log('currentStory:', currentStory);
    console.log('user:', user);
    
    if (!currentStory || currentStory.user_id !== user?.id) {
      console.log('Cannot delete story - not owner or story not found');
      console.log('currentStory.user_id:', currentStory?.user_id);
      console.log('user.id:', user?.id);
      return;
    }

    console.log('Attempting to delete story with id:', currentStory.id);

    try {
      const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', currentStory.id);

      console.log('Delete response:', { error });

      if (error) {
        console.error('Delete error:', error);
        throw error;
      }

      console.log('Story deleted successfully');

      toast({
        title: "Story deletado",
        description: "Seu story foi removido com sucesso",
      });

      // Se havia mais stories no grupo atual, vá para o próximo
      if (allStories.length > 1) {
        if (currentStoryIndex > 0) {
          onStoryChange(currentStoryIndex - 1);
        } else {
          handleNext();
        }
      } else {
        // Se era o último story do grupo, feche o viewer
        onOpenChange(false);
      }

      // Chama callback para atualizar a lista de stories
      onStoryDeleted?.();
      
    } catch (error) {
      console.error('Erro ao deletar story:', error);
      toast({
        title: "Erro",
        description: "Não foi possível deletar o story",
        variant: "destructive",
      });
    }
  }, [currentStory, user?.id, allStories.length, currentStoryIndex, onStoryChange, handleNext, onOpenChange, onStoryDeleted]);

  // Melhor sistema de pré-carregamento 
  const preloadAdjacentStories = useCallback(() => {
    if (!storyGroups.length) return;
    
    const adjacentStories: string[] = [];
    
    // Preload próximo story no mesmo grupo
    if (currentStoryIndex < allStories.length - 1) {
      const nextStory = allStories[currentStoryIndex + 1];
      if (nextStory?.media_url) adjacentStories.push(nextStory.media_url);
    }
    
    // Preload primeiro story do próximo grupo
    if (currentGroupIndex < storyGroups.length - 1) {
      const nextGroup = storyGroups[currentGroupIndex + 1];
      if (nextGroup?.stories[0]?.media_url) {
        adjacentStories.push(nextGroup.stories[0].media_url);
      }
    }
    
    // Preload story anterior no mesmo grupo
    if (currentStoryIndex > 0) {
      const prevStory = allStories[currentStoryIndex - 1];
      if (prevStory?.media_url) adjacentStories.push(prevStory.media_url);
    }
    
    // Executar preload
    adjacentStories.forEach(url => {
      if (url.includes('video') || url.match(/\.(mp4|webm|ogg)$/i)) {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = url;
      } else {
        const img = new Image();
        img.src = url;
      }
    });
  }, [storyGroups, currentGroupIndex, currentStoryIndex, allStories]);

  // Executar preload quando mudar story
  useEffect(() => {
    if (open) {
      preloadAdjacentStories();
    }
  }, [open, currentGroupIndex, currentStoryIndex, preloadAdjacentStories]);
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!open) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handlePrevious();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
        case ' ':
          e.preventDefault();
          setIsPaused(prev => !prev);
          break;
        case 'Escape':
          e.preventDefault();
          onOpenChange(false);
          break;
      }
    };

    if (open) {
      document.addEventListener('keydown', handleKeyPress);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [open, handlePrevious, handleNext, onOpenChange]);

  if (!currentStory) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-sm mx-auto p-0 bg-transparent border-0">
        <DialogTitle className="sr-only">
          Visualizando story de {currentStory.profiles.display_name}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Story {currentStoryIndex + 1} de {allStories.length} de {currentStory.profiles.display_name}
        </DialogDescription>
        
        <div 
          ref={containerRef}
          className="relative w-full h-[600px] rounded-2xl overflow-hidden animate-scale-in"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handlePointerDown}
          onMouseUp={handlePointerUp}
        >
          {/* Barras de progresso */}
          <div className="absolute top-2 left-4 right-4 z-20 flex space-x-1">
            {allStories.map((_, index) => (
              <div
                key={index}
                className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-white transition-all duration-100"
                  style={{
                    width: index < currentStoryIndex ? '100%' : 
                           index === currentStoryIndex ? `${progress}%` : '0%'
                  }}
                />
              </div>
            ))}
          </div>

          {/* Indicador de grupo */}
          {storyGroups.length > 1 && (
            <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-20">
              <div className="flex space-x-1">
                {storyGroups.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-all duration-200 ${
                      index === currentGroupIndex ? 'bg-white' : 'bg-white/30'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Conteúdo do Story */}
          <div
            className="w-full h-full relative flex items-center justify-center transition-all duration-300 ease-in-out"
            style={{
              background: currentStory.media_url ? 'transparent' : 
                         `linear-gradient(135deg, ${currentStory.background_color}, ${currentStory.background_color}dd)`,
            }}
          >
            {/* Mídia de fundo */}
            {currentStory.media_url && (
              <div className="w-full h-full animate-fade-in">
                {currentStory.media_type === 'video' ? (
                  <video
                    ref={videoRef}
                    src={currentStory.media_url}
                    className="w-full h-full object-cover transition-opacity duration-300"
                    autoPlay
                    muted={isMuted}
                    loop
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={currentStory.media_url}
                    alt="Story media"
                    className="w-full h-full object-cover transition-opacity duration-300"
                    loading="eager"
                  />
                )}
              </div>
            )}

            {/* Overlay escuro para melhor legibilidade do texto */}
            {currentStory.content && currentStory.media_url && (
              <div className="absolute inset-0 bg-black/30" />
            )}

            {/* Informações do usuário */}
            <div className="absolute top-14 left-4 right-4 flex items-center justify-between z-10">
              <div className="flex items-center space-x-2">
                <Avatar className="w-8 h-8 border-2 border-white">
                  <AvatarImage src={currentStory.profiles.avatar_url || ''} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-sm font-semibold">
                    {currentStory.profiles.display_name[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <span className="text-white font-medium text-sm drop-shadow-lg">
                    {currentStory.profiles.display_name}
                  </span>
                  <div className="text-white/70 text-xs drop-shadow-lg">
                    {formatTimeAgo(currentStory.created_at)}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                 {/* Menu de opções para o próprio story */}
                {currentStory.user_id === user?.id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                        onTouchEnd={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                        className="text-white hover:bg-white/20 w-8 h-8 p-0 rounded-full z-50 relative pointer-events-auto bg-black/30 backdrop-blur-sm"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                     <DropdownMenuContent 
                      align="end" 
                      className="bg-background/95 backdrop-blur-sm border border-border z-[9999]"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onPointerUp={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => e.stopPropagation()}
                    >
                      {/* Only show edit option for text and photo stories (not videos) */}
                      {currentStory.media_type !== 'video' && (
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsEditingStory(true);
                          }}
                          className="cursor-pointer hover:bg-accent focus:bg-accent"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Editar story
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteStory();
                        }}
                        className="text-destructive focus:text-destructive cursor-pointer hover:bg-destructive/10 focus:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Deletar story
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Controle de volume para vídeos - botão maior */}
                {currentStory.media_type === 'video' && (
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMute();
                    }}
                    className="text-white hover:bg-white/20 w-12 h-12 p-0 rounded-full bg-black/30 backdrop-blur-sm"
                  >
                    {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                  </Button>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenChange(false);
                  }}
                  className="text-white hover:bg-white/20 w-8 h-8 p-0 rounded-full"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Botão de chat - apenas para stories de outros usuários */}
            {currentStory.user_id !== user?.id && (
              <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-10">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartChat(currentStory.user_id, currentStory);
                  }}
                  className="bg-white/90 hover:bg-white text-black rounded-full px-6 py-2 backdrop-blur-sm transition-all duration-200 hover:scale-105"
                  size="sm"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Chamar para conversar
                </Button>
              </div>
            )}

            {/* Conteúdo de texto */}
            {currentStory.content && (
              <div
                className={cn(
                  "absolute p-8 z-10 flex animate-fade-in",
                  {
                    'inset-0 items-center justify-center': (currentStory.text_position || 'center') === 'center',
                    'top-0 left-0 right-0 items-start justify-center': (currentStory.text_position || 'center') === 'top',
                    'bottom-0 left-0 right-0 items-end justify-center': (currentStory.text_position || 'center') === 'bottom',
                    'inset-0 items-center justify-start': (currentStory.text_position || 'center') === 'left',
                    'inset-0 items-center justify-end': (currentStory.text_position || 'center') === 'right',
                  }
                )}
                style={{ color: currentStory.text_color }}
              >
                <p 
                  className="font-bold text-center drop-shadow-lg leading-tight animate-scale-in break-words max-w-[80%]"
                  style={{ fontSize: `${currentStory.text_size || 24}px` }}
                >
                  {currentStory.content}
                </p>
              </div>
            )}

            {/* Indicadores de navegação */}
            <div className="absolute inset-0 flex pointer-events-none">
              <div className="w-1/3 h-full flex items-center justify-start pl-4">
                {(currentStoryIndex > 0 || currentGroupIndex > 0) && !currentStory.media_type?.includes('video') && (
                  <ChevronLeft className="w-6 h-6 text-white/50 transition-all duration-300 hover:text-white hover:scale-110" />
                )}
              </div>
              <div className="w-1/3 h-full flex items-center justify-center">
                {isPaused && (
                  <div className="bg-black/50 rounded-lg px-3 py-1 animate-scale-in">
                    <span className="text-white text-sm font-medium">Pausado</span>
                  </div>
                )}
              </div>
              <div className="w-1/3 h-full flex items-center justify-end pr-4">
                {(currentStoryIndex < allStories.length - 1 || currentGroupIndex < storyGroups.length - 1) && !currentStory.media_type?.includes('video') ? (
                  <ChevronRight className="w-6 h-6 text-white/50 transition-all duration-300 hover:text-white hover:scale-110" />
                ) : !currentStory.media_type?.includes('video') && (
                  <X className="w-6 h-6 text-white/50 transition-all duration-300 hover:text-white hover:scale-110" />
                )}
              </div>
            </div>

            {/* Setas de navegação para vídeos - sempre visíveis */}
            {currentStory.media_type === 'video' && (
              <>
                {/* Seta Anterior */}
                {(currentStoryIndex > 0 || currentGroupIndex > 0) && (
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrevious();
                    }}
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20 text-white hover:bg-white/20 w-12 h-12 p-0 rounded-full bg-black/30 backdrop-blur-sm hover:scale-110 transition-all duration-200"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </Button>
                )}

                {/* Seta Próxima */}
                {(currentStoryIndex < allStories.length - 1 || currentGroupIndex < storyGroups.length - 1) && (
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNext();
                    }}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20 text-white hover:bg-white/20 w-12 h-12 p-0 rounded-full bg-black/30 backdrop-blur-sm hover:scale-110 transition-all duration-200"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Story Editor Modal */}
        <StoryEditor
          open={isEditingStory}
          onOpenChange={setIsEditingStory}
          story={currentStory}
          onStoryUpdated={() => {
            onStoryDeleted?.(); // Refresh stories list
          }}
        />
      </DialogContent>
    </Dialog>
  );
};

export default StoryViewerEnhanced;