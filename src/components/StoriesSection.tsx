import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';
import { useNavigate } from 'react-router-dom';
import { useStoriesCache } from '@/hooks/useStoriesCache';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import StoryCreator from '@/components/StoryCreator';
import StoryViewerEnhanced from '@/components/StoryViewerEnhanced';

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

const StoriesSection = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { createOrGetConversation } = useConversations();
  const { stories, userStories, loading, refreshStories, preloadStoryMedia } = useStoriesCache(user?.id);
  const [createStoryOpen, setCreateStoryOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);

  // Clear cache and force refresh when component mounts
  useEffect(() => {
    console.log('🔄 StoriesSection mounted - forcing stories refresh');
    refreshStories();
  }, []);

  const handleStoryCreated = () => {
    refreshStories();
  };

  // Create story groups including user's own stories
  const allStoryGroups = [
    ...(userStories.length > 0 ? [{
      user_id: user?.id || '',
      user: {
        display_name: user?.display_name || 'Você',
        username: user?.username || '',
        avatar_url: user?.avatar_url || null,
      },
      stories: userStories,
      hasViewed: true, // Stories próprios NUNCA mostram bolinha vermelha
    }] : []),
    ...stories
  ];

  const handleViewStories = (groupIndex: number, storyIndex = 0) => {
    setCurrentGroupIndex(groupIndex);
    setCurrentStoryIndex(storyIndex);
    setViewerOpen(true);
    
    // Preload media for better experience
    const group = allStoryGroups[groupIndex];
    if (group) {
      preloadStoryMedia(group.stories);
    }
  };

  const handleStartChat = async (userId: string, story: any) => {
    const conversationId = await createOrGetConversation(userId, story.id);
    if (conversationId) {
      navigate('/messages');
    }
  };

  const handleViewUserStories = () => {
    if (userStories.length > 0) {
      handleViewStories(0, 0); // User's stories are always at index 0
    } else {
      setCreateStoryOpen(true);
    }
  };

  const handleViewFollowedStories = (storyGroup: StoryGroup) => {
    const groupIndex = allStoryGroups.findIndex(g => g.user_id === storyGroup.user_id);
    if (groupIndex !== -1) {
      handleViewStories(groupIndex, 0);
    }
  };

  return (
    <>
      <div className="border-b border-border py-4">
        <div className="mobile-container">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="md" />
            </div>
          ) : (
            <div className="flex space-x-4 overflow-x-auto pb-2 animate-fade-in">
              {/* User's own story */}
              <div 
                className="flex-shrink-0 flex flex-col items-center space-y-1 cursor-pointer group"
                onClick={handleViewUserStories}
              >
                <div className="relative">
                  {userStories.length > 0 ? (
                    <div className="w-16 h-16 rounded-full story-gradient p-0.5 transition-all duration-300 group-hover:scale-110 animate-story-ring-pulse">
                      <Avatar className="w-full h-full border-2 border-white">
                        <AvatarImage src={user?.avatar_url || ''} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-sm font-semibold">
                          {user?.display_name?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-primary flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:border-solid group-hover:bg-primary/5 animate-story-bounce">
                      <Plus className="w-6 h-6 text-primary transition-transform duration-300 group-hover:scale-125" />
                    </div>
                  )}
                  
                  {/* Story count indicator */}
                  {userStories.length > 1 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-story-count-bg text-story-count-text text-xs font-bold rounded-full flex items-center justify-center animate-story-glow">
                      {userStories.length}
                    </div>
                  )}
                  
                   {/* New story indicator - NUNCA mostrar para stories próprios */}
                   {false && (
                     <div className="absolute top-0 right-0 w-3 h-3 bg-story-new-indicator rounded-full animate-pulse border-2 border-white animate-story-glow" />
                   )}
                </div>
                
                <span className="text-xs text-muted-foreground transition-colors duration-300 group-hover:text-primary font-medium">
                  {userStories.length > 0 ? 'Meu story' : 'Adicionar'}
                </span>
              </div>
            
              {/* Stories from followed users */}
              {stories.map((storyGroup) => (
                <div 
                  key={storyGroup.user_id}
                  className="flex-shrink-0 flex flex-col items-center space-y-1 cursor-pointer group"
                  onClick={() => handleViewFollowedStories(storyGroup)}
                >
                  <div className="relative">
                    <div className={`w-16 h-16 rounded-full p-0.5 transition-all duration-300 group-hover:scale-110 ${
                      storyGroup.hasViewed 
                        ? 'bg-gradient-to-br from-muted to-muted-foreground/30' 
                        : 'story-gradient animate-story-ring-pulse'
                    }`}>
                      <Avatar className="w-full h-full border-2 border-white">
                        <AvatarImage src={storyGroup.user.avatar_url || ''} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-sm font-semibold">
                          {storyGroup.user.display_name[0]}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    
                    {/* Story count indicator */}
                    {storyGroup.stories.length > 1 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-story-count-bg text-story-count-text text-xs font-bold rounded-full flex items-center justify-center animate-story-glow">
                        {storyGroup.stories.length}
                      </div>
                    )}
                    
                    {/* New story indicator - only show if not viewed */}
                    {!storyGroup.hasViewed && (
                      <div className="absolute top-0 right-0 w-3 h-3 bg-story-new-indicator rounded-full animate-pulse border-2 border-white animate-story-glow" />
                    )}
                  </div>
                  
                  <span className="text-xs text-muted-foreground max-w-[64px] truncate transition-colors duration-300 group-hover:text-primary font-medium">
                    {storyGroup.user.display_name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <StoryCreator
        open={createStoryOpen}
        onOpenChange={setCreateStoryOpen}
        onStoryCreated={handleStoryCreated}
      />

      <StoryViewerEnhanced
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        storyGroups={allStoryGroups}
        currentGroupIndex={currentGroupIndex}
        currentStoryIndex={currentStoryIndex}
        onGroupChange={setCurrentGroupIndex}
        onStoryChange={setCurrentStoryIndex}
        onStartChat={handleStartChat}
        onStoryDeleted={() => {
          // Recarrega as stories após deletar
          refreshStories();
        }}
      />
    </>
  );
};

export default StoriesSection;