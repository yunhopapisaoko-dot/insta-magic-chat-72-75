import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tag, Users, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TaggedUser {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
}

interface PostTagsProps {
  postId?: string;
  storyId?: string;
  variant?: 'compact' | 'full';
  showCount?: boolean;
}

export const PostTags = ({ postId, storyId, variant = 'compact', showCount = true }: PostTagsProps) => {
  const [tags, setTags] = useState<TaggedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFullList, setShowFullList] = useState(false);

  useEffect(() => {
    if (postId || storyId) {
      fetchTags();
    }
  }, [postId, storyId]);

  const fetchTags = async () => {
    if (!postId && !storyId) return;
    
    setLoading(true);
    try {
      let query;
      
      if (postId) {
        query = supabase
          .from('post_tags')
          .select('user_id')
          .eq('post_id', postId);
      } else {
        query = supabase
          .from('story_tags')
          .select('user_id')
          .eq('story_id', storyId);
      }

      const { data: tagData, error: tagError } = await query;

      if (tagError) throw tagError;

      if (!tagData || tagData.length === 0) {
        setTags([]);
        return;
      }

      // Then get the user profiles
      const userIds = tagData.map((tag: any) => tag.user_id);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', userIds);

      if (profileError) throw profileError;

      setTags(profileData || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || tags.length === 0) {
    return null;
  }

  const visibleTags = variant === 'compact' ? tags.slice(0, 3) : tags;
  const hasMoreTags = tags.length > 3 && variant === 'compact';

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Tag className="w-3 h-3 text-muted-foreground" />
          {variant === 'compact' && showCount && (
            <span className="text-xs text-muted-foreground">
              {tags.length} marcado{tags.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {visibleTags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="text-xs px-2 py-1 flex items-center gap-1"
            >
              <Avatar className="w-4 h-4">
                <AvatarImage src={tag.avatar_url || ''} />
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {tag.display_name[0]}
                </AvatarFallback>
              </Avatar>
              <span>{tag.display_name}</span>
            </Badge>
          ))}

          {hasMoreTags && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowFullList(true)}
            >
              +{tags.length - 3} mais
              <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* Full List Modal */}
      <Dialog open={showFullList} onOpenChange={setShowFullList}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Pessoas marcadas
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-80">
            <div className="space-y-3">
              {tags.map((tag) => (
                <div key={tag.id} className="flex items-center space-x-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={tag.avatar_url || ''} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-sm font-semibold">
                      {tag.display_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {tag.display_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      Pessoa marcada
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};