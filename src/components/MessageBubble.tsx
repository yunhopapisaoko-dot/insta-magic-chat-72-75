import React from 'react';
import { useLongPress } from '@/hooks/useLongPress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface MessageBubbleProps {
  message: any;
  isOwnMessage: boolean;
  isGroupChat: boolean;
  senderInfo?: {
    display_name: string;
    avatar_url: string | null;
  };
  onLongPress: (e: React.TouchEvent | React.MouseEvent) => void;
}

export const MessageBubble = ({ message, isOwnMessage, isGroupChat, senderInfo, onLongPress }: MessageBubbleProps) => {
  const longPressProps = useLongPress({
    onLongPress: onLongPress,
    delay: 500
  });

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="flex flex-col space-y-1">
      {/* Show sender name for group chats and non-own messages */}
      {!isOwnMessage && isGroupChat && senderInfo && (
        <span className="text-xs text-muted-foreground font-medium px-1">
          {senderInfo.display_name}
        </span>
      )}
      
      <div 
        className={`p-3 rounded-2xl ${
          isOwnMessage 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-muted'
        }`}
        {...longPressProps}
      >
      {message.content && (
        <p className="text-sm leading-relaxed">{message.content}</p>
      )}
      
      {/* Media Content */}
      {message.media_url && (
        <div className="mt-2">
          {message.media_type === 'video' ? (
            <video
              src={message.media_url}
              controls
              className="max-w-full rounded-lg"
              style={{ maxHeight: '200px' }}
              playsInline
            />
          ) : (
            <img
              src={message.media_url}
              alt="Imagem compartilhada"
              className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              style={{ maxHeight: '200px' }}
              onClick={() => window.open(message.media_url!, '_blank')}
            />
          )}
        </div>
      )}
      
      <div className={`flex items-center justify-between mt-1 ${
        isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'
      }`}>
        <span className="text-xs">
          {formatMessageTime(message.created_at)}
        </span>
        {isOwnMessage && (
          <div className="flex items-center gap-1">
            {message.message_status === 'read' && (
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
            )}
            {message.message_status === 'delivered' && (
              <div className="w-2 h-2 bg-green-500 rounded-full" />
            )}
            {(message.message_status === 'sent' || !message.message_status) && (
              <div className="w-2 h-2 bg-gray-400 rounded-full" />
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
};