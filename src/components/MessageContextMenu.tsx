import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Reply, Copy, Trash2 } from 'lucide-react';

interface MessageContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onReply: () => void;
  onCopy: () => void;
  onDelete?: () => void;
  canDelete: boolean;
  messageText: string;
}

export const MessageContextMenu = ({
  isOpen,
  onClose,
  onReply,
  onCopy,
  onDelete,
  canDelete,
  messageText
}: MessageContextMenuProps) => {

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    onCopy();
    onClose();
  };

  const handleReply = () => {
    onReply();
    onClose();
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
    }
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-auto rounded-t-3xl border-0 bg-background p-0">
        <div className="p-6">
          <SheetHeader className="mb-4">
            <div className="flex items-center justify-center">
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
            </div>
            <SheetTitle className="text-center text-lg font-semibold mt-3">
              Opções da mensagem
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start h-12"
              onClick={handleReply}
            >
              <Reply className="w-5 h-5 mr-3" />
              Responder
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start h-12"
              onClick={handleCopy}
            >
              <Copy className="w-5 h-5 mr-3" />
              Copiar texto
            </Button>

            {canDelete && (
              <Button
                variant="ghost"
                className="w-full justify-start h-12 text-destructive hover:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="w-5 h-5 mr-3" />
                Deletar mensagem
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};