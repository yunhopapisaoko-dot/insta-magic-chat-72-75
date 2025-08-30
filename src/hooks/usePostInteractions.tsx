import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  likes_count: number;
  profiles: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
}

export const usePostInteractions = (postId: string | null) => {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsCount, setCommentsCount] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentLikes, setCommentLikes] = useState<Set<string>>(new Set());

  // Fetch initial data
  useEffect(() => {
    if (!postId) return;

    const fetchData = async () => {
      // Get post data
      const { data: post } = await supabase
        .from('posts')
        .select('likes_count, comments_count')
        .eq('id', postId)
        .single();

      if (post) {
        setLikesCount(post.likes_count);
        setCommentsCount(post.comments_count);
      }

      // Check if user liked the post
      if (user) {
        const { data: like } = await supabase
          .from('post_likes')
          .select('id')
          .eq('user_id', user.id)
          .eq('post_id', postId)
          .single();

        setIsLiked(!!like);
      }

      // Get comments with profile data
      const { data: commentsData } = await supabase
        .from('post_comments')
        .select('id, content, created_at, user_id, likes_count')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (commentsData) {
        // Fetch profile data for each comment
        const commentsWithProfiles = await Promise.all(
          commentsData.map(async (comment) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name, username, avatar_url')
              .eq('id', comment.user_id)
              .single();
            
            return {
              ...comment,
              profiles: profile || {
                display_name: 'Usuário',
                username: 'user',
                avatar_url: null
              }
            };
          })
        );
        setComments(commentsWithProfiles);
        
        // Check which comments the user has liked
        if (user && commentsData.length > 0) {
          const { data: userCommentLikes } = await supabase
            .from('comment_likes')
            .select('comment_id')
            .eq('user_id', user.id)
            .in('comment_id', commentsData.map(c => c.id));
          
          if (userCommentLikes) {
            setCommentLikes(new Set(userCommentLikes.map(like => like.comment_id)));
          }
        }
      }
    };

    fetchData();
  }, [postId, user]);

  // Real-time subscriptions
  useEffect(() => {
    if (!postId) return;

    // Subscribe to likes changes
    const likesChannel = supabase
      .channel(`post-likes-${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'post_likes',
          filter: `post_id=eq.${postId}`,
        },
        () => {
          setLikesCount(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'post_likes',
          filter: `post_id=eq.${postId}`,
        },
        () => {
          setLikesCount(prev => prev - 1);
        }
      )
      .subscribe();

    // Subscribe to comments changes with realtime updates
    const commentsChannel = supabase
      .channel(`post-comments-${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'post_comments',
          filter: `post_id=eq.${postId}`,
        },
        async (payload) => {
          console.log('New comment received:', payload);
          
          // Fetch the new comment with profile data
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, username, avatar_url')
            .eq('id', payload.new.user_id)
            .single();

          const newComment = {
            id: payload.new.id,
            content: payload.new.content,
            created_at: payload.new.created_at,
            user_id: payload.new.user_id,
            likes_count: payload.new.likes_count || 0,
            profiles: profile || {
              display_name: 'Usuário',
              username: 'user',
              avatar_url: null
            }
          };

          setComments(prev => [...prev, newComment]);
          setCommentsCount(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'post_comments',
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          setComments(prev => prev.filter(comment => comment.id !== payload.old.id));
          setCommentsCount(prev => prev - 1);
        }
      )
      .subscribe();

    // Subscribe to comment likes changes
    const commentLikesChannel = supabase
      .channel(`comment-likes-${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comment_likes',
        },
        (payload) => {
          // Update comment likes count
          setComments(prev => prev.map(comment => 
            comment.id === payload.new.comment_id 
              ? { ...comment, likes_count: comment.likes_count + 1 }
              : comment
          ));
          
          // Update user's liked comments if it's their like
          if (user && payload.new.user_id === user.id) {
            setCommentLikes(prev => new Set([...prev, payload.new.comment_id]));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'comment_likes',
        },
        (payload) => {
          // Update comment likes count
          setComments(prev => prev.map(comment => 
            comment.id === payload.old.comment_id 
              ? { ...comment, likes_count: Math.max(0, comment.likes_count - 1) }
              : comment
          ));
          
          // Update user's liked comments if it's their unlike
          if (user && payload.old.user_id === user.id) {
            setCommentLikes(prev => {
              const newSet = new Set(prev);
              newSet.delete(payload.old.comment_id);
              return newSet;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(commentsChannel);
      supabase.removeChannel(commentLikesChannel);
    };
  }, [postId]);

  const handleLike = useCallback(async () => {
    if (!user || !postId) return;

    try {
      if (isLiked) {
        // Unlike
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', postId);

        if (error) throw error;
        setIsLiked(false);
      } else {
        // Like
        const { error } = await supabase
          .from('post_likes')
          .insert({
            user_id: user.id,
            post_id: postId,
          });

        if (error) throw error;
        setIsLiked(true);
      }
    } catch (error) {
      console.error('Error liking/unliking post:', error);
      toast({
        title: "Erro",
        description: "Não foi possível curtir o post.",
        variant: "destructive",
      });
    }
  }, [user, postId, isLiked]);

  const handleSubmitComment = useCallback(async () => {
    if (!user || !postId || !newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content: newComment.trim(),
        })
        .select('id, content, created_at, user_id')
        .single();

      if (error) throw error;

      // Buscar dados do perfil do usuário atual
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, username, avatar_url')
        .eq('id', user.id)
        .single();

      // Adicionar comentário imediatamente à lista local
      const newCommentData = {
        id: data.id,
        content: data.content,
        created_at: data.created_at,
        user_id: data.user_id,
        likes_count: 0,
        profiles: profile || {
          display_name: user.display_name || 'Usuário',
          username: user.username || 'user',
          avatar_url: user.avatar_url || null
        }
      };

      setComments(prev => [...prev, newCommentData]);
      setCommentsCount(prev => prev + 1);
      setNewComment('');
    } catch (error) {
      console.error('Error creating comment:', error);
      toast({
        title: "Erro",
        description: "Não foi possível comentar no post.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingComment(false);
    }
  }, [user, postId, newComment]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('post_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: "Erro",
        description: "Não foi possível deletar o comentário.",
        variant: "destructive",
      });
    }
  }, [user]);

  const handleCommentLike = useCallback(async (commentId: string) => {
    if (!user?.id) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado para curtir comentários.",
        variant: "destructive",
      });
      return;
    }

    try {
      const isLiked = commentLikes.has(commentId);
      
      if (isLiked) {
        // Unlike
        const { error } = await supabase
          .from('comment_likes')
          .delete()
          .eq('user_id', user.id)
          .eq('comment_id', commentId);

        if (error) throw error;
      } else {
        // Like
        const { error } = await supabase
          .from('comment_likes')
          .insert({
            user_id: user.id,
            comment_id: commentId,
          });

        if (error) throw error;
      }
    } catch (error) {
      console.error('Erro ao curtir comentário:', error);
      toast({
        title: "Erro",
        description: "Não foi possível curtir o comentário.",
        variant: "destructive",
      });
    }
  }, [user, commentLikes]);

  return {
    isLiked,
    likesCount,
    comments,
    commentsCount,
    newComment,
    setNewComment,
    isSubmittingComment,
    commentLikes,
    handleLike,
    handleSubmitComment,
    handleDeleteComment,
    handleCommentLike,
  };
};