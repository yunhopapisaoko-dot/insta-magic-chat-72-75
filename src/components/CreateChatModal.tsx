import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Users, MessageCircle, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface CreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChatCreated: (chatId: string) => void;
}

interface Profile {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
}

export const CreateChatModal = ({ isOpen, onClose, onChatCreated }: CreateChatModalProps) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'type' | 'details' | 'invite'>('type');
  const [chatType, setChatType] = useState<'public' | 'private'>('public');
  const [chatName, setChatName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch all users for inviting
  useEffect(() => {
    if (step === 'invite' && isOpen) {
      fetchProfiles();
    }
  }, [step, isOpen]);

  const fetchProfiles = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .neq('id', user.id);

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os usuários.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredProfiles = profiles.filter(profile =>
    profile.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUserToggle = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const createChat = async () => {
    if (!user || !chatName.trim()) return;

    setIsCreating(true);
    try {
      // Create conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({})
        .select()
        .single();

      if (convError) throw convError;

      // Add current user to conversation
      const { error: participantError } = await supabase
        .from('conversation_participants')
        .insert({
          conversation_id: conversation.id,
          user_id: user.id,
        });

      if (participantError) throw participantError;

      // Add selected users to conversation
      if (selectedUsers.size > 0) {
        const participants = Array.from(selectedUsers).map(userId => ({
          conversation_id: conversation.id,
          user_id: userId,
        }));

        const { error: participantsError } = await supabase
          .from('conversation_participants')
          .insert(participants);

        if (participantsError) throw participantsError;
      }

      // Send initial message with chat name/purpose
      const initialMessage = chatType === 'public' 
        ? `Chat público "${chatName}" criado!`
        : `Chat privado "${chatName}" criado!`;

      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: user.id,
          content: initialMessage,
        });

      if (messageError) throw messageError;

      toast({
        title: "Sucesso",
        description: `${chatType === 'public' ? 'Chat público' : 'Chat privado'} criado com sucesso!`,
      });

      onChatCreated(conversation.id);
      handleClose();
    } catch (error) {
      console.error('Error creating chat:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o chat.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setStep('type');
    setChatType('public');
    setChatName('');
    setSearchTerm('');
    setSelectedUsers(new Set());
    onClose();
  };

  const handleNext = () => {
    if (step === 'type') {
      setStep('details');
    } else if (step === 'details') {
      if (chatType === 'private') {
        setStep('invite');
      } else {
        // For public chats, create immediately
        createChat();
      }
    }
  };

  const canProceed = () => {
    if (step === 'details') {
      return chatName.trim().length > 0;
    }
    return true;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            {step === 'type' && 'Criar Chat'}
            {step === 'details' && 'Detalhes do Chat'}
            {step === 'invite' && 'Convidar Pessoas'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === 'type' && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Escolha o tipo de chat que deseja criar:
              </p>
              
              <div className="space-y-3">
                <Card 
                  className={`cursor-pointer transition-colors ${
                    chatType === 'public' ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setChatType('public')}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">Chat Público</h3>
                        <p className="text-sm text-muted-foreground">
                          Qualquer pessoa pode participar
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className={`cursor-pointer transition-colors ${
                    chatType === 'private' ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setChatType('private')}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-accent flex items-center justify-center">
                        <MessageCircle className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">Chat Privado</h3>
                        <p className="text-sm text-muted-foreground">
                          Apenas pessoas convidadas
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {step === 'details' && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="chat-name">Nome do Chat</Label>
                <Input
                  id="chat-name"
                  placeholder={`Nome do chat ${chatType === 'public' ? 'público' : 'privado'}...`}
                  value={chatName}
                  onChange={(e) => setChatName(e.target.value)}
                  maxLength={50}
                />
                <p className="text-xs text-muted-foreground">
                  {chatName.length}/50 caracteres
                </p>
              </div>
              
              {chatType === 'public' && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    💡 Chats públicos aparecem na lista para todos os usuários participarem
                  </p>
                </div>
              )}
              
              {chatType === 'private' && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    🔒 Chats privados são visíveis apenas para pessoas convidadas
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 'invite' && (
            <div className="space-y-4 py-4 flex-1 overflow-hidden flex flex-col">
              <div className="space-y-2">
                <Label>Convidar Pessoas</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar usuários..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {selectedUsers.size > 0 && (
                <div className="text-sm text-muted-foreground">
                  {selectedUsers.size} pessoa(s) selecionada(s)
                </div>
              )}

              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-2">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : filteredProfiles.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchTerm ? 'Nenhum usuário encontrado' : 'Nenhum usuário disponível'}
                    </div>
                  ) : (
                    filteredProfiles.map((profile) => (
                      <div 
                        key={profile.id}
                        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleUserToggle(profile.id)}
                      >
                        <Checkbox
                          checked={selectedUsers.has(profile.id)}
                          onChange={() => handleUserToggle(profile.id)}
                        />
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={profile.avatar_url || ''} />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs">
                            {profile.display_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {profile.display_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            @{profile.username}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={step === 'type' ? handleClose : () => setStep(step === 'invite' ? 'details' : 'type')}
          >
            {step === 'type' ? 'Cancelar' : 'Voltar'}
          </Button>
          
          <Button 
            onClick={step === 'invite' ? createChat : handleNext}
            disabled={!canProceed() || isCreating}
          >
            {isCreating ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Criando...
              </div>
            ) : step === 'invite' ? (
              'Criar Chat'
            ) : (
              'Próximo'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};