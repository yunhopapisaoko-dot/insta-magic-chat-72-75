import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Heart, MessageCircle, Share, MoreHorizontal, Trash2, Send } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { isVideoUrl, stripUserDigits } from '@/lib/utils';
import { usePostInteractions } from '@/hooks/usePostInteractions';
import { useRef } from 'react';

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
  const commentInputRef = useRef<HTMLInputElement>(null);
  const {
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
  } = usePostInteractions(post?.id || null);

  const focusCommentInput = () => {
    commentInputRef.current?.focus();
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitComment();
    }
  };

  if (!post) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="relative flex-1 flex flex-col">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="absolute top-2 right-2 z-10 bg-background/80 hover:bg-background"
          >
            <X className="w-4 h-4" />
          </Button>
          
          <Card className="border-0 shadow-none flex-1 flex flex-col">
            <CardContent className="p-0 flex-1 flex flex-col">
              {/* Post Header */}
              <div className="flex items-center space-x-3 p-4 pb-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={post.profiles.avatar_url || ''} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-sm font-semibold">
                    {stripUserDigits(post.profiles.display_name)[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">{stripUserDigits(post.profiles.display_name)}</h3>
                  <p className="text-xs text-muted-foreground">
                    @{stripUserDigits(post.profiles.username)} • {formatTimeAgo(post.created_at)}
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
              <div className="px-4 py-3 border-t border-b border-border">
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
                    <button 
                      onClick={focusCommentInput}
                      className="flex items-center space-x-1 text-muted-foreground hover:text-primary transition-colors"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span className="text-sm">{commentsCount}</span>
                    </button>
                  </div>
                  <button className="text-muted-foreground hover:text-primary transition-colors">
                    <Share className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Comments Section */}
              <div className="flex-1 flex flex-col min-h-0">
                <ScrollArea className="flex-1 px-4 py-3">
                  {comments.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-8">
                      Nenhum comentário ainda. Seja o primeiro a comentar!
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {comments.map((comment) => (
                        <div key={comment.id} className="space-y-3">
                          {/* Main Comment */}
                          <div className="flex space-x-3">
                            <Avatar className="w-8 h-8 flex-shrink-0">
                              <AvatarImage src={comment.profiles.avatar_url || ''} />
                              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs">
                                {stripUserDigits(comment.profiles.display_name)[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <span className="font-semibold text-sm">{stripUserDigits(comment.profiles.display_name)}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {formatTimeAgo(comment.created_at)}
                                  </span>
                                </div>
                                {comment.user_id === user?.id && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteComment(comment.id)}
                                    className="w-6 h-6 p-0 text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                              <p className="text-sm text-foreground break-words mb-2">{comment.content}</p>
                              <div className="flex items-center space-x-3">
                                <button
                                  onClick={() => handleCommentLike?.(comment.id)}
                                  className={`flex items-center space-x-1 text-xs transition-colors ${
                                    commentLikes?.has(comment.id)
                                      ? 'text-red-500'
                                      : 'text-muted-foreground hover:text-red-500'
                                  }`}
                                >
                                  <Heart className={`w-3 h-3 ${commentLikes?.has(comment.id) ? 'fill-current' : ''}`} />
                                  <span>{comment.likes_count}</span>
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Replies */}
                          {comment.replies && comment.replies.length > 0 && (
                            <div className="ml-8 space-y-3 border-l-2 border-border pl-4">
                              {comment.replies.slice(0, 3).map((reply) => (
                                <div key={reply.id} className="flex space-x-3">
                                  <Avatar className="w-6 h-6 flex-shrink-0">
                                    <AvatarImage src={reply.profiles.avatar_url || ''} />
                                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs">
                                      {stripUserDigits(reply.profiles.display_name)[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-2">
                                        <span className="font-semibold text-xs">{stripUserDigits(reply.profiles.display_name)}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {formatTimeAgo(reply.created_at)}
                                        </span>
                                      </div>
                                      {reply.user_id === user?.id && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteComment(reply.id)}
                                          className="w-5 h-5 p-0 text-muted-foreground hover:text-destructive"
                                        >
                                          <Trash2 className="w-2.5 h-2.5" />
                                        </Button>
                                      )}
                                    </div>
                                    <p className="text-xs text-foreground break-words mb-1">{reply.content}</p>
                                    <button
                                      onClick={() => handleCommentLike?.(reply.id)}
                                      className={`flex items-center space-x-1 text-xs transition-colors ${
                                        commentLikes?.has(reply.id)
                                          ? 'text-red-500'
                                          : 'text-muted-foreground hover:text-red-500'
                                      }`}
                                    >
                                      <Heart className={`w-3 h-3 ${commentLikes?.has(reply.id) ? 'fill-current' : ''}`} />
                                      <span>{reply.likes_count}</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {comment.replies.length > 3 && (
                                <button className="text-xs text-primary hover:underline ml-9">
                                  Ver mais {comment.replies.length - 3} resposta{comment.replies.length - 3 > 1 ? 's' : ''}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {/* Comment Input */}
                <div className="p-4 border-t border-border">
                  <div className="flex space-x-2">
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarImage src={user?.avatar_url || ''} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs">
                        {user?.display_name ? stripUserDigits(user.display_name)[0] : 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 flex space-x-2">
                      <Input
                        ref={commentInputRef}
                        placeholder="Adicione um comentário..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="flex-1"
                        disabled={isSubmittingComment}
                      />
                      <Button
                        onClick={() => handleSubmitComment()}
                        disabled={!newComment.trim() || isSubmittingComment}
                        size="sm"
                        className="px-3"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
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