import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Heart, MessageCircle, Share, MoreHorizontal, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MentionText } from '@/components/MentionText';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import MobileLayout from '@/components/MobileLayout';
import VideoPlayer from '@/components/ui/VideoPlayer';
import { usePostInteractions } from '@/hooks/usePostInteractions';
import { CommentsModal } from '@/components/CommentsModal';
import { stripUserDigits } from '@/lib/utils';

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  media_type: string;
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

const PostDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [showComments, setShowComments] = useState(false);
  
  const {
    isLiked,
    likesCount,
    commentsCount,
    handleLike,
  } = usePostInteractions(id || null);

  useEffect(() => {
    if (id) {
      fetchPost();
    }
  }, [id]);

  const fetchPost = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles!inner(display_name, username, avatar_url)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setPost(data);
      } else {
        toast({
          title: "Post não encontrado",
          description: "O post que você está procurando não existe.",
          variant: "destructive",
        });
        navigate('/feed');
      }
    } catch (error) {
      console.error('Error fetching post:', error);
      toast({
        title: "Erro ao carregar post",
        description: "Não foi possível carregar o post.",
        variant: "destructive",
      });
      navigate('/feed');
    } finally {
      setLoading(false);
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
      
      navigate('/feed');
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

  const openComments = () => {
    setShowComments(true);
  };

  if (loading) {
    return (
      <MobileLayout>
        <div className="min-h-screen">
          {/* Header */}
          <div className="sticky top-0 z-50 bg-background border-b border-border">
            <div className="mobile-container py-4">
              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(-1)}
                  className="p-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="text-lg font-semibold">Post</h1>
              </div>
            </div>
          </div>
          
          {/* Loading */}
          <div className="mobile-container py-6 flex items-center justify-center min-h-[50vh]">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (!post) return null;

  return (
    <MobileLayout>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-background border-b border-border">
          <div className="mobile-container py-4">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="p-2"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-lg font-semibold">Post</h1>
            </div>
          </div>
        </div>

        {/* Post Content */}
        <div className="flex-1 flex flex-col">
          <div className="mobile-container">
            <div className="bg-background">
              {/* Post Header */}
              <div className="flex items-center space-x-3 py-4">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={post.profiles.avatar_url || ''} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-lg font-semibold">
                    {post.profiles.display_name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-semibold text-base">{post.profiles.display_name}</h3>
                  <p className="text-sm text-muted-foreground">
                    @{stripUserDigits(post.profiles.username)} • {formatTimeAgo(post.created_at)}
                  </p>
                </div>
                {post.user_id === user?.id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-10 h-10 p-0">
                        <MoreHorizontal className="w-5 h-5" />
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
                <div className="mb-4">
                  {post.media_type === 'video' ? (
                    <VideoPlayer
                      src={post.image_url}
                      className="w-full rounded-lg max-h-[70vh]"
                    />
                  ) : (
                    <img
                      src={post.image_url}
                      alt="Post content"
                      className="w-full rounded-lg object-cover"
                      style={{ maxHeight: '70vh' }}
                      loading="lazy"
                    />
                  )}
                </div>
              )}

              {/* Post Content */}
              {post.content && (
                <div className="py-3">
                  <MentionText text={post.content} className="text-base leading-relaxed" />
                </div>
              )}
              
              {/* Post Actions */}
              <div className="py-3 border-b border-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-4">
                    <button 
                      onClick={handleLike}
                      className={`flex items-center space-x-2 transition-colors ${
                        isLiked 
                          ? 'text-red-500 hover:text-red-600' 
                          : 'text-muted-foreground hover:text-red-500'
                      }`}
                    >
                      <Heart 
                        className={`w-6 h-6 ${isLiked ? 'fill-current' : ''}`} 
                      />
                      <span className="font-semibold">{likesCount}</span>
                    </button>
                    <button 
                      onClick={openComments}
                      className="flex items-center space-x-2 text-muted-foreground hover:text-primary transition-colors"
                    >
                      <MessageCircle className="w-6 h-6" />
                      <span className="font-semibold">{commentsCount}</span>
                    </button>
                  </div>
                  <button className="text-muted-foreground hover:text-primary transition-colors">
                    <Share className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Tap to view comments */}
              <button 
                onClick={openComments}
                className="py-4 text-center text-muted-foreground hover:text-primary transition-colors border-b border-border"
              >
                <p className="text-sm">Ver todos os {commentsCount} comentários</p>
              </button>
            </div>
          </div>

          {/* Comments Modal */}
          <CommentsModal 
            isOpen={showComments}
            onClose={() => setShowComments(false)}
            postId={id || ''}
            postOwnerId={post?.user_id}
          />
        </div>
      </div>
    </MobileLayout>
  );
};

export default PostDetail;