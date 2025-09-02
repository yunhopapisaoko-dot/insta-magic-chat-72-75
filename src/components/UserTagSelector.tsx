import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, X, Users, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { stripUserDigits } from '@/lib/utils';

interface User {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
}

interface UserTagSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUsers: User[];
  onUsersChange: (users: User[]) => void;
  maxTags?: number;
  onUserSelected?: (user: User) => void;
}

export const UserTagSelector = ({ 
  open, 
  onOpenChange, 
  selectedUsers, 
  onUsersChange,
  maxTags = 10,
  onUserSelected 
}: UserTagSelectorProps) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setUsers([]);
      setHasSearched(false);
      // Carregar usuários seguidos automaticamente
      loadFollowedUsers();
    }
  }, [open]);

  const loadFollowedUsers = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    setHasSearched(true);

    try {
      console.log('Loading followed users for:', user.id);
      
      const { data, error } = await supabase
        .from('follows')
        .select(`
          following_id,
          profiles!follows_following_id_fkey (
            id,
            display_name,
            username,
            avatar_url
          )
        `)
        .eq('follower_id', user.id);

      console.log('Follows query result:', { data, error });

      if (error) throw error;

      // Extrair os perfis dos seguidos
      const followedUsers = data?.map(f => f.profiles).filter(Boolean) as User[];
      console.log('Followed users found:', followedUsers);
      setUsers(followedUsers || []);
    } catch (error) {
      console.error('Error loading followed users:', error);
      toast({
        title: "Erro na busca",
        description: "Não foi possível carregar usuários seguidos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      // Se não tem busca, carrega todos os seguidos
      loadFollowedUsers();
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      console.log('Searching users with query:', query, 'user ID:', user?.id);
      
      // Buscar apenas usuários que seguimos com filtro
      const { data, error } = await supabase
        .from('follows')
        .select(`
          following_id,
          profiles!follows_following_id_fkey (
            id,
            display_name,
            username,
            avatar_url
          )
        `)
        .eq('follower_id', user?.id);

      console.log('Follows query result:', { data, error });

      if (error) throw error;

      // Extrair os perfis dos seguidos e filtrar pelo query
      const followedUsers = data?.map(f => f.profiles).filter(Boolean) as User[];
      const filteredUsers = followedUsers.filter(user => 
        user.display_name?.toLowerCase().includes(query.toLowerCase()) ||
        user.username?.toLowerCase().includes(query.toLowerCase())
      );
      
      console.log('Filtered users found:', filteredUsers);
      setUsers(filteredUsers || []);
    } catch (error) {
      console.error('Error searching users:', error);
      toast({
        title: "Erro na busca",
        description: "Não foi possível buscar usuários",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // Debounce search
    const timeoutId = setTimeout(() => {
      searchUsers(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  const toggleUser = (selectedUser: User) => {
    const isSelected = selectedUsers.some(u => u.id === selectedUser.id);
    
    if (isSelected) {
      onUsersChange(selectedUsers.filter(u => u.id !== selectedUser.id));
    } else {
      if (selectedUsers.length >= maxTags) {
        toast({
          title: "Limite atingido",
          description: `Você pode marcar no máximo ${maxTags} usuários`,
          variant: "destructive",
        });
        return;
      }
      onUsersChange([...selectedUsers, selectedUser]);
      
      // Adicionar @ automaticamente no conteúdo
      onUserSelected?.(selectedUser);
    }
  };

  const removeUser = (userId: string) => {
    onUsersChange(selectedUsers.filter(u => u.id !== userId));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            Marcar pessoas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Buscar por nome ou username..."
              className="pl-10"
            />
          </div>

          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Marcados ({selectedUsers.length}/{maxTags})
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((user) => (
                  <Badge
                    key={user.id}
                    variant="secondary"
                    className="flex items-center gap-2 px-2 py-1"
                  >
                    <Avatar className="w-4 h-4">
                      <AvatarImage src={user.avatar_url || ''} />
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                        {stripUserDigits(user.display_name)[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs">{stripUserDigits(user.display_name)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-4 h-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => removeUser(user.id)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Search Results */}
          <ScrollArea className="h-64">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-sm text-muted-foreground">Buscando...</div>
              </div>
            ) : hasSearched && users.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <Users className="w-8 h-8 text-muted-foreground/50 mb-2" />
                 <p className="text-sm text-muted-foreground">
                   {searchQuery.length < 2 
                     ? "Digite pelo menos 2 caracteres" 
                     : "Nenhum usuário que você segue foi encontrado"
                   }
                 </p>
              </div>
            ) : !hasSearched ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <Search className="w-8 h-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Carregando pessoas que você segue...
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((searchUser) => {
                  const isSelected = selectedUsers.some(u => u.id === searchUser.id);
                  
                  return (
                    <div
                      key={searchUser.id}
                      className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-primary/10 border border-primary/20' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => toggleUser(searchUser)}
                    >
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={searchUser.avatar_url || ''} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-sm font-semibold">
                          {stripUserDigits(searchUser.display_name)[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {stripUserDigits(searchUser.display_name)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {stripUserDigits(searchUser.display_name)}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={() => onOpenChange(false)}>
              Confirmar ({selectedUsers.length})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};