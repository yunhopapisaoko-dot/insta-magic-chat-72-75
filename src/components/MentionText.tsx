import React from 'react';
import { useNavigate } from 'react-router-dom';
import { stripUserDigits } from '@/lib/utils';

interface MentionTextProps {
  text: string;
  className?: string;
}

export const MentionText = ({ text, className = "" }: MentionTextProps) => {
  const navigate = useNavigate();
  
  const renderTextWithMentions = (text: string) => {
    // Regex to find @mentions
    const mentionRegex = /@(\w+)/g;
    const parts = text.split(mentionRegex);
    
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        // This is a mention (every odd index after split)
        return (
          <span
            key={index}
            className="text-primary font-semibold cursor-pointer hover:underline animate-fade-in"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/user/${stripUserDigits(part)}`);
            }}
          >
            @{part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <span className={className}>
      {renderTextWithMentions(text)}
    </span>
  );
};