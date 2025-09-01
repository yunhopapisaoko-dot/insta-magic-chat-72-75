import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, UserPlus, AtSign, Check, CheckCheck } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NotificationsListProps {
  onNotificationClick?: () => void;
}

const NotificationsList = ({ onNotificationClick }: NotificationsListProps) => {
  const navigate = useNavigate();
  const { notifications, loading, markAsRead, markAllAsRead } = useNotifications();

  const fetchUserProfileAndNavigate = async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .single();
      
      if (profile?.username) {
        navigate(`/user/${profile.username}`);
      } else {
        navigate('/feed');
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      navigate('/feed');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="w-4 h-4 text-red-500" />;
      case 'comment':
        return <MessageCircle className="w-4 h-4 text-blue-500" />;
      case 'comment_like':
        return <Heart className="w-4 h-4 text-pink-500" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-green-500" />;
      case 'post_tag':
      case 'story_tag':
        return <AtSign className="w-4 h-4 text-purple-500" />;
      case 'mention':
        return <AtSign className="w-4 h-4 text-purple-500" />;
      default:
        return <Heart className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const handleNotificationClick = async (notification: any) => {
    try {
      // Always mark as read when clicked, regardless of current status
      await markAsRead(notification.id);

      // Close the notifications panel if callback provided
      onNotificationClick?.();

      // Small delay to ensure the update is processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Navigate based on notification type and entity
      if (notification.entity_type === 'post' && notification.entity_id) {
        navigate(`/post/${notification.entity_id}`);
      } else if (notification.entity_type === 'story' && notification.entity_id) {
        // Para notificações de story, navegar para o feed onde stories são visualizadas
        navigate('/feed');
      } else if (notification.entity_type === 'comment' && notification.entity_id) {
        // For comment notifications and likes, navigate to the post
        // We'll need to get the post_id from the comment
        // For now, navigate to feed and let user find the post
        navigate('/feed');
      } else if (notification.entity_type === 'user' && notification.actor_id) {
        // For follow notifications, navigate to the follower's profile
        // Use actor_id to get the username first, then navigate
        fetchUserProfileAndNavigate(notification.actor_id);
      } else if (notification.type === 'follow' && notification.actor_id) {
        // Navigate to follower's profile
        fetchUserProfileAndNavigate(notification.actor_id);
      } else {
        // Fallback to feed
        navigate('/feed');
      }
    } catch (error) {
      console.error('Error handling notification click:', error);
      // Close panel and navigate even if marking as read fails
      onNotificationClick?.();
      navigate('/feed');
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <Card className="card-shadow border-0">
        <CardContent className="p-12 text-center">
          <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhuma notificação</h3>
          <p className="text-muted-foreground">
            Você não tem notificações ainda
          </p>
        </CardContent>
      </Card>
    );
  }

  const unreadNotifications = notifications.filter(n => !n.is_read);

  return (
    <div className="space-y-4">
      {/* Header with mark all as read */}
      {unreadNotifications.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {unreadNotifications.length} não lidas
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllAsRead}
            className="text-primary hover:text-primary/80"
          >
            <CheckCheck className="w-4 h-4 mr-1" />
            Marcar todas como lidas
          </Button>
        </div>
      )}

      {/* Notifications list */}
      <div className="space-y-2">
        {notifications.map((notification) => (
          <Card
            key={notification.id}
            className={`cursor-pointer transition-all hover:shadow-md border-0 group ${
              !notification.is_read 
                ? 'bg-primary/5 border-l-4 border-l-primary' 
                : 'card-shadow'
            }`}
            onClick={() => handleNotificationClick(notification)}
          >
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  {getNotificationIcon(notification.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${
                        !notification.is_read ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {notification.title}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-2">
                      {!notification.is_read && (
                        <div className="w-2 h-2 bg-primary rounded-full" />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!notification.is_read) {
                            markAsRead(notification.id);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default NotificationsList;