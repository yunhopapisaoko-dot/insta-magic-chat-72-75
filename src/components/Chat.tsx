import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Image, Smile, Play, Pause, VolumeX } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import MobileLayout from '@/components/MobileLayout';
import MessageStatus from '@/components/ui/MessageStatus';
import TypingIndicator from '@/components/ui/TypingIndicator';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import { NetworkIndicator } from '@/components/ui/NetworkIndicator';
import { MessageRetryIndicator } from '@/components/ui/MessageRetryIndicator';
import MediaUpload from '@/components/MediaUpload';

interface ChatProps {
  conversationId: string;
  onBack: () => void;
}

interface ChatParticipant {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
}

const Chat = ({ conversationId, onBack }: ChatProps) => {
  const { user } = useAuth();
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
    pendingMessages,
    retryMessage,
    getMessageStatus,
    getRetryCount
  } = useRealtimeMessages(conversationId);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<ChatParticipant | null>(null);
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchConversationData();
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers]);

  // Remove old real-time subscription effect since it's handled by useRealtimeMessages

  const fetchConversationData = async () => {
    try {
      // Get other participant
      const { data: participants, error } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .neq('user_id', user?.id);

      if (error) throw error;
      
      if (participants?.[0]) {
        const userId = participants[0].user_id;
        
        // Get profile data
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('display_name, username, avatar_url')
          .eq('id', userId)
          .single();

        if (profileError) throw profileError;

        setOtherUser({
          id: userId,
          display_name: profile.display_name,
          username: profile.username,
          avatar_url: profile.avatar_url,
        });
      }
    } catch (error) {
      console.error('Error fetching conversation data:', error);
    }
  };

  // Remove fetchMessages since it's handled by useRealtimeMessages

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (messageContent?: string, mediaUrl?: string, mediaType?: string) => {
    const content = messageContent || newMessage.trim();
    if ((!content && !mediaUrl) || sending || !user) return;

    // Clear typing indicator before sending
    await sendTypingIndicator(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    const result = await realtimeSendMessage(content, mediaUrl, mediaType);
    if (result) {
      setNewMessage('');
      setShowMediaUpload(false);
    }
  };

  const handleMediaSelected = (url: string, type: 'image' | 'video') => {
    handleSendMessage('', url, type);
  };

  const handleMessageChange = async (value: string) => {
    setNewMessage(value);
    
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
      }, 2000); // Stop typing after 2 seconds of inactivity
    } else {
      // Immediately stop typing if input is empty
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

  if (!otherUser) {
    return (
      <MobileLayout>
        <div className="mobile-container py-6 flex items-center justify-center min-h-[50vh]">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </MobileLayout>
    );
  }

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
                
                <Avatar className="w-10 h-10">
                  <AvatarImage src={otherUser.avatar_url || ''} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white font-semibold">
                    {otherUser.display_name[0]}
                  </AvatarFallback>
                </Avatar>
                
                <div>
                  <h2 className="font-semibold text-lg">{otherUser.display_name}</h2>
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
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={otherUser?.avatar_url || ''} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xl font-semibold">
                  {otherUser?.display_name?.[0] || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">{otherUser?.display_name}</h3>
                <p className="text-muted-foreground text-sm">Envie uma mensagem para começar a conversa!</p>
              </div>
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
                           <AvatarImage src={otherUser?.avatar_url || ''} />
                           <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs font-semibold">
                             {otherUser?.display_name?.[0] || '?'}
                           </AvatarFallback>
                         </Avatar>
                       )}
                       
                       <div className={`max-w-[70%] ${isOwnMessage ? 'ml-auto' : ''}`}>
                         {!isOwnMessage && (
                           <p className="text-xs text-muted-foreground mb-1 px-1">
                             {otherUser?.display_name || 'Usuário'}
                           </p>
                         )}
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
                              <div className="flex items-center gap-1">
                                {isOwnMessage && (
                                  <MessageStatus 
                                    status={message.message_status as 'sent' | 'delivered' | 'read' || 'sent'} 
                                    className="ml-2" 
                                  />
                                )}
                                {/* Show retry indicator for failed messages */}
                                {isOwnMessage && (
                                  <MessageRetryIndicator
                                    status={getMessageStatus(message.id) ? 
                                      getMessageStatus(message.id) as any : 
                                      (message.message_status === 'sent' ? 'sent' : 'sending')
                                    }
                                    onRetry={async () => {
                                      await retryMessage(message.id, async () => {
                                        // The retry logic is handled by the hook
                                        return true;
                                      });
                                    }}
                                    retryCount={getRetryCount(message.id)}
                                    maxRetries={3}
                                  />
                                )}
                              </div>
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
              
              {/* Enhanced Typing Indicator */}
              <TypingIndicator typingUsers={typingUsers} className="px-2" />
              
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <Card className="card-shadow border-0 rounded-none">
          <CardContent className="p-4 space-y-3">
            {/* Media Upload */}
            {showMediaUpload && (
              <MediaUpload
                onMediaSelected={handleMediaSelected}
                disabled={sending}
                className="w-full"
              />
            )}
            
            {/* Message Input */}
            <div className="flex items-center space-x-2">
              <MediaUpload
                onMediaSelected={handleMediaSelected}
                disabled={sending}
              />
              
              <Input
                value={newMessage}
                onChange={(e) => handleMessageChange(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite uma mensagem..."
                className="flex-1 rounded-full border-0 bg-muted/50"
                disabled={sending}
              />
              
              <Button variant="ghost" size="sm" className="w-9 h-9 p-0">
                <Smile className="w-4 h-4" />
              </Button>
              
              <Button
                onClick={() => handleSendMessage()}
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

export default Chat;