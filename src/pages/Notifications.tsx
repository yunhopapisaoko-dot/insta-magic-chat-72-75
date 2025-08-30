import { ArrowLeft, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '@/components/MobileLayout';
import NotificationsList from '@/components/NotificationsList';

const Notifications = () => {
  const navigate = useNavigate();

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