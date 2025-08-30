import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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
  loading: boolean;
  login: (username: string) => Promise<boolean>;
  register: (username: string, displayName: string) => Promise<boolean>;
  logout: () => Promise<void>;
  adminLogin: (password: string) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_PASSWORD = '88620787';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const validateUsername = (username: string): boolean => {
    const regex = /^[a-zA-Z]+\d{4}$/;
    return regex.test(username);
  };

  useEffect(() => {
    // Check for saved user in localStorage
    const savedUser = localStorage.getItem('magic-talk-user');
    const savedAdmin = localStorage.getItem('magic-talk-admin');
    
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    
    if (savedAdmin) {
      setIsAdmin(true);
    }
    
    setLoading(false);
  }, []);

  const login = async (username: string): Promise<boolean> => {
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
      localStorage.setItem('magic-talk-user', JSON.stringify(data));
      
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

  const register = async (username: string, displayName: string): Promise<boolean> => {
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
      localStorage.setItem('magic-talk-user', JSON.stringify(data));
      
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
    setUser(null);
    setIsAdmin(false);
    localStorage.removeItem('magic-talk-user');
    localStorage.removeItem('magic-talk-admin');
    
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