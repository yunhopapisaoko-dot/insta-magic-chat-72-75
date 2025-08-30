import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X, Heart, MessageCircle, Share, MoreHorizontal, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { isVideoUrl } from '@/lib/utils';

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  user_id: string;
  profiles: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
}

interface PostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: Post | null;
  onPostUpdate?: () => void;
}

const PostModal = ({ open, onOpenChange, post, onPostUpdate }: PostModalProps) => {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  useEffect(() => {
    if (post) {
      setLikesCount(post.likes_count);
      fetchLikeStatus();
    }
  }, [post, user]);

  const fetchLikeStatus = async () => {
    if (!user || !post) return;

    try {
      const { data } = await supabase
        .from('post_likes')
        .select('id')
        .eq('user_id', user.id)
        .eq('post_id', post.id)
        .single();

      setIsLiked(!!data);
    } catch (error) {
      // No like found
      setIsLiked(false);
    }
  };

  const handleLike = async () => {
    if (!user || !post) return;

    try {
      if (isLiked) {
        // Unlike
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', post.id);

        if (error) throw error;
        setIsLiked(false);
        setLikesCount(prev => prev - 1);
      } else {
        // Like
        const { error } = await supabase
          .from('post_likes')
          .insert({
            user_id: user.id,
            post_id: post.id,
          });

        if (error) throw error;
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error liking/unliking post:', error);
    }
  };

  const handleDeletePost = async () => {
    if (!user || !post) return;

    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', post.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Post deletado",
        description: "Seu post foi removido com sucesso.",
      });
      
      onOpenChange(false);
      onPostUpdate?.();
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: "Erro ao deletar",
        description: "Não foi possível deletar o post.",
        variant: "destructive",
      });
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMilliseconds = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMilliseconds / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'agora';
    if (diffInHours < 24) return `${diffInHours}h`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d`;
  };

  if (!post) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="absolute top-2 right-2 z-10 bg-background/80 hover:bg-background"
          >
            <X className="w-4 h-4" />
          </Button>
          
          <Card className="border-0 shadow-none">
            <CardContent className="p-0">
              {/* Post Header */}
              <div className="flex items-center space-x-3 p-4 pb-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={post.profiles.avatar_url || ''} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-sm font-semibold">
                    {post.profiles.display_name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">{post.profiles.display_name}</h3>
                  <p className="text-xs text-muted-foreground">
                    @{post.profiles.username} • {formatTimeAgo(post.created_at)}
                  </p>
                </div>
                {post.user_id === user?.id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-background border border-border">
                      <DropdownMenuItem 
                        onClick={handleDeletePost}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Deletar post
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              
              {/* Post Media */}
              {post.image_url && (
                <div className="px-4 pb-3">
                  {isVideoUrl(post.image_url) ? (
                    <video
                      src={post.image_url}
                      className="w-full rounded-lg object-cover max-h-96"
                      controls
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={post.image_url}
                      alt="Post content"
                      className="w-full rounded-lg object-cover max-h-96"
                      loading="lazy"
                    />
                  )}
                </div>
              )}
              
              {/* Post Content */}
              {post.content && (
                <div className="px-4 pb-3">
                  <p className="text-sm leading-relaxed">{post.content}</p>
                </div>
              )}
              
              {/* Post Actions */}
              <div className="px-4 py-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <button 
                      onClick={handleLike}
                      className={`flex items-center space-x-1 transition-colors ${
                        isLiked 
                          ? 'text-red-500 hover:text-red-600' 
                          : 'text-muted-foreground hover:text-red-500'
                      }`}
                    >
                      <Heart 
                        className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} 
                      />
                      <span className="text-sm">{likesCount}</span>
                    </button>
                    <button className="flex items-center space-x-1 text-muted-foreground hover:text-primary transition-colors">
                      <MessageCircle className="w-5 h-5" />
                      <span className="text-sm">{post.comments_count}</span>
                    </button>
                  </div>
                  <button className="text-muted-foreground hover:text-primary transition-colors">
                    <Share className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostModal;