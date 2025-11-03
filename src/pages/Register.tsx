import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { MessageCircle, ArrowLeft, UserPlus, Keyboard } from 'lucide-react';
import VirtualKeyboard from '@/components/VirtualKeyboard';
import { cn } from '@/lib/utils';

const Register = () => {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);
  const [activeField, setActiveField] = useState<'username' | 'displayName' | null>(null);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleVirtualKeyPress = (key: string) => {
    if (activeField === 'username') {
      setUsername(prev => prev + key.toLowerCase());
    } else if (activeField === 'displayName') {
      setDisplayName(prev => prev + key);
    }
  };

  const handleVirtualBackspace = () => {
    if (activeField === 'username') {
      setUsername(prev => prev.slice(0, -1));
    } else if (activeField === 'displayName') {
      setDisplayName(prev => prev.slice(0, -1));
    }
  };

  const handleVirtualSpace = () => {
    if (activeField === 'displayName') {
      setDisplayName(prev => prev + ' ');
    }
  };

  const handleFieldClick = (field: 'username' | 'displayName') => {
    setActiveField(field);
    setShowVirtualKeyboard(true);
  };

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
    <div className={cn(
      "min-h-screen bg-background mobile-container py-8 flex flex-col justify-center transition-all duration-300 ease-in-out",
      showVirtualKeyboard && "justify-start pt-4"
    )}>
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
              <div className="flex items-center space-x-2">
                <Input
                  type="text"
                  placeholder="Ex: ana1234"
                  value={username}
                  readOnly
                  onClick={() => handleFieldClick('username')}
                  className="mobile-input flex-1 cursor-pointer"
                  maxLength={20}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-9 h-9 p-0"
                  onClick={() => {
                    setActiveField('username');
                    setShowVirtualKeyboard(!showVirtualKeyboard);
                  }}
                >
                  <Keyboard className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Nome de usuário: letras + exatamente 4 números
              </p>
            </div>
            
            <div>
              <div className="flex items-center space-x-2">
                <Input
                  type="text"
                  placeholder="Ex: Ana"
                  value={displayName}
                  readOnly
                  onClick={() => handleFieldClick('displayName')}
                  className="mobile-input flex-1 cursor-pointer"
                  maxLength={50}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-9 h-9 p-0"
                  onClick={() => {
                    setActiveField('displayName');
                    setShowVirtualKeyboard(!showVirtualKeyboard);
                  }}
                >
                  <Keyboard className="w-4 h-4" />
                </Button>
              </div>
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

      {/* Virtual Keyboard */}
      {showVirtualKeyboard && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <VirtualKeyboard
            onKeyPress={handleVirtualKeyPress}
            onBackspace={handleVirtualBackspace}
            onSpace={handleVirtualSpace}
            onClose={() => setShowVirtualKeyboard(false)}
            currentValue={activeField === 'username' ? username : displayName}
          />
        </div>
      )}
    </div>
  );
};

export default Register;