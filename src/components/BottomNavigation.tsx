import { Home, Search, Plus, User, MessageCircle } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const BottomNavigation = () => {
  const navItems = [
    { icon: Home, path: '/feed', label: 'Feed' },
    { icon: Search, path: '/explore', label: 'Explorar' },
    { icon: Plus, path: '/create', label: 'Post', isSpecial: true },
    { icon: MessageCircle, path: '/messages', label: 'Chat' },
    { icon: User, path: '/profile', label: 'Perfil' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
      <div className="mobile-container py-2">
        <div className="flex justify-around items-center">
          {navItems.map(({ icon: Icon, path, label, isSpecial }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200',
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
              <span className={cn(
                'text-xs mt-1 font-medium',
                isSpecial ? 'text-white' : ''
              )}>
                {label}
              </span>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BottomNavigation;