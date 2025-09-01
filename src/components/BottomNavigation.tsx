import { Home, Search, Plus, User, MessageCircle } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { Badge } from '@/components/ui/badge';

const BottomNavigation = () => {
  const { unreadCount } = useUnreadMessages();
  
  const navItems = [
    { icon: Home, path: '/feed', label: 'Feed' },
    { icon: Search, path: '/explore', label: 'Explorar' },
    { icon: Plus, path: '/create', label: 'Post', isSpecial: true },
    { icon: MessageCircle, path: '/messages', label: 'Chat', hasCounter: true },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
      <div className="mobile-container py-2">
        <div className="flex justify-around items-center">
          {navItems.map(({ icon: Icon, path, label, isSpecial, hasCounter }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 relative',
                  isSpecial 
                    ? 'magic-gradient text-white shadow-lg' 
                    : isActive 
                      ? 'text-primary' 
                      : 'text-muted-foreground hover:text-foreground'
                )
              }
            >
              <Icon className={cn(
                'transition-all duration-200',
                isSpecial ? 'w-6 h-6' : 'w-5 h-5'
              )} />
              {hasCounter && unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                >
                  {unreadCount > 10 ? '+10' : unreadCount}
                </Badge>
              )}
              <span className={cn(
                'text-xs mt-1 font-medium',
                isSpecial ? 'text-white' : ''
              )}>
                {label}
              </span>
            </NavLink>
          ))}
          
          {/* Profile Link */}
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200',
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            <User className="w-5 h-5 transition-all duration-200" />
            <span className="text-xs mt-1 font-medium">
              Perfil
            </span>
          </NavLink>
        </div>
      </div>
    </div>
  );
};

export default BottomNavigation;