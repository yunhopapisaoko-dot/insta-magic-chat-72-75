import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { MessageCircle, ArrowLeft, UserPlus } from 'lucide-react';

const Register = () => {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true); // Padrão marcado para novo usuário
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const success = await register(username, displayName, rememberMe);
    if (success) {
      // Salva as preferências se "Lembrar de mim" estiver marcado
      if (rememberMe) {
        localStorage.setItem('magic-talk-saved-username', username);
        localStorage.setItem('magic-talk-remember-me', 'true');
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
          VilaAurora
        </h1>
        <p className="text-muted-foreground mt-2">
          Crie sua conta no reino
        </p>
      </div>

      <Card className="w-full card-shadow border-0">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-xl">Criar Conta</CardTitle>
          <CardDescription>
            Junte-se à comunidade VilaAurora
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
                Nome de usuário: letras + exatamente 4 números
              </p>
            </div>
            
            <div>
              <Input
                type="text"
                placeholder="Ex: Ana"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mobile-input"
                maxLength={50}
                required
              />
              <p className="text-xs text-muted-foreground mt-2">
                Nome que aparecerá para outros usuários
              </p>
            </div>

            {/* Opção Lembrar de mim */}
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="remember-me-register" 
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(!!checked)}
              />
              <label 
                htmlFor="remember-me-register" 
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
                  <UserPlus className="w-4 h-4 mr-2" />
                  Criar Conta
                </>
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Já tem uma conta?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-primary font-medium hover:underline"
              >
                Entrar
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
      
      <Button
        variant="ghost"
        onClick={() => navigate('/login')}
        className="mt-4 self-start"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Voltar
      </Button>
    </div>
  );
};

export default Register;