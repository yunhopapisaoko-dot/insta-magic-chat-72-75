import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface TypingUser {
  user_id: string;
  display_name: string;
  is_typing: boolean;
}

interface TypingIndicatorProps {
  typingUsers: TypingUser[];
  className?: string;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ 
  typingUsers, 
  className = "" 
}) => {
  if (typingUsers.length === 0) return null;

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].display_name} está digitando...`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0].display_name} e ${typingUsers[1].display_name} estão digitando...`;
    } else {
      return `${typingUsers[0].display_name} e mais ${typingUsers.length - 1} pessoas estão digitando...`;
    }
  };

  return (
    <div className={`flex items-center space-x-3 py-2 px-4 ${className}`}>
      <div className="flex -space-x-2">
        {typingUsers.slice(0, 3).map((user) => (
          <Avatar key={user.user_id} className="w-6 h-6 border-2 border-background">
            <AvatarImage src="" />
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs">
              {user.display_name[0]}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <div className="flex space-x-1">
          <div 
            className="w-2 h-2 bg-primary rounded-full animate-bounce" 
            style={{ animationDelay: '0ms' }} 
          />
          <div 
            className="w-2 h-2 bg-primary rounded-full animate-bounce" 
            style={{ animationDelay: '150ms' }} 
          />
          <div 
            className="w-2 h-2 bg-primary rounded-full animate-bounce" 
            style={{ animationDelay: '300ms' }} 
          />
        </div>
        <span>{getTypingText()}</span>
      </div>
    </div>
  );
};

export default TypingIndicator;