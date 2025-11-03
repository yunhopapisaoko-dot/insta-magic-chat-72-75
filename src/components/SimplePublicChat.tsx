import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Users, Keyboard } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSimplePublicChat } from '@/hooks/useSimplePublicChat';
import MobileLayout from '@/components/MobileLayout';
import VirtualKeyboard from '@/components/VirtualKeyboard';
import { cn } from '@/lib/utils';

interface SimplePublicChatProps {
  onBack: () => void;
}

const SimplePublicChat = ({ onBack }: SimplePublicChatProps) => {
  const { user } = useAuth();
  const { 
    messages, 
    loading, 
    sending, 
    sendMessage, 
    userProfile
  } = useSimplePublicChat();
  const [newMessage, setNewMessage] = useState('');
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);

  const handleVirtualKeyPress = (key: string) => {
    setNewMessage(prev => prev + key);
  };

  const handleVirtualBackspace = () => {
    setNewMessage(prev => prev.slice(0, -1));
  };

  const handleVirtualSpace = () => {
    setNewMessage(prev => prev + ' ');
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending || !user || !userProfile) return;

    try {
      await sendMessage(newMessage);
      setNewMessage('');
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <MobileLayout>
      <div className={cn(
        "flex flex-col h-screen transition-transform duration-300 ease-in-out",
        showVirtualKeyboard && "-translate-y-[340px]"
      )}>
        {/* Header */}
        <Card className="card-shadow border-0 rounded-none">
          <CardHeader className="py-4 px-6">
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
                <p className="text-sm text-muted-foreground">Últimas mensagens</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Messages */}
        <div className="flex-1 p-4 space-y-3 overflow-y-auto">
          {loading ? (
            <div className="space-y-3">
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
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Users className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma mensagem ainda</h3>
              <p className="text-muted-foreground">Seja o primeiro a enviar uma mensagem!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => {
                const isOwnMessage = message.sender_id === user?.id;

                return (
                  <div key={message.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} items-start space-x-2`}>
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
                );
              })}
            </div>
          )}
        </div>

        {/* Input */}
        <Card className="card-shadow border-0 rounded-none">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Input
                value={newMessage}
                readOnly
                onClick={() => setShowVirtualKeyboard(true)}
                placeholder="Digite uma mensagem na pousada..."
                className="flex-1 rounded-full border-0 bg-muted/50 cursor-pointer"
                disabled={sending}
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

        {/* Virtual Keyboard - Fixed at bottom */}
        {showVirtualKeyboard && (
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
            <VirtualKeyboard
              onKeyPress={handleVirtualKeyPress}
              onBackspace={handleVirtualBackspace}
              onSpace={handleVirtualSpace}
              onClose={() => setShowVirtualKeyboard(false)}
              currentValue={newMessage}
            />
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default SimplePublicChat;