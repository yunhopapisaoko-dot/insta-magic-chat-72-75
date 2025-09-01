import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Users, MessageCircle, Plus, Camera, Globe } from 'lucide-react';
import MediaUpload from '@/components/MediaUpload';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { stripUserDigits } from '@/lib/utils';

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
  const [chatDescription, setChatDescription] = useState('');
  const [chatImageUrl, setChatImageUrl] = useState<string>('');
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
      let finalPhotoUrl = null;
      
      // Upload photo if selected
      if (chatImageUrl && chatImageUrl.startsWith('blob:')) {
        try {
          // Convert blob URL to file
          const response = await fetch(chatImageUrl);
          const blob = await response.blob();
          const file = new File([blob], `chat-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
          
          // Upload to Supabase storage
          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}-${Date.now()}.${fileExt}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('chat-photos')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('chat-photos')
            .getPublicUrl(fileName);
            
          finalPhotoUrl = publicUrl;
        } catch (uploadError) {
          console.error('Error uploading chat photo:', uploadError);
          toast({
            title: "Aviso",
            description: "Não foi possível fazer upload da foto, mas o chat foi criado.",
            variant: "default",
          });
        }
      } else if (chatImageUrl) {
        finalPhotoUrl = chatImageUrl;
      }

      // Create conversation with metadata
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          creator_id: user.id,
          is_public: chatType === 'public',
          name: chatName,
          description: chatDescription,
          photo_url: finalPhotoUrl
        })
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

      // Add selected users to conversation (for private chats)
      if (chatType === 'private' && selectedUsers.size > 0) {
        const participants = Array.from(selectedUsers).map(userId => ({
          conversation_id: conversation.id,
          user_id: userId,
        }));

        const { error: participantsError } = await supabase
          .from('conversation_participants')
          .insert(participants);

        if (participantsError) throw participantsError;
      }

      // Store chat metadata without sending an automatic message
      // Chat info will be stored when first real message is sent

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
    setChatDescription('');
    setChatImageUrl('');
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
            <div className="space-y-6 py-4">
              {chatType === 'public' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold mb-2">Configuração do Chat Público</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure as informações do seu grupo público
                    </p>
                  </div>

                  {/* Foto de Capa */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Foto de Capa</Label>
                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center overflow-hidden border-2 border-dashed border-muted-foreground/30">
                        {chatImageUrl ? (
                          <img src={chatImageUrl} alt="Foto de Capa" className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <Camera className="w-8 h-8 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const url = URL.createObjectURL(file);
                              setChatImageUrl(url);
                            }
                          }}
                          className="hidden"
                          id="group-cover-upload"
                        />
                        <label htmlFor="group-cover-upload">
                          <Button variant="outline" size="sm" type="button" asChild>
                            <span className="cursor-pointer">
                              <Camera className="w-4 h-4 mr-2" />
                              {chatImageUrl ? 'Alterar Foto' : 'Escolher Foto'}
                            </span>
                          </Button>
                        </label>
                      </div>
                      {chatImageUrl && (
                        <p className="text-xs text-muted-foreground text-center">
                          Prévia da foto de capa do grupo
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Nome do Grupo */}
                  <div className="space-y-2">
                    <Label htmlFor="group-name" className="text-sm font-medium">
                      Nome do Grupo <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="group-name"
                      placeholder="Digite o nome do grupo..."
                      value={chatName}
                      onChange={(e) => setChatName(e.target.value)}
                      maxLength={50}
                      className="h-11"
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-muted-foreground">
                        Campo obrigatório
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {chatName.length}/50
                      </p>
                    </div>
                  </div>

                  {/* Descrição */}
                  <div className="space-y-2">
                    <Label htmlFor="group-description" className="text-sm font-medium">
                      Descrição
                    </Label>
                    <Textarea
                      id="group-description"
                      placeholder="Descreva sobre o que é este grupo... (opcional)"
                      value={chatDescription}
                      onChange={(e) => setChatDescription(e.target.value)}
                      maxLength={200}
                      rows={4}
                      className="resize-none"
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-muted-foreground">
                        Campo opcional
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {chatDescription.length}/200
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start space-x-3">
                      <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                          Chat Público
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          Qualquer pessoa poderá encontrar e participar deste grupo. As mensagens serão visíveis para todos os membros.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {chatType === 'private' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold mb-2">Configuração do Chat Privado</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure as informações do seu chat privado
                    </p>
                  </div>

                  {/* Foto de Capa para Chat Privado */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Foto de Capa</Label>
                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-secondary to-accent flex items-center justify-center overflow-hidden border-2 border-dashed border-muted-foreground/30">
                        {chatImageUrl ? (
                          <img src={chatImageUrl} alt="Foto de Capa" className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <Camera className="w-8 h-8 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const url = URL.createObjectURL(file);
                              setChatImageUrl(url);
                            }
                          }}
                          className="hidden"
                          id="private-chat-cover-upload"
                        />
                        <label htmlFor="private-chat-cover-upload">
                          <Button variant="outline" size="sm" type="button" asChild>
                            <span className="cursor-pointer">
                              <Camera className="w-4 h-4 mr-2" />
                              {chatImageUrl ? 'Alterar Foto' : 'Escolher Foto'}
                            </span>
                          </Button>
                        </label>
                      </div>
                      {chatImageUrl && (
                        <p className="text-xs text-muted-foreground text-center">
                          Prévia da foto de capa do chat
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Nome do Chat */}
                  <div className="space-y-2">
                    <Label htmlFor="private-chat-name" className="text-sm font-medium">
                      Nome do Chat <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="private-chat-name"
                      placeholder="Digite o nome do chat..."
                      value={chatName}
                      onChange={(e) => setChatName(e.target.value)}
                      maxLength={50}
                      className="h-11"
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-muted-foreground">
                        Campo obrigatório
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {chatName.length}/50
                      </p>
                    </div>
                  </div>

                  {/* Descrição */}
                  <div className="space-y-2">
                    <Label htmlFor="private-chat-description" className="text-sm font-medium">
                      Descrição
                    </Label>
                    <Textarea
                      id="private-chat-description"
                      placeholder="Descreva sobre o que é este chat... (opcional)"
                      value={chatDescription}
                      onChange={(e) => setChatDescription(e.target.value)}
                      maxLength={200}
                      rows={4}
                      className="resize-none"
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-muted-foreground">
                        Campo opcional
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {chatDescription.length}/200
                      </p>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start space-x-3">
                      <MessageCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">
                          Chat Privado
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          Apenas pessoas convidadas poderão participar deste chat. As mensagens serão visíveis apenas para os membros.
                        </p>
                      </div>
                    </div>
                  </div>
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
                             {stripUserDigits(profile.display_name)[0]}
                           </AvatarFallback>
                         </Avatar>
                         <div className="flex-1 min-w-0">
                           <p className="font-medium text-sm truncate">
                             {stripUserDigits(profile.display_name)}
                           </p>
                          <p className="text-xs text-muted-foreground truncate">
                            @{stripUserDigits(profile.username)}
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
            ) : step === 'details' && chatType === 'public' ? (
              'Criar Grupo'
            ) : (
              'Próximo'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};