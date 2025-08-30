import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimePublicChat } from '@/hooks/useRealtimePublicChat';
import { toast } from '@/hooks/use-toast';
import MobileLayout from '@/components/MobileLayout';
import TypingIndicator from '@/components/ui/TypingIndicator';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';

interface PublicChatProps {
  onBack: () => void;
}

const PublicChat = ({ onBack }: PublicChatProps) => {
  const { user } = useAuth();
  const { 
    messages, 
    typingUsers, 
    loading, 
    sending, 
    sendMessage, 
    sendTypingIndicator, 
    userProfile,
    connectionStatus,
    isOnline,
    reconnectAttempts,
    reconnectChannels
  } = useRealtimePublicChat();
  const [newMessage, setNewMessage] = useState('');
  const [isNearBottom, setIsNearBottom] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if user is near bottom of chat
  const checkIfNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return false;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    const threshold = 100; // pixels from bottom
    return scrollHeight - scrollTop - clientHeight < threshold;
  }, []);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    setIsNearBottom(checkIfNearBottom());
  }, [checkIfNearBottom]);

  // Only auto-scroll if user is near bottom
  useEffect(() => {
    if (isNearBottom) {
      scrollToBottom();
    }
  }, [messages, typingUsers, isNearBottom]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending || !user || !userProfile) return;

    // Clear typing status before sending
    await sendTypingIndicator(false, userProfile.display_name);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    try {
      await sendMessage(newMessage);
      setNewMessage('');
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleMessageChange = async (value: string) => {
    setNewMessage(value);
    
    if (!userProfile) return;

    // Send typing status when user starts typing
    if (value.trim() && !typingTimeoutRef.current) {
      await sendTypingIndicator(true, userProfile.display_name);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator
    if (value.trim()) {
      typingTimeoutRef.current = setTimeout(async () => {
        await sendTypingIndicator(false, userProfile.display_name);
        typingTimeoutRef.current = null;
      }, 2000); // Stop typing after 2 seconds of inactivity
    } else {
      // Immediately stop typing if input is empty
      await sendTypingIndicator(false, userProfile.display_name);
      typingTimeoutRef.current = null;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDateSeparator = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoje';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ontem';
    } else {
      return date.toLocaleDateString('pt-BR', { 
        day: 'numeric', 
        month: 'long' 
      });
    }
  };

  const shouldShowDateSeparator = (currentMessage: any, previousMessage?: any) => {
    if (!previousMessage) return true;
    
    const currentDate = new Date(currentMessage.created_at).toDateString();
    const previousDate = new Date(previousMessage.created_at).toDateString();
    
    return currentDate !== previousDate;
  };

  return (
    <MobileLayout>
      <div className="flex flex-col h-screen">
        {/* Header */}
        <Card className="card-shadow border-0 rounded-none">
          <CardHeader className="py-4 px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                  className="w-8 h-8 p-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Users className="w-7 h-7 text-white" />
                </div>
                
                <div>
                  <h2 className="font-semibold text-xl">Pousada teste</h2>
                  <p className="text-sm text-muted-foreground">Chat da pousada - Todos podem participar</p>
                </div>
              </div>
              
              <ConnectionStatus
                status={connectionStatus}
                isOnline={isOnline}
                reconnectAttempts={reconnectAttempts}
                onReconnect={reconnectChannels}
              />
            </div>
          </CardHeader>
        </Card>

        {/* Messages */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
          onScroll={handleScroll}
        >
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] p-3 rounded-lg animate-pulse ${
                    i % 2 === 0 ? 'bg-primary/20' : 'bg-muted'
                  }`}>
                    <div className="h-4 bg-muted-foreground/20 rounded w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {messages.map((message, index) => {
                const previousMessage = messages[index - 1];
                const isOwnMessage = message.sender_id === user?.id;
                const showDateSeparator = shouldShowDateSeparator(message, previousMessage);

                return (
                  <div key={message.id}>
                    {showDateSeparator && (
                      <div className="flex justify-center my-4">
                        <span className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                          {formatDateSeparator(message.created_at)}
                        </span>
                      </div>
                    )}
                    
                    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} items-start space-x-2`}>
                      {!isOwnMessage && (
                        <Avatar className="w-8 h-8 mt-1">
                          <AvatarImage src={message.sender?.avatar_url || ''} />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs font-semibold">
                            {message.sender?.display_name?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      
                      <div className={`max-w-[70%] ${isOwnMessage ? 'ml-auto' : ''}`}>
                        {!isOwnMessage && (
                          <p className="text-xs text-muted-foreground mb-1 px-1">
                            {message.sender?.display_name || 'Usuário'}
                          </p>
                        )}
                        <div className={`p-3 rounded-2xl ${
                          isOwnMessage 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}>
                          <p className="text-sm leading-relaxed">{message.content}</p>
                          <div className={`text-xs mt-1 ${
                            isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          }`}>
                            {formatMessageTime(message.created_at)}
                          </div>
                        </div>
                      </div>
                      
                      {isOwnMessage && (
                        <Avatar className="w-8 h-8 mt-1">
                          <AvatarImage src={userProfile?.avatar_url || ''} />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs font-semibold">
                            {userProfile?.display_name?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {/* Enhanced Typing Indicator */}
              <TypingIndicator typingUsers={typingUsers} className="bg-muted/50 rounded-lg mx-4" />
              
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <Card className="card-shadow border-0 rounded-none">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Input
                value={newMessage}
                onChange={(e) => handleMessageChange(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite uma mensagem na pousada..."
                className="flex-1 rounded-full border-0 bg-muted/50"
                disabled={sending}
              />
              
              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sending}
                size="sm"
                className="rounded-full w-9 h-9 p-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
};

export default PublicChat;