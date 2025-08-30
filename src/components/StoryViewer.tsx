import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X, ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

interface Story {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  background_color: string;
  text_color: string;
  created_at: string;
  profiles: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
}

interface StoryViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stories: Story[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onStartChat?: (userId: string, story: Story) => void;
}

const StoryViewer = ({ 
  open, 
  onOpenChange, 
  stories, 
  currentIndex, 
  onIndexChange,
  onStartChat 
}: StoryViewerProps) => {
  const { user } = useAuth();
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const STORY_DURATION = 5000; // 5 seconds per story

  const currentStory = stories[currentIndex];

  useEffect(() => {
    if (open && !isPaused) {
      setProgress(0);
      const increment = 100 / (STORY_DURATION / 50); // Update every 50ms

      intervalRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            // Move to next story
            if (currentIndex < stories.length - 1) {
              onIndexChange(currentIndex + 1);
              return 0;
            } else {
              // Close viewer when all stories are finished
              onOpenChange(false);
              return 0;
            }
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
  }, [open, isPaused, currentIndex, stories.length, onIndexChange, onOpenChange]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      onIndexChange(currentIndex - 1);
      setProgress(0);
    }
  };

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      onIndexChange(currentIndex + 1);
      setProgress(0);
    } else {
      onOpenChange(false);
    }
  };

  const handlePause = () => {
    setIsPaused(true);
  };

  const handleResume = () => {
    setIsPaused(false);
  };

  const handleStartChat = (userId: string, story: Story) => {
    if (onStartChat) {
      onStartChat(userId, story);
      onOpenChange(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMilliseconds = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMilliseconds / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'agora';
    if (diffInHours < 24) return `${diffInHours}h`;
    return `${Math.floor(diffInHours / 24)}d`;
  };

  if (!currentStory) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-sm mx-auto p-0 bg-transparent border-0">
        <div className="relative w-full h-[600px] rounded-2xl overflow-hidden">
          {/* Progress bars */}
          <div className="absolute top-2 left-4 right-4 z-20 flex space-x-1">
            {stories.map((_, index) => (
              <div
                key={index}
                className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-white transition-all duration-100"
                  style={{
                    width: index < currentIndex ? '100%' : 
                           index === currentIndex ? `${progress}%` : '0%'
                  }}
                />
              </div>
            ))}
          </div>

          {/* Story Content */}
          <div
            className="w-full h-full relative flex items-center justify-center"
            style={{
              background: currentStory.media_url ? 'transparent' : 
                         `linear-gradient(135deg, ${currentStory.background_color}, ${currentStory.background_color}dd)`,
            }}
            onMouseDown={handlePause}
            onMouseUp={handleResume}
            onTouchStart={handlePause}
            onTouchEnd={handleResume}
          >
            {currentStory.media_url ? (
              currentStory.media_type === 'video' ? (
                <video
                  src={currentStory.media_url}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  loop
                />
              ) : (
                <img
                  src={currentStory.media_url}
                  alt="Story media"
                  className="w-full h-full object-cover"
                />
              )
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-transparent" />
            )}

            {/* User Info Overlay */}
            <div className="absolute top-12 left-4 right-4 flex items-center justify-between z-10">
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
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-white hover:bg-white/20 w-8 h-8 p-0 rounded-full"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Chat Button - Only show for other users' stories */}
            {currentStory.user_id !== user?.id && (
              <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-10">
                <Button
                  onClick={() => handleStartChat(currentStory.user_id, currentStory)}
                  className="bg-white/90 hover:bg-white text-black rounded-full px-6 py-2 backdrop-blur-sm"
                  size="sm"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Chamar para conversar
                </Button>
              </div>
            )}

            {/* Text Content */}
            {currentStory.content && (
              <div
                className="absolute inset-0 flex items-center justify-center p-8 z-10"
                style={{ color: currentStory.text_color }}
              >
                <p className="text-2xl font-bold text-center drop-shadow-lg leading-tight">
                  {currentStory.content}
                </p>
              </div>
            )}

            {/* Navigation areas */}
            <div className="absolute inset-0 flex">
              <div 
                className="w-1/3 h-full flex items-center justify-start pl-4"
                onClick={handlePrevious}
              >
                {currentIndex > 0 && (
                  <ChevronLeft className="w-6 h-6 text-white/50" />
                )}
              </div>
              <div className="w-1/3 h-full" />
              <div 
                className="w-1/3 h-full flex items-center justify-end pr-4"
                onClick={handleNext}
              >
                {currentIndex < stories.length - 1 ? (
                  <ChevronRight className="w-6 h-6 text-white/50" />
                ) : (
                  <X className="w-6 h-6 text-white/50" />
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StoryViewer;