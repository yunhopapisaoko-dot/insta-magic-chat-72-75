import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { stripUserDigits } from '@/lib/utils';

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
}

export const MessageReply = ({ originalMessage, senderInfo, isOwnMessage }: MessageReplyProps) => {
  const getReplyContent = () => {
    if (originalMessage.content) {
      return originalMessage.content.length > 50 
        ? `${originalMessage.content.substring(0, 50)}...`
        : originalMessage.content;
    }
    
    if (originalMessage.media_type === 'image') {
      return '📷 Imagem';
    }
    
    if (originalMessage.media_type === 'video') {
      return '🎥 Vídeo';
    }
    
    return 'Mensagem';
  };

  const getSenderName = () => {
    if (isOwnMessage) return 'Você';
    return senderInfo?.display_name ? stripUserDigits(senderInfo.display_name) : 'Usuário';
  };

  return (
    <div className={`mb-2 p-3 rounded-lg border-l-4 ${
      isOwnMessage 
        ? 'bg-primary/10 border-primary/50' 
        : 'bg-muted/50 border-muted-foreground/30'
    }`}>
      <div className="flex items-center gap-2 mb-1">
        <Avatar className="w-4 h-4">
          <AvatarImage src={senderInfo?.avatar_url || ''} />
          <AvatarFallback className="text-xs bg-gradient-to-br from-primary to-accent text-white">
            {getSenderName()[0]}
          </AvatarFallback>
        </Avatar>
        <p className={`text-xs font-medium ${
          isOwnMessage ? 'text-primary' : 'text-muted-foreground'
        }`}>
          {getSenderName()}
        </p>
      </div>
      <p className={`text-sm ${
        isOwnMessage ? 'text-primary/80' : 'text-muted-foreground'
      }`}>
        {getReplyContent()}
      </p>
    </div>
  );
};