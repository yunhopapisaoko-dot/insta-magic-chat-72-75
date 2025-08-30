import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { MessageCircle, Sparkles, Users, Shield } from 'lucide-react';
import { useEffect } from 'react';

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/feed');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="mobile-container pt-16 pb-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full magic-gradient mb-6 magic-shadow">
            <MessageCircle className="w-10 h-10 text-white" />
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Magic Talk
            </span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-md mx-auto">
            A rede social que conecta pessoas de forma mágica e autêntica
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => navigate('/register')}
              className="magic-button text-lg px-8 py-6 h-auto"
            >
              Começar Agora
            </Button>
            
            <Button
              variant="outline"
              onClick={() => navigate('/login')}
              className="text-lg px-8 py-6 h-auto border-primary text-primary hover:bg-primary/10"
            >
              Já tenho conta
            </Button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="mobile-container py-12">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Experiência Única</h3>
            <p className="text-muted-foreground text-sm">
              Design inspirado no Instagram com toques mágicos e interface intuitiva
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Comunidade Segura</h3>
            <p className="text-muted-foreground text-sm">
              Sistema de usuários único com validação personalizada para máxima segurança
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Mobile First</h3>
            <p className="text-muted-foreground text-sm">
              Otimizado para smartphones com design responsivo e navegação fluida
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="mobile-container py-12">
        <div className="text-center bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-4">
            Pronto para a magia?
          </h2>
          <p className="text-muted-foreground mb-6">
            Junte-se à comunidade Magic Talk e comece a compartilhar seus momentos especiais
          </p>
          <Button
            onClick={() => navigate('/register')}
            className="magic-button text-lg px-8 py-6 h-auto"
          >
            Criar Conta Grátis
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
