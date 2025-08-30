import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { MessageCircle, ArrowRight } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Carrega o último usuário salvo ao inicializar
  useEffect(() => {
    const savedUsername = localStorage.getItem('magic-talk-saved-username');
    const wasRemembered = localStorage.getItem('magic-talk-remember-me') === 'true';
    
    if (savedUsername && wasRemembered) {
      setUsername(savedUsername);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const success = await login(username, rememberMe);
    if (success) {
      // Salva ou remove as preferências baseado na opção "Lembrar de mim"
      if (rememberMe) {
        localStorage.setItem('magic-talk-saved-username', username);
        localStorage.setItem('magic-talk-remember-me', 'true');
      } else {
        localStorage.removeItem('magic-talk-saved-username');
        localStorage.removeItem('magic-talk-remember-me');
      }
      navigate('/feed');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background mobile-container py-8 flex flex-col justify-center">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full magic-gradient mb-4">
          <MessageCircle className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Magic Talk
        </h1>
        <p className="text-muted-foreground mt-2">
          Entre na conversa mágica
        </p>
      </div>

      <Card className="w-full card-shadow border-0">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-xl">Entrar</CardTitle>
          <CardDescription>
            Digite seu nome de usuário + 4 dígitos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Input
                type="text"
                placeholder="Ex: ana1234"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className="mobile-input"
                maxLength={20}
                required
              />
              <p className="text-xs text-muted-foreground mt-2">
                Formato: letras + exatamente 4 números
              </p>
            </div>

            {/* Opção Lembrar de mim */}
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="remember-me" 
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(!!checked)}
              />
              <label 
                htmlFor="remember-me" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Lembrar de mim
              </label>
            </div>
            
            <Button
              type="submit"
              className="w-full magic-button"
              disabled={loading}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Entrar
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Não tem uma conta?{' '}
              <button
                onClick={() => navigate('/register')}
                className="text-primary font-medium hover:underline"
              >
                Cadastre-se
              </button>
            </p>
            
            <div className="mt-4 pt-4 border-t border-border">
              <button
                onClick={() => navigate('/admin')}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Acesso administrativo
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;