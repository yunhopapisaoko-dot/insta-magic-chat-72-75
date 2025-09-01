import { useState, useRef, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Heart, MoreHorizontal, Smile, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePostInteractions } from '@/hooks/usePostInteractions';
import { stripUserDigits } from '@/lib/utils';

interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
}

export const CommentsModal = ({ isOpen, onClose, postId }: CommentsModalProps) => {
  const { user } = useAuth();
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);
  
  const {
    comments,
    newComment,
    setNewComment,
    isSubmittingComment,
    commentLikes,
    handleSubmitComment,
    handleDeleteComment,
    handleCommentLike,
  } = usePostInteractions(postId);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        commentInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMilliseconds = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMilliseconds / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    const diffInWeeks = Math.floor(diffInDays / 7);
    
    if (diffInMinutes < 1) return 'agora';
    if (diffInMinutes < 60) return `${diffInMinutes} min`;
    if (diffInHours < 24) return `${diffInHours}h`;
    if (diffInDays < 7) return `${diffInDays}d`;
    if (diffInWeeks < 4) return `${diffInWeeks} sem`;
    return new Date(dateString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const handleSubmit = async () => {
    await handleSubmitComment();
    setReplyingTo(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleReply = (username: string, commentId: string) => {
    setReplyingTo(commentId);
    setNewComment(`@${stripUserDigits(username)} `);
    commentInputRef.current?.focus();
  };

  const handleEmojiClick = (emoji: string) => {
    setNewComment(prev => prev + emoji);
    setShowEmojiPicker(false);
    commentInputRef.current?.focus();
  };

  const addEmoji = (emoji: string) => {
    setNewComment(prev => prev + emoji);
    setShowEmojiPicker(false);
    commentInputRef.current?.focus();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="bottom" 
        className="h-[90vh] rounded-t-3xl border-0 bg-background p-0"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="px-6 py-4 border-b border-border/50">
            <div className="flex items-center justify-center">
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
            </div>
            <SheetTitle className="text-center text-lg font-semibold mt-3">
              Comentários
            </SheetTitle>
            <div className="absolute top-4 right-4">
              <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                <MoreHorizontal className="w-5 h-5" />
              </Button>
            </div>
          </SheetHeader>

          {/* Comments List */}
          <ScrollArea className="flex-1 px-6">
            <div className="py-4 space-y-4">
              {comments.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Ainda não há comentários.</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Comece a conversa.
                  </p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarImage src={comment.profiles.avatar_url || ''} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs">
                        {stripUserDigits(comment.profiles.display_name)[0]}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => handleReply(stripUserDigits(comment.profiles.username), comment.id)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">
                              {stripUserDigits(comment.profiles.display_name)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatTimeAgo(comment.created_at)}
                            </span>
                            {commentLikes.has(comment.id) && (
                              <span className="text-xs text-red-500">❤️</span>
                            )}
                          </div>
                          <p className="text-sm mt-1 leading-relaxed">
                            {comment.content}
                          </p>
                          
                          <div className="flex items-center gap-4 mt-2">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReply(stripUserDigits(comment.profiles.username), comment.id);
                              }}
                              className="text-xs text-muted-foreground font-medium hover:text-foreground"
                            >
                              Responder
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCommentLike(comment.id);
                              }}
                              className={`text-xs font-medium hover:text-foreground transition-colors ${
                                commentLikes.has(comment.id) 
                                  ? 'text-red-500' 
                                  : 'text-muted-foreground'
                              }`}
                            >
                              Curtir
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-center gap-1">
                          <button 
                            onClick={() => handleCommentLike(comment.id)}
                            className="p-1 hover:bg-muted rounded-full transition-colors"
                          >
                            <Heart 
                              className={`w-3 h-3 transition-colors ${
                                commentLikes.has(comment.id) 
                                  ? 'fill-red-500 text-red-500' 
                                  : 'text-muted-foreground'
                              }`} 
                            />
                          </button>
                          <span className="text-xs text-muted-foreground">
                            {comment.likes_count}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Comment Input */}
          <div className="px-6 py-4 border-t border-border/50 bg-background">
            <div className="flex items-center gap-3">
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarImage src={user?.avatar_url || ''} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs">
                  {user?.display_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 relative">
                <Input
                  ref={commentInputRef}
                  placeholder={replyingTo ? `Responder a ${newComment.split(' ')[0]}...` : "Adicione um comentário..."}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pr-24 bg-muted/50 border-0 rounded-full text-sm"
                  disabled={isSubmittingComment}
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="w-8 h-8 p-0 rounded-full"
                  >
                    <Smile className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
                
                {/* Emoji Picker */}
                {showEmojiPicker && (
                  <div className="absolute bottom-full right-0 mb-2 bg-background border border-border rounded-2xl p-3 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">Emojis</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowEmojiPicker(false)}
                        className="w-6 h-6 p-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {['❤️', '🙌', '🔥', '👏', '🥺', '😍', '😱', '😂', '😊', '👍', '💯', '✨'].map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => addEmoji(emoji)}
                          className="text-2xl p-2 hover:bg-muted rounded-lg transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <Button
                onClick={handleSubmit}
                disabled={!newComment.trim() || isSubmittingComment}
                variant="ghost"
                size="sm"
                className="text-primary font-semibold disabled:text-muted-foreground"
              >
                {isSubmittingComment ? 'Enviando...' : 'Publicar'}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};