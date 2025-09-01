import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useRealtimeProfile } from './useRealtimeProfile';

interface Profile {
  id: string;
  username: string;
  display_name: string;
  bio?: string | null;
  avatar_url?: string | null;
  followers_count?: number;
  following_count?: number;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: Profile | null;
  supabaseUser: User | null;
  session: Session | null;
  loading: boolean;
  login: (username: string, rememberMe?: boolean) => Promise<boolean>;
  register: (username: string, displayName: string, rememberMe?: boolean) => Promise<boolean>;
  logout: () => Promise<void>;
  adminLogin: (password: string) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_PASSWORD = '88620787';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const validateUsername = (username: string): boolean => {
    const regex = /^[a-zA-Z]+\d{4}$/;
    return regex.test(username);
  };

  const fetchUserProfile = async (userId: string) => {
    console.log('Fetching user profile for ID:', userId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        throw error;
      }
      console.log('User profile fetched:', data);
      setUser(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const handleRealtimeProfileUpdate = (profileUpdate: any) => {
    console.log('Realtime profile update received:', profileUpdate);
    setUser(prev => {
      if (!prev) return null;
      const updatedUser = { ...prev, ...profileUpdate };
      
      // Atualizar também o localStorage se "lembrar de mim" estiver ativo
      const shouldRememberLogin = localStorage.getItem('magic-talk-remember-login') === 'true';
      if (shouldRememberLogin) {
        localStorage.setItem('magic-talk-user', JSON.stringify(updatedUser));
      }
      
      return updatedUser;
    });
  };

  const forceProfileRefresh = async () => {
    if (!user) return;
    console.log('Forcing profile refresh for user:', user.id);
    await fetchUserProfile(user.id);
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        setSession(session);
        setSupabaseUser(session?.user ?? null);
        
        // Defer profile fetch to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserProfile(session.user.id);
          }, 0);
        } else {
          setUser(null);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', session?.user?.id);
      setSession(session);
      setSupabaseUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(() => {
          fetchUserProfile(session.user.id);
        }, 0);
      } else {
        // Check for saved login (quando "lembrar de mim" está ativo)
        const shouldRememberLogin = localStorage.getItem('magic-talk-remember-login') === 'true';
        const savedUser = localStorage.getItem('magic-talk-user');
        
        if (shouldRememberLogin && savedUser) {
          try {
            const userData = JSON.parse(savedUser);
            setUser(userData);
            console.log('Restored saved user:', userData);
          } catch (error) {
            console.error('Error parsing saved user:', error);
            localStorage.removeItem('magic-talk-user');
            localStorage.removeItem('magic-talk-remember-login');
          }
        }
      }
      
      setLoading(false);
    });

    // Check for admin status
    const savedAdmin = localStorage.getItem('magic-talk-admin');
    if (savedAdmin) {
      setIsAdmin(true);
    }

    // Listener para refresh manual do perfil
    const handleForceProfileRefresh = (event: any) => {
      if (event.detail) {
        console.log('Force profile refresh event received:', event.detail);
        setUser(prev => {
          if (!prev) return null;
          const updatedUser = { ...prev, ...event.detail };
          
          // Atualizar localStorage também
          const shouldRememberLogin = localStorage.getItem('magic-talk-remember-login') === 'true';
          if (shouldRememberLogin) {
            localStorage.setItem('magic-talk-user', JSON.stringify(updatedUser));
          }
          
          return updatedUser;
        });
      } else {
        forceProfileRefresh();
      }
    };

    window.addEventListener('forceProfileRefresh', handleForceProfileRefresh);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('forceProfileRefresh', handleForceProfileRefresh);
    };
  }, []);

  // Set up realtime profile updates
  useRealtimeProfile({
    userId: user?.id || null,
    onProfileUpdate: handleRealtimeProfileUpdate,
  });

  const login = async (username: string, rememberMe: boolean = false): Promise<boolean> => {
    if (!validateUsername(username)) {
      toast({
        title: "Formato inválido",
        description: "O nome de usuário deve ter letras seguidas de exatamente 4 números",
        variant: "destructive",
      });
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();

      if (error) {
        toast({
          title: "Usuário não encontrado",
          description: "Este nome de usuário não existe",
          variant: "destructive",
        });
        return false;
      }

      setUser(data);
      
      // Se "lembrar de mim" estiver ativado, mantém o usuário em localStorage como backup
      if (rememberMe) {
        localStorage.setItem('magic-talk-user', JSON.stringify(data));
        localStorage.setItem('magic-talk-remember-login', 'true');
      }
      
      toast({
        title: "Login realizado",
        description: `Bem-vindo, ${data.display_name}!`,
      });
      
      return true;
    } catch (error) {
      toast({
        title: "Erro no login",
        description: "Tente novamente",
        variant: "destructive",
      });
      return false;
    }
  };

  const register = async (username: string, displayName: string, rememberMe: boolean = false): Promise<boolean> => {
    if (!validateUsername(username)) {
      toast({
        title: "Formato inválido",
        description: "O nome de usuário deve ter letras seguidas de exatamente 4 números",
        variant: "destructive",
      });
      return false;
    }

    if (!displayName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, digite seu nome de exibição",
        variant: "destructive",
      });
      return false;
    }

    try {
      // Check if username already exists
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .single();

      if (existingUser) {
        toast({
          title: "Nome já existe",
          description: "Este nome de usuário já está em uso",
          variant: "destructive",
        });
        return false;
      }

      // Create new user
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          username,
          display_name: displayName.trim(),
        })
        .select()
        .single();

      if (error) {
        toast({
          title: "Erro no cadastro",
          description: "Tente novamente",
          variant: "destructive",
        });
        return false;
      }

      setUser(data);
      
      // Se "lembrar de mim" estiver ativado, salva o usuário
      if (rememberMe) {
        localStorage.setItem('magic-talk-user', JSON.stringify(data));
        localStorage.setItem('magic-talk-remember-login', 'true');
      }
      
      toast({
        title: "Conta criada",
        description: `Bem-vindo ao Magic Talk, ${data.display_name}!`,
      });
      
      return true;
    } catch (error) {
      toast({
        title: "Erro no cadastro",
        description: "Tente novamente",
        variant: "destructive",
      });
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    // Sign out from Supabase if authenticated
    if (supabaseUser) {
      await supabase.auth.signOut();
    }
    
    setUser(null);
    setSupabaseUser(null);
    setSession(null);
    setIsAdmin(false);
    
    // Limpa dados de sessão, mantém preferências "lembrar de mim"
    localStorage.removeItem('magic-talk-user');
    localStorage.removeItem('magic-talk-admin');
    localStorage.removeItem('magic-talk-remember-login');
    // Mantemos 'magic-talk-saved-username' e 'magic-talk-remember-me' para facilitar o próximo login
    
    toast({
      title: "Logout realizado",
      description: "Até logo!",
    });
  };

  const adminLogin = (password: string): boolean => {
    if (password === ADMIN_PASSWORD) {
      setIsAdmin(true);
      localStorage.setItem('magic-talk-admin', 'true');
      toast({
        title: "Acesso administrativo",
        description: "Bem-vindo ao painel administrativo",
      });
      return true;
    } else {
      toast({
        title: "Senha incorreta",
        description: "Senha administrativa inválida",
        variant: "destructive",
      });
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      supabaseUser,
      session,
      loading,
      login,
      register,
      logout,
      adminLogin,
      isAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};