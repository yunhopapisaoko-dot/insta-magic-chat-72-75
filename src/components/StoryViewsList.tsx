import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface StoryView {
  id: string;
  user_id: string;
  viewed_at: string;
  profiles: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
}

interface StoryViewsListProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storyId: string;
}

const StoryViewsList = ({ open, onOpenChange, storyId }: StoryViewsListProps) => {
  const [views, setViews] = useState<StoryView[]>([]);
  const [loading, setLoading] = useState(false);

  const stripUserDigits = (username: string): string => {
    return username.replace(/\d{4}$/, '');
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

  useEffect(() => {
    if (open && storyId) {
      fetchStoryViews();
    }
  }, [open, storyId]);

  const fetchStoryViews = async () => {
    setLoading(true);
    try {
      // Simular dados de visualização por enquanto já que não temos a tabela story_views
      // Em produção, isso seria uma consulta real ao banco
      setViews([]);
    } catch (error) {
      console.error('Error fetching story views:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-base">
            <Eye className="w-4 h-4 mr-2" />
            Visualizações ({views.length})
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="md" />
            </div>
          ) : views.length === 0 ? (
            <div className="text-center py-8">
              <Eye className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">
                Ninguém visualizou ainda
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {views.map((view) => (
                <div key={view.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={view.profiles.avatar_url || ''} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-sm font-semibold">
                        {view.profiles.display_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{view.profiles.display_name}</p>
                      <p className="text-xs text-muted-foreground">
                        @{stripUserDigits(view.profiles.username)}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatTimeAgo(view.viewed_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StoryViewsList;