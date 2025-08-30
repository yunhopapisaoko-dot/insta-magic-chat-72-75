import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import ChatList from '@/components/ChatList';

const Messages = () => {
  const { user, loading } = useAuth();

  useEffect(() => {
    console.log('Messages page loaded', { user: user?.id, loading });
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Usuário não autenticado</p>
      </div>
    );
  }

  return <ChatList />;
};

export default Messages;