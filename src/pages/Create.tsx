import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Image, Video, Zap, X, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '@/components/MobileLayout';
import MediaCatalog from '@/components/MediaCatalog';
import StoryCreator from '@/components/StoryCreator';
import CreatePost from '@/components/CreatePost';

type ContentType = 'select' | 'post' | 'story';

const Create = () => {
  const navigate = useNavigate();
  const [contentType, setContentType] = useState<ContentType>('select');
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [storyCreatorOpen, setStoryCreatorOpen] = useState(false);

  const contentTypes = [
    {
      id: 'post',
      title: 'Post',
      description: 'Compartilhe fotos e vídeos no seu feed',
      icon: Image,
      gradient: 'from-blue-500 to-purple-600',
    },
    {
      id: 'story',
      title: 'Story',
      description: 'Compartilhe momentos que desaparecem em 24h',
      icon: Zap,
      gradient: 'from-pink-500 to-orange-500',
    },
  ];

  const handleTypeSelect = (type: string) => {
    if (type === 'post') {
      setCreatePostOpen(true);
    } else if (type === 'story') {
      setStoryCreatorOpen(true);
    }
  };

  const handlePostCreated = () => {
    navigate('/feed');
  };

  const handleStoryCreated = () => {
    navigate('/feed');
  };

  if (contentType === 'post') {
    return <MediaCatalog type="post" onBack={() => setContentType('select')} />;
  }

  if (contentType === 'story') {
    return <MediaCatalog type="story" onBack={() => setContentType('select')} />;
  }

  return (
    <MobileLayout showBottomNav={false}>
      <div className="mobile-container py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Criar Conteúdo</h1>
          <div className="w-10" />
        </div>

        {/* Content Type Selection */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-center mb-8">
            O que você quer compartilhar?
          </h2>
          
          <div className="grid grid-cols-1 gap-4">
            {contentTypes.map((type) => (
              <Card 
                key={type.id}
                className="cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg border-2 hover:border-primary/50"
                onClick={() => handleTypeSelect(type.id)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${type.gradient} flex items-center justify-center shadow-lg`}>
                      <type.icon className="w-8 h-8 text-white" />
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="text-lg font-bold mb-1">{type.title}</h3>
                      <p className="text-muted-foreground text-sm">{type.description}</p>
                    </div>
                    
                    <ArrowLeft className="w-5 h-5 text-muted-foreground rotate-180" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

      </div>

      <CreatePost
        open={createPostOpen}
        onOpenChange={setCreatePostOpen}
        onPostCreated={handlePostCreated}
      />

      <StoryCreator
        open={storyCreatorOpen}
        onOpenChange={setStoryCreatorOpen}
        onStoryCreated={handleStoryCreated}
      />
    </MobileLayout>
  );
};

export default Create;