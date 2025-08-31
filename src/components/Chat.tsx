import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Image, Smile, Play, Pause, VolumeX, Wifi, WifiOff, Settings, UserPlus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeChat } from '@/hooks/useRealtimeChat';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import MobileLayout from '@/components/MobileLayout';
import MediaUpload from '@/components/MediaUpload';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import TypingIndicator from '@/components/ui/TypingIndicator';

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
    connectionStatus,
    sendMessage,
    sendTypingIndicator,
  } = useRealtimeChat(conversationId);
  const { markConversationAsRead } = useUnreadMessages();
  
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<ChatParticipant | null>(null);
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchConversationData();
  }, [conversationId]);

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

  const scrollToBottom = (instant = false) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: instant ? 'auto' : 'smooth',
        block: 'end'
      });
    }
  };

  // Auto scroll when new messages arrive
  useEffect(() => {
    // Always scroll to bottom when messages change
    scrollToBottom(false);
  }, [messages]);

  // Mark conversation as read when viewing
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      markConversationAsRead(conversationId);
    }
  }, [conversationId, messages, markConversationAsRead]);

  const handleSendMessage = async (messageContent?: string, mediaUrl?: string, mediaType?: string) => {
    const content = messageContent || newMessage.trim();
    if ((!content && !mediaUrl) || sending || !user) return;

    // Clear typing indicator before sending
    await sendTypingIndicator(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    const success = await sendMessage(content, mediaUrl, mediaType);
    if (success) {
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

  // Settings helpers
  const fetchParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from('conversation_participants')
        .select(`
          user_id,
          profiles:user_id (
            id,
            display_name,
            username,
            avatar_url
          )
        `)
        .eq('conversation_id', conversationId);

      if (error) throw error;
      setParticipants(data || []);
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .limit(50);

      if (error) throw error;
      setAllUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const addParticipant = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('conversation_participants')
        .insert({ conversation_id: conversationId, user_id: userId });

      if (error) throw error;
      toast({ title: 'Pessoa adicionada', description: 'A pessoa foi adicionada à conversa.' });
      fetchParticipants();
    } catch (error) {
      console.error('Error adding participant:', error);
      toast({ title: 'Erro', description: 'Não foi possível adicionar a pessoa.', variant: 'destructive' });
    }
  };

  const handleOpenSettings = () => {
    setShowSettings(true);
    fetchParticipants();
    fetchAllUsers();
  };

  const handleLeaveConversation = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      if (error) throw error;
      toast({ title: 'Conversa encerrada', description: 'Você saiu da conversa.' });
      setShowSettings(false);
      setShowLeaveConfirm(false);
      onBack();
    } catch (error) {
      console.error('Error leaving conversation:', error);
      toast({ title: 'Erro', description: 'Não foi possível sair da conversa.', variant: 'destructive' });
    }
  };

  const filteredUsers = allUsers
    .filter(u => u.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                 u.username.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(u => !participants.some(p => p.profiles?.id === u.id) && u.id !== user?.id);

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
    <div className="flex flex-col h-screen relative bg-background">
        {/* Fixed Header */}
        <Card className="card-shadow border-0 rounded-none sticky top-0 z-10 bg-background">
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
                {/* Connection Status Indicator */}
                <div className="flex items-center gap-1">
                  {connectionStatus === 'connected' ? (
                    <Wifi className="w-4 h-4 text-green-500" />
                  ) : connectionStatus === 'connecting' ? (
                    <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-red-500" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {connectionStatus === 'connected' ? 'Online' : 
                     connectionStatus === 'connecting' ? 'Conectando...' : 'Offline'}
                  </span>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenSettings}
                  className="w-8 h-8 p-0"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Messages - with bottom padding to account for fixed input */}
        <div className="flex-1 overflow-y-auto p-4 pb-32">
          {messages.length === 0 ? (
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
            <div className="flex flex-col justify-end min-h-full">
              <div className="space-y-4">
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
                               {isOwnMessage && (
                                 <div className="flex items-center gap-1">
                                   {message.message_status === 'read' && (
                                     <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                   )}
                                   {message.message_status === 'delivered' && (
                                     <div className="w-2 h-2 bg-green-500 rounded-full" />
                                   )}
                                   {(message.message_status === 'sent' || !message.message_status) && (
                                     <div className="w-2 h-2 bg-gray-400 rounded-full" />
                                   )}
                                 </div>
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
              </div>
            </div>
          )}
        </div>

        {/* Fixed Input - always at bottom */}
        <Card className="card-shadow border-0 rounded-none fixed bottom-0 left-0 right-0 z-20 bg-background border-t">
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

        {/* Settings Modal */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Configurações da Conversa</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Current Participants */}
              <div>
                <h3 className="text-sm font-medium mb-3">Participantes ({participants.length})</h3>
                <ScrollArea className="max-h-32">
                  <div className="space-y-2">
                    {participants.map((participant) => (
                      <div key={participant.user_id} className="flex items-center space-x-3 p-2 rounded-lg bg-muted/50">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={participant.profiles?.avatar_url || ''} />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs">
                            {participant.profiles?.display_name?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{participant.profiles?.display_name}</p>
                          <p className="text-xs text-muted-foreground truncate">@{participant.profiles?.username}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <Separator />

              {/* Add People */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium">Adicionar Pessoas</h3>
                  <UserPlus className="w-4 h-4 text-muted-foreground" />
                </div>

                <Input
                  placeholder="Buscar pessoas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-3"
                />

                <ScrollArea className="max-h-32">
                  <div className="space-y-2">
                    {filteredUsers.map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                        <div className="flex items-center space-x-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={u.avatar_url || ''} />
                            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs">
                              {u.display_name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{u.display_name}</p>
                            <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => addParticipant(u.id)} className="h-7 px-2">
                          <UserPlus className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    {filteredUsers.length === 0 && searchQuery && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Nenhuma pessoa encontrada
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>

              <Separator />

              {/* Leave Conversation */}
              <Button variant="destructive" onClick={() => setShowLeaveConfirm(true)} className="w-full">
                Sair da Conversa
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Leave Confirmation Modal */}
        <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sair da Conversa</AlertDialogTitle>
              <AlertDialogDescription>
                Você tem certeza que deseja sair desta conversa? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleLeaveConversation} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Sair da Conversa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
};

export default Chat;