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
    <div className="w-full bg-gradient-to-b from-background/98 to-background border-t border-border/50 shadow-2xl">
      {/* Preview Area */}
      <div className="px-4 py-3 bg-muted/30 backdrop-blur-md border-b border-border/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Digitando</span>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full hover:bg-destructive/20 hover:text-destructive"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="min-h-[48px] max-h-[80px] overflow-y-auto bg-background/50 rounded-lg px-3 py-2 text-sm break-words border border-border/50">
          {currentValue || <span className="text-muted-foreground/50">Digite aqui...</span>}
        </div>
      </div>

      {/* Keyboard */}
      <div className="p-3 space-y-2">
        {/* First Row */}
        <div className="flex gap-1.5 justify-center">
          {row1.map((key) => (
            <Button
              key={key}
              onClick={() => handleKeyPress(key)}
              variant="outline"
              className="h-11 min-w-[28px] flex-1 text-base font-medium bg-card hover:bg-primary hover:text-primary-foreground active:scale-95 transition-all rounded-lg shadow-sm border-border/50"
            >
              {isUpperCase && !isSymbols ? key.toUpperCase() : key}
            </Button>
          ))}
        </div>

        {/* Second Row */}
        <div className="flex gap-1.5 justify-center px-2">
          {row2.map((key) => (
            <Button
              key={key}
              onClick={() => handleKeyPress(key)}
              variant="outline"
              className="h-11 min-w-[28px] flex-1 text-base font-medium bg-card hover:bg-primary hover:text-primary-foreground active:scale-95 transition-all rounded-lg shadow-sm border-border/50"
            >
              {isUpperCase && !isSymbols ? key.toUpperCase() : key}
            </Button>
          ))}
        </div>

        {/* Third Row */}
        <div className="flex gap-1.5 justify-center">
          <Button
            onClick={() => setIsUpperCase(!isUpperCase)}
            variant="outline"
            className="h-11 px-4 text-lg font-bold bg-card hover:bg-accent hover:text-accent-foreground active:scale-95 transition-all rounded-lg shadow-sm border-border/50"
          >
            {isUpperCase ? '⇩' : '⇧'}
          </Button>
          {row3.map((key) => (
            <Button
              key={key}
              onClick={() => handleKeyPress(key)}
              variant="outline"
              className="h-11 min-w-[28px] flex-1 text-base font-medium bg-card hover:bg-primary hover:text-primary-foreground active:scale-95 transition-all rounded-lg shadow-sm border-border/50"
            >
              {isUpperCase && !isSymbols ? key.toUpperCase() : key}
            </Button>
          ))}
          <Button
            onClick={onBackspace}
            variant="outline"
            className="h-11 px-4 bg-card hover:bg-destructive hover:text-destructive-foreground active:scale-95 transition-all rounded-lg shadow-sm border-border/50"
          >
            <Delete className="w-5 h-5" />
          </Button>
        </div>

        {/* Fourth Row */}
        <div className="flex gap-1.5 justify-center">
          <Button
            onClick={() => setIsSymbols(!isSymbols)}
            variant="outline"
            className="h-11 px-5 text-sm font-bold bg-card hover:bg-accent hover:text-accent-foreground active:scale-95 transition-all rounded-lg shadow-sm border-border/50"
          >
            {isSymbols ? 'ABC' : '123'}
          </Button>
          <Button
            onClick={onSpace}
            variant="outline"
            className="h-11 flex-1 text-xs font-medium bg-card hover:bg-primary hover:text-primary-foreground active:scale-95 transition-all rounded-lg shadow-sm border-border/50"
          >
            espaço
          </Button>
          <Button
            onClick={() => handleKeyPress('.')}
            variant="outline"
            className="h-11 px-5 text-lg font-bold bg-card hover:bg-primary hover:text-primary-foreground active:scale-95 transition-all rounded-lg shadow-sm border-border/50"
          >
            .
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VirtualKeyboard;
