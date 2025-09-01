import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MessageCircle, Plus, Heart, MessageCircle as Comment, Share, Settings, LogOut, MoreHorizontal, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '@/components/MobileLayout';
import CreatePost from '@/components/CreatePost';
import StoriesSection from '@/components/StoriesSection';
import VideoPlayer from '@/components/ui/VideoPlayer';
import NotificationBell from '@/components/NotificationBell';
import { MentionText } from '@/components/MentionText';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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

const Feed = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      fetchPosts();
      fetchLikedPosts();
      const cleanup = setupRealtimeSubscriptions();
      
      return cleanup;
    }
  }, [user]);

  const setupRealtimeSubscriptions = () => {
    if (!user) return;

    // Subscribe to post likes changes for real-time updates
    const likesChannel = supabase
      .channel('post-likes-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'post_likes',
        },
        (payload) => {
          const newLike = payload.new as any;
          console.log('New like received:', newLike);
          
          // Update local liked posts if this user liked it
          if (newLike.user_id === user.id) {
            setLikedPosts(prev => new Set([...prev, newLike.post_id]));
          }
          
          // Update likes count for the post
          setPosts(prev => prev.map(post => 
            post.id === newLike.post_id 
              ? { ...post, likes_count: post.likes_count + 1 }
              : post
          ));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'post_likes',
        },
        (payload) => {
          const deletedLike = payload.old as any;
          console.log('Like removed:', deletedLike);
          
          // Update local liked posts if this user unliked it
          if (deletedLike.user_id === user.id) {
            setLikedPosts(prev => {
              const newSet = new Set(prev);
              newSet.delete(deletedLike.post_id);
              return newSet;
            });
          }
          
          // Update likes count for the post
          setPosts(prev => prev.map(post => 
            post.id === deletedLike.post_id 
              ? { ...post, likes_count: Math.max(0, post.likes_count - 1) }
              : post
          ));
        }
      )
      .subscribe();

    // Subscribe to posts changes for new posts
    const postsChannel = supabase
      .channel('posts-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
        },
        (payload) => {
          const newPost = payload.new as any;
          fetchNewPost(newPost.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(postsChannel);
    };
  };

  const fetchNewPost = async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles!inner(display_name, username, avatar_url)
        `)
        .eq('id', postId)
        .single();

      if (error) throw error;
      if (data) {
        setPosts(prev => [data, ...prev]);
      }
    } catch (error) {
      console.error('Error fetching new post:', error);
    }
  };

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles!inner(display_name, username, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLikedPosts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', user.id);

      if (error) throw error;
      
      const likedIds = new Set(data?.map(like => like.post_id) || []);
      setLikedPosts(likedIds);
    } catch (error) {
      console.error('Error fetching likes:', error);
    }
  };

  const handleLike = async (postId: string) => {
    if (!user) return;

    try {
      const isLiked = likedPosts.has(postId);

      // Optimistic update - update UI immediately
      if (isLiked) {
        // Remove like locally first for instant feedback
        setLikedPosts(prev => {
          const newSet = new Set(prev);
          newSet.delete(postId);
          return newSet;
        });
        setPosts(prev => prev.map(post => 
          post.id === postId 
            ? { ...post, likes_count: Math.max(0, post.likes_count - 1) }
            : post
        ));

        // Then remove from database
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', postId);

        if (error) {
          // Revert on error
          console.error('Error unliking post:', error);
          setLikedPosts(prev => new Set([...prev, postId]));
          setPosts(prev => prev.map(post => 
            post.id === postId 
              ? { ...post, likes_count: post.likes_count + 1 }
              : post
          ));
        }
      } else {
        // Add like locally first for instant feedback
        setLikedPosts(prev => new Set([...prev, postId]));
        setPosts(prev => prev.map(post => 
          post.id === postId 
            ? { ...post, likes_count: post.likes_count + 1 }
            : post
        ));

        // Then add to database
        const { error } = await supabase
          .from('post_likes')
          .insert({
            user_id: user.id,
            post_id: postId,
          });

        if (error) {
          // Revert on error
          console.error('Error liking post:', error);
          setLikedPosts(prev => {
            const newSet = new Set(prev);
            newSet.delete(postId);
            return newSet;
          });
          setPosts(prev => prev.map(post => 
            post.id === postId 
              ? { ...post, likes_count: Math.max(0, post.likes_count - 1) }
              : post
          ));
        }
      }
    } catch (error) {
      console.error('Error in handleLike:', error);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', user.id);

      if (error) throw error;

      setPosts(prev => prev.filter(p => p.id !== postId));
      toast({
        title: "Post deletado",
        description: "Seu post foi removido com sucesso.",
      });
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

  const handlePostClick = (post: Post) => {
    navigate(`/post/${post.id}`);
  };

  const handleProfileClick = (username: string) => {
    navigate(`/user/${username}`);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <MobileLayout>
      <div className="space-y-0">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="mobile-container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full magic-gradient flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Magic Talk
              </h1>
            </div>
            
            <div className="flex items-center space-x-2">
              <NotificationBell />
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/admin')}
                  className="text-primary"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <StoriesSection />

      {/* Welcome Message */}
      <div className="mobile-container py-6">
        <Card className="card-shadow border-0 magic-gradient text-white">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-2">
              Bem-vindo, {user.display_name}! 👋
            </h2>
            <p className="opacity-90">
              Você está conectado como {user.display_name}. Compartilhe seus momentos mágicos com a comunidade!
            </p>
          </CardContent>
        </Card>
      </div>

        {/* Posts Feed */}
        <div className="mobile-container pb-6">
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="card-shadow border-0 animate-pulse">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-muted rounded w-1/4" />
                        <div className="h-2 bg-muted rounded w-1/6" />
                      </div>
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="h-4 bg-muted rounded w-full" />
                      <div className="h-4 bg-muted rounded w-3/4" />
                    </div>
                    <div className="flex space-x-4">
                      <div className="h-6 bg-muted rounded w-12" />
                      <div className="h-6 bg-muted rounded w-12" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <Card className="card-shadow border-0">
              <CardContent className="p-12 text-center">
                <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum post ainda</h3>
                <p className="text-muted-foreground mb-4">
                  Seja o primeiro a compartilhar algo incrível!
                </p>
                <Button 
                  onClick={() => setCreatePostOpen(true)}
                  className="magic-button"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Post
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <Card key={post.id} className="card-shadow border-0 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handlePostClick(post)}>
                  <CardContent className="p-0">
                     {/* Post Header */}
                    <div className="flex items-center space-x-3 p-4 pb-3">
                      <Avatar className="w-10 h-10 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleProfileClick(post.profiles.username); }}>
                        <AvatarImage src={post.profiles.avatar_url || ''} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-sm font-semibold">
                          {post.profiles.display_name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h3 
                          className="font-semibold text-sm cursor-pointer hover:underline" 
                          onClick={(e) => { e.stopPropagation(); handleProfileClick(post.profiles.username); }}
                        >
                          {post.profiles.display_name}
                        </h3>
                         <p className="text-xs text-muted-foreground">
                           @{post.profiles.username} • {formatTimeAgo(post.created_at)}
                         </p>
                      </div>
                      {post.user_id === user?.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-8 h-8 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-background border border-border">
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePost(post.id);
                              }}
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
                        {post.media_type === 'video' ? (
                          <VideoPlayer
                            src={post.image_url}
                            className="w-full max-h-96"
                            autoPlay={true}
                            loop={false}
                            onPlayStateChange={(isPlaying) => {
                              // Pause other videos when this one plays
                              if (isPlaying) {
                                const otherVideos = document.querySelectorAll('video');
                                otherVideos.forEach(video => {
                                  if (video.src !== post.image_url) {
                                    video.pause();
                                  }
                                });
                              }
                            }}
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
                         <MentionText text={post.content} className="text-sm leading-relaxed" />
                       </div>
                     )}
                    
                    {/* Post Actions */}
                    <div className="px-4 py-3 border-t border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLike(post.id);
                            }}
                            className={`flex items-center space-x-1 transition-colors ${
                              likedPosts.has(post.id) 
                                ? 'text-red-500 hover:text-red-600' 
                                : 'text-muted-foreground hover:text-red-500'
                            }`}
                          >
                            <Heart 
                              className={`w-5 h-5 ${likedPosts.has(post.id) ? 'fill-current' : ''}`} 
                            />
                            <span className="text-sm">{post.likes_count}</span>
                          </button>
                          <button 
                            className="flex items-center space-x-1 text-muted-foreground hover:text-primary transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Comment className="w-5 h-5" />
                            <span className="text-sm">{post.comments_count}</span>
                          </button>
                        </div>
                        <button 
                          className="text-muted-foreground hover:text-primary transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Share className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6">
        <Button 
          onClick={() => setCreatePostOpen(true)}
          className="w-14 h-14 rounded-full magic-button magic-shadow"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      <CreatePost
        open={createPostOpen}
        onOpenChange={setCreatePostOpen}
        onPostCreated={fetchPosts}
      />
      </div>
    </MobileLayout>
  );
};

export default Feed;