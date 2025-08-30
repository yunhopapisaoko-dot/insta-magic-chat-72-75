import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Smile, X, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import { useRealtimeConversations } from '@/hooks/useRealtimeConversations';
import { useProfileNavigation } from '@/hooks/useProfileNavigation';
import MessageStatus from '@/components/ui/MessageStatus';
import TypingIndicator from '@/components/ui/TypingIndicator';
import MediaUpload from '@/components/MediaUpload';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import { NetworkIndicator } from '@/components/ui/NetworkIndicator';

interface ProfileChatProps {
  otherUser: {
    id: string;
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
  isOpen: boolean;
  onClose: () => void;
  onNavigateBack?: () => void;
  showBackButton?: boolean;
}

const ProfileChat = ({ otherUser, isOpen, onClose, onNavigateBack, showBackButton = false }: ProfileChatProps) => {
  const { user } = useAuth();
  const { createOrGetConversation } = useRealtimeConversations();
  const { cacheConversation } = useProfileNavigation();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { 
    messages, 
    typingUsers, 
    loading, 
    sending, 
    sendMessage: realtimeSendMessage,
    sendTypingIndicator,
    connectionStatus,
    isOnline,
    reconnectAttempts,
    reconnectChannels,
    connectionQuality,
    networkMetrics,
  } = useRealtimeMessages(conversationId || '');

  useEffect(() => {
    if (isOpen && user && otherUser.id) {
      initializeConversation();
    }
  }, [isOpen, user, otherUser.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers]);

  const initializeConversation = async () => {
    if (!user) return;
    
    const convId = await createOrGetConversation(otherUser.id);
    if (convId) {
      setConversationId(convId);
      // Cache this conversation with complete profile data
      const profileData = {
        ...otherUser,
        bio: null,
        followers_count: 0,
        following_count: 0,
      };
      cacheConversation(otherUser.id, convId, profileData);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (messageContent?: string, mediaUrl?: string, mediaType?: string) => {
    const content = messageContent || newMessage.trim();
    if ((!content && !mediaUrl) || sending || !user || !conversationId) return;

    // Clear typing indicator before sending
    await sendTypingIndicator(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    const result = await realtimeSendMessage(content, mediaUrl, mediaType);
    if (result) {
      setNewMessage('');
    }
  };

  const handleMediaSelected = (url: string, type: 'image' | 'video') => {
    handleSendMessage('', url, type);
  };

  const handleMessageChange = async (value: string) => {
    setNewMessage(value);
    
    if (!conversationId) return;
    
    // Send typing status when user starts typing
    if (value.trim() && !typingTimeoutRef.current) {
      await sendTypingIndicator(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator
    if (value.trim()) {
      typingTimeoutRef.current = setTimeout(async () => {
        await sendTypingIndicator(false);
        typingTimeoutRef.current = null;
      }, 2000);
    } else {
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

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="bottom" 
        className="h-[90vh] flex flex-col p-0 bg-background border-t border-border rounded-t-2xl"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {showBackButton && onNavigateBack && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onNavigateBack}
                  className="w-8 h-8 p-0 mr-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              )}
              
              <Avatar className="w-10 h-10">
                <AvatarImage src={otherUser.avatar_url || ''} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white font-semibold">
                  {otherUser.display_name[0]}
                </AvatarFallback>
              </Avatar>
              
              <div>
                <SheetTitle className="text-left">{otherUser.display_name}</SheetTitle>
                <p className="text-sm text-muted-foreground">@{otherUser.username}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <NetworkIndicator
                quality={connectionQuality}
                latency={networkMetrics.latency}
                successRate={networkMetrics.successRate}
                isValidating={false}
                consecutiveFailures={networkMetrics.consecutiveFailures}
                onRetry={reconnectChannels}
              />
              
              <ConnectionStatus
                status={connectionStatus}
                isOnline={isOnline}
                reconnectAttempts={reconnectAttempts}
                onReconnect={reconnectChannels}
              />
              
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="w-8 h-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
          {!conversationId ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : loading ? (
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
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={otherUser.avatar_url || ''} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xl font-semibold">
                      {otherUser.display_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-lg">{otherUser.display_name}</h3>
                    <p className="text-muted-foreground">Comece uma conversa!</p>
                  </div>
                </div>
              )}

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
                          <AvatarImage src={otherUser.avatar_url || ''} />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs font-semibold">
                            {otherUser.display_name[0]}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      
                      <div className={`max-w-[70%] ${isOwnMessage ? 'ml-auto' : ''}`}>
                        <div className={`p-3 rounded-2xl ${
                          isOwnMessage 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}>
                          {message.content && (
                            <p className="text-sm leading-relaxed">{message.content}</p>
                          )}
                          
                          {/* Media Content */}
                          {message.media_url && (
                            <div className="mt-2">
                              {message.media_type === 'video' ? (
                                <video
                                  src={message.media_url}
                                  controls
                                  className="max-w-full rounded-lg"
                                  style={{ maxHeight: '200px' }}
                                  playsInline
                                />
                              ) : (
                                <img
                                  src={message.media_url}
                                  alt="Imagem compartilhada"
                                  className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                  style={{ maxHeight: '200px' }}
                                  onClick={() => window.open(message.media_url!, '_blank')}
                                />
                              )}
                            </div>
                          )}
                          
                          <div className={`flex items-center justify-between mt-1 ${
                            isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          }`}>
                            <span className="text-xs">
                              {formatMessageTime(message.created_at)}
                            </span>
                            {isOwnMessage && (
                              <MessageStatus 
                                status={message.message_status as 'sent' | 'delivered' | 'read' || 'sent'} 
                                className="ml-2" 
                              />
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {isOwnMessage && user && (
                        <Avatar className="w-8 h-8 mt-1">
                          <AvatarImage src={user.avatar_url || ''} />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs font-semibold">
                            {user.display_name?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {/* Typing Indicator */}
              <TypingIndicator typingUsers={typingUsers} className="px-2" />
              
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border p-4 bg-card">
          <div className="flex items-center space-x-2">
            <MediaUpload
              onMediaSelected={handleMediaSelected}
              disabled={sending || !conversationId}
            />
            
            <Input
              value={newMessage}
              onChange={(e) => handleMessageChange(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite uma mensagem..."
              className="flex-1 rounded-full border-0 bg-muted/50"
              disabled={sending || !conversationId}
            />
            
            <Button variant="ghost" size="sm" className="w-9 h-9 p-0">
              <Smile className="w-4 h-4" />
            </Button>
            
            <Button
              onClick={() => handleSendMessage()}
              disabled={!newMessage.trim() || sending || !conversationId}
              size="sm"
              className="rounded-full w-9 h-9 p-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ProfileChat;