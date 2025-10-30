import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
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
  supabaseUser: User | null;
  loading: boolean;
  login: (username: string) => Promise<boolean>;
  register: (username: string, displayName: string) => Promise<boolean>;
  logout: () => Promise<void>;
  adminLogin: (password: string) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_PASSWORD = '88620787';

export const SupabaseAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const validateUsername = (username: string): boolean => {
    const regex = /^[a-zA-Z]+$/;
    return regex.test(username);
  };

  const generateUserCode = (): string => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSupabaseUser(session.user);
        fetchUserProfile(session.user.id);
      } else {
        // Check for old localStorage user
        const savedUser = localStorage.getItem('magic-talk-user');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }
      }
      setLoading(false);
    });

    // Check for admin status
    const savedAdmin = localStorage.getItem('magic-talk-admin');
    if (savedAdmin) {
      setIsAdmin(true);
    }

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setSupabaseUser(session.user);
        await fetchUserProfile(session.user.id);
      } else {
        setSupabaseUser(null);
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUser(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const login = async (username: string): Promise<boolean> => {
    if (!validateUsername(username)) {
      toast({
        title: "Formato inválido",
        description: "O nome de usuário deve conter apenas letras",
        variant: "destructive",
      });
      return false;
    }

    try {
      // First, check if user exists by username (old system compatibility)
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username + generateUserCode()) // This won't match, fallback needed
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        // Check for username pattern without numbers (old format)
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('*')
          .ilike('username', `${username}%`);

        if (error || !profiles || profiles.length === 0) {
          toast({
            title: "Usuário não encontrado",
            description: "Este nome de usuário não existe",
            variant: "destructive",
          });
          return false;
        }

        // Use first matching profile (for old system compatibility)
        const profile = profiles[0];
        setUser(profile);
        
        toast({
          title: "Login realizado",
          description: `Bem-vindo, ${profile.display_name}!`,
        });
        
        return true;
      }

      setUser(existingProfile);
      toast({
        title: "Login realizado",
        description: `Bem-vindo, ${existingProfile.display_name}!`,
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
        description: "O nome de usuário deve conter apenas letras",
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
      const userCode = generateUserCode();
      const fullUsername = username + userCode;

      // Check if username already exists
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', fullUsername)
        .single();

      if (existingUser) {
        toast({
          title: "Nome já existe",
          description: "Tente novamente",
          variant: "destructive",
        });
        return false;
      }

      // Create new user profile
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          username: fullUsername,
          display_name: displayName.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      setUser(data);
      
      toast({
        title: "Conta criada",
        description: `Bem-vindo à VilaAurora, ${data.display_name}! Seu usuário é: ${fullUsername}`,
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
    if (supabaseUser) {
      await supabase.auth.signOut();
    }
    
    setUser(null);
    setSupabaseUser(null);
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
      supabaseUser,
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

export const useSupabaseAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
  }
  return context;
};