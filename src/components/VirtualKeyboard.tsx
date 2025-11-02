import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Delete, Space } from 'lucide-react';

interface VirtualKeyboardProps {
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  onSpace: () => void;
  onClose: () => void;
}

const VirtualKeyboard = ({ onKeyPress, onBackspace, onSpace, onClose }: VirtualKeyboardProps) => {
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
    <Card className="w-full p-2 bg-card/95 backdrop-blur-sm border-primary/20">
      <div className="space-y-1">
        {/* First Row */}
        <div className="flex gap-1 justify-center">
          {row1.map((key) => (
            <Button
              key={key}
              onClick={() => handleKeyPress(key)}
              variant="outline"
              className="h-10 min-w-[32px] flex-1 text-sm font-semibold bg-muted hover:bg-primary hover:text-primary-foreground"
            >
              {isUpperCase && !isSymbols ? key.toUpperCase() : key}
            </Button>
          ))}
        </div>

        {/* Second Row */}
        <div className="flex gap-1 justify-center">
          {row2.map((key) => (
            <Button
              key={key}
              onClick={() => handleKeyPress(key)}
              variant="outline"
              className="h-10 min-w-[32px] flex-1 text-sm font-semibold bg-muted hover:bg-primary hover:text-primary-foreground"
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
            className="h-10 px-3 text-xs font-bold bg-muted hover:bg-primary hover:text-primary-foreground"
          >
            {isUpperCase ? '↓' : '↑'}
          </Button>
          {row3.map((key) => (
            <Button
              key={key}
              onClick={() => handleKeyPress(key)}
              variant="outline"
              className="h-10 min-w-[32px] flex-1 text-sm font-semibold bg-muted hover:bg-primary hover:text-primary-foreground"
            >
              {isUpperCase && !isSymbols ? key.toUpperCase() : key}
            </Button>
          ))}
          <Button
            onClick={onBackspace}
            variant="outline"
            className="h-10 px-3 bg-muted hover:bg-destructive hover:text-destructive-foreground"
          >
            <Delete className="w-4 h-4" />
          </Button>
        </div>

        {/* Fourth Row */}
        <div className="flex gap-1 justify-center">
          <Button
            onClick={() => setIsSymbols(!isSymbols)}
            variant="outline"
            className="h-10 px-4 text-xs font-bold bg-muted hover:bg-primary hover:text-primary-foreground"
          >
            {isSymbols ? 'ABC' : '#+='}
          </Button>
          <Button
            onClick={onSpace}
            variant="outline"
            className="h-10 flex-1 bg-muted hover:bg-primary hover:text-primary-foreground"
          >
            <Space className="w-4 h-4" />
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            className="h-10 px-4 text-xs font-bold bg-muted hover:bg-accent hover:text-accent-foreground"
          >
            Fechar
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default VirtualKeyboard;
