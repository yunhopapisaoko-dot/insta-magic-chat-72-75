import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Globe, User, Calendar, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PublicChatSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
}

interface ChatInfo {
  name: string;
  description: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string;
  createdAt: string;
}

interface Participant {
  user_id: string;
  profiles?: {
    id: string;
    display_name: string;
    username: string;
    avatar_url?: string;
  };
}

export const PublicChatSettings = ({ isOpen, onClose, conversationId }: PublicChatSettingsProps) => {
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && conversationId) {
      fetchChatInfo();
      fetchParticipants();
    }
  }, [isOpen, conversationId]);

  const fetchChatInfo = async () => {
    setLoading(true);
    try {
      // Get the initial message that contains chat info
      const { data: messages, error } = await supabase
        .from('messages')
        .select(`
          content,
          sender_id,
          created_at,
          profiles:sender_id (
            id,
            display_name,
            username,
            avatar_url
          )
        `)
        .eq('conversation_id', conversationId)
        .ilike('content', '%🌐 Chat Público%')
        .order('created_at', { ascending: true })
        .limit(1);

      if (error) throw error;

      if (messages && messages.length > 0) {
        const message = messages[0];
        
        // Extract chat name and description from the message
        const nameMatch = message.content?.match(/: "([^"]+)"/);
        const chatName = nameMatch ? nameMatch[1] : 'Chat Público';
        
        // Extract description if it exists
        const descriptionMatch = message.content?.match(/📝 (.+)/);
        const description = descriptionMatch ? descriptionMatch[1].trim() : '';
        
        const profile = message.profiles as any;
        
        setChatInfo({
          name: chatName,
          description: description,
          creatorId: message.sender_id,
          creatorName: profile?.display_name || 'Usuário',
          creatorAvatar: profile?.avatar_url,
          createdAt: message.created_at
        });
      }
    } catch (error) {
      console.error('Error fetching chat info:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipants = async () => {
    try {
      // First get participants
      const { data: participantsData, error: participantsError } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId);

      if (participantsError) throw participantsError;

      if (participantsData && participantsData.length > 0) {
        // Then get their profiles
        const userIds = participantsData.map(p => p.user_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .in('id', userIds);

        if (profilesError) throw profilesError;

        // Combine the data
        const combinedData = participantsData.map(participant => ({
          user_id: participant.user_id,
          profiles: profilesData?.find(profile => profile.id === participant.user_id)
        }));

        setParticipants(combinedData);
      }
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading || !chatInfo) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Informações do Chat Público
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Chat Photo and Name */}
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Globe className="w-10 h-10 text-white" />
              </div>
              
              <div>
                <h2 className="text-xl font-semibold">{chatInfo.name}</h2>
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
                  <Globe className="w-3 h-3" />
                  Chat Público
                </p>
              </div>
            </div>

            {/* Description */}
            {chatInfo.description && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Descrição</h3>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {chatInfo.description}
                  </p>
                </div>
              </div>
            )}

            <Separator />

            {/* Creator Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4" />
                Criado por
              </h3>
              
              <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={chatInfo.creatorAvatar || ''} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white font-semibold">
                    {chatInfo.creatorName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium text-sm">{chatInfo.creatorName}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(chatInfo.createdAt)}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Participants */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                Participantes ({participants.length})
              </h3>
              
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {participants.map((participant) => (
                  <div key={participant.user_id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={participant.profiles?.avatar_url || ''} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs">
                        {participant.profiles?.display_name?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {participant.profiles?.display_name || 'Usuário'}
                        {participant.user_id === chatInfo.creatorId && (
                          <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                            Criador
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        @{participant.profiles?.username || 'unknown'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="pt-4">
          <Button onClick={onClose} className="w-full">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};