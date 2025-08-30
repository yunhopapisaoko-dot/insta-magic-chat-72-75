import { Wifi, WifiOff, AlertTriangle, CheckCircle, Clock, RotateCcw } from 'lucide-react';
import { NetworkQuality } from '@/hooks/useConnectionValidator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface NetworkIndicatorProps {
  quality: NetworkQuality;
  latency: number;
  successRate: number;
  isValidating: boolean;
  consecutiveFailures: number;
  onRetry?: () => void;
  showDetails?: boolean;
  className?: string;
}

export const NetworkIndicator = ({
  quality,
  latency,
  successRate,
  isValidating,
  consecutiveFailures,
  onRetry,
  showDetails = false,
  className
}: NetworkIndicatorProps) => {
  const getQualityConfig = () => {
    switch (quality) {
      case 'excellent':
        return {
          icon: Wifi,
          label: 'Excelente',
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          progress: 100
        };
      case 'good':
        return {
          icon: Wifi,
          label: 'Boa',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          progress: 75
        };
      case 'poor':
        return {
          icon: AlertTriangle,
          label: 'Instável',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          progress: 40
        };
      case 'offline':
        return {
          icon: WifiOff,
          label: 'Offline',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          progress: 0
        };
    }
  };

  const config = getQualityConfig();
  const Icon = config.icon;

  const formatLatency = (ms: number) => {
    if (ms < 100) return `${ms}ms`;
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getLatencyColor = (ms: number) => {
    if (ms < 100) return 'text-green-600';
    if (ms < 300) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (!showDetails) {
    // Compact indicator
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('flex items-center gap-1', className)}>
              <Icon 
                className={cn(
                  'h-4 w-4',
                  config.color,
                  isValidating && 'animate-pulse'
                )}
              />
              {consecutiveFailures > 0 && (
                <span className="text-xs text-red-600 font-medium">
                  {consecutiveFailures}
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Qualidade: {config.label}</span>
                <span className={cn('text-sm', getLatencyColor(latency))}>
                  {formatLatency(latency)}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Taxa de sucesso</span>
                  <span>{successRate}%</span>
                </div>
                <Progress value={successRate} className="h-1" />
              </div>
              {consecutiveFailures > 0 && (
                <p className="text-xs text-red-600">
                  {consecutiveFailures} falhas consecutivas
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Detailed indicator
  return (
    <div className={cn(
      'p-3 rounded-lg border',
      config.bgColor,
      config.borderColor,
      className
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-5 w-5', config.color)} />
          <div>
            <p className="font-medium text-sm">Conexão {config.label}</p>
            <p className={cn('text-xs', getLatencyColor(latency))}>
              Latência: {formatLatency(latency)}
            </p>
          </div>
        </div>
        
        {onRetry && (quality === 'poor' || quality === 'offline') && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            disabled={isValidating}
            className="h-7 px-2"
          >
            <RotateCcw className={cn('h-3 w-3 mr-1', isValidating && 'animate-spin')} />
            Tentar novamente
          </Button>
        )}
      </div>

      {/* Success rate progress */}
      <div className="space-y-1 mb-2">
        <div className="flex justify-between text-xs">
          <span>Taxa de sucesso</span>
          <span className="font-medium">{successRate}%</span>
        </div>
        <Progress value={successRate} className="h-2" />
      </div>

      {/* Status indicators */}
      <div className="flex items-center gap-4 text-xs">
        {isValidating && (
          <div className="flex items-center gap-1 text-blue-600">
            <Clock className="h-3 w-3 animate-pulse" />
            Verificando...
          </div>
        )}
        
        {consecutiveFailures > 0 && (
          <div className="flex items-center gap-1 text-red-600">
            <AlertTriangle className="h-3 w-3" />
            {consecutiveFailures} falhas
          </div>
        )}
        
        {quality === 'excellent' && consecutiveFailures === 0 && (
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle className="h-3 w-3" />
            Estável
          </div>
        )}
      </div>
    </div>
  );
};