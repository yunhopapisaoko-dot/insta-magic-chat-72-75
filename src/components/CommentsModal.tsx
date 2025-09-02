import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Heart, MoreHorizontal, Smile, X, Reply, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePostInteractions } from '@/hooks/usePostInteractions';
import { stripUserDigits } from '@/lib/utils';
import { MentionText } from '@/components/MentionText';
import { UserMentionInput } from '@/components/UserMentionInput';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  postOwnerId?: string;
}

export const CommentsModal = ({ isOpen, onClose, postId, postOwnerId }: CommentsModalProps) => {
  const navigate = useNavigate();
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
    const parentId = replyingTo;
    await handleSubmitComment(parentId);
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

  const handleProfileClick = (username: string) => {
    navigate(`/user/${stripUserDigits(username)}`);
  };

  const onDeleteComment = (commentId: string, commentUserId: string) => {
    const isPostOwner = user?.id === postOwnerId;
    const isCommentOwner = user?.id === commentUserId;
    
    if (isPostOwner || isCommentOwner) {
      handleDeleteComment(commentId, isPostOwner);
    }
  };

  const renderComment = (comment: any, isReply = false) => (
    <div key={comment.id} className={`group relative animate-fade-in ${isReply ? 'ml-8 mt-3' : 'mb-6'}`}>
      {/* Reply indicator line for nested comments */}
      {isReply && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/30 to-transparent -ml-6" />
      )}
      
      <div className={`p-4 rounded-2xl transition-all duration-300 ${
        isReply 
          ? 'bg-gradient-to-r from-muted/30 to-muted/10 border border-border/30' 
          : 'bg-gradient-to-br from-background to-muted/20 border border-border/50 hover:shadow-md'
      }`}>
        <div className="flex gap-3">
          <Avatar 
            className="w-10 h-10 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity border-2 border-white/10" 
            onClick={() => handleProfileClick(comment.profiles.username)}
          >
            <AvatarImage src={comment.profiles.avatar_url || ''} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-sm font-semibold">
              {stripUserDigits(comment.profiles.display_name)[0]}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <span 
                className="font-bold text-sm cursor-pointer hover:text-primary transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleProfileClick(comment.profiles.username);
                }}
              >
                {stripUserDigits(comment.profiles.display_name)}
              </span>
              <span className="text-xs text-muted-foreground/80">
                {formatTimeAgo(comment.created_at)}
              </span>
              {commentLikes.has(comment.id) && (
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              )}
            </div>
            
            {/* Content with mentions */}
            <div className="mb-3">
              <MentionText 
                text={comment.content}
                className="text-sm leading-relaxed text-foreground/90"
              />
            </div>
            
            {/* Action buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {!isReply && (
                  <button
                    onClick={() => handleReply(stripUserDigits(comment.profiles.username), comment.id)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium hover:text-primary transition-all duration-200 group/reply"
                  >
                    <Reply className="w-3.5 h-3.5 group-hover/reply:scale-110 transition-transform" />
                    Responder
                  </button>
                )}
                <button 
                  onClick={() => handleCommentLike(comment.id)}
                  className={`flex items-center gap-1.5 text-xs font-medium transition-all duration-200 hover:scale-105 ${
                    commentLikes.has(comment.id) 
                      ? 'text-red-500' 
                      : 'text-muted-foreground hover:text-red-400'
                  }`}
                >
                  <Heart 
                    className={`w-3.5 h-3.5 transition-all ${
                      commentLikes.has(comment.id) 
                        ? 'fill-red-500 text-red-500 animate-pulse' 
                        : ''
                    }`} 
                  />
                  {comment.likes_count > 0 && (
                    <span className={commentLikes.has(comment.id) ? 'text-red-500' : ''}>
                      {comment.likes_count}
                    </span>
                  )}
                </button>
              </div>
              
              {/* Comment menu for delete option */}
              {user && ((user.id === postOwnerId) || (user.id === comment.user_id)) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background border border-border shadow-lg">
                    <DropdownMenuItem 
                      onClick={() => onDeleteComment(comment.id, comment.user_id)}
                      className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {user.id === postOwnerId && user.id !== comment.user_id 
                        ? 'Remover comentário' 
                        : 'Deletar comentário'
                      }
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
        
        {/* Render replies with improved styling */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-4 space-y-3 border-l-2 border-primary/20 pl-4 ml-2">
            {comment.replies.slice(0, 3).map((reply: any) => renderComment(reply, true))}
            {comment.replies.length > 3 && (
              <button className="text-xs text-primary hover:underline font-medium ml-2 py-1">
                Ver mais {comment.replies.length - 3} resposta{comment.replies.length - 3 > 1 ? 's' : ''}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

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
            <div className="py-16 space-y-4 animate-fade-in">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-primary/10 to-accent/10 rounded-3xl flex items-center justify-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center">
                    <span className="text-2xl">💭</span>
                  </div>
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  Ainda não há comentários
                </h3>
                <p className="text-sm text-muted-foreground/70 max-w-xs mx-auto">
                  Seja o primeiro a comentar! Use @ para mencionar outros usuários.
                </p>
              </div>
            </div>
              ) : (
                comments.map((comment) => renderComment(comment))
              )}
            </div>
          </ScrollArea>

          {/* Reply indicator */}
          {replyingTo && (
            <div className="px-6 py-3 bg-gradient-to-r from-primary/5 to-primary/10 border-b border-primary/20 animate-slide-in-right">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Reply className="w-4 h-4 text-primary" />
                  <span className="text-sm text-primary font-medium">
                    Respondendo {newComment.split(' ')[0]}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setReplyingTo(null);
                    setNewComment('');
                  }}
                  className="w-6 h-6 p-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Comment Input */}
          <div className="px-6 py-4 border-t border-border/50 bg-gradient-to-r from-background to-muted/10">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10 flex-shrink-0 border-2 border-white/10">
                <AvatarImage src={user?.avatar_url || ''} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-sm font-semibold">
                  {user?.display_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 relative">
                <UserMentionInput
                  value={newComment}
                  onChange={setNewComment}
                  onKeyPress={handleKeyPress}
                  placeholder={replyingTo ? `Responder a ${newComment.split(' ')[0]}...` : "Adicione um comentário... (use @ para mencionar)"}
                  disabled={isSubmittingComment}
                  className="pr-24 bg-muted/30 border border-border/50 rounded-2xl text-sm backdrop-blur-sm hover:bg-muted/40 focus:bg-background transition-all"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="w-8 h-8 p-0 rounded-full hover:bg-muted/50"
                  >
                    <Smile className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
                
                {/* Emoji Picker */}
                {showEmojiPicker && (
                  <div className="absolute bottom-full right-0 mb-2 bg-background border border-border rounded-2xl p-4 shadow-xl animate-scale-in z-50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold">Reações</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowEmojiPicker(false)}
                        className="w-6 h-6 p-0 hover:bg-muted/50"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {['❤️', '🙌', '🔥', '👏', '🥺', '😍', '😱', '😂', '😊', '👍', '💯', '✨'].map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => addEmoji(emoji)}
                          className="text-2xl p-3 hover:bg-muted/50 rounded-xl transition-all duration-200 hover:scale-110"
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
                className={`font-bold px-4 py-2 rounded-xl transition-all duration-200 ${
                  newComment.trim() 
                    ? 'text-primary hover:bg-primary/10 hover:scale-105' 
                    : 'text-muted-foreground'
                }`}
              >
                {isSubmittingComment ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span>Enviando...</span>
                  </div>
                ) : (
                  'Publicar'
                )}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};