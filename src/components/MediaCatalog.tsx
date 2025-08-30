import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Image, Video, Camera, Grid3X3, Clock, Heart, Folder } from 'lucide-react';
import MobileLayout from '@/components/MobileLayout';
import CreatePost from '@/components/CreatePost';
import StoryCreator from '@/components/StoryCreator';

interface MediaCatalogProps {
  type: 'post' | 'story';
  onBack: () => void;
}

const MediaCatalog = ({ type, onBack }: MediaCatalogProps) => {
  const [selectedCategory, setSelectedCategory] = useState('recents');
  const [selectedMedia, setSelectedMedia] = useState<File[]>([]);
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [storyCreatorOpen, setStoryCreatorOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mock media categories
  const categories = [
    { id: 'recents', label: 'Recentes', icon: Clock },
    { id: 'gallery', label: 'Galeria', icon: Grid3X3 },
    { id: 'favorites', label: 'Favoritos', icon: Heart },
    { id: 'camera', label: 'Câmera', icon: Camera },
  ];

  // Mock media files
  const mockMedia = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    type: i % 3 === 0 ? 'video' : 'image',
    thumbnail: `https://picsum.photos/200/200?random=${i}`,
    duration: i % 3 === 0 ? '0:15' : null,
  }));

  const handleMediaSelect = (media: any) => {
    // In a real app, you'd convert the selected media to files
    console.log('Selected media:', media);
    
    if (type === 'post') {
      setCreatePostOpen(true);
    } else {
      setStoryCreatorOpen(true);
    }
  };

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedMedia(files);
    
    if (type === 'post') {
      setCreatePostOpen(true);
    } else {
      setStoryCreatorOpen(true);
    }
  };

  const handlePostCreated = () => {
    onBack();
  };

  return (
    <MobileLayout showBottomNav={false}>
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-10">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">
            {type === 'post' ? 'Escolher Foto/Vídeo' : 'Criar Story'}
          </h1>
          <Button variant="ghost" size="sm" onClick={handleCameraClick}>
            <Camera className="w-5 h-5" />
          </Button>
        </div>

        {/* Categories */}
        <div className="p-4 border-b border-border">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex space-x-2">
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className="flex items-center space-x-2 rounded-full min-w-fit"
                >
                  <category.icon className="w-4 h-4" />
                  <span>{category.label}</span>
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Media Grid */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {selectedCategory === 'camera' ? (
              <Card className="h-64 cursor-pointer hover:bg-muted/50 transition-colors" onClick={handleCameraClick}>
                <CardContent className="h-full flex flex-col items-center justify-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Camera className="w-10 h-10 text-primary" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-semibold mb-1">Abrir Câmera</h3>
                    <p className="text-sm text-muted-foreground">
                      {type === 'post' ? 'Tire uma nova foto ou vídeo' : 'Crie um novo story'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {mockMedia.map((media) => (
                  <div
                    key={media.id}
                    className="aspect-square relative cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => handleMediaSelect(media)}
                  >
                    <img
                      src={media.thumbnail}
                      alt={`Media ${media.id}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                    
                    {media.type === 'video' && (
                      <>
                        <div className="absolute inset-0 bg-black/20 rounded-lg" />
                        <Video className="absolute top-2 right-2 w-4 h-4 text-white" />
                        {media.duration && (
                          <span className="absolute bottom-2 right-2 text-xs text-white bg-black/50 px-1 rounded">
                            {media.duration}
                          </span>
                        )}
                      </>
                    )}
                    
                    <div className="absolute inset-0 ring-2 ring-transparent hover:ring-primary rounded-lg transition-all" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Bottom Info */}
        <div className="p-4 border-t border-border bg-background">
          <div className="flex items-center justify-center space-x-4 text-sm text-muted-foreground">
            <div className="flex items-center space-x-1">
              <Folder className="w-4 h-4" />
              <span>{mockMedia.length} itens</span>
            </div>
            <span>•</span>
            <span>Toque para selecionar</span>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={type === 'post' ? 'image/*,video/*' : 'image/*,video/*'}
        multiple={type === 'post'}
        onChange={handleFileSelect}
        className="hidden"
      />

      <CreatePost
        open={createPostOpen}
        onOpenChange={setCreatePostOpen}
        onPostCreated={handlePostCreated}
      />

      <StoryCreator
        open={storyCreatorOpen}
        onOpenChange={setStoryCreatorOpen}
        onStoryCreated={handlePostCreated}
      />
    </MobileLayout>
  );
};

export default MediaCatalog;