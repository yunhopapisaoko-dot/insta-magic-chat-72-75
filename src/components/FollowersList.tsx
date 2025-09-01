import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Search, Users, UserPlus, UserMinus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useFollowersCache } from '@/hooks/useFollowersCache';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { stripUserDigits } from '@/lib/utils';

interface FollowersListProps {
  userId: string;
  type: 'followers' | 'following';
  onBack: () => void;
}

const FollowersList = ({ userId, type, onBack }: FollowersListProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { followers, following, followersLoading, followingLoading } = useFollowersCache(userId);
  const [searchQuery, setSearchQuery] = useState('');
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set());
  const [followLoading, setFollowLoading] = useState<Set<string>>(new Set());

  const users = type === 'followers' ? followers : following;
  const loading = type === 'followers' ? followersLoading : followingLoading;

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    return users.filter(u => 
      u.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  // Check if current user follows these users
  React.useEffect(() => {
    const checkFollowStatus = async () => {
      if (!user || users.length === 0) return;

      try {
        const { data } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id)
          .in('following_id', users.map(u => u.id));

        const followedIds = new Set(data?.map(f => f.following_id) || []);
        setFollowedUsers(followedIds);
      } catch (error) {
        console.error('Error checking follow status:', error);
      }
    };

    checkFollowStatus();
  }, [user, users]);

  const handleFollow = async (targetUserId: string) => {
    if (!user) return;

    setFollowLoading(prev => new Set([...prev, targetUserId]));
    
    try {
      const isFollowing = followedUsers.has(targetUserId);

      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId);

        if (error) throw error;

        setFollowedUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(targetUserId);
          return newSet;
        });

        toast({
          title: "Deixou de seguir",
          description: "Usuário removido da sua lista de seguidos",
        });
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: targetUserId,
          });

        if (error) throw error;

        setFollowedUsers(prev => new Set([...prev, targetUserId]));

        toast({
          title: "Seguindo",
          description: "Usuário adicionado à sua lista de seguidos",
        });
      }
    } catch (error) {
      console.error('Error following/unfollowing:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status de seguir",
        variant: "destructive",
      });
    } finally {
      setFollowLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(targetUserId);
        return newSet;
      });
    }
  };

  const handleUserClick = (username: string) => {
    navigate(`/user/${username}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="p-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">
            {type === 'followers' ? 'Seguidores' : 'Seguindo'} ({users.length})
          </h2>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Buscar usuários..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 rounded-xl"
        />
      </div>

      {/* Users List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="card-shadow border-0 animate-pulse">
              <CardContent className="p-4">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                  <div className="w-20 h-8 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <Card className="card-shadow border-0">
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? 'Nenhum usuário encontrado' : `Nenhum ${type === 'followers' ? 'seguidor' : 'seguido'}`}
            </h3>
            <p className="text-muted-foreground">
              {searchQuery 
                ? 'Tente buscar por outro nome' 
                : type === 'followers' 
                  ? 'Ainda não há seguidores' 
                  : 'Ainda não segue ninguém'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((followUser) => (
            <Card key={followUser.id} className="card-shadow border-0 hover:shadow-lg transition-all duration-200 cursor-pointer">
              <CardContent className="p-4" onClick={() => handleUserClick(followUser.username)}>
                <div className="flex items-center space-x-4">
                  <Avatar className="w-12 h-12 hover:scale-105 transition-transform">
                    <AvatarImage src={followUser.avatar_url || ''} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white font-semibold">
                      {stripUserDigits(followUser.display_name)[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate hover:text-primary transition-colors">
                      {stripUserDigits(followUser.display_name)}
                    </h3>
                    <p className="text-sm text-muted-foreground hover:text-primary/80 transition-colors">
                      @{stripUserDigits(followUser.username)}
                    </p>
                    {followUser.bio && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {followUser.bio}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {followUser.followers_count} seguidores
                    </p>
                  </div>
                  
                  {user && user.id !== followUser.id && (
                    <Button
                      size="sm"
                      variant={followedUsers.has(followUser.id) ? "outline" : "default"}
                      disabled={followLoading.has(followUser.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFollow(followUser.id);
                      }}
                      className={`transition-all ${followedUsers.has(followUser.id) 
                        ? "border-primary text-primary hover:bg-primary/10" 
                        : "magic-button"
                      }`}
                    >
                      {followLoading.has(followUser.id) ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                      ) : followedUsers.has(followUser.id) ? (
                        <>
                          <UserMinus className="w-4 h-4 mr-1" />
                          Seguindo
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 mr-1" />
                          Seguir
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FollowersList;