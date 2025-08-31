import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Trash2, Edit3, Reply, MessageSquare } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface MessageContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
  isOwnMessage: boolean;
  messageContent: string;
  onCopy: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onReply: () => void;
}

export const MessageContextMenu = ({
  isOpen,
  onClose,
  position,
  isOwnMessage,
  messageContent,
  onCopy,
  onDelete,
  onEdit,
  onReply
}: MessageContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const menuItems = [
    {
      icon: Copy,
      label: 'Copiar',
      action: () => {
        onCopy();
        onClose();
      }
    },
    ...(isOwnMessage ? [
      {
        icon: Edit3,
        label: 'Editar',
        action: () => {
          onEdit();
          onClose();
        }
      },
      {
        icon: Trash2,
        label: 'Apagar',
        action: () => {
          onDelete();
          onClose();
        },
        destructive: true
      }
    ] : []),
    {
      icon: Reply,
      label: 'Responder',
      action: () => {
        onReply();
        onClose();
      }
    }
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      
      {/* Menu */}
      <div
        ref={menuRef}
        className="fixed z-50 bg-background border border-border rounded-lg shadow-lg py-2 min-w-32"
        style={{
          left: Math.min(position.x, window.innerWidth - 150),
          top: Math.min(position.y, window.innerHeight - 200),
        }}
      >
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <Button
              key={index}
              variant="ghost"
              size="sm"
              className={`w-full justify-start gap-2 px-3 py-2 h-auto font-normal ${
                item.destructive ? 'text-destructive hover:text-destructive' : ''
              }`}
              onClick={item.action}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Button>
          );
        })}
      </div>
    </>
  );
};