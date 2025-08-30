import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

interface TimeoutConfig {
  sendTimeout: number;
  deliveryTimeout: number;
  maxRetries: number;
  retryDelay: number;
}

interface PendingMessage {
  id: string;
  content: string;
  timestamp: number;
  retryCount: number;
  timeoutId?: NodeJS.Timeout;
  status: 'pending' | 'timeout' | 'failed' | 'sent';
}

export const useMessageTimeout = (config: TimeoutConfig = {
  sendTimeout: 30000, // 30 seconds
  deliveryTimeout: 60000, // 60 seconds  
  maxRetries: 3,
  retryDelay: 2000 // 2 seconds
}) => {
  const [pendingMessages, setPendingMessages] = useState<Map<string, PendingMessage>>(new Map());
  const [timeoutMessages, setTimeoutMessages] = useState<string[]>([]);
  const retryTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Add message to pending list with timeout
  const addPendingMessage = useCallback((
    messageId: string,
    content: string,
    onTimeout?: (messageId: string) => void,
    onRetry?: (messageId: string) => Promise<boolean>
  ) => {
    const timeoutId = setTimeout(() => {
      setPendingMessages(prev => {
        const newMap = new Map(prev);
        const message = newMap.get(messageId);
        if (message) {
          newMap.set(messageId, {
            ...message,
            status: 'timeout'
          });
        }
        return newMap;
      });

      setTimeoutMessages(prev => [...prev, messageId]);
      
      // Show timeout notification
      toast({
        title: "Timeout na mensagem",
        description: "A mensagem demorou muito para ser enviada. Tentando novamente...",
        variant: "destructive",
      });

      onTimeout?.(messageId);
    }, config.sendTimeout);

    const pendingMessage: PendingMessage = {
      id: messageId,
      content,
      timestamp: Date.now(),
      retryCount: 0,
      timeoutId,
      status: 'pending'
    };

    setPendingMessages(prev => new Map(prev).set(messageId, pendingMessage));

    // Auto-retry logic
    if (onRetry) {
      const attemptRetry = async (attempt: number) => {
        if (attempt >= config.maxRetries) {
          setPendingMessages(prev => {
            const newMap = new Map(prev);
            const message = newMap.get(messageId);
            if (message) {
              newMap.set(messageId, {
                ...message,
                status: 'failed'
              });
            }
            return newMap;
          });

          toast({
            title: "Falha no envio",
            description: "Não foi possível enviar a mensagem após várias tentativas.",
            variant: "destructive",
          });
          return;
        }

        const retryTimeout = setTimeout(async () => {
          try {
            const success = await onRetry(messageId);
            if (!success) {
              attemptRetry(attempt + 1);
            }
          } catch (error) {
            console.error('Retry failed:', error);
            attemptRetry(attempt + 1);
          }
        }, config.retryDelay * Math.pow(2, attempt)); // Exponential backoff

        retryTimeoutsRef.current.set(`${messageId}-${attempt}`, retryTimeout);
      };

      // Start retry sequence after initial timeout
      setTimeout(() => {
        const message = pendingMessages.get(messageId);
        if (message && message.status === 'timeout') {
          attemptRetry(0);
        }
      }, config.sendTimeout + 1000);
    }

    return messageId;
  }, [config, pendingMessages]);

  // Mark message as successfully sent
  const markMessageSent = useCallback((messageId: string) => {
    setPendingMessages(prev => {
      const newMap = new Map(prev);
      const message = newMap.get(messageId);
      
      if (message) {
        // Clear timeout
        if (message.timeoutId) {
          clearTimeout(message.timeoutId);
        }
        
        newMap.set(messageId, {
          ...message,
          status: 'sent'
        });

        // Remove from timeout list
        setTimeoutMessages(prev => prev.filter(id => id !== messageId));
        
        // Clean up after a delay
        setTimeout(() => {
          setPendingMessages(current => {
            const updated = new Map(current);
            updated.delete(messageId);
            return updated;
          });
        }, 5000);
      }
      
      return newMap;
    });

    // Clear any retry timeouts
    retryTimeoutsRef.current.forEach((timeout, key) => {
      if (key.startsWith(messageId)) {
        clearTimeout(timeout);
        retryTimeoutsRef.current.delete(key);
      }
    });
  }, []);

  // Manual retry for failed messages
  const retryMessage = useCallback(async (
    messageId: string,
    onRetry: (messageId: string) => Promise<boolean>
  ) => {
    const message = pendingMessages.get(messageId);
    if (!message || message.retryCount >= config.maxRetries) {
      return false;
    }

    setPendingMessages(prev => {
      const newMap = new Map(prev);
      const msg = newMap.get(messageId);
      if (msg) {
        newMap.set(messageId, {
          ...msg,
          retryCount: msg.retryCount + 1,
          status: 'pending'
        });
      }
      return newMap;
    });

    try {
      const success = await onRetry(messageId);
      
      if (success) {
        markMessageSent(messageId);
        toast({
          title: "Mensagem enviada",
          description: "A mensagem foi enviada com sucesso!",
        });
      } else {
        setPendingMessages(prev => {
          const newMap = new Map(prev);
          const msg = newMap.get(messageId);
          if (msg) {
            newMap.set(messageId, {
              ...msg,
              status: msg.retryCount >= config.maxRetries ? 'failed' : 'timeout'
            });
          }
          return newMap;
        });
      }
      
      return success;
    } catch (error) {
      console.error('Manual retry failed:', error);
      return false;
    }
  }, [pendingMessages, config.maxRetries, markMessageSent]);

  // Get message status
  const getMessageStatus = useCallback((messageId: string) => {
    const message = pendingMessages.get(messageId);
    return message?.status || null;
  }, [pendingMessages]);

  // Get retry count
  const getRetryCount = useCallback((messageId: string) => {
    const message = pendingMessages.get(messageId);
    return message?.retryCount || 0;
  }, [pendingMessages]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      pendingMessages.forEach(message => {
        if (message.timeoutId) {
          clearTimeout(message.timeoutId);
        }
      });
      
      retryTimeoutsRef.current.forEach(timeout => {
        clearTimeout(timeout);
      });
    };
  }, [pendingMessages]);

  return {
    addPendingMessage,
    markMessageSent,
    retryMessage,
    getMessageStatus,
    getRetryCount,
    pendingMessages: Array.from(pendingMessages.values()),
    timeoutMessages,
    hasTimeouts: timeoutMessages.length > 0,
    hasPendingMessages: pendingMessages.size > 0
  };
};