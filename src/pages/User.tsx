import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Grid3X3, Users, UserPlus, UserMinus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import MobileLayout from '@/components/MobileLayout';
import PostsGrid from '@/components/PostsGrid';
import { toast } from '@/hooks/use-toast';

interface ProfileData {
  id: string;
  display_name: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  followers_count: number;
  following_count: number;
}

const UserProfile = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (username) {
      fetchProfile();
      checkIfFollowing();
    }
  }, [username, user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username, bio, avatar_url, followers_count, following_count')
        .eq('username', username)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setProfileData(data);
      } else {
        toast({
          title: "Perfil não encontrado",
          description: "O usuário que você está procurando não existe.",
          variant: "destructive",
        });
        navigate('/feed');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Erro ao carregar perfil",
        description: "Não foi possível carregar o perfil do usuário.",
        variant: "destructive",
      });
      navigate('/feed');
    } finally {
      setLoading(false);
    }
  };

  const checkIfFollowing = async () => {
    if (!user || !profileData) return;

    try {
      const { data, error } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', profileData.id)
        .maybeSingle();

      if (error) throw error;
      setIsFollowing(!!data);
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };

  const handleFollow = async () => {
    if (!user || !profileData) return;

    setFollowLoading(true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', profileData.id);

        if (error) throw error;
        setIsFollowing(false);
        setProfileData(prev => prev ? { ...prev, followers_count: prev.followers_count - 1 } : null);
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: profileData.id,
          });

        if (error) throw error;
        setIsFollowing(true);
        setProfileData(prev => prev ? { ...prev, followers_count: prev.followers_count + 1 } : null);
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

  useEffect(() => {
    if (profileData && user) {
      checkIfFollowing();
    }
  }, [profileData, user]);

  if (loading) {
    return (
      <MobileLayout>
        <div className="min-h-screen">
          {/* Header */}
          <div className="sticky top-0 z-50 bg-background border-b border-border">
            <div className="mobile-container py-4">
              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(-1)}
                  className="p-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="text-lg font-semibold">Perfil</h1>
              </div>
            </div>
          </div>
          
          {/* Loading */}
          <div className="mobile-container py-6 flex items-center justify-center min-h-[50vh]">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (!profileData) return null;

  const isOwnProfile = user?.id === profileData.id;

  return (
    <MobileLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-background border-b border-border">
          <div className="mobile-container py-4">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="p-2"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-lg font-semibold">@{profileData.username}</h1>
            </div>
          </div>
        </div>

        <div className="mobile-container py-6 space-y-6">
          {/* Profile Info */}
          <div className="text-center space-y-4">
            <Avatar className="w-24 h-24 mx-auto">
              <AvatarImage src={profileData.avatar_url || ''} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-2xl font-semibold">
                {profileData.display_name[0] || 'U'}
              </AvatarFallback>
            </Avatar>

            <div>
              <h2 className="text-xl font-bold">{profileData.display_name}</h2>
              {profileData.bio && (
                <p className="text-muted-foreground mt-2 max-w-xs mx-auto">
                  {profileData.bio}
                </p>
              )}
            </div>

            {/* Stats */}
            <div className="flex justify-center space-x-8">
              <div className="text-center">
                <p className="text-xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Posts</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold">{profileData.followers_count || 0}</p>
                <p className="text-sm text-muted-foreground">Seguidores</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold">{profileData.following_count || 0}</p>
                <p className="text-sm text-muted-foreground">Seguindo</p>
              </div>
            </div>

            {/* Follow Button */}
            {!isOwnProfile && (
              <Button 
                onClick={handleFollow}
                disabled={followLoading}
                className={`w-full rounded-xl ${
                  isFollowing 
                    ? 'bg-muted text-foreground hover:bg-muted/80' 
                    : 'magic-button'
                }`}
                variant={isFollowing ? 'outline' : 'default'}
              >
                {followLoading ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                ) : isFollowing ? (
                  <UserMinus className="w-4 h-4 mr-2" />
                ) : (
                  <UserPlus className="w-4 h-4 mr-2" />
                )}
                {isFollowing ? 'Deixar de seguir' : 'Seguir'}
              </Button>
            )}

            {isOwnProfile && (
              <Button 
                onClick={() => navigate('/profile')}
                className="w-full rounded-xl"
                variant="outline"
              >
                <Users className="w-4 h-4 mr-2" />
                Ver meu perfil
              </Button>
            )}
          </div>

          {/* Posts Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-center border-b border-border">
              <button className="flex items-center space-x-2 pb-3 border-b-2 border-primary">
                <Grid3X3 className="w-4 h-4" />
                <span className="font-medium">Posts</span>
              </button>
            </div>

            <PostsGrid userId={profileData.id} onPostUpdate={fetchProfile} />
          </div>
        </div>
      </div>
    </MobileLayout>
  );
};

export default UserProfile;