import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  MessageCircle, 
  UserPlus, 
  UserMinus, 
  Clock, 
  Users, 
  X,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfileNavigation } from '@/hooks/useProfileNavigation';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import ProfileChat from '@/components/ProfileChat';

interface ProfileNavigatorProps {
  isOpen: boolean;
  onClose: () => void;
  initialUserId?: string;
  initialUsername?: string;
}

const ProfileNavigator = ({ isOpen, onClose, initialUserId, initialUsername }: ProfileNavigatorProps) => {
  const { user } = useAuth();
  const {
    currentProfile,
    navigateToProfile,
    getRecentProfiles,
    getRecentConversations,
    isLoading,
    cacheConversation,
  } = useProfileNavigation();
  
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'recent' | 'conversations'>('profile');

  const recentProfiles = getRecentProfiles();
  const recentConversations = getRecentConversations();

  useEffect(() => {
    if (isOpen && (initialUserId || initialUsername)) {
      if (initialUsername) {
        navigateToProfile(initialUsername, initialUserId);
      } else if (initialUserId) {
        // Fetch by ID if we don't have username
        fetchProfileById(initialUserId);
      }
    }
  }, [isOpen, initialUserId, initialUsername]);

  useEffect(() => {
    if (currentProfile && user) {
      checkIfFollowing();
    }
  }, [currentProfile, user]);

  const fetchProfileById = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .single();

      if (error) throw error;
      if (data) {
        navigateToProfile(data.username, userId);
      }
    } catch (error) {
      console.error('Error fetching profile by ID:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o perfil.",
        variant: "destructive",
      });
    }
  };

  const checkIfFollowing = async () => {
    if (!user || !currentProfile) return;

    try {
      const { data, error } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', currentProfile.id)
        .maybeSingle();

      if (error) throw error;
      setIsFollowing(!!data);
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };

  const handleFollow = async () => {
    if (!user || !currentProfile) return;

    setFollowLoading(true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', currentProfile.id);

        if (error) throw error;
        setIsFollowing(false);
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: currentProfile.id,
          });

        if (error) throw error;
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Error following/unfollowing:', error);
      toast({
        title: "Erro",
        description: "Não foi possível realizar esta ação.",
        variant: "destructive",
      });
    } finally {
      setFollowLoading(false);
    }
  };

  const handleStartChat = () => {
    if (currentProfile) {
      setChatOpen(true);
    }
  };

  const handleProfileSelect = async (username: string, userId?: string) => {
    await navigateToProfile(username, userId);
    setActiveTab('profile');
  };

  const handleConversationSelect = (conversation: any) => {
    navigateToProfile(conversation.otherUser.username, conversation.otherUser.id);
    setActiveTab('profile');
    setChatOpen(true);
  };

  const isOwnProfile = user?.id === currentProfile?.id;
  const loadingProfile = initialUsername ? isLoading(initialUsername) : false;

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent 
          side="right" 
          className="w-full max-w-md p-0 bg-background border-l border-border"
        >
          {/* Header */}
          <SheetHeader className="px-6 py-4 border-b border-border bg-card">
            <div className="flex items-center justify-between">
              <SheetTitle>Navegador de Perfis</SheetTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="w-8 h-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </SheetHeader>

          {/* Tabs */}
          <div className="flex border-b border-border bg-muted/30">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'profile'
                  ? 'text-primary border-b-2 border-primary bg-background'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Perfil
            </button>
            <button
              onClick={() => setActiveTab('recent')}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'recent'
                  ? 'text-primary border-b-2 border-primary bg-background'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Recentes
            </button>
            <button
              onClick={() => setActiveTab('conversations')}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'conversations'
                  ? 'text-primary border-b-2 border-primary bg-background'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Conversas
            </button>
          </div>

          <ScrollArea className="flex-1">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="p-6 space-y-6">
                {loadingProfile ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : currentProfile ? (
                  <>
                    {/* Profile Info */}
                    <div className="text-center space-y-4">
                      <Avatar className="w-20 h-20 mx-auto">
                        <AvatarImage src={currentProfile.avatar_url || ''} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xl font-semibold">
                          {currentProfile.display_name[0]}
                        </AvatarFallback>
                      </Avatar>

                      <div>
                        <h2 className="text-lg font-bold">{currentProfile.display_name}</h2>
                        <p className="text-muted-foreground">@{currentProfile.username}</p>
                        {currentProfile.bio && (
                          <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                            {currentProfile.bio}
                          </p>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="flex justify-center space-x-6">
                        <div className="text-center">
                          <p className="font-bold">{currentProfile.followers_count || 0}</p>
                          <p className="text-xs text-muted-foreground">Seguidores</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold">{currentProfile.following_count || 0}</p>
                          <p className="text-xs text-muted-foreground">Seguindo</p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {!isOwnProfile && (
                      <div className="space-y-3">
                        <Button 
                          onClick={handleStartChat}
                          className="w-full rounded-xl bg-gradient-to-r from-primary to-accent text-white shadow-lg hover:shadow-xl transition-all duration-300"
                          size="lg"
                        >
                          <MessageCircle className="w-4 h-4 mr-2" />
                          Enviar Mensagem
                        </Button>
                        
                        <Button 
                          onClick={handleFollow}
                          disabled={followLoading}
                          className={`w-full rounded-xl ${
                            isFollowing 
                              ? 'bg-muted text-foreground hover:bg-muted/80' 
                              : 'border-primary text-primary hover:bg-primary hover:text-primary-foreground'
                          }`}
                          variant="outline"
                        >
                          {followLoading ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : isFollowing ? (
                            <UserMinus className="w-4 h-4 mr-2" />
                          ) : (
                            <UserPlus className="w-4 h-4 mr-2" />
                          )}
                          {isFollowing ? 'Deixar de seguir' : 'Seguir'}
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Nenhum perfil selecionado</p>
                  </div>
                )}
              </div>
            )}

            {/* Recent Profiles Tab */}
            {activeTab === 'recent' && (
              <div className="p-4 space-y-2">
                {recentProfiles.length > 0 ? (
                  <>
                    <div className="flex items-center space-x-2 px-2 py-1">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Perfis Recentes</span>
                    </div>
                    {recentProfiles.map((profile) => (
                      <button
                        key={profile.id}
                        onClick={() => handleProfileSelect(profile.username, profile.id)}
                        className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={profile.avatar_url || ''} />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white font-semibold">
                            {profile.display_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-left">
                          <p className="font-medium">{profile.display_name}</p>
                          <p className="text-sm text-muted-foreground">@{profile.username}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </button>
                    ))}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Nenhum perfil recente</p>
                  </div>
                )}
              </div>
            )}

            {/* Conversations Tab */}
            {activeTab === 'conversations' && (
              <div className="p-4 space-y-2">
                {recentConversations.length > 0 ? (
                  <>
                    <div className="flex items-center space-x-2 px-2 py-1">
                      <MessageCircle className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Conversas Recentes</span>
                    </div>
                    {recentConversations.map((conversation) => (
                      <button
                        key={conversation.conversationId}
                        onClick={() => handleConversationSelect(conversation)}
                        className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={conversation.otherUser.avatar_url || ''} />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white font-semibold">
                            {conversation.otherUser.display_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-left">
                          <p className="font-medium">{conversation.otherUser.display_name}</p>
                          <p className="text-sm text-muted-foreground">
                            @{conversation.otherUser.username}
                          </p>
                        </div>
                        <div className="text-right">
                          <MessageCircle className="w-4 h-4 text-primary" />
                        </div>
                      </button>
                    ))}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <MessageCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Nenhuma conversa recente</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Profile Chat */}
      {currentProfile && chatOpen && (
        <ProfileChat
          otherUser={{
            id: currentProfile.id,
            display_name: currentProfile.display_name,
            username: currentProfile.username,
            avatar_url: currentProfile.avatar_url,
          }}
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
        />
      )}
    </>
  );
};

export default ProfileNavigator;