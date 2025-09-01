import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Settings, Edit2, Grid3X3, Heart, MessageCircle, Share, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import ProfileEditor from '@/components/ProfileEditor';
import MobileLayout from '@/components/MobileLayout';
import PostsGrid from '@/components/PostsGrid';
import { toast } from '@/hooks/use-toast';

interface ProfileData {
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  followers_count: number;
  following_count: number;
}

const Profile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const mockPosts = [];

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, bio, avatar_url, followers_count, following_count')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfileData(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Erro ao carregar perfil",
        description: "Não foi possível carregar suas informações.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  // Update local state when user context changes (from realtime updates)
  useEffect(() => {
    if (user && profileData) {
      setProfileData({
        display_name: user.display_name,
        bio: user.bio,
        avatar_url: user.avatar_url,
        followers_count: user.followers_count || 0,
        following_count: user.following_count || 0,
      });
    }
  }, [user?.display_name, user?.bio, user?.avatar_url, user?.followers_count, user?.following_count]);

  const handleLogout = async () => {
    if (confirm('Tem certeza que deseja sair?')) {
      setLoggingOut(true);
      await logout();
      navigate('/login');
    }
  };

  if (loading) {
    return (
      <MobileLayout>
        <div className="mobile-container py-6 flex items-center justify-center min-h-[50vh]">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </MobileLayout>
    );
  }

  if (!profileData) {
    return (
      <MobileLayout>
        <div className="mobile-container py-6 text-center">
          <p className="text-muted-foreground">Erro ao carregar perfil</p>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="mobile-container py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-bold">@{user?.username}</h1>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          >
            {loggingOut ? (
              <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <LogOut className="w-5 h-5" />
            )}
          </Button>
        </div>

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

          {/* Edit Profile Button */}
          <Button 
            onClick={() => setEditorOpen(true)}
            className="w-full rounded-xl"
            variant="outline"
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Editar Perfil
          </Button>
        </div>

        {/* Posts Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-center border-b border-border">
            <button className="flex items-center space-x-2 pb-3 border-b-2 border-primary">
              <Grid3X3 className="w-4 h-4" />
              <span className="font-medium">Posts</span>
            </button>
          </div>

          <PostsGrid userId={user?.id} onPostUpdate={fetchProfile} />
        </div>
      </div>

      <ProfileEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onProfileUpdate={fetchProfile}
      />
    </MobileLayout>
  );
};

export default Profile;