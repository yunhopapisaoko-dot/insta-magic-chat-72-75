import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { stripUserDigits } from '@/lib/utils';
import { Reply } from 'lucide-react';

interface MessageReplyProps {
  originalMessage: {
    id: string;
    content: string | null;
    media_url: string | null;
    media_type: string | null;
    sender_id: string;
  };
  senderInfo?: {
    display_name: string;
    avatar_url: string | null;
  };
  isOwnMessage: boolean;
  className?: string;
}

export const MessageReply = ({ originalMessage, senderInfo, isOwnMessage, className = "" }: MessageReplyProps) => {
  const getReplyContent = () => {
    if (originalMessage.content) {
      return originalMessage.content.length > 80 
        ? `${originalMessage.content.substring(0, 80)}...`
        : originalMessage.content;
    }
    
    if (originalMessage.media_type === 'image') {
      return '📷 Imagem compartilhada';
    }
    
    if (originalMessage.media_type === 'video') {
      return '🎥 Vídeo compartilhado';
    }
    
    return 'Mensagem';
  };

  const getSenderName = () => {
    if (isOwnMessage) return 'Você';
    return senderInfo?.display_name ? stripUserDigits(senderInfo.display_name) : 'Usuário';
  };

  return (
    <div className={`animate-fade-in ${className}`}>
      <div className={`relative mb-3 p-3 rounded-xl border-l-4 backdrop-blur-sm transition-all duration-300 hover:shadow-md ${
        isOwnMessage 
          ? 'bg-gradient-to-r from-primary/20 to-primary/30 border-primary shadow-primary/40' 
          : 'bg-gradient-to-r from-muted/60 to-muted/80 border-accent shadow-accent/40'
      }`}>
        {/* Decorative accent line */}
        <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${
          isOwnMessage 
            ? 'from-primary/20 via-primary/40 to-transparent' 
            : 'from-accent/20 via-accent/40 to-transparent'
        }`} />
        
        <div className="flex items-start gap-3">
          {/* Reply icon */}
          <div className={`flex-shrink-0 p-1.5 rounded-full ${
            isOwnMessage 
              ? 'bg-primary/10 text-primary' 
              : 'bg-accent/10 text-accent'
          }`}>
            <Reply className="w-3 h-3" />
          </div>
          
          <div className="flex-1 min-w-0">
            {/* Sender info */}
            <div className="flex items-center gap-2 mb-1.5">
              <Avatar className="w-5 h-5 border border-white/20">
                <AvatarImage src={senderInfo?.avatar_url || ''} />
                <AvatarFallback className="text-[10px] bg-gradient-to-br from-primary to-accent text-white font-semibold">
                  {getSenderName()[0]}
                </AvatarFallback>
              </Avatar>
              <p className={`text-xs font-semibold ${
                isOwnMessage ? 'text-primary' : 'text-accent'
              }`}>
                {getSenderName()}
              </p>
            </div>
            
            {/* Message content */}
            <div className={`text-sm leading-relaxed ${
              isOwnMessage ? 'text-primary/90' : 'text-foreground/80'
            }`}>
              {originalMessage.content ? (
                <p className="break-words">{getReplyContent()}</p>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-lg">{originalMessage.media_type === 'image' ? '📷' : '🎥'}</span>
                  <span className="italic">{getReplyContent()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Subtle glow effect */}
        <div className={`absolute inset-0 rounded-xl pointer-events-none ${
          isOwnMessage 
            ? 'bg-gradient-to-r from-primary/5 to-transparent' 
            : 'bg-gradient-to-r from-accent/5 to-transparent'
        }`} />
      </div>
    </div>
  );
};