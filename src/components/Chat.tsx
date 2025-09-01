import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Image, Smile, Play, Pause, VolumeX, Wifi, WifiOff, Settings, UserPlus, LogIn, Palette } from 'lucide-react';
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
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import { PublicChatSettings } from '@/components/PublicChatSettings';
import { PrivateChatSettings } from '@/components/PrivateChatSettings';
import { MessageContextMenu } from '@/components/MessageContextMenu';
import { MessageBubble } from '@/components/MessageBubble';
import { useLongPress } from '@/hooks/useLongPress';
import { WallpaperSettings } from '@/components/WallpaperSettings';

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
    isOnline,
    reconnectAttempts,
    sendMessage,
    sendTypingIndicator,
    reconnectChannels,
  } = useRealtimeChat(conversationId);
  const { markConversationAsRead } = useUnreadMessages();
  
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<ChatParticipant | null>(null);
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPublicSettings, setShowPublicSettings] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasInitialScrolled, setHasInitialScrolled] = useState(false);
  const [isPublicChat, setIsPublicChat] = useState(false);
  const [isParticipant, setIsParticipant] = useState(true);
  const [joining, setJoining] = useState(false);
  const [chatPhoto, setChatPhoto] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    messageId: string;
    isOwnMessage: boolean;
    messageContent: string;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    messageId: '',
    isOwnMessage: false,
    messageContent: ''
  });
  const [editingMessage, setEditingMessage] = useState<{
    id: string;
    content: string;
  } | null>(null);
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    content: string;
    senderName: string;
  } | null>(null);
  const [showWallpaperSettings, setShowWallpaperSettings] = useState(false);
  const [currentWallpaper, setCurrentWallpaper] = useState<{
    type: 'color' | 'image';
    value: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (conversationId && user) {
      checkPublicChatStatus();
      fetchOtherUser();
      loadWallpaper();
    }
  }, [conversationId, user]);

  const loadWallpaper = () => {
    if (!user || !conversationId) return;
    
    const wallpaperKey = `wallpaper_${user.id}_${conversationId}`;
    const stored = localStorage.getItem(wallpaperKey);
    
    if (stored) {
      try {
        const wallpaper = JSON.parse(stored);
        setCurrentWallpaper(wallpaper);
      } catch (error) {
        console.error('Error loading wallpaper:', error);
      }
    }
  };

  const checkPublicChatStatus = async () => {
    if (!user || !conversationId) return;

    try {
      // Check if this conversation is marked as public
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('is_public, creator_id, name, photo_url')
        .eq('id', conversationId)
        .single();

      if (convError) {
        console.error('Error checking conversation:', convError);
        return;
      }

      // Use the database flag directly
      const isPublic = conversation?.is_public || false;
      setIsPublicChat(isPublic);
      setChatPhoto(conversation?.photo_url || null);

      // Check if user is a participant
      const { data: participants, error: participantsError } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId);

      if (participantsError) throw participantsError;

      if (isPublic) {
        // Check if user is already a participant
        const isUserParticipant = participants?.some(p => p.user_id === user.id) || false;
        setIsParticipant(isUserParticipant);

        // Auto-join if user is participant
        if (isUserParticipant) {
          console.log('User is already a participant in public chat:', conversationId);
        }
      } else {
        setIsParticipant(true); // For private chats, assume user is participant if they can access
      }
    } catch (error) {
      console.error('Error checking public chat status:', error);
    }
  };

  const joinPublicChat = async () => {
    if (!user || !conversationId) return;

    setJoining(true);
    try {
      const { error } = await supabase
        .from('conversation_participants')
        .insert({
          conversation_id: conversationId,
          user_id: user.id
        });

      if (error) throw error;

      setIsParticipant(true);
      toast({
        title: "Sucesso",
        description: "Você entrou no chat público!",
      });
      
      console.log('Successfully joined public chat:', conversationId);
    } catch (error) {
      console.error('Error joining public chat:', error);
      toast({
        title: "Erro",
        description: "Não foi possível entrar no chat.",
        variant: "destructive",
      });
    } finally {
      setJoining(false);
    }
  };

  const fetchOtherUser = async () => {
    if (!conversationId || !user) return;

    try {
      // First check if this conversation is public from the database
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('is_public, name, photo_url')
        .eq('id', conversationId)
        .single();

      if (convError) throw convError;

      // If it's a public chat, set the display name accordingly
      if (conversation?.is_public) {
        setOtherUser({
          id: 'public',
          display_name: conversation.name || 'Chat Público',
          username: 'public_chat',
          avatar_url: conversation.photo_url
        });
        return;
      }

      // Regular private chat - get other user
      const { data: participants, error } = await supabase
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
        .eq('conversation_id', conversationId)
        .neq('user_id', user.id);

      if (error) throw error;

      if (participants?.length > 0) {
        const firstParticipant = participants[0];
        if (firstParticipant.profiles && typeof firstParticipant.profiles === 'object' && !('error' in (firstParticipant.profiles || {}))) {
          const profile = firstParticipant.profiles as any;
          setOtherUser({
            id: profile.id,
            display_name: profile.display_name,
            username: profile.username,
            avatar_url: profile.avatar_url
          });
        } else {
          setOtherUser({
            id: 'unknown',
            display_name: 'Usuário',
            username: 'unknown',
            avatar_url: null
          });
        }
      } else {
        // New chat without other participants yet
        setOtherUser({
          id: 'new_chat',
          display_name: conversation?.name || 'Novo Chat',
          username: 'new_chat',
          avatar_url: conversation?.photo_url || null
        });
      }
    } catch (error) {
      console.error('Error fetching other user:', error);
    }
  };

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
    if (isPublicChat) {
      setShowPublicSettings(true);
    } else {
      setShowSettings(true);
      fetchParticipants();
      fetchAllUsers();
    }
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

  // Message context menu handlers
  const handleMessageLongPress = (event: React.TouchEvent | React.MouseEvent, message: any) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setContextMenu({
      isOpen: true,
      position: { x: rect.left, y: rect.top },
      messageId: message.id,
      isOwnMessage: message.sender_id === user?.id,
      messageContent: message.content || ''
    });
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(contextMenu.messageContent);
    toast({
      title: "Copiado",
      description: "Mensagem copiada para a área de transferência",
    });
  };

  const handleDeleteMessage = async () => {
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', contextMenu.messageId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Mensagem apagada",
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: "Erro",
        description: "Não foi possível apagar a mensagem",
        variant: "destructive",
      });
    }
  };

  const handleEditMessage = () => {
    const message = messages.find(m => m.id === contextMenu.messageId);
    if (message) {
      setEditingMessage({
        id: message.id,
        content: message.content || ''
      });
      setNewMessage(message.content || '');
    }
  };

  const handleReplyMessage = () => {
    const message = messages.find(m => m.id === contextMenu.messageId);
    if (message) {
      const senderName = message.sender_id === user?.id ? 'Você' : otherUser?.display_name || 'Usuário';
      setReplyingTo({
        id: message.id,
        content: message.content || '',
        senderName
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMessage || !newMessage.trim()) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({ content: newMessage.trim() })
        .eq('id', editingMessage.id);

      if (error) throw error;

      setEditingMessage(null);
      setNewMessage('');
      toast({
        title: "Sucesso",
        description: "Mensagem editada",
      });
    } catch (error) {
      console.error('Error editing message:', error);
      toast({
        title: "Erro",
        description: "Não foi possível editar a mensagem",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setNewMessage('');
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
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
                  {isPublicChat && chatPhoto ? (
                    <AvatarImage src={chatPhoto} className="object-cover" />
                  ) : (
                    <>
                      <AvatarImage src={otherUser.avatar_url || ''} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white font-semibold">
                        {otherUser.display_name[0]}
                      </AvatarFallback>
                    </>
                  )}
                </Avatar>
                
                <div>
                  <h2 className="font-semibold text-lg">{otherUser.display_name}</h2>
                  <p className="text-sm text-muted-foreground">@{otherUser.username}</p>
                </div>
              </div>
              
               <div className="flex items-center gap-2">
                 <ConnectionStatus
                   status={connectionStatus}
                   isOnline={isOnline}
                   reconnectAttempts={reconnectAttempts}
                   onReconnect={reconnectChannels}
                 />

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
        <div 
          className="flex-1 overflow-y-auto p-4 pb-32 relative" 
          style={{ 
            scrollBehavior: 'auto',
            backgroundColor: currentWallpaper?.type === 'color' ? currentWallpaper.value : undefined
          }}
        >
          {/* Background Image */}
          {currentWallpaper?.type === 'image' && (
            <div 
              className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
              style={{ 
                backgroundImage: `url(${currentWallpaper.value})`,
                zIndex: -1
              }}
            />
          )}
          {!isParticipant && isPublicChat ? (
            // Join Public Chat View
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
              <Avatar className="w-20 h-20">
                <AvatarImage src={otherUser?.avatar_url || ''} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-2xl font-semibold">
                  {otherUser?.display_name?.[0] || '🌐'}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-4">
                <h3 className="font-semibold text-xl">{otherUser?.display_name}</h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                  Este é um chat público. Clique em "Entrar" para participar da conversa.
                </p>
                <Button 
                  onClick={joinPublicChat}
                  disabled={joining}
                  size="lg"
                  className="gap-2"
                >
                  {joining ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <LogIn className="w-4 h-4" />
                  )}
                  {joining ? 'Entrando...' : 'Entrar no Chat'}
                </Button>
              </div>
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
                          
                          {/* Reply preview */}
                          {replyingTo && replyingTo.id === message.id && (
                            <div className="mb-2 p-2 bg-muted/50 rounded-lg border-l-2 border-primary">
                              <p className="text-xs text-muted-foreground">
                                Respondendo a {replyingTo.senderName}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {replyingTo.content}
                              </p>
                            </div>
                          )}
                          
                          <MessageBubble 
                            message={message}
                            isOwnMessage={isOwnMessage}
                            onLongPress={(e) => handleMessageLongPress(e, message)}
                          />
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
        {isParticipant && (
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
              
              {/* Reply/Edit bar */}
              {(replyingTo || editingMessage) && (
                <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                  <div className="flex-1">
                    {replyingTo && (
                      <div>
                        <p className="text-xs text-muted-foreground">Respondendo a {replyingTo.senderName}</p>
                        <p className="text-sm truncate">{replyingTo.content}</p>
                      </div>
                    )}
                    {editingMessage && (
                      <p className="text-xs text-muted-foreground">Editando mensagem</p>
                    )}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={editingMessage ? handleCancelEdit : handleCancelReply}
                    className="w-8 h-8 p-0"
                  >
                    ×
                  </Button>
                </div>
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
                  placeholder={editingMessage ? "Editar mensagem..." : "Digite uma mensagem..."}
                  className="flex-1 rounded-full border-0 bg-muted/50"
                  disabled={sending}
                />
                
                <Button variant="ghost" size="sm" className="w-9 h-9 p-0">
                  <Smile className="w-4 h-4" />
                </Button>
                
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    editingMessage ? handleSaveEdit() : handleSendMessage();
                  }}
                  disabled={!newMessage.trim() || sending}
                  size="sm"
                  className="rounded-full w-9 h-9 p-0"
                  type="button"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Public Chat Settings Modal */}
        <PublicChatSettings
          isOpen={showPublicSettings}
          onClose={() => setShowPublicSettings(false)}
          conversationId={conversationId}
        />

        {/* Private Chat Settings Modal */}
        <PrivateChatSettings
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          conversationId={conversationId}
        />

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

        {/* Message Context Menu */}
        <MessageContextMenu
          isOpen={contextMenu.isOpen}
          onClose={() => setContextMenu(prev => ({ ...prev, isOpen: false }))}
          position={contextMenu.position}
          isOwnMessage={contextMenu.isOwnMessage}
          messageContent={contextMenu.messageContent}
          onCopy={handleCopyMessage}
          onDelete={handleDeleteMessage}
          onEdit={handleEditMessage}
          onReply={handleReplyMessage}
        />

        {/* Wallpaper Settings Modal */}
        <WallpaperSettings
          isOpen={showWallpaperSettings}
          onClose={() => setShowWallpaperSettings(false)}
          conversationId={conversationId}
          currentWallpaper={currentWallpaper}
          onWallpaperChange={(wallpaper) => {
            setCurrentWallpaper(wallpaper);
          }}
        />
      </div>
    );
};

export default Chat;