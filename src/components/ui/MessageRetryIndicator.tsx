import { useState } from 'react';
import { AlertCircle, RotateCcw, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type MessageRetryStatus = 'sending' | 'sent' | 'failed' | 'retrying' | 'timeout';

interface MessageRetryIndicatorProps {
  status: MessageRetryStatus;
  onRetry?: () => void;
  retryCount?: number;
  maxRetries?: number;
  timeoutDuration?: number;
  className?: string;
}

export const MessageRetryIndicator = ({
  status,
  onRetry,
  retryCount = 0,
  maxRetries = 3,
  timeoutDuration = 30000,
  className
}: MessageRetryIndicatorProps) => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    if (!onRetry || isRetrying) return;
    
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'sending':
        return {
          icon: Clock,
          label: 'Enviando...',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          animate: 'animate-pulse'
        };
      case 'sent':
        return {
          icon: CheckCircle,
          label: 'Enviado',
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          animate: ''
        };
      case 'failed':
        return {
          icon: XCircle,
          label: 'Falha no envio',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          animate: ''
        };
      case 'retrying':
        return {
          icon: RotateCcw,
          label: `Tentativa ${retryCount + 1}/${maxRetries}`,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          animate: 'animate-spin'
        };
      case 'timeout':
        return {
          icon: AlertCircle,
          label: 'Timeout',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          animate: ''
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  const canRetry = (status === 'failed' || status === 'timeout') && retryCount < maxRetries;

  // For successful messages, don't show indicator
  if (status === 'sent') {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-2', className)}>
            <Badge
              variant="outline"
              className={cn(
                'flex items-center gap-1 px-2 py-1',
                config.bgColor,
                config.borderColor
              )}
            >
              <Icon 
                className={cn(
                  'h-3 w-3',
                  config.color,
                  config.animate,
                  isRetrying && 'animate-spin'
                )}
              />
              <span className={cn('text-xs font-medium', config.color)}>
                {config.label}
              </span>
            </Badge>

            {canRetry && onRetry && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRetry}
                disabled={isRetrying}
                className="h-6 w-6 p-0"
              >
                <RotateCcw className={cn('h-3 w-3', isRetrying && 'animate-spin')} />
              </Button>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{config.label}</p>
            {retryCount > 0 && (
              <p className="text-xs">
                Tentativas: {retryCount}/{maxRetries}
              </p>
            )}
            {status === 'timeout' && (
              <p className="text-xs">
                Timeout após {timeoutDuration / 1000}s
              </p>
            )}
            {status === 'failed' && (
              <p className="text-xs">
                Verifique sua conexão e tente novamente
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};