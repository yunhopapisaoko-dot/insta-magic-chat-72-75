import React from 'react';
import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageStatusProps {
  status: 'sent' | 'delivered' | 'read' | 'error';
  className?: string;
}

const MessageStatus: React.FC<MessageStatusProps> = ({ status, className }) => {
  const getIcon = () => {
    switch (status) {
      case 'sent':
        return <Clock className="w-3 h-3" />;
      case 'delivered':
        return <Check className="w-3 h-3" />;
      case 'read':
        return <CheckCheck className="w-3 h-3" />;
      case 'error':
        return <AlertCircle className="w-3 h-3" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  const getColor = () => {
    switch (status) {
      case 'sent':
        return 'text-muted-foreground';
      case 'delivered':
        return 'text-muted-foreground';
      case 'read':
        return 'text-primary';
      case 'error':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <span className={cn(getColor(), className)}>
      {getIcon()}
    </span>
  );
};

export default MessageStatus;