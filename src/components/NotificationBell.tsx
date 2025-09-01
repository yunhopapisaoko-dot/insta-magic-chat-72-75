import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import NotificationsList from '@/components/NotificationsList';

const NotificationBell = () => {
  const { unreadCount, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);

  // Marcar todas as notificações como lidas quando o modal abrir
  useEffect(() => {
    if (open && unreadCount > 0) {
      // Pequeno delay para garantir que o modal foi aberto
      const timer = setTimeout(() => {
        markAllAsRead();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [open, unreadCount, markAllAsRead]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="relative p-1">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-left">Notificações</SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 h-full overflow-auto pb-20">
          <NotificationsList onNotificationClick={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default NotificationBell;