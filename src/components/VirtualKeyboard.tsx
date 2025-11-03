import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Delete, Space, X } from 'lucide-react';

interface VirtualKeyboardProps {
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  onSpace: () => void;
  onClose: () => void;
  currentValue: string;
}

const VirtualKeyboard = ({ onKeyPress, onBackspace, onSpace, onClose, currentValue }: VirtualKeyboardProps) => {
  const [isUpperCase, setIsUpperCase] = useState(false);
  const [isSymbols, setIsSymbols] = useState(false);

  const lettersRow1 = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];
  const lettersRow2 = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'];
  const lettersRow3 = ['z', 'x', 'c', 'v', 'b', 'n', 'm'];

  const symbolsRow1 = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  const symbolsRow2 = ['@', '#', '$', '_', '&', '-', '+', '(', ')', '/'];
  const symbolsRow3 = ['*', '"', "'", ':', ';', '!', '?', ',', '.'];

  const row1 = isSymbols ? symbolsRow1 : lettersRow1;
  const row2 = isSymbols ? symbolsRow2 : lettersRow2;
  const row3 = isSymbols ? symbolsRow3 : lettersRow3;

  const handleKeyPress = (key: string) => {
    const char = isUpperCase && !isSymbols ? key.toUpperCase() : key;
    onKeyPress(char);
  };

  return (
    <div className="w-full bg-background border-t border-border shadow-2xl animate-slide-up">
      {/* Preview Area - Compacta */}
      <div className="px-3 py-2 bg-muted/40 backdrop-blur-sm border-b border-border/30 flex items-center justify-between">
        <div className="flex-1 min-w-0 mr-2">
          <div className="text-xs truncate text-foreground">
            {currentValue || <span className="text-muted-foreground/60">Digite...</span>}
          </div>
        </div>
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0 rounded-full hover:bg-destructive/20 hover:text-destructive"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Keyboard - Compacto */}
      <div className="p-2 pb-1 space-y-1.5">
        {/* First Row */}
        <div className="flex gap-1 justify-center">
          {row1.map((key) => (
            <Button
              key={key}
              onClick={() => handleKeyPress(key)}
              variant="outline"
              className="h-10 min-w-[28px] flex-1 max-w-[36px] text-base font-semibold bg-muted hover:bg-primary hover:text-primary-foreground active:scale-95 transition-all rounded-md border-border/50"
            >
              {isUpperCase && !isSymbols ? key.toUpperCase() : key}
            </Button>
          ))}
        </div>

        {/* Second Row */}
        <div className="flex gap-1 justify-center px-2">
          {row2.map((key) => (
            <Button
              key={key}
              onClick={() => handleKeyPress(key)}
              variant="outline"
              className="h-10 min-w-[28px] flex-1 max-w-[36px] text-base font-semibold bg-muted hover:bg-primary hover:text-primary-foreground active:scale-95 transition-all rounded-md border-border/50"
            >
              {isUpperCase && !isSymbols ? key.toUpperCase() : key}
            </Button>
          ))}
        </div>

        {/* Third Row */}
        <div className="flex gap-1 justify-center">
          <Button
            onClick={() => setIsUpperCase(!isUpperCase)}
            variant="outline"
            className="h-10 px-3 text-lg font-bold bg-muted hover:bg-accent hover:text-accent-foreground active:scale-95 transition-all rounded-md border-border/50"
          >
            {isUpperCase ? '⇩' : '⇧'}
          </Button>
          {row3.map((key) => (
            <Button
              key={key}
              onClick={() => handleKeyPress(key)}
              variant="outline"
              className="h-10 min-w-[28px] flex-1 max-w-[36px] text-base font-semibold bg-muted hover:bg-primary hover:text-primary-foreground active:scale-95 transition-all rounded-md border-border/50"
            >
              {isUpperCase && !isSymbols ? key.toUpperCase() : key}
            </Button>
          ))}
          <Button
            onClick={onBackspace}
            variant="outline"
            className="h-10 px-3 bg-muted hover:bg-destructive hover:text-destructive-foreground active:scale-95 transition-all rounded-md border-border/50"
          >
            <Delete className="w-5 h-5" />
          </Button>
        </div>

        {/* Fourth Row */}
        <div className="flex gap-1 justify-center mb-1">
          <Button
            onClick={() => setIsSymbols(!isSymbols)}
            variant="outline"
            className="h-10 px-4 text-xs font-bold bg-muted hover:bg-accent hover:text-accent-foreground active:scale-95 transition-all rounded-md border-border/50"
          >
            {isSymbols ? 'ABC' : '123'}
          </Button>
          <Button
            onClick={onSpace}
            variant="outline"
            className="h-10 flex-1 text-xs font-medium bg-muted hover:bg-primary hover:text-primary-foreground active:scale-95 transition-all rounded-md border-border/50"
          >
            espaço
          </Button>
          <Button
            onClick={() => handleKeyPress('.')}
            variant="outline"
            className="h-10 px-4 text-xl font-bold bg-muted hover:bg-primary hover:text-primary-foreground active:scale-95 transition-all rounded-md border-border/50"
          >
            .
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            className="h-10 px-3 text-xs font-bold bg-muted hover:bg-accent hover:text-accent-foreground active:scale-95 transition-all rounded-md border-border/50"
          >
            ✓
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VirtualKeyboard;
