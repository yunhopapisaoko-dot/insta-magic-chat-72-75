import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Image, Smile, Play, Pause, VolumeX, Wifi, WifiOff, Settings, UserPlus, LogIn, Palette, MessageCircle, Reply, Edit, X } from 'lucide-react';
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
import { MessageBubble } from '@/components/MessageBubble';
import { MessageContextMenu } from '@/components/MessageContextMenu';
import { useLongPress } from '@/hooks/useLongPress';
import { WallpaperSettings } from '@/components/WallpaperSettings';
import { useMessageSenders } from '@/hooks/useMessageSenders';
import { useNewMessageIndicator } from '@/hooks/useNewMessageIndicator';
import { stripUserDigits } from '@/lib/utils';

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
  const navigate = useNavigate();
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
  const { getSenderInfo } = useMessageSenders(messages);
  const { hasNewMessageFrom, clearIndicatorsFromSender } = useNewMessageIndicator(conversationId);
  
  const [otherUser, setOtherUser] = useState<{
    id: string;
    display_name: string;
    username: string;
    avatar_url: string | null;
  } | null>(null);
  const [chatPhoto, setChatPhoto] = useState<string | null>(null);
  const [isOneOnOneChat, setIsOneOnOneChat] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPublicSettings, setShowPublicSettings] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasInitialScrolled, setHasInitialScrolled] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [isPublicChat, setIsPublicChat] = useState(false);
  const [isParticipant, setIsParticipant] = useState(true);
  const [joining, setJoining] = useState(false);
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
  const [messageReplyTo, setMessageReplyTo] = useState<{
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
      
      // Setup realtime updates and cleanup
      const cleanup = setupRealtimeUpdates();
      return cleanup;
    }
  }, [conversationId, user]);

  useEffect(() => {
    if (conversationId && user && isPublicChat !== null) {
      checkParticipantStatus();
    }
  }, [conversationId, user, isPublicChat]);

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

  const handleWallpaperChange = (wallpaper: { type: 'color' | 'image'; value: string } | null) => {
    setCurrentWallpaper(wallpaper);
  };

  const setupRealtimeUpdates = () => {
    if (!conversationId) return;

    // Listen for conversation updates (photo changes)
    const conversationChannel = supabase
      .channel(`conversation_updates:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `id=eq.${conversationId}`
        },
        (payload) => {
          console.log('Conversation updated:', payload);
          const updatedConversation = payload.new as any;
          
          // Update chat photo if changed
          if (updatedConversation.photo_url !== chatPhoto) {
            setChatPhoto(updatedConversation.photo_url);
          }
          
          // Update conversation name and photo for public chats
          if (isPublicChat) {
            setOtherUser(prev => ({
              id: conversationId,
              display_name: updatedConversation.name || 'Chat Público',
              username: updatedConversation.description || 'Chat público',
              avatar_url: updatedConversation.photo_url || ''
            }));
          } else if (updatedConversation.name) {
            // For private chats, only update name if it exists
            setOtherUser(prev => prev ? {
              ...prev,
              display_name: updatedConversation.name
            } : null);
          }
        }
      )
      .subscribe();

    // Listen for wallpaper changes in localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `wallpaper_${user?.id}_${conversationId}`) {
        if (e.newValue) {
          try {
            const newWallpaper = JSON.parse(e.newValue);
            setCurrentWallpaper(newWallpaper);
          } catch (error) {
            console.error('Error parsing wallpaper from storage:', error);
          }
        } else {
          setCurrentWallpaper(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      supabase.removeChannel(conversationChannel);
      window.removeEventListener('storage', handleStorageChange);
    };
  };

  const checkPublicChatStatus = async () => {
    try {
      const { data: conversation, error } = await supabase
        .from('conversations')
         .select('*')
        .eq('id', conversationId)
        .single();

      if (error) throw error;

      const isPublic = conversation?.is_public || false;
      setIsPublicChat(isPublic);
      setChatPhoto(conversation?.photo_url || null);
      
      // Update other user info with conversation data for public chats
      if (isPublic && conversation) {
        setOtherUser(prev => ({
          id: conversationId,
          display_name: conversation.name || 'Chat Público',
          username: conversation.description || 'Chat público',
          avatar_url: conversation.photo_url || ''
        }));
      }
    } catch (error) {
      console.error('Error checking public chat status:', error);
    }
  };

  const checkParticipantStatus = async () => {
    if (!user || !conversationId) return;

    try {
      // Check if user is a participant
      const { data: participants, error: participantsError } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId);

      if (participantsError) throw participantsError;

      if (isPublicChat) {
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
      console.error('Error checking participant status:', error);
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
      // First get conversation details
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (convError) throw convError;

      // First check how many participants are in this conversation
      const { data: allParticipants, error: participantCountError } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId);

      if (participantCountError) throw participantCountError;

      const participantCount = allParticipants ? allParticipants.length : 0;
      const isOneOnOne = participantCount === 2;
      setIsOneOnOneChat(isOneOnOne);

      // For public chats, always use conversation name and photo
      if (conversation?.is_public) {
        setOtherUser({
          id: conversationId,
          display_name: conversation.name || 'Chat Público',
          username: conversation.description || 'Chat público',
          avatar_url: conversation.photo_url || ''
        });
        setChatPhoto(conversation.photo_url || null);
        return;
      }

      // Check if the other user has left the conversation
      let hasUserLeft = false;
      
      // For private chats that are 1-on-1, get the other participant
      if (isOneOnOne || participantCount === 1) {
        // First try to get from active participants
        const { data: participantRows, error: participantsError } = await supabase
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', conversationId)
          .neq('user_id', user.id);

        if (participantsError) throw participantsError;

        let otherId = participantRows?.[0]?.user_id;
        
        // If no active participants (user left), get from message history
        if (!otherId) {
          hasUserLeft = true;
          const { data: messages, error: messagesError } = await supabase
            .from('messages')
            .select('sender_id')
            .eq('conversation_id', conversationId)
            .neq('sender_id', user.id)
            .not('message_type', 'eq', 'system')
            .limit(1);

          if (!messagesError && messages?.length > 0) {
            otherId = messages[0].sender_id;
          }
        }

        if (otherId) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, display_name, username, avatar_url')
            .eq('id', otherId)
            .maybeSingle();

          if (profileError) throw profileError;

          if (profile) {
            setOtherUser({
              id: profile.id,
              display_name: profile.display_name as any,
              username: profile.username as any,
              avatar_url: profile.avatar_url as any,
              hasLeft: hasUserLeft
            } as any);
            setChatPhoto(null); // No custom photo for 1-on-1 chats
          }
        }
        return;
      }

      // For private groups with multiple participants, check if it has custom name and photo
      if (conversation?.name || participantCount > 2) {
        // This is a private group with custom name or multiple participants
        setOtherUser({
          id: conversationId,
          display_name: conversation.name || 'Grupo Privado',
          username: conversation.description || `${participantCount} participantes`,
          avatar_url: conversation.photo_url || ''
        });
        setChatPhoto(conversation.photo_url || null);
        return;
      }
    } catch (error) {
      console.error('Error fetching conversation info:', error);
    }
  };

  // Reset scroll state when conversation changes
  useEffect(() => {
    setHasInitialScrolled(false);
  }, [conversationId]);

  // Realtime profile updates for the other participant
  useEffect(() => {
    if (!otherUser || isPublicChat) return;

    const channel = supabase
      .channel(`profile_updates:${otherUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${otherUser.id}`,
        },
        (payload) => {
          const updated: any = (payload as any).new;
          setOtherUser(prev => prev ? {
            ...prev,
            display_name: updated.display_name,
            username: updated.username,
            avatar_url: updated.avatar_url,
          } : prev);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [otherUser, isPublicChat]);

  const handleSendMessage = async (messageContent?: string, mediaUrl?: string, mediaType?: string) => {
    const content = messageContent || newMessage.trim();
    if ((!content && !mediaUrl) || sending || !user) return;

    // Clear typing indicator before sending
    await sendTypingIndicator(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    const success = await sendMessage(content, mediaUrl, mediaType, messageReplyTo?.id);
    if (success) {
      setNewMessage('');
      setShowMediaUpload(false);
      setMessageReplyTo(null); // Clear reply when message is sent
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
      const { data: participantData, error } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId);

      if (error) throw error;

      if (participantData && participantData.length > 0) {
        const userIds = participantData.map(p => p.user_id);
        
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .in('id', userIds);

        if (profilesError) throw profilesError;

        const participantsWithProfiles = participantData.map(participant => ({
          user_id: participant.user_id,
          profiles: profiles?.find(p => p.id === participant.user_id)
        }));

        setParticipants(participantsWithProfiles);
      }
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
      // Create a system message about user leaving
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();

      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: `${userProfile?.display_name || 'Usuário'} saiu da conversa`,
          message_type: 'system'
        });

      if (messageError) console.error('Error creating leave message:', messageError);

      // Remove user from conversation participants
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
      const senderName = message.sender_id === user?.id ? 'Você' : stripUserDigits(otherUser?.display_name || 'Usuário');
      setMessageReplyTo({
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
    setMessageReplyTo(null);
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
                
                <Avatar 
                  className="w-10 h-10 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => {
                    if (!isPublicChat && isOneOnOneChat) {
                      navigate(`/user/${stripUserDigits(otherUser.username)}`);
                    }
                  }}
                >
                  <AvatarImage 
                    src={otherUser.avatar_url || ''} 
                    className="object-cover w-full h-full" 
                  />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white font-semibold">
                    {otherUser.display_name ? stripUserDigits(otherUser.display_name)[0] : '?'}
                  </AvatarFallback>
                </Avatar>
                
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-lg">
                      {otherUser?.display_name ? stripUserDigits(otherUser.display_name) : 'Chat'}
                    </h2>
                    {(otherUser as any)?.hasLeft && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border animate-fade-in">
                        Saiu do chat
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isPublicChat ? otherUser?.username : `@${otherUser?.username || ''}`}
                  </p>
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
           ref={(el) => {
             if (el && messages.length > 0 && !hasInitialScrolled) {
               // Posicionar no final das mensagens sem animação
               setTimeout(() => {
                 el.scrollTop = el.scrollHeight;
                 setHasInitialScrolled(true);
               }, 50);
             }
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
                  {otherUser?.display_name ? stripUserDigits(otherUser.display_name)[0] : '🌐'}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-4">
                <h3 className="font-semibold text-xl">{otherUser?.display_name ? stripUserDigits(otherUser.display_name) : ''}</h3>
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
                  {otherUser?.display_name ? stripUserDigits(otherUser.display_name)[0] : '?'}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">{otherUser?.display_name ? stripUserDigits(otherUser.display_name) : ''}</h3>
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
                const isSystemMessage = message.message_type === 'system';

                return (
                  <div key={message.id}>
                    {showDateSeparator && (
                      <div className="flex justify-center my-4">
                        <span className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                          {formatDateSeparator(message.created_at)}
                        </span>
                      </div>
                    )}
                    
                    {/* System messages are rendered differently */}
                    {isSystemMessage ? (
                      <MessageBubble 
                        message={message}
                        isOwnMessage={isOwnMessage}
                        isGroupChat={isPublicChat || !isOneOnOneChat}
                        senderInfo={undefined}
                        onLongPress={() => {}}
                      />
                    ) : (
                      <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} items-start space-x-2`}>
                        {!isOwnMessage && (
                          <div className="relative">
                            <Avatar 
                              className="w-8 h-8 mt-1 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => {
                                 const senderInfo = getSenderInfo(message.sender_id);
                                 if (senderInfo) {
                                   navigate(`/user/${stripUserDigits(senderInfo.username)}`);
                                 }
                               }}
                            >
                              <AvatarImage src={
                                (isPublicChat || !isOneOnOneChat) 
                                  ? getSenderInfo(message.sender_id)?.avatar_url || ''
                                  : otherUser?.avatar_url || ''
                              } />
                               <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs font-semibold">
                                 {((isPublicChat || !isOneOnOneChat) 
                                   ? (getSenderInfo(message.sender_id)?.display_name ? stripUserDigits(getSenderInfo(message.sender_id)?.display_name!)[0] : '?')
                                   : (otherUser?.display_name ? stripUserDigits(otherUser.display_name)[0] : '?')) || '?'}
                               </AvatarFallback>
                            </Avatar>
                            {/* New message indicator next to avatar */}
                            {hasNewMessageFrom(message.sender_id) && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
                            )}
                          </div>
                        )}
                         
                        <div className={`max-w-[70%] ${isOwnMessage ? 'ml-auto' : ''}`}>
                         
                          <MessageBubble 
                            message={message}
                            isOwnMessage={isOwnMessage}
                            isGroupChat={isPublicChat || !isOneOnOneChat}
                            senderInfo={!isOwnMessage ? getSenderInfo(message.sender_id) : undefined}
                              onLongPress={() => {
                                setSelectedMessage(message);
                                setContextMenuOpen(true);
                              }}
                          />
                         </div>
                      </div>
                    )}
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
               {(messageReplyTo || editingMessage) && (
                 <div className="animate-slide-in-right p-4 rounded-2xl bg-gradient-to-r from-muted/50 to-muted/30 border border-muted-foreground/20 backdrop-blur-sm shadow-lg">
                   <div className="flex items-start justify-between gap-3">
                     <div className="flex-1 min-w-0">
                       {messageReplyTo && (
                         <div className="space-y-2">
                           <div className="flex items-center gap-2">
                             <div className="p-1 rounded-full bg-primary/10">
                               <Reply className="w-3 h-3 text-primary" />
                             </div>
                             <p className="text-xs font-semibold text-primary">
                               Respondendo a {messageReplyTo.senderName}
                             </p>
                           </div>
                           <div className="pl-6">
                             <p className="text-sm text-foreground/80 line-clamp-2 leading-relaxed">
                               {messageReplyTo.content.length > 100 
                                 ? `${messageReplyTo.content.substring(0, 100)}...`
                                 : messageReplyTo.content
                               }
                             </p>
                           </div>
                         </div>
                       )}
                       {editingMessage && (
                         <div className="flex items-center gap-2">
                           <div className="p-1 rounded-full bg-accent/10">
                             <Edit className="w-3 h-3 text-accent" />
                           </div>
                           <p className="text-xs font-semibold text-accent">Editando mensagem</p>
                         </div>
                       )}
                     </div>
                     <Button 
                       variant="ghost" 
                       size="sm" 
                       onClick={editingMessage ? handleCancelEdit : handleCancelReply}
                       className="w-8 h-8 p-0 hover:bg-destructive/10 hover:text-destructive transition-colors duration-200"
                     >
                       <X className="w-4 h-4" />
                     </Button>
                   </div>
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
          isOneOnOneChat={isOneOnOneChat}
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
          isOpen={contextMenuOpen}
          onClose={() => {
            setContextMenuOpen(false);
            setSelectedMessage(null);
          }}
          onReply={() => {
            if (selectedMessage) {
              setMessageReplyTo({
                id: selectedMessage.id,
                content: selectedMessage.content || '',
                senderName: selectedMessage.sender_id === user?.id ? 'Você' : stripUserDigits(otherUser?.display_name || 'Usuário')
              });
            }
          }}
          onCopy={() => {
            if (selectedMessage?.content) {
              navigator.clipboard.writeText(selectedMessage.content);
            }
            toast({
              title: "Copiado!",
              description: "Texto da mensagem copiado para a área de transferência.",
            });
          }}
          onDelete={async () => {
            if (!selectedMessage || !user) return;
            
            try {
              const { error } = await supabase
                .from('messages')
                .delete()
                .eq('id', selectedMessage.id)
                .eq('sender_id', user.id);

              if (error) throw error;

              toast({
                title: "Mensagem deletada",
                description: "A mensagem foi removida com sucesso.",
              });
            } catch (error) {
              console.error('Error deleting message:', error);
              toast({
                title: "Erro",
                description: "Não foi possível deletar a mensagem.",
                variant: "destructive",
              });
            }
          }}
          canDelete={selectedMessage?.sender_id === user?.id}
          messageText={selectedMessage?.content || ''}
        />

        {/* Wallpaper Settings Modal */}
        <WallpaperSettings
          isOpen={showWallpaperSettings}
          onClose={() => setShowWallpaperSettings(false)}
          conversationId={conversationId}
          currentWallpaper={currentWallpaper}
          onWallpaperChange={handleWallpaperChange}
        />
      </div>
    );
};

export default Chat;