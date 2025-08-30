import { useState, useEffect } from 'react';
import { Loader2, Wifi, WifiOff, Battery, BatteryLow, Zap } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface LoadingFeedbackProps {
  isLoading: boolean;
  operation?: string;
  progress?: number;
  showNetworkStatus?: boolean;
  showBatteryStatus?: boolean;
  showPerformanceHints?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'inline' | 'overlay';
}

interface NetworkInfo {
  isOnline: boolean;
  quality: 'excellent' | 'good' | 'poor' | 'offline';
  effectiveType: string;
}

interface BatteryInfo {
  level: number;
  charging: boolean;
}

export const LoadingFeedback = ({
  isLoading,
  operation = 'Carregando',
  progress,
  showNetworkStatus = false,
  showBatteryStatus = false,
  showPerformanceHints = false,
  className,
  size = 'md',
  variant = 'default'
}: LoadingFeedbackProps) => {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({
    isOnline: navigator.onLine,
    quality: 'good',
    effectiveType: '4g'
  });
  const [batteryInfo, setBatteryInfo] = useState<BatteryInfo | null>(null);
  const [animationReduced, setAnimationReduced] = useState(false);

  useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setAnimationReduced(prefersReducedMotion);

    // Network monitoring
    const updateNetworkStatus = () => {
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      
      setNetworkInfo({
        isOnline: navigator.onLine,
        quality: connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g' ? 'poor' :
                connection?.effectiveType === '3g' ? 'good' : 'excellent',
        effectiveType: connection?.effectiveType || '4g'
      });
    };

    updateNetworkStatus();
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    // Battery monitoring
    if ('getBattery' in navigator && showBatteryStatus) {
      (navigator as any).getBattery().then((battery: any) => {
        const updateBatteryInfo = () => {
          setBatteryInfo({
            level: Math.round(battery.level * 100),
            charging: battery.charging
          });
        };

        updateBatteryInfo();
        battery.addEventListener('levelchange', updateBatteryInfo);
        battery.addEventListener('chargingchange', updateBatteryInfo);
      }).catch(() => {
        console.log('Battery API not available');
      });
    }

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
    };
  }, [showBatteryStatus]);

  const getLoadingMessage = () => {
    if (!networkInfo.isOnline) {
      return 'Sem conexão - aguardando rede';
    }
    
    if (networkInfo.quality === 'poor') {
      return `${operation} - conexão lenta`;
    }
    
    if (batteryInfo && batteryInfo.level < 20 && !batteryInfo.charging) {
      return `${operation} - modo economia`;
    }
    
    return operation;
  };

  const getPerformanceHint = () => {
    if (!showPerformanceHints) return null;
    
    if (!networkInfo.isOnline) {
      return "Verifique sua conexão com a internet";
    }
    
    if (networkInfo.quality === 'poor') {
      return "Conexão lenta detectada - carregando versão otimizada";
    }
    
    if (batteryInfo && batteryInfo.level < 20 && !batteryInfo.charging) {
      return "Bateria baixa - recursos limitados para economizar energia";
    }
    
    return null;
  };

  const sizeClasses = {
    sm: 'text-sm gap-2',
    md: 'text-base gap-3',
    lg: 'text-lg gap-4'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  if (!isLoading) return null;

  const baseClasses = cn(
    'flex flex-col items-center justify-center',
    sizeClasses[size],
    variant === 'overlay' && 'fixed inset-0 bg-background/80 backdrop-blur-sm z-50',
    variant === 'inline' && 'py-2',
    className
  );

  return (
    <div className={baseClasses}>
      {/* Main loading indicator */}
      <div className="flex items-center gap-3 mb-2">
        <Loader2 
          className={cn(
            iconSizes[size],
            animationReduced ? '' : 'animate-spin'
          )} 
        />
        <span className="font-medium">{getLoadingMessage()}</span>
      </div>

      {/* Progress bar */}
      {progress !== undefined && (
        <div className="w-full max-w-xs mb-3">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{Math.round(progress)}%</span>
            {progress > 0 && progress < 100 && (
              <span>
                {progress < 50 ? 'Preparando...' : 
                 progress < 90 ? 'Quase pronto...' : 'Finalizando...'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Status indicators */}
      <div className="flex items-center gap-2 mb-2">
        {showNetworkStatus && (
          <Badge variant={networkInfo.isOnline ? 'default' : 'destructive'} className="text-xs">
            {networkInfo.isOnline ? (
              <Wifi className="w-3 h-3 mr-1" />
            ) : (
              <WifiOff className="w-3 h-3 mr-1" />
            )}
            {networkInfo.isOnline ? networkInfo.effectiveType.toUpperCase() : 'Offline'}
          </Badge>
        )}

        {showBatteryStatus && batteryInfo && (
          <Badge 
            variant={batteryInfo.level < 20 && !batteryInfo.charging ? 'destructive' : 'default'}
            className="text-xs"
          >
            {batteryInfo.charging ? (
              <Zap className="w-3 h-3 mr-1" />
            ) : batteryInfo.level < 20 ? (
              <BatteryLow className="w-3 h-3 mr-1" />
            ) : (
              <Battery className="w-3 h-3 mr-1" />
            )}
            {batteryInfo.level}%
          </Badge>
        )}
      </div>

      {/* Performance hint */}
      {getPerformanceHint() && (
        <p className="text-xs text-muted-foreground text-center max-w-sm">
          {getPerformanceHint()}
        </p>
      )}

      {/* Loading dots animation (fallback for reduced motion) */}
      {animationReduced && (
        <div className="flex space-x-1 mt-2">
          <div className="w-2 h-2 bg-primary rounded-full opacity-75"></div>
          <div className="w-2 h-2 bg-primary rounded-full opacity-50"></div>
          <div className="w-2 h-2 bg-primary rounded-full opacity-25"></div>
        </div>
      )}
    </div>
  );
};