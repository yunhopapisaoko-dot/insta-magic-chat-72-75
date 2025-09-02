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
  const [showSavedAccount, setShowSavedAccount] = useState(false);
  const [savedUser, setSavedUser] = useState<any>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Carrega o último usuário salvo ao inicializar
  useEffect(() => {
    const savedUserData = localStorage.getItem('magic-talk-user');
    const wasRemembered = localStorage.getItem('magic-talk-remember-login') === 'true';
    
    if (savedUserData && wasRemembered) {
      try {
        const userData = JSON.parse(savedUserData);
        setSavedUser(userData);
        setShowSavedAccount(true);
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('magic-talk-user');
        localStorage.removeItem('magic-talk-remember-login');
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const success = await login(username, rememberMe);
    if (success) {
      navigate('/feed');
    }
    
    setLoading(false);
  };

  const handleSavedAccountLogin = async () => {
    if (!savedUser) return;
    
    setLoading(true);
    const success = await login(savedUser.username, true);
    if (success) {
      navigate('/feed');
    }
    setLoading(false);
  };

  const handleEnterAnotherAccount = () => {
    setShowSavedAccount(false);
    setSavedUser(null);
  };

  const stripUserDigits = (username: string): string => {
    return username.replace(/\d{4}$/, '');
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
          {showSavedAccount && savedUser ? (
            // Mostra a conta salva
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <div className="relative mx-auto">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent p-1 shadow-xl">
                    <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
                      {savedUser.avatar_url ? (
                        <img 
                          src={savedUser.avatar_url} 
                          alt={savedUser.display_name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-foreground font-bold text-xl">
                          {savedUser.display_name?.charAt(0).toUpperCase() || savedUser.username?.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-background flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-xl text-foreground">{savedUser.display_name}</h3>
                  <p className="text-sm text-muted-foreground font-medium">@{stripUserDigits(savedUser.username)}</p>
                </div>
              </div>
              
              <Button
                onClick={handleSavedAccountLogin}
                className="w-full relative overflow-hidden group bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white border-0 py-3 rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
                disabled={loading}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Entrando...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <span className="font-semibold">Continuar como {savedUser.display_name}</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
                  </div>
                )}
              </Button>
              
              <div className="text-center">
                <button
                  onClick={handleEnterAnotherAccount}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium px-4 py-2 rounded-lg hover:bg-muted/50"
                >
                  Usar outra conta
                </button>
              </div>
              
              <div className="mt-4 pt-4 border-t border-border text-center">
                <button
                  onClick={() => navigate('/admin')}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Acesso administrativo
                </button>
              </div>
            </div>
          ) : (
            // Mostra o formulário normal
            <>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Input
                    type="text"
                    placeholder="Ex: ana1234"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    showClearButton={true}
                    onClear={() => setUsername('')}
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;