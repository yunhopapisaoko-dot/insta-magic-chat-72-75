import { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Users, ChevronDown, Loader2, Keyboard } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useInfinitePublicChat } from '@/hooks/useInfinitePublicChat';
import MobileLayout from '@/components/MobileLayout';
import TypingIndicator from '@/components/ui/TypingIndicator';
import { cn, stripUserDigits } from '@/lib/utils';
import VirtualKeyboard from '@/components/VirtualKeyboard';

interface InfinitePublicChatProps {
  onBack: () => void;
}

const InfinitePublicChat = ({ onBack }: InfinitePublicChatProps) => {
  const { user } = useAuth();
  const { 
    messages, 
    loading, 
    loadingMore,
    sending, 
    hasMore,
    isNearBottom,
    typingUsers,
    sendMessage,
    sendTypingIndicator, 
    userProfile,
    scrollToBottom,
    scrollElementRef,
    handleScroll,
  } = useInfinitePublicChat({ pageSize: 25, enableAutoScroll: true });
  
  const [newMessage, setNewMessage] = useState('');
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleVirtualKeyPress = (key: string) => {
    const newValue = newMessage + key;
    setNewMessage(newValue);
    handleMessageChange(newValue);
  };

  const handleVirtualBackspace = () => {
    const newValue = newMessage.slice(0, -1);
    setNewMessage(newValue);
    handleMessageChange(newValue);
  };

  const handleVirtualSpace = () => {
    const newValue = newMessage + ' ';
    setNewMessage(newValue);
    handleMessageChange(newValue);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending || !user || !userProfile) return;

    // Clear typing indicator before sending
    await sendTypingIndicator(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    try {
      await sendMessage(newMessage);
      setNewMessage('');
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleMessageChange = async (value: string) => {
    console.log('Message changed:', value);
    setNewMessage(value);
    
    // Send typing status when user starts typing
    if (value.trim() && !typingTimeoutRef.current) {
      console.log('Starting to type - sending typing indicator');
      await sendTypingIndicator(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator
    if (value.trim()) {
      typingTimeoutRef.current = setTimeout(async () => {
        console.log('Stopping typing indicator after timeout');
        await sendTypingIndicator(false);
        typingTimeoutRef.current = null;
      }, 2000); // Stop typing after 2 seconds of inactivity
    } else {
      // Immediately stop typing if input is empty
      console.log('Input empty - stopping typing indicator');
      await sendTypingIndicator(false);
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

  const messageElements = useMemo(() => {
    return messages.map((message) => {
      const isOwnMessage = message.sender_id === user?.id;

      return (
        <div 
          key={message.id} 
          className={cn(
            "flex items-start space-x-2 animate-fade-in",
            isOwnMessage ? 'justify-end' : 'justify-start'
          )}
        >
          {!isOwnMessage && (
            <Avatar className="w-8 h-8 mt-1 flex-shrink-0">
              <AvatarImage src={message.sender?.avatar_url || ''} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-semibold">
                {message.sender?.display_name ? stripUserDigits(message.sender.display_name)[0] : '?'}
              </AvatarFallback>
            </Avatar>
          )}
          
          <div className={cn("max-w-[70%]", isOwnMessage ? 'ml-auto' : '')}>
            {!isOwnMessage && (
              <p className="text-xs text-muted-foreground mb-1 px-1">
                {message.sender?.display_name ? stripUserDigits(message.sender.display_name) : 'Usuário'}
              </p>
            )}
            <div className={cn(
              "p-3 rounded-2xl transition-all duration-200 hover:scale-[1.02]",
              isOwnMessage 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted hover:bg-muted/80'
            )}>
              <p className="text-sm leading-relaxed break-words">{message.content}</p>
              <div className={cn(
                "text-xs mt-1",
                isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'
              )}>
                {formatMessageTime(message.created_at)}
              </div>
            </div>
          </div>
          
          {isOwnMessage && (
            <Avatar className="w-8 h-8 mt-1 flex-shrink-0">
              <AvatarImage src={userProfile?.avatar_url || ''} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-semibold">
                {userProfile?.display_name ? stripUserDigits(userProfile.display_name)[0] : '?'}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      );
    });
  }, [messages, user?.id, userProfile]);

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
                  className="w-8 h-8 p-0 hover-scale"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Users className="w-7 h-7 text-white" />
                </div>
                
                <div>
                  <h2 className="font-semibold text-xl">Pousada teste</h2>
                  <p className="text-sm text-muted-foreground">
                    {messages.length} mensagem{messages.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Scroll to bottom button */}
              {!isNearBottom && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => scrollToBottom(false)}
                  className="rounded-full w-9 h-9 p-0 hover-scale"
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Messages */}
        <div className={cn(
          "flex-1 relative transition-all duration-300",
          showVirtualKeyboard && "max-h-[40vh]"
        )}>
            <div
            ref={scrollElementRef}
            onScroll={handleScroll}
            className="absolute inset-0 overflow-y-auto p-4"
            style={{ scrollBehavior: 'auto', display: 'flex', flexDirection: 'column-reverse' }}
          >
            {/* Load more indicator */}
            {loadingMore && (
              <div className="flex justify-center py-4">
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Carregando mensagens antigas...</span>
                </div>
              </div>
            )}

            {/* Messages container */}
            <div className="space-y-4">
              {loading ? (
                // Loading skeleton
                <div className="space-y-4">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className={cn(
                      "flex animate-pulse",
                      i % 2 === 0 ? 'justify-end' : 'justify-start'
                    )}>
                      <div className={cn(
                        "max-w-[70%] p-3 rounded-2xl",
                        i % 2 === 0 ? 'bg-primary/20' : 'bg-muted'
                      )}>
                        <div className="h-4 bg-muted-foreground/20 rounded w-24 mb-1" />
                        <div className="h-3 bg-muted-foreground/10 rounded w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                // Empty state
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <Users className="w-16 h-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhuma mensagem ainda</h3>
                  <p className="text-muted-foreground">Seja o primeiro a enviar uma mensagem!</p>
                </div>
              ) : (
                // Messages
                <div className={cn(
                  "space-y-4"
                )}>
                  {messageElements}
                  
                  {/* Typing Indicator */}
                  <TypingIndicator typingUsers={typingUsers} />
                  
                  {/* Scroll anchor - always at bottom */}
                  <div className="h-1" />
                </div>
              )}
            </div>

            {/* Scroll indicator */}
            <div className="h-4" />
          </div>
        </div>

        {/* Input */}
        <Card className="card-shadow border-0 rounded-none">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center space-x-2">
              <Input
                value={newMessage}
                readOnly
                onClick={() => setShowVirtualKeyboard(true)}
                placeholder="Digite uma mensagem..."
                className="flex-1 rounded-full border-0 bg-muted/50 transition-all duration-200 cursor-pointer"
                disabled={sending}
                maxLength={1000}
              />
              
              <Button
                variant="ghost"
                size="sm"
                className="w-9 h-9 p-0"
                onClick={() => setShowVirtualKeyboard(!showVirtualKeyboard)}
              >
                <Keyboard className="w-4 h-4" />
              </Button>
              
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSendMessage();
                }}
                disabled={!newMessage.trim() || sending}
                size="sm"
                className="rounded-full w-9 h-9 p-0 hover-scale transition-all duration-200 disabled:opacity-50"
                type="button"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            
            {newMessage.length > 800 && (
              <p className="text-xs text-muted-foreground mt-2 text-right">
                {newMessage.length}/1000 caracteres
              </p>
            )}

            {/* Virtual Keyboard */}
            {showVirtualKeyboard && (
              <VirtualKeyboard
                onKeyPress={handleVirtualKeyPress}
                onBackspace={handleVirtualBackspace}
                onSpace={handleVirtualSpace}
                onClose={() => setShowVirtualKeyboard(false)}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
};

export default InfinitePublicChat;