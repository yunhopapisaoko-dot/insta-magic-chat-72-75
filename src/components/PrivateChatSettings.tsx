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
import { MessageCircle, User, Calendar, Users, Plus, MoreHorizontal, Check, X, Edit, Camera, Upload, Trash2, UserPlus, Palette } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { WallpaperSettings } from '@/components/WallpaperSettings';
import { useAuth } from '@/hooks/useAuth';

interface PrivateChatSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
}

interface User {
  id: string;
  display_name: string;
  avatar_url?: string;
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

export const PrivateChatSettings = ({ isOpen, onClose, conversationId }: PrivateChatSettingsProps) => {
  const { user } = useAuth();
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
  const [showWallpaperSettings, setShowWallpaperSettings] = useState(false);
  const [showAllParticipants, setShowAllParticipants] = useState(false);
  const [participantSearchQuery, setParticipantSearchQuery] = useState('');
  const [currentWallpaper, setCurrentWallpaper] = useState<{
    type: 'color' | 'image';
    value: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen && conversationId) {
      fetchChatInfo();
      fetchParticipants();
      loadWallpaper();
    }
  }, [isOpen, conversationId]);

  const loadWallpaper = () => {
    const userId = user?.id;
    if (!userId || !conversationId) return;
    
    const wallpaperKey = `wallpaper_${userId}_${conversationId}`;
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

  const fetchChatInfo = async () => {
    try {
      setLoading(true);
      
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select(`
          name,
          description,
          creator_id,
          created_at,
          photo_url,
          profiles:creator_id (
            display_name,
            avatar_url
          )
        `)
        .eq('id', conversationId)
        .single();

      if (convError) throw convError;

      if (conversation) {
        setChatInfo({
          name: conversation.name || 'Chat Privado',
          description: conversation.description || '',
          creatorId: conversation.creator_id,
          creatorName: (conversation.profiles as any)?.display_name || 'Usuário',
          creatorAvatar: (conversation.profiles as any)?.avatar_url,
          createdAt: conversation.created_at
        });
        
        setChatPhoto(conversation.photo_url);
        setEditName(conversation.name || '');
        setEditDescription(conversation.description || '');
        setEditPhoto(conversation.photo_url);
      }
    } catch (error) {
      console.error('Error fetching chat info:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as informações do chat.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from('conversation_participants')
        .select(`
          user_id,
          joined_at
        `)
        .eq('conversation_id', conversationId);

      if (error) throw error;

      // Get profiles separately to avoid relation issues
      if (data && data.length > 0) {
        const userIds = data.map(p => p.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .in('id', userIds);

        if (profilesError) throw profilesError;

        // Map participants with their profiles
        const participantsWithProfiles = data.map(participant => ({
          user_id: participant.user_id,
          profiles: profiles?.find(p => p.id === participant.user_id)
        }));

        setParticipants(participantsWithProfiles);
      } else {
        setParticipants([]);
      }
    } catch (error) {
      console.error('Error fetching participants:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os participantes.",
        variant: "destructive",
      });
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      setLoading(true);

      const participantIds = participants.map(p => p.user_id);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .not('id', 'in', `(${participantIds.join(',')})`);

      if (error) throw error;
      setAvailableUsers(data || []);
    } catch (error) {
      console.error('Error fetching available users:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os usuários disponíveis.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addParticipants = async () => {
    if (selectedUsers.size === 0) return;

    try {
      setLoading(true);
      
      const participantData = Array.from(selectedUsers).map(userId => ({
        conversation_id: conversationId,
        user_id: userId
      }));

      const { error } = await supabase
        .from('conversation_participants')
        .insert(participantData);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `${selectedUsers.size} pessoa(s) adicionada(s) ao chat.`,
      });

      setSelectedUsers(new Set());
      setShowAddUsers(false);
      fetchParticipants();
    } catch (error) {
      console.error('Error adding participants:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar os participantes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const removeParticipant = async (userId: string) => {
    if (userId === user?.id) {
      toast({
        title: "Erro",
        description: "Você não pode se remover do chat.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Participante removido do chat.",
      });

      fetchParticipants();
    } catch (error) {
      console.error('Error removing participant:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o participante.",
        variant: "destructive",
      });
    }
  };

  const updateChatInfo = async () => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('conversations')
        .update({
          name: editName.trim() || null,
          description: editDescription.trim() || null,
          photo_url: editPhoto
        })
        .eq('id', conversationId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Informações do chat atualizadas.",
      });

      setIsEditingInfo(false);
      fetchChatInfo();
    } catch (error) {
      console.error('Error updating chat info:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar as informações.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteChat = async () => {
    try {
      setIsDeleting(true);

      // Remove all participants first
      const { error: participantsError } = await supabase
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', conversationId);

      if (participantsError) throw participantsError;

      // Delete all messages
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);

      if (messagesError) throw messagesError;

      // Delete the conversation
      const { error: conversationError } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (conversationError) throw conversationError;

      toast({
        title: "Sucesso",
        description: "Chat excluído com sucesso.",
      });

      onClose();
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o chat.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenAddUsers = () => {
    setShowAddUsers(true);
    fetchAvailableUsers();
  };

  const filteredParticipants = participants.filter(participant => {
    const profile = participant.profiles;
    if (!profile) return false;
    
    const searchLower = participantSearchQuery.toLowerCase();
    return (
      profile.display_name.toLowerCase().includes(searchLower) ||
      profile.username.toLowerCase().includes(searchLower)
    );
  });

  const displayedParticipants = showAllParticipants 
    ? filteredParticipants 
    : filteredParticipants.slice(0, 5);

  const remainingCount = filteredParticipants.length - 5;

  const isCreator = user?.id === chatInfo?.creatorId;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Configurações do Chat
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto px-6">
            {loading && !chatInfo ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-6 pb-6">
                {/* Chat Photo & Info */}
                <div className="text-center space-y-4">
                  <div className="relative inline-block">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-secondary to-accent flex items-center justify-center overflow-hidden border-4 border-background shadow-lg">
                      {chatPhoto ? (
                        <img src={chatPhoto} alt="Chat" className="w-full h-full object-cover" />
                      ) : (
                        <MessageCircle className="w-10 h-10 text-white" />
                      )}
                    </div>
                    
                    {isCreator && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="absolute bottom-0 right-0 rounded-full w-8 h-8 p-0"
                        onClick={() => setIsEditingInfo(true)}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold">{chatInfo?.name || 'Chat Privado'}</h3>
                    {chatInfo?.description && (
                      <p className="text-sm text-muted-foreground mt-1">{chatInfo.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Chat privado • {participants.length} participante{participants.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Chat Actions */}
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => setShowWallpaperSettings(true)}
                  >
                    <Palette className="w-4 h-4 mr-3" />
                    Papel de Parede
                  </Button>
                </div>

                <Separator />

                {/* Participants Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Participantes ({participants.length})</h4>
                    {isCreator && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleOpenAddUsers}
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Adicionar
                      </Button>
                    )}
                  </div>

                  {showAllParticipants && (
                    <div className="relative">
                      <Input
                        placeholder="Buscar participantes..."
                        value={participantSearchQuery}
                        onChange={(e) => setParticipantSearchQuery(e.target.value)}
                        className="mb-4"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    {displayedParticipants.map((participant) => {
                      const profile = participant.profiles;
                      if (!profile) return null;

                      return (
                        <div key={participant.user_id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                          <div className="flex items-center space-x-3">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={profile.avatar_url || ''} />
                              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-sm">
                                {profile.display_name[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{profile.display_name}</p>
                              <p className="text-xs text-muted-foreground">@{profile.username}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {participant.user_id === chatInfo?.creatorId && (
                              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                                Criador
                              </span>
                            )}
                            
                            {isCreator && participant.user_id !== user?.id && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem 
                                    onClick={() => removeParticipant(participant.user_id)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Remover
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {!showAllParticipants && remainingCount > 0 && (
                      <Button
                        variant="ghost"
                        className="w-full"
                        onClick={() => setShowAllParticipants(true)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Ver mais {remainingCount} participante{remainingCount !== 1 ? 's' : ''}
                      </Button>
                    )}

                    {showAllParticipants && (
                      <Button
                        variant="ghost"
                        className="w-full"
                        onClick={() => {
                          setShowAllParticipants(false);
                          setParticipantSearchQuery('');
                        }}
                      >
                        Mostrar menos
                      </Button>
                    )}
                  </div>
                </div>

                {/* Creator Actions */}
                {isCreator && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="w-full">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir Chat
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Chat</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. O chat será permanentemente excluído para todos os participantes.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={deleteChat}
                              disabled={isDeleting}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {isDeleting ? 'Excluindo...' : 'Excluir'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Users Dialog */}
      <Dialog open={showAddUsers} onOpenChange={setShowAddUsers}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Pessoas</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <ScrollArea className="h-60">
              <div className="space-y-2">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : availableUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Todos os usuários já estão no chat
                  </div>
                ) : (
                  availableUsers.map((user) => (
                    <div 
                      key={user.id}
                      className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
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
                        onChange={() => {}}
                      />
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={user.avatar_url || ''} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs">
                          {user.display_name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{user.display_name}</p>
                        <p className="text-xs text-muted-foreground">@{user.username}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setShowAddUsers(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={addParticipants}
                disabled={selectedUsers.size === 0 || loading}
              >
                Adicionar ({selectedUsers.size})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Chat Info Dialog */}
      <Dialog open={isEditingInfo} onOpenChange={setIsEditingInfo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Chat</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome do Chat</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nome do chat..."
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Descrição do chat..."
                maxLength={200}
                rows={3}
              />
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setIsEditingInfo(false)}>
                Cancelar
              </Button>
              <Button onClick={updateChatInfo} disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Wallpaper Settings */}
      <WallpaperSettings
        isOpen={showWallpaperSettings}
        onClose={() => setShowWallpaperSettings(false)}
        conversationId={conversationId}
        currentWallpaper={currentWallpaper}
        onWallpaperChange={(wallpaper) => setCurrentWallpaper(wallpaper)}
      />
    </>
  );
};