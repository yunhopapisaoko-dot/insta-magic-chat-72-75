import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Heart, MessageCircle, Grid3X3 } from 'lucide-react';
import { MentionText } from '@/components/MentionText';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import VideoPlayer from '@/components/ui/VideoPlayer';

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

interface PostsGridProps {
  userId?: string;
  showAllUsers?: boolean;
  onPostUpdate?: () => void;
}

const PostsGrid = ({ userId, showAllUsers = false, onPostUpdate }: PostsGridProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, [userId, showAllUsers]);

  const fetchPosts = async () => {
    try {
      let query = supabase
        .from('posts')
        .select(`
          *,
          profiles!inner(display_name, username, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (!showAllUsers && userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePostClick = (post: Post) => {
    navigate(`/post/${post.id}`);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-1">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="aspect-square animate-pulse bg-muted border-0" />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <Grid3X3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">
          {showAllUsers ? 'Nenhum post ainda' : 'Nenhum post ainda'}
        </p>
        <p className="text-sm text-muted-foreground">
          {showAllUsers ? 'Seja o primeiro a compartilhar!' : 'Compartilhe seu primeiro momento!'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-1">
        {posts.map((post) => (
          <Card 
            key={post.id} 
            className="aspect-square overflow-hidden border-0 relative group cursor-pointer"
            onClick={() => handlePostClick(post)}
          >
            <CardContent className="p-0 h-full">
              {post.image_url ? (
                post.media_type === 'video' ? (
                  <VideoPlayer
                    src={post.image_url}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={post.image_url}
                    alt="Post"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center p-2">
                  <MentionText text={post.content} className="text-xs text-center text-muted-foreground line-clamp-3" />
                </div>
              )}
              
              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="flex items-center space-x-4 text-white">
                  <div className="flex items-center space-x-1">
                    <Heart className="w-4 h-4" />
                    <span className="text-sm font-semibold">{post.likes_count}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-sm font-semibold">{post.comments_count}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
};

export default PostsGrid;