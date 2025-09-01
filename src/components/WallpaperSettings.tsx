import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { Palette, Upload, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface WallpaperSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  currentWallpaper?: {
    type: 'color' | 'image';
    value: string;
  } | null;
  onWallpaperChange: (wallpaper: { type: 'color' | 'image'; value: string } | null) => void;
}

const PRESET_COLORS = [
  { name: 'Preto', value: '#000000' },
  { name: 'Branco', value: '#ffffff' },
  { name: 'Azul', value: '#3b82f6' },
  { name: 'Rosa', value: '#ec4899' },
];

export const WallpaperSettings = ({ 
  isOpen, 
  onClose, 
  conversationId, 
  currentWallpaper,
  onWallpaperChange 
}: WallpaperSettingsProps) => {
  const [uploading, setUploading] = useState(false);
  const [selectedWallpaper, setSelectedWallpaper] = useState<{ type: 'color' | 'image'; value: string } | null>(
    currentWallpaper || null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleColorSelect = (color: string) => {
    setSelectedWallpaper({ type: 'color', value: color });
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erro",
        description: "Por favor, selecione apenas arquivos de imagem.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Erro",
        description: "A imagem deve ter no máximo 5MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Convert to base64 for simple storage
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setSelectedWallpaper({ type: 'image', value: result });
        setUploading(false);
      };
      reader.onerror = () => {
        setUploading(false);
        toast({
          title: "Erro",
          description: "Não foi possível carregar a imagem.",
          variant: "destructive",
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading image:', error);
      setUploading(false);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a imagem.",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    try {
      // Save wallpaper preference to user's conversation settings
      const userId = JSON.parse(localStorage.getItem('auth_user') || '{}')?.id;
      if (!userId) throw new Error('User not found');

      const wallpaperData = selectedWallpaper ? {
        type: selectedWallpaper.type,
        value: selectedWallpaper.value
      } : null;

      // Store wallpaper preference in localStorage for now
      // In a real app, you'd store this in the database
      const wallpaperKey = `wallpaper_${userId}_${conversationId}`;
      if (wallpaperData) {
        localStorage.setItem(wallpaperKey, JSON.stringify(wallpaperData));
      } else {
        localStorage.removeItem(wallpaperKey);
      }

      onWallpaperChange(selectedWallpaper);

      // Trigger storage event for realtime updates
      window.dispatchEvent(new StorageEvent('storage', {
        key: wallpaperKey,
        newValue: wallpaperData ? JSON.stringify(wallpaperData) : null,
        oldValue: localStorage.getItem(wallpaperKey)
      }));

      toast({
        title: "Sucesso",
        description: "Papel de parede atualizado!",
      });

      onClose();
    } catch (error) {
      console.error('Error saving wallpaper:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o papel de parede.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveWallpaper = () => {
    setSelectedWallpaper(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Papel de Parede
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6">
            {/* Current Preview */}
            {selectedWallpaper && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Visualização</h3>
                <div className="relative w-full h-32 rounded-lg overflow-hidden border">
                  {selectedWallpaper.type === 'color' ? (
                    <div 
                      className="w-full h-full"
                      style={{ backgroundColor: selectedWallpaper.value }}
                    />
                  ) : (
                    <img 
                      src={selectedWallpaper.value} 
                      alt="Papel de parede selecionado"
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
                      <span className="text-xs text-white font-medium">
                        Exemplo de mensagem
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Color Options */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Cores Predefinidas</h3>
              <div className="grid grid-cols-2 gap-3">
                {PRESET_COLORS.map((color) => (
                  <Button
                    key={color.value}
                    variant={
                      selectedWallpaper?.type === 'color' && 
                      selectedWallpaper?.value === color.value 
                        ? "default" 
                        : "outline"
                    }
                    className="h-12 flex items-center gap-3 justify-start"
                    onClick={() => handleColorSelect(color.value)}
                  >
                    <div 
                      className="w-6 h-6 rounded-full border-2 border-border"
                      style={{ backgroundColor: color.value }}
                    />
                    <span>{color.name}</span>
                    {selectedWallpaper?.type === 'color' && 
                     selectedWallpaper?.value === color.value && (
                      <Check className="w-4 h-4 ml-auto" />
                    )}
                  </Button>
                ))}
              </div>
            </div>

            {/* Image Upload */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Imagem Personalizada</h3>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full h-12"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                {uploading ? 'Enviando...' : 'Escolher da Galeria'}
              </Button>
            </div>

            {/* Remove Wallpaper */}
            {selectedWallpaper && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleRemoveWallpaper}
              >
                Remover Papel de Parede
              </Button>
            )}
          </div>
        </ScrollArea>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
          >
            Aplicar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};