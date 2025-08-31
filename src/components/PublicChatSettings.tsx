import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { Globe, User, Calendar, Users, Plus, MoreHorizontal, Check, X, Edit, Camera, Upload, Trash2 } from 'lucide-react';
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

interface Profile {
  id: string;
  display_name: string;
  username: string;
  avatar_url?: string;
}

export const PublicChatSettings = ({ isOpen, onClose, conversationId }: PublicChatSettingsProps) => {
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddUsers, setShowAddUsers] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPhoto, setEditPhoto] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [chatPhoto, setChatPhoto] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen && conversationId) {
      fetchChatInfo();
      fetchParticipants();
    }
  }, [isOpen, conversationId]);

  useEffect(() => {
    if (chatInfo) {
      setEditName(chatInfo.name);
      setEditDescription(chatInfo.description);
    }
  }, [chatInfo]);

  const fetchChatInfo = async () => {
    setLoading(true);
    try {
      // Get the initial message that contains chat info
      const { data: messages, error } = await supabase
        .from('messages')
        .select(`
          content,
          sender_id,
          created_at
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
        
        // Extract chat photo if it exists
        const photoMatch = message.content?.match(/📷 (.+)/);
        const photoUrl = photoMatch ? photoMatch[1].trim() : null;
        setChatPhoto(photoUrl);
        
        // Get creator profile separately
        const { data: creatorProfile } = await supabase
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('id', message.sender_id)
          .single();
        
        setChatInfo({
          name: chatName,
          description: description,
          creatorId: message.sender_id,
          creatorName: creatorProfile?.display_name || 'Usuário',
          creatorAvatar: creatorProfile?.avatar_url,
          createdAt: message.created_at
        });
      } else {
        // If no initial message found, show basic info
        setChatInfo({
          name: 'Chat Público',
          description: '',
          creatorId: '',
          creatorName: 'Usuário',
          creatorAvatar: '',
          createdAt: new Date().toISOString()
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

  const fetchAvailableUsers = async () => {
    try {
      const participantIds = participants.map(p => p.user_id);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .not('id', 'in', `(${participantIds.join(',')})`)
        .limit(50);

      if (error) throw error;
      setAvailableUsers(data || []);
    } catch (error) {
      console.error('Error fetching available users:', error);
    }
  };

  const handleAddUsers = async () => {
    if (selectedUsers.size === 0) return;

    try {
      const newParticipants = Array.from(selectedUsers).map(userId => ({
        conversation_id: conversationId,
        user_id: userId,
      }));

      const { error } = await supabase
        .from('conversation_participants')
        .insert(newParticipants);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `${selectedUsers.size} pessoa(s) adicionada(s) ao chat.`,
      });

      setSelectedUsers(new Set());
      setShowAddUsers(false);
      fetchParticipants();
    } catch (error) {
      console.error('Error adding users:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar os usuários.",
        variant: "destructive",
      });
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Simple base64 conversion for now - in a real app you'd upload to storage
    setPhotoUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setEditPhoto(result);
        setPhotoUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading photo:', error);
      setPhotoUploading(false);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a foto.",
        variant: "destructive",
      });
    }
  };

  const handleRemovePhoto = () => {
    setEditPhoto(null);
    setChatPhoto(null);
  };

  const handleSaveInfo = async () => {
    if (!chatInfo || !editName.trim()) return;

    try {
      // Since we don't have a dedicated chat info table, we'll update the first message
      const { data: messages } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .ilike('content', '%🌐 Chat Público%')
        .order('created_at', { ascending: true })
        .limit(1);

      if (messages && messages.length > 0) {
        let newContent = `🌐 Chat Público: "${editName}" criado!`;
        if (editDescription.trim()) {
          newContent += `\n📝 ${editDescription}`;
        }
        if (editPhoto) {
          newContent += `\n📷 ${editPhoto}`;
          setChatPhoto(editPhoto);
          setEditPhoto(null);
        }

        const { error } = await supabase
          .from('messages')
          .update({ content: newContent })
          .eq('id', messages[0].id);

        if (error) throw error;

        setChatInfo({
          ...chatInfo,
          name: editName,
          description: editDescription
        });

        toast({
          title: "Sucesso",
          description: "Informações do chat atualizadas.",
        });
      }

      setIsEditingInfo(false);
    } catch (error) {
      console.error('Error updating chat info:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar as informações.",
        variant: "destructive",
      });
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

  const handleDeleteChat = async () => {
    setIsDeleting(true);
    try {
      // Delete all messages from the conversation
      await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);

      // Delete all participants
      await supabase
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', conversationId);

      // Delete the conversation itself
      await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      toast({
        title: "Chat deletado",
        description: "O chat público foi deletado com sucesso.",
      });

      onClose();
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast({
        title: "Erro",
        description: "Não foi possível deletar o chat.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
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
              <div className="relative w-20 h-20 mx-auto">
                <Avatar className="w-20 h-20">
                  {chatPhoto || editPhoto ? (
                    <AvatarImage src={editPhoto || chatPhoto || ''} className="object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                      <Globe className="w-10 h-10 text-white" />
                    </div>
                  )}
                </Avatar>
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Informações do Chat</h3>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setIsEditingInfo(true)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              {isEditingInfo ? (
                <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Foto do Chat</label>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-16 h-16">
                        {editPhoto ? (
                          <AvatarImage src={editPhoto} className="object-cover" />
                        ) : chatPhoto ? (
                          <AvatarImage src={chatPhoto} className="object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                            <Globe className="w-8 h-8 text-white" />
                          </div>
                        )}
                      </Avatar>
                      <div className="flex-1 space-y-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                          id="chat-photo-upload"
                        />
                        <label htmlFor="chat-photo-upload">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full cursor-pointer"
                            disabled={photoUploading}
                            asChild
                          >
                            <span>
                              {photoUploading ? (
                                <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin mr-2" />
                              ) : (
                                <Camera className="w-3 h-3 mr-2" />
                              )}
                              {photoUploading ? 'Enviando...' : 'Alterar Foto'}
                            </span>
                          </Button>
                        </label>
                        {(editPhoto || chatPhoto) && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleRemovePhoto}
                            className="w-full text-red-600 hover:text-red-700"
                          >
                            <X className="w-3 h-3 mr-2" />
                            Remover Foto
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Nome do Chat</label>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Nome do chat..."
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Descrição</label>
                    <Textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Descrição do chat..."
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveInfo} className="flex-1">
                      <Check className="w-3 h-3 mr-1" />
                      Salvar
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        setIsEditingInfo(false);
                        setEditName(chatInfo?.name || '');
                        setEditDescription(chatInfo?.description || '');
                        setEditPhoto(null);
                      }}
                      className="flex-1"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium mb-1">{chatInfo.name}</p>
                  {chatInfo.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {chatInfo.description}
                    </p>
                  )}
                  {!chatInfo.description && (
                    <p className="text-xs text-muted-foreground italic">
                      Nenhuma descrição
                    </p>
                  )}
                </div>
              )}
            </div>

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
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Participantes ({participants.length})
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddUsers(true);
                    fetchAvailableUsers();
                  }}
                  className="h-8 w-8 p-0"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
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

        {/* Add Users Modal */}
        {showAddUsers && (
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Adicionar Participantes</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddUsers(false);
                  setSelectedUsers(new Set());
                }}
                className="h-6 w-6 p-0"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (selectedUsers.size === availableUsers.length) {
                    setSelectedUsers(new Set());
                  } else {
                    setSelectedUsers(new Set(availableUsers.map(u => u.id)));
                  }
                }}
                className="text-xs"
              >
                {selectedUsers.size === availableUsers.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </Button>
              
              {selectedUsers.size > 0 && (
                <Button
                  size="sm"
                  onClick={handleAddUsers}
                  className="text-xs"
                >
                  Adicionar ({selectedUsers.size})
                </Button>
              )}
            </div>

            <ScrollArea className="max-h-32">
              <div className="space-y-2">
                {availableUsers.map((user) => (
                  <div 
                    key={user.id}
                    className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                    onClick={() => {
                      const newSelected = new Set(selectedUsers);
                      if (newSelected.has(user.id)) {
                        newSelected.delete(user.id);
                      } else {
                        newSelected.add(user.id);
                      }
                      setSelectedUsers(newSelected);
                    }}
                  >
                    <Checkbox
                      checked={selectedUsers.has(user.id)}
                    />
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={user.avatar_url || ''} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs">
                        {user.display_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{user.display_name}</p>
                      <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <div className="pt-4 space-y-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                className="w-full"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                {isDeleting ? 'Deletando...' : 'Deletar Chat'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Deletar Chat Público</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja deletar este chat público? Esta ação não pode ser desfeita.
                  Todas as mensagens e participantes serão removidos permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteChat}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Deletar Chat
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          
          <Button onClick={onClose} variant="outline" className="w-full">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};