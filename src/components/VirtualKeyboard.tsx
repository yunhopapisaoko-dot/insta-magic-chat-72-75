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
    <div className="w-full bg-gradient-to-b from-background/98 to-background border-t border-border/50 shadow-2xl animate-slide-up">
      {/* Preview Area */}
      <div className="px-5 py-4 bg-muted/30 backdrop-blur-md border-b border-border/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Digitando</span>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full hover:bg-destructive/20 hover:text-destructive transition-colors"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        <div className="min-h-[56px] max-h-[90px] overflow-y-auto bg-background/60 rounded-xl px-4 py-3 text-base break-words border border-border/50 shadow-inner">
          {currentValue || <span className="text-muted-foreground/50">Digite aqui...</span>}
        </div>
      </div>

      {/* Keyboard */}
      <div className="p-4 space-y-3">
        {/* First Row */}
        <div className="flex gap-2 justify-center">
          {row1.map((key) => (
            <Button
              key={key}
              onClick={() => handleKeyPress(key)}
              variant="outline"
              className="h-14 min-w-[34px] flex-1 text-xl font-semibold bg-card hover:bg-primary hover:text-primary-foreground active:scale-95 transition-all rounded-xl shadow-md border-border/50"
            >
              {isUpperCase && !isSymbols ? key.toUpperCase() : key}
            </Button>
          ))}
        </div>

        {/* Second Row */}
        <div className="flex gap-2 justify-center px-3">
          {row2.map((key) => (
            <Button
              key={key}
              onClick={() => handleKeyPress(key)}
              variant="outline"
              className="h-14 min-w-[34px] flex-1 text-xl font-semibold bg-card hover:bg-primary hover:text-primary-foreground active:scale-95 transition-all rounded-xl shadow-md border-border/50"
            >
              {isUpperCase && !isSymbols ? key.toUpperCase() : key}
            </Button>
          ))}
        </div>

        {/* Third Row */}
        <div className="flex gap-2 justify-center">
          <Button
            onClick={() => setIsUpperCase(!isUpperCase)}
            variant="outline"
            className="h-14 px-5 text-2xl font-bold bg-card hover:bg-accent hover:text-accent-foreground active:scale-95 transition-all rounded-xl shadow-md border-border/50"
          >
            {isUpperCase ? '⇩' : '⇧'}
          </Button>
          {row3.map((key) => (
            <Button
              key={key}
              onClick={() => handleKeyPress(key)}
              variant="outline"
              className="h-14 min-w-[34px] flex-1 text-xl font-semibold bg-card hover:bg-primary hover:text-primary-foreground active:scale-95 transition-all rounded-xl shadow-md border-border/50"
            >
              {isUpperCase && !isSymbols ? key.toUpperCase() : key}
            </Button>
          ))}
          <Button
            onClick={onBackspace}
            variant="outline"
            className="h-14 px-5 bg-card hover:bg-destructive hover:text-destructive-foreground active:scale-95 transition-all rounded-xl shadow-md border-border/50"
          >
            <Delete className="w-6 h-6" />
          </Button>
        </div>

        {/* Fourth Row */}
        <div className="flex gap-2 justify-center">
          <Button
            onClick={() => setIsSymbols(!isSymbols)}
            variant="outline"
            className="h-14 px-6 text-base font-bold bg-card hover:bg-accent hover:text-accent-foreground active:scale-95 transition-all rounded-xl shadow-md border-border/50"
          >
            {isSymbols ? 'ABC' : '123'}
          </Button>
          <Button
            onClick={onSpace}
            variant="outline"
            className="h-14 flex-1 text-sm font-semibold bg-card hover:bg-primary hover:text-primary-foreground active:scale-95 transition-all rounded-xl shadow-md border-border/50"
          >
            espaço
          </Button>
          <Button
            onClick={() => handleKeyPress('.')}
            variant="outline"
            className="h-14 px-6 text-2xl font-bold bg-card hover:bg-primary hover:text-primary-foreground active:scale-95 transition-all rounded-xl shadow-md border-border/50"
          >
            .
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VirtualKeyboard;
