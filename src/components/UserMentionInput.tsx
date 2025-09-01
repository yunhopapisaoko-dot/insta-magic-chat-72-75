import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { stripUserDigits } from '@/lib/utils';

interface User {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
}

interface UserMentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyPress?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const UserMentionInput = ({ 
  value, 
  onChange, 
  onKeyPress, 
  placeholder, 
  disabled, 
  className 
}: UserMentionInputProps) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search for users when typing @
  useEffect(() => {
    const searchUsers = async () => {
      if (!mentionQuery || mentionQuery.length < 1) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .or(`display_name.ilike.%${mentionQuery}%,username.ilike.%${mentionQuery}%`)
          .limit(5);

        if (data) {
          setSuggestions(data);
          setShowSuggestions(data.length > 0);
          setSelectedIndex(0);
        }
      } catch (error) {
        console.error('Error searching users:', error);
      }
    };

    searchUsers();
  }, [mentionQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const position = e.target.selectionStart || 0;
    
    onChange(newValue);
    setCursorPosition(position);

    // Check if we're typing after an @ symbol
    const textBeforeCursor = newValue.slice(0, position);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1) {
      const afterAt = textBeforeCursor.slice(atIndex + 1);
      
      // Check if there's no space after @
      if (!afterAt.includes(' ') && afterAt.length >= 0) {
        setMentionQuery(afterAt);
      } else {
        setMentionQuery('');
        setShowSuggestions(false);
      }
    } else {
      setMentionQuery('');
      setShowSuggestions(false);
    }
  };

  const insertMention = (user: User) => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1) {
      const beforeAt = textBeforeCursor.slice(0, atIndex);
      const mentionText = `@${stripUserDigits(user.display_name)} `;
      const newValue = beforeAt + mentionText + textAfterCursor;
      
      onChange(newValue);
      setShowSuggestions(false);
      setMentionQuery('');
      
      // Focus back to input after mention insertion
      setTimeout(() => {
        inputRef.current?.focus();
        const newPosition = beforeAt.length + mentionText.length;
        inputRef.current?.setSelectionRange(newPosition, newPosition);
      }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          if (suggestions[selectedIndex]) {
            e.preventDefault();
            insertMention(suggestions[selectedIndex]);
            return;
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowSuggestions(false);
          setMentionQuery('');
          break;
      }
    }
    
    if (onKeyPress) {
      onKeyPress(e);
    }
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-background border border-border rounded-2xl shadow-lg z-50 animate-scale-in">
          <div className="p-3">
            <span className="text-xs font-medium text-muted-foreground">Mencionar usuário</span>
          </div>
          <ScrollArea className="max-h-48">
            <div className="space-y-1 p-2">
              {suggestions.map((user, index) => (
                <div
                  key={user.id}
                  className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all duration-200 ${
                    index === selectedIndex 
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => insertMention(user)}
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user.avatar_url || ''} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs font-semibold">
                      {stripUserDigits(user.display_name)[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {stripUserDigits(user.display_name)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      @{user.username}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};