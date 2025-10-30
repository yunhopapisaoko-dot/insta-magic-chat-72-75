import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Shield, Users, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Profile {
  id: string;
  username: string;
  display_name: string;
  created_at: string;
}

const Admin = () => {
  const [password, setPassword] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const { adminLogin, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const success = adminLogin(password);
    if (success) {
      loadUsers();
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        toast({
          title: "Erro ao carregar usuários",
          description: "Tente novamente",
          variant: "destructive",
        });
        return;
      }

      setUsers(data || []);
    } catch (error) {
      toast({
        title: "Erro ao carregar usuários",
        description: "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const deleteUser = async (userId: string, displayName: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) {
        toast({
          title: "Erro ao deletar usuário",
          description: "Tente novamente",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Usuário deletado",
        description: `${displayName} foi removido do sistema`,
      });

      // Reload users list
      loadUsers();
    } catch (error) {
      toast({
        title: "Erro ao deletar usuário",
        description: "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteAllUsers = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) {
        toast({
          title: "Erro ao deletar usuários",
          description: "Tente novamente",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Todos os usuários deletados",
        description: "O banco de dados foi limpo completamente",
      });

      // Reload users list
      loadUsers();
    } catch (error) {
      toast({
        title: "Erro ao deletar usuários",
        description: "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background mobile-container py-8 flex flex-col justify-center">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-4">
            <Shield className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-3xl font-bold text-destructive">
            Acesso Administrativo
          </h1>
          <p className="text-muted-foreground mt-2">
            Digite a senha administrativa
          </p>
        </div>

        <Card className="w-full card-shadow border-0">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-xl">Painel Administrativo</CardTitle>
            <CardDescription>
              Acesso restrito - senha obrigatória
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdminLogin} className="space-y-6">
              <div>
                <Input
                  type="password"
                  placeholder="Senha administrativa"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mobile-input"
                  required
                />
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
                    <Shield className="w-4 h-4 mr-2" />
                    Acessar Painel
                  </>
                )}
              </Button>
            </form>
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
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="mobile-container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-destructive" />
              </div>
              <h1 className="text-xl font-bold text-destructive">
                Painel Admin
              </h1>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
            >
              Sair
            </Button>
          </div>
        </div>
      </div>

      <div className="mobile-container py-6">
        {/* Stats Card */}
        <Card className="mb-6 card-shadow border-0">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">{users.length}</h3>
                <p className="text-muted-foreground">Usuários cadastrados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card className="card-shadow border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>Usuários Cadastrados</span>
            </CardTitle>
            <CardDescription>
              Gerencie todos os usuários da VilaAurora
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Deletar Todos os Usuários
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center space-x-2">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                      <span>Deletar TODOS os usuários?</span>
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação irá <strong>DELETAR PERMANENTEMENTE</strong> todos os {users.length} usuários cadastrados. 
                      Esta ação não pode ser desfeita!
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={deleteAllUsers}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      SIM, DELETAR TODOS
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {loadingUsers ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum usuário cadastrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                        <span className="text-sm font-semibold text-white">
                          {user.display_name[0]}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium">{user.display_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {user.username} • {new Date(user.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center space-x-2">
                            <AlertTriangle className="w-5 h-5 text-destructive" />
                            <span>Confirmar exclusão</span>
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir o usuário <strong>{user.display_name}</strong>? 
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteUser(user.id, user.display_name)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir usuário
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        <Button
          variant="ghost"
          onClick={() => navigate('/feed')}
          className="mt-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar ao Feed
        </Button>
      </div>
    </div>
  );
};

export default Admin;