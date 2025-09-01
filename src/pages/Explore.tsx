import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, TrendingUp, Hash, MapPin, Users, UserPlus, UserMinus, MessageCircle } from 'lucide-react';
import MobileLayout from '@/components/MobileLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { useConversations } from '@/hooks/useConversations';
import { stripUserDigits } from '@/lib/utils';

interface Profile {
  id: string;
  username: string;
  display_name: string;
  bio?: string | null;
  avatar_url?: string | null;
  followers_count: number;
  following_count: number;
}

const Explore = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { createOrGetConversation } = useConversations();
  const [searchQuery, setSearchQuery] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState<string | null>(null);

  useEffect(() => {
    fetchProfiles();
    if (user) {
      fetchFollowedUsers();
    }
  }, [user]);

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowedUsers = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      if (error) throw error;
      
      const followedIds = new Set(data?.map(f => f.following_id) || []);
      setFollowedUsers(followedIds);
    } catch (error) {
      console.error('Error fetching follows:', error);
    }
  };

  const handleFollow = async (userId: string) => {
    if (!user) {
      toast({
        title: "Login necessário",
        description: "Faça login para seguir usuários",
        variant: "destructive",
      });
      return;
    }

    try {
      const isFollowing = followedUsers.has(userId);

      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId);

        if (error) throw error;

        setFollowedUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });

        toast({
          title: "Deixou de seguir",
          description: "Usuário removido da sua lista de seguidos",
        });
      } else {
        // Follow
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: userId,
          });

        if (error) throw error;

        setFollowedUsers(prev => new Set([...prev, userId]));

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
    }
  };

  const handleViewProfile = (username: string) => {
    navigate(`/user/${username}`);
  };

  const handleStartChat = async (userId: string, displayName: string) => {
    console.log('handleStartChat called with:', { userId, displayName, currentUser: user?.id });
    
    if (!user) {
      console.log('No user logged in');
      toast({
        title: "Login necessário",
        description: "Faça login para enviar mensagens",
        variant: "destructive",
      });
      return;
    }

    if (userId === user.id) {
      console.log('User trying to chat with themselves');
      toast({
        title: "Ação inválida",
        description: "Você não pode conversar consigo mesmo",
        variant: "destructive",
      });
      return;
    }

    setStartingChat(userId);
    
    try {
      console.log('Creating or getting conversation...');
      const conversationId = await createOrGetConversation(userId);
      console.log('Conversation result:', conversationId);
      
      if (conversationId) {
        toast({
          title: "Conversa iniciada",
          description: `Iniciando conversa com ${displayName}`,
        });
        console.log('Navigating to /messages with conversation:', conversationId);
        navigate(`/messages?chat=${conversationId}`);
      } else {
        console.error('createOrGetConversation returned null');
        throw new Error('Failed to create conversation');
      }
    } catch (error) {
      console.error('Error starting chat:', error);
      toast({
        title: "Erro ao iniciar conversa",
        description: "Não foi possível iniciar a conversa. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setStartingChat(null);
    }
  };

  const filteredProfiles = profiles.filter(profile =>
    profile.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    profile.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <MobileLayout>
      <div className="mobile-container py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full magic-gradient flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Descobrir Pessoas
          </h1>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar pessoas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl border-border"
          />
        </div>

        {/* Users Grid */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="card-shadow border-0 animate-pulse">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-full bg-muted" />
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
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Usuários ({filteredProfiles.length})</h2>
            </div>
            
            {filteredProfiles.length === 0 ? (
              <Card className="card-shadow border-0">
                <CardContent className="p-12 text-center">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum usuário encontrado</h3>
                  <p className="text-muted-foreground">
                    {searchQuery ? 'Tente buscar por outro nome' : 'Seja o primeiro a se cadastrar!'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                 {filteredProfiles.map((profile) => (
                   <Card key={profile.id} className="card-shadow border-0 hover:shadow-lg transition-shadow cursor-pointer">
                     <CardContent className="p-4" onClick={() => handleViewProfile(profile.username)}>
                       <div className="flex items-center space-x-4">
                         <Avatar className="w-16 h-16 cursor-pointer hover:scale-105 transition-transform">
                           <AvatarImage src={profile.avatar_url || ''} />
                           <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-lg font-semibold">
                             {stripUserDigits(profile.display_name)[0] || 'U'}
                           </AvatarFallback>
                         </Avatar>
                         
                         <div className="flex-1 min-w-0 cursor-pointer">
                           <h3 className="font-semibold truncate hover:text-primary transition-colors">{stripUserDigits(profile.display_name)}</h3>
                           <p className="text-sm text-muted-foreground hover:text-primary/80 transition-colors">@{stripUserDigits(profile.username)}</p>
                           {profile.bio && (
                             <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                               {profile.bio}
                             </p>
                           )}
                           <p className="text-xs text-muted-foreground mt-1">
                             {profile.followers_count} seguidores · {profile.following_count} seguindo
                           </p>
                         </div>
                         
                          {user && user.id !== profile.id && (
                            <div className="flex gap-2">
                              {/* Chat Button */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartChat(profile.id, stripUserDigits(profile.display_name));
                                }}
                                disabled={startingChat === profile.id}
                                className="border-primary text-primary hover:bg-primary/10 w-10 h-8 p-0"
                              >
                                {startingChat === profile.id ? (
                                  <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <MessageCircle className="w-4 h-4" />
                                )}
                              </Button>
                              
                              {/* Follow Button */}
                              <Button
                                size="sm"
                                variant={followedUsers.has(profile.id) ? "outline" : "default"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFollow(profile.id);
                                }}
                                className={followedUsers.has(profile.id) 
                                  ? "border-primary text-primary hover:bg-primary/10" 
                                  : "magic-button"
                                }
                              >
                                {followedUsers.has(profile.id) ? (
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
                            </div>
                          )}
                       </div>
                     </CardContent>
                   </Card>
                 ))}
              </div>
            )}
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default Explore;