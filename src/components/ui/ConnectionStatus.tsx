import { Wifi, WifiOff, RotateCcw, AlertCircle } from 'lucide-react';
import { ConnectionStatus as ConnectionStatusType } from '@/hooks/useWebSocketConnection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  status: ConnectionStatusType;
  isOnline: boolean;
  reconnectAttempts: number;
  onReconnect?: () => void;
  className?: string;
}

export const ConnectionStatus = ({ 
  status, 
  isOnline, 
  reconnectAttempts,
  onReconnect,
  className 
}: ConnectionStatusProps) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: Wifi,
          label: 'Conectado',
          variant: 'default' as const,
          className: 'bg-green-500/10 text-green-600 border-green-500/20'
        };
      case 'connecting':
        return {
          icon: RotateCcw,
          label: 'Conectando...',
          variant: 'secondary' as const,
          className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20 animate-pulse'
        };
      case 'reconnecting':
        return {
          icon: RotateCcw,
          label: `Reconectando... (${reconnectAttempts})`,
          variant: 'secondary' as const,
          className: 'bg-orange-500/10 text-orange-600 border-orange-500/20 animate-pulse'
        };
      case 'disconnected':
        return {
          icon: WifiOff,
          label: isOnline ? 'Desconectado' : 'Sem internet',
          variant: 'destructive' as const,
          className: 'bg-red-500/10 text-red-600 border-red-500/20'
        };
      case 'error':
        return {
          icon: AlertCircle,
          label: 'Erro de conexão',
          variant: 'destructive' as const,
          className: 'bg-red-500/10 text-red-600 border-red-500/20'
        };
      default:
        return {
          icon: WifiOff,
          label: 'Status desconhecido',
          variant: 'secondary' as const,
          className: 'bg-gray-500/10 text-gray-600 border-gray-500/20'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  // Don't show status when everything is working normally
  if (status === 'connected' && isOnline) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Badge 
        variant={config.variant}
        className={cn('flex items-center gap-1.5 px-2 py-1', config.className)}
      >
        <Icon 
          className={cn(
            'h-3 w-3',
            status === 'connecting' || status === 'reconnecting' ? 'animate-spin' : ''
          )} 
        />
        <span className="text-xs font-medium">{config.label}</span>
      </Badge>
      
      {(status === 'disconnected' || status === 'error') && onReconnect && (
        <Button
          size="sm"
          variant="outline"
          onClick={onReconnect}
          className="h-6 px-2 text-xs"
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Reconectar
        </Button>
      )}
    </div>
  );
};