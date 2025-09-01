import { ArrowLeft, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import MobileLayout from '@/components/MobileLayout';
import NotificationsList from '@/components/NotificationsList';
import { useNotifications } from '@/hooks/useNotifications';

const Notifications = () => {
  const navigate = useNavigate();
  const { markAllAsRead, unreadCount } = useNotifications();

  // Marcar todas as notificações como lidas automaticamente ao abrir a página
  useEffect(() => {
    if (unreadCount > 0) {
      const timer = setTimeout(() => {
        markAllAsRead();
      }, 500); // Pequeno delay para melhor UX
      
      return () => clearTimeout(timer);
    }
  }, [unreadCount, markAllAsRead]);

  return (
    <MobileLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-background border-b border-border">
          <div className="mobile-container py-4">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="p-2"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center space-x-2">
                <Bell className="w-5 h-5 text-primary" />
                <h1 className="text-lg font-semibold">Notificações</h1>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mobile-container py-6">
          <NotificationsList />
        </div>
      </div>
    </MobileLayout>
  );
};

export default Notifications;