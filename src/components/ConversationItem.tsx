import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Users, Globe, Eye, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { type Conversation } from '@/hooks/useConversations';
import { useMessageSender } from '@/hooks/useMessageSender';
import { useAuth } from '@/hooks/useAuth';
import { useConversationReadStatus } from '@/hooks/useConversationReadStatus';
import { useLongPress } from '@/hooks/useLongPress';
import { stripUserDigits } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';

interface ConversationItemProps {
  conversation: Conversation;
  onSelect: (id: string) => void;
  formatTimeAgo: (dateString: string) => string;
  formatLastMessage: (message: string | null) => string;
  onLeaveChat?: (conversationId: string) => void;
}

const ConversationItem = ({ conversation, onSelect, formatTimeAgo, formatLastMessage, onLeaveChat }: ConversationItemProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  
  // Check if it's a public chat based on display name
  const isPublicChat = conversation.other_user.display_name.startsWith('🌐');
  // Check if it's a group with custom name
  const isCustomGroup = conversation.other_user.id === 'group' && conversation.other_user.display_name !== 'Novo Chat';
  // Check if message is from current user
  const isOwnMessage = conversation.last_message?.sender_id === user?.id;
  
  // Get read status for this conversation
  const { isAnyoneReading } = useConversationReadStatus(conversation.id);
  
  // Get sender info for messages from other users in groups
  const shouldFetchSender = !isOwnMessage && (isCustomGroup || isPublicChat) && conversation.last_message?.sender_id;
  const { senderInfo } = useMessageSender(shouldFetchSender ? conversation.last_message?.sender_id || null : null);
  
  const getSenderPrefix = () => {
    if (!conversation.last_message) return '';
    
    if (isOwnMessage) {
      return 'Você: ';
    }
    
    // For 1-on-1 chats, show sender name when it's not from current user
    if (!isCustomGroup && !isPublicChat) {
      return `${stripUserDigits(conversation.other_user.display_name)}: `;
    }
    
    // For groups and public chats, show sender name
    if (senderInfo) {
      return `${stripUserDigits(senderInfo.display_name)}: `;
    }
    
    return '';
  };

  const handleLeaveChat = async () => {
    if (!user || !onLeaveChat) return;
    
    try {
      // Remove current user from conversation participants
      const { error } = await supabase
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', conversation.id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Send system message that user left
      await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: user.id,
          content: `👋 ${stripUserDigits(user.display_name || 'Usuário')} deixou a conversa`,
          message_type: 'system'
        });

      toast({
        title: "Você saiu do chat",
        description: "Você foi removido da conversa.",
      });

      onLeaveChat(conversation.id);
      setShowLeaveDialog(false);
    } catch (error) {
      console.error('Error leaving chat:', error);
      toast({
        title: "Erro",
        description: "Não foi possível sair do chat.",
        variant: "destructive",
      });
    }
  };

  const longPressProps = useLongPress({
    onLongPress: () => setShowLeaveDialog(true),
    delay: 600
  });

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>
          <Card 
            key={conversation.id} 
            className="card-shadow border-0 cursor-pointer hover:bg-muted/20 transition-colors select-none"
            onClick={() => onSelect(conversation.id)}
            {...longPressProps}
          >
      <CardContent className="p-4">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Avatar 
              className="w-12 h-12 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                if (!isPublicChat && !isCustomGroup) {
                  navigate(`/user/${stripUserDigits(conversation.other_user.username)}`);
                }
              }}
            >
              {isPublicChat || isCustomGroup ? (
                conversation.other_user.avatar_url ? (
                  <AvatarImage src={conversation.other_user.avatar_url} className="object-cover w-full h-full" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                )
              ) : (
                <>
                  <AvatarImage src={conversation.other_user.avatar_url || ''} className="object-cover w-full h-full" />
                   <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white font-semibold">
                     {stripUserDigits(conversation.other_user.display_name)[0]}
                   </AvatarFallback>
                </>
              )}
            </Avatar>
            {isPublicChat && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                <Globe className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-semibold text-sm truncate flex items-center gap-1">
                {isPublicChat ? (
                  <>
                    <Globe className="w-3 h-3 text-green-500" />
                    {conversation.other_user.display_name.replace('🌐 ', '')}
                  </>
                ) : isCustomGroup ? (
                  <>
                    <Users className="w-3 h-3 text-primary" />
                    {conversation.other_user.display_name}
                  </>
                 ) : (
                   stripUserDigits(conversation.other_user.display_name)
                 )}
                {/* Unread message indicator */}
                {conversation.unread_count > 0 && (
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse ml-2" />
                )}
              </h4>
              {conversation.last_message && (
                <span className="text-xs text-muted-foreground">
                  {formatTimeAgo(conversation.last_message.created_at)}
                </span>
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground truncate">
                {getSenderPrefix()}
                {isPublicChat && !conversation.last_message?.content?.startsWith('🌐')
                  ? 'Chat público'
                  : formatLastMessage(conversation.last_message?.content)
                }
              </p>
              
              <div className="flex items-center gap-2">
                {/* Show reading indicator when someone is currently reading */}
                {isAnyoneReading() && conversation.unread_count === 0 && isOwnMessage && (
                  <div className="flex items-center text-green-500 animate-pulse">
                    <Eye className="w-3 h-3" />
                  </div>
                )}
                
                {conversation.unread_count > 0 && (
                  <div className="relative">
                    <div className="bg-primary text-primary-foreground text-xs font-bold rounded-full min-w-5 h-5 flex items-center justify-center px-1.5 shadow-sm animate-pulse">
                      {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                    </div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => setShowLeaveDialog(true)} className="text-red-600">
            <LogOut className="w-4 h-4 mr-2" />
            Sair do Chat
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair do Chat</AlertDialogTitle>
            <AlertDialogDescription>
              Você será removido desta conversa e não receberá mais notificações. 
              {isPublicChat 
                ? " Você pode entrar novamente a qualquer momento."
                : isCustomGroup 
                  ? " Você precisará ser adicionado novamente para participar."
                  : " A conversa será mantida para a outra pessoa."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveChat}
              className="bg-red-600 hover:bg-red-700"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair do Chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ConversationItem;