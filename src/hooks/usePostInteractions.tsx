import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
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
        .select('id, content, created_at, user_id')
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

    // Subscribe to comments changes
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
          // Fetch the new comment with profile data
          const { data: comment } = await supabase
            .from('post_comments')
            .select('id, content, created_at, user_id')
            .eq('id', payload.new.id)
            .single();

          if (comment) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name, username, avatar_url')
              .eq('id', comment.user_id)
              .single();

            const newComment = {
              ...comment,
              profiles: profile || {
                display_name: 'Usuário',
                username: 'user',
                avatar_url: null
              }
            };

            setComments(prev => [...prev, newComment]);
            setCommentsCount(prev => prev + 1);
          }
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

    return () => {
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(commentsChannel);
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
      // Ensure there's an authenticated Supabase session (use anonymous if needed)
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const { error: anonError } = await supabase.auth.signInAnonymously();
        if (anonError) throw anonError;
      }

      const { error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content: newComment.trim(),
        });

      if (error) throw error;
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

  return {
    isLiked,
    likesCount,
    comments,
    commentsCount,
    newComment,
    setNewComment,
    isSubmittingComment,
    handleLike,
    handleSubmitComment,
    handleDeleteComment,
  };
};