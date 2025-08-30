import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type NetworkQuality = 'excellent' | 'good' | 'poor' | 'offline';

interface ConnectionMetrics {
  latency: number;
  quality: NetworkQuality;
  lastCheck: number;
  consecutiveFailures: number;
  uptime: number;
}

export const useConnectionValidator = () => {
  const [metrics, setMetrics] = useState<ConnectionMetrics>({
    latency: 0,
    quality: 'excellent',
    lastCheck: Date.now(),
    consecutiveFailures: 0,
    uptime: 0
  });
  
  const [isValidating, setIsValidating] = useState(false);
  const [connectionHistory, setConnectionHistory] = useState<boolean[]>([]);
  const intervalRef = useRef<NodeJS.Timeout>();
  const startTimeRef = useRef(Date.now());

  // Test connection quality by measuring response times
  const validateConnection = useCallback(async (): Promise<{ success: boolean; latency: number }> => {
    const startTime = Date.now();
    
    try {
      // Simple query to test database connectivity and measure latency
      const { error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
        .maybeSingle();

      const latency = Date.now() - startTime;
      
      if (error) {
        throw error;
      }

      return { success: true, latency };
    } catch (error) {
      console.warn('Connection validation failed:', error);
      return { success: false, latency: Date.now() - startTime };
    }
  }, []);

  // Determine network quality based on latency and success rate
  const calculateQuality = useCallback((latency: number, successRate: number): NetworkQuality => {
    if (!navigator.onLine || successRate < 0.5) {
      return 'offline';
    }
    
    if (latency < 100 && successRate >= 0.9) {
      return 'excellent';
    } else if (latency < 300 && successRate >= 0.7) {
      return 'good';
    } else {
      return 'poor';
    }
  }, []);

  // Run periodic connection validation
  const runValidation = useCallback(async () => {
    if (isValidating) return;
    
    setIsValidating(true);
    
    try {
      const result = await validateConnection();
      const now = Date.now();
      
      // Update connection history (keep last 10 results)
      setConnectionHistory(prev => {
        const newHistory = [...prev, result.success].slice(-10);
        return newHistory;
      });
      
      setMetrics(prev => {
        const successRate = connectionHistory.length > 0 
          ? connectionHistory.filter(Boolean).length / connectionHistory.length
          : (result.success ? 1 : 0);
        
        const quality = calculateQuality(result.latency, successRate);
        const consecutiveFailures = result.success ? 0 : prev.consecutiveFailures + 1;
        const uptime = (now - startTimeRef.current) / 1000; // in seconds
        
        return {
          latency: result.latency,
          quality,
          lastCheck: now,
          consecutiveFailures,
          uptime
        };
      });

      // Show warnings for poor connection
      if (!result.success) {
        const failureCount = metrics.consecutiveFailures + 1;
        
        if (failureCount === 3) {
          toast({
            title: "Conexão instável",
            description: "Verificando conectividade... As mensagens serão sincronizadas quando a conexão for restabelecida.",
            variant: "destructive",
          });
        } else if (failureCount === 1) {
          toast({
            title: "Problema de conexão",
            description: "Tentando reconectar...",
            variant: "destructive",
          });
        }
      } else if (metrics.consecutiveFailures > 0) {
        // Connection restored
        toast({
          title: "Conexão restabelecida",
          description: "Todas as funcionalidades estão operacionais novamente.",
        });
      }
      
    } catch (error) {
      console.error('Validation error:', error);
    } finally {
      setIsValidating(false);
    }
  }, [isValidating, validateConnection, connectionHistory, calculateQuality, metrics.consecutiveFailures]);

  // Start periodic validation
  useEffect(() => {
    // Initial validation
    runValidation();
    
    // Set up periodic checks (every 30 seconds)
    intervalRef.current = setInterval(runValidation, 30000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [runValidation]);

  // Monitor online/offline events
  useEffect(() => {
    const handleOnline = () => {
      toast({
        title: "Conexão de internet restaurada",
        description: "Sincronizando dados...",
      });
      runValidation();
    };

    const handleOffline = () => {
      toast({
        title: "Sem conexão com a internet",
        description: "Funcionando no modo offline. As mensagens serão enviadas quando a conexão for restabelecida.",
        variant: "destructive",
      });
      
      setMetrics(prev => ({
        ...prev,
        quality: 'offline',
        consecutiveFailures: prev.consecutiveFailures + 1
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [runValidation]);

  // Get connection status text
  const getStatusText = useCallback(() => {
    switch (metrics.quality) {
      case 'offline':
        return 'Sem conexão';
      case 'poor':
        return 'Conexão instável';
      case 'good':
        return 'Conexão boa';
      case 'excellent':
        return 'Conexão excelente';
      default:
        return 'Verificando...';
    }
  }, [metrics.quality]);

  // Force validation (useful for manual retry)
  const forceValidation = useCallback(() => {
    runValidation();
  }, [runValidation]);

  // Get detailed connection info
  const getConnectionInfo = useCallback(() => {
    const successRate = connectionHistory.length > 0 
      ? (connectionHistory.filter(Boolean).length / connectionHistory.length) * 100
      : 0;
    
    return {
      ...metrics,
      successRate: Math.round(successRate),
      statusText: getStatusText(),
      isHealthy: metrics.quality !== 'offline' && metrics.consecutiveFailures < 3
    };
  }, [metrics, connectionHistory, getStatusText]);

  return {
    metrics,
    isValidating,
    connectionHistory,
    forceValidation,
    getConnectionInfo,
    getStatusText
  };
};
