import { useState, ChangeEvent, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { stripUserDigits } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import ImageCropper from './ImageCropper';

interface ProfileEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProfileUpdate: () => void;
}

const ProfileEditor = ({ open, onOpenChange, onProfileUpdate }: ProfileEditorProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "Arquivo muito grande",
          description: "O arquivo deve ter no máximo 5MB",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      setCropperOpen(true);
    }
  };

  const handleCropComplete = (croppedFile: File) => {
    setAvatarFile(croppedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarPreview(e.target?.result as string);
    };
    reader.readAsDataURL(croppedFile);
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return null;

    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  // Load existing bio when opening
  useEffect(() => {
    if (open && user) {
      setDisplayName(user.display_name || '');
      setBio(user.bio || '');
    }
  }, [open, user]);

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      let avatarUrl = null;

      if (avatarFile) {
        avatarUrl = await uploadAvatar(avatarFile);
      }

      const updateData: any = {
        display_name: displayName.trim(),
        bio: bio.trim(),
      };

      if (avatarUrl) {
        updateData.avatar_url = avatarUrl;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      // Força atualização imediata do contexto com os novos dados
      const { data: updatedProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (updatedProfile) {
        // Força uma nova busca dos dados do usuário no contexto global
        window.dispatchEvent(new CustomEvent('forceProfileRefresh', {
          detail: updatedProfile
        }));
      }

      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso!",
      });

      // Reset form state
      setAvatarFile(null);
      setAvatarPreview(null);
      
      onProfileUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível salvar suas informações. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mobile-container max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="text-center">Editar Perfil</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <Avatar className="w-24 h-24">
                <AvatarImage src={avatarPreview || user?.avatar_url || ''} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xl font-semibold">
                  {user?.display_name ? stripUserDigits(user.display_name)[0] : 'U'}
                </AvatarFallback>
              </Avatar>
              <label htmlFor="avatar-upload" className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors">
                <Camera className="w-4 h-4 text-primary-foreground" />
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            {avatarPreview && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAvatarFile(null);
                  setAvatarPreview(null);
                }}
                className="text-muted-foreground"
              >
                <X className="w-4 h-4 mr-1" />
                Remover foto
              </Button>
            )}
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="display-name">Nome de exibição</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Digite seu nome"
              className="rounded-xl"
            />
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Conte um pouco sobre você..."
              rows={3}
              className="rounded-xl resize-none"
              maxLength={150}
            />
            <p className="text-xs text-muted-foreground text-right">
              {bio.length}/150
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 rounded-xl"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 rounded-xl magic-button"
              disabled={loading}
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>

        <ImageCropper
          open={cropperOpen}
          onOpenChange={setCropperOpen}
          imageFile={selectedFile}
          onCropComplete={handleCropComplete}
        />
      </DialogContent>
    </Dialog>
  );
};

export default ProfileEditor;