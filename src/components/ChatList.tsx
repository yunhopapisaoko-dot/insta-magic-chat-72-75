import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle, Search, Users, LogOut, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useOptimizedConversations } from '@/hooks/useOptimizedConversations';
import { type Conversation } from '@/hooks/useConversations';
import { useAuth } from '@/hooks/useAuth';
import Chat from '@/components/Chat';
import InfinitePublicChat from '@/components/InfinitePublicChat';
import MobileLayout from '@/components/MobileLayout';
import { CreateChatModal } from '@/components/CreateChatModal';
import ConversationItem from '@/components/ConversationItem';

const ChatList = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { 
    conversations, 
    loading, 
    error,
    markMessagesAsRead,
    fetchConversations
  } = useOptimizedConversations();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(
    searchParams.get('chat') || null
  );
  const [showPublicChat, setShowPublicChat] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showCreateChat, setShowCreateChat] = useState(false);

  // Auto-open chat from URL parameter
  useEffect(() => {
    const chatId = searchParams.get('chat');
    if (chatId && chatId !== selectedConversation) {
      setSelectedConversation(chatId);
    }
  }, [searchParams, selectedConversation]);

  const filteredConversations = conversations.filter(conv =>
    conv.other_user.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.other_user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMilliseconds = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMilliseconds / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInMinutes < 1) return 'agora';
    if (diffInMinutes < 60) return `${diffInMinutes}min`;
    if (diffInHours < 24) return `${diffInHours}h`;
    if (diffInDays < 7) return `${diffInDays}d`;
    
    // Show exact time for older messages
    return date.toLocaleString('pt-BR', { 
      day: '2-digit',
      month: '2-digit', 
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatLastMessage = (message: string | null) => {
    if (!message) return 'Conversa iniciada';
    return message.length > 40 ? `${message.substring(0, 40)}...` : message;
  };

  const handleBackToList = () => {
    setSelectedConversation(null);
    // Remove chat parameter from URL
    searchParams.delete('chat');
    setSearchParams(searchParams);
  };

  const handleLogout = async () => {
    if (confirm('Tem certeza que deseja sair das conversas?')) {
      setLoggingOut(true);
      await logout();
      navigate('/login');
    }
  };

  const handleChatCreated = (chatId: string) => {
    setSelectedConversation(chatId);
    // Add chat parameter to URL
    searchParams.set('chat', chatId);
    setSearchParams(searchParams);
    // Mark messages as read when opening the conversation
    markMessagesAsRead(chatId);
  };

  const handleConversationSelect = (conversationId: string) => {
    setSelectedConversation(conversationId);
    // Add chat parameter to URL
    searchParams.set('chat', conversationId);
    setSearchParams(searchParams);
    // Mark messages as read when opening the conversation
    markMessagesAsRead(conversationId);
  };

  const handleLeaveChat = async (conversationId: string) => {
    // Se era o chat atualmente selecionado, voltar para a lista
    if (selectedConversation === conversationId) {
      handleBackToList();
    }
    // Atualizar a lista de conversas
    setTimeout(() => {
      fetchConversations();
    }, 500);
  };

  if (selectedConversation) {
    return (
      <Chat 
        conversationId={selectedConversation}
        onBack={handleBackToList}
      />
    );
  }

  if (showPublicChat) {
    return (
      <InfinitePublicChat 
        onBack={() => setShowPublicChat(false)}
      />
    );
  }

  return (
    <MobileLayout>
      <div className="mobile-container py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full magic-gradient flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Conversas
            </h1>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          >
            {loggingOut ? (
              <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <LogOut className="w-5 h-5" />
            )}
          </Button>
        </div>

        {/* Public Chat Button */}
        <Button
          onClick={() => setShowPublicChat(true)}
          className="w-full rounded-xl mb-4 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 p-4 shadow-lg"
        >
          <Users className="w-6 h-6 mr-3" />
          <span className="text-lg font-semibold">Chat Público</span>
        </Button>

        {/* Create Chat Button */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Suas Conversas</h2>
          <Button
            onClick={() => setShowCreateChat(true)}
            size="sm"
            className="w-10 h-10 p-0 rounded-full bg-gradient-to-r from-secondary to-accent hover:from-secondary/90 hover:to-accent/90"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-xl border-0 bg-muted/50"
          />
        </div>

        {/* Conversations List */}
        <div className="space-y-2">
          {loading ? (
            <Card className="card-shadow border-0">
              <CardContent className="p-8 text-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Carregando conversas...</h3>
                <p className="text-muted-foreground text-sm">Aguarde um momento</p>
              </CardContent>
            </Card>
          ) : error ? (
            <Card className="card-shadow border-0">
              <CardContent className="p-8 text-center">
                <MessageCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-destructive">Erro ao carregar</h3>
                <p className="text-muted-foreground">{error}</p>
              </CardContent>
            </Card>
          ) : filteredConversations.length === 0 ? (
            <Card className="card-shadow border-0">
              <CardContent className="p-8 text-center">
                <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma conversa ainda</h3>
                <p className="text-muted-foreground">
                  {searchTerm 
                    ? 'Nenhuma conversa encontrada para sua busca'
                    : 'Inicie uma conversa vendo os stories dos seus amigos!'
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                onSelect={handleConversationSelect}
                formatTimeAgo={formatTimeAgo}
                formatLastMessage={formatLastMessage}
                onLeaveChat={handleLeaveChat}
              />
            ))
          )}
        </div>
        
        {/* Create Chat Modal */}
        <CreateChatModal
          isOpen={showCreateChat}
          onClose={() => setShowCreateChat(false)}
          onChatCreated={handleChatCreated}
        />
      </div>
    </MobileLayout>
  );
};

export default ChatList;