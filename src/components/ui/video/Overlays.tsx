import React from 'react';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';

export const PlayOverlay: React.FC<{ onPlay: () => void } > = ({ onPlay }) => (
  <div className="absolute inset-0 flex items-center justify-center bg-background/40 cursor-pointer" onClick={onPlay}>
    <div className="w-16 h-16 rounded-full bg-foreground/20 backdrop-blur-sm flex items-center justify-center hover:bg-foreground/30 transition-colors">
      <Play className="w-8 h-8 text-foreground ml-1" />
    </div>
  </div>
);

export const ErrorOverlay: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 text-foreground p-4">
    <div className="text-center">
      <div className="w-12 h-12 mb-3 mx-auto rounded-full bg-destructive/20 flex items-center justify-center">
        <Play className="w-6 h-6 text-destructive" />
      </div>
      <p className="text-sm font-medium mb-1">Erro no vídeo</p>
      <p className="text-xs text-foreground/70">{message}</p>
      <Button onClick={onRetry} variant="ghost" size="sm" className="mt-3">
        Tentar novamente
      </Button>
    </div>
  </div>
);

export const LoadingOverlay: React.FC = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-background/40">
    <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
  </div>
);
