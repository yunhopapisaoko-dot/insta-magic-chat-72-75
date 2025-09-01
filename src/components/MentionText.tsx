import { useNavigate } from 'react-router-dom';

interface MentionTextProps {
  text: string;
  className?: string;
}

export const MentionText = ({ text, className = '' }: MentionTextProps) => {
  const navigate = useNavigate();

  const renderTextWithMentions = (content: string) => {
    // Regex para detectar menções (@username)
    const mentionRegex = /@(\w+)/g;
    const parts = content.split(mentionRegex);
    
    return parts.map((part, index) => {
      // Se o índice é ímpar, é um username (parte capturada pelo regex)
      if (index % 2 === 1) {
        return (
          <span
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/user/${part}`);
            }}
            className="text-primary font-semibold cursor-pointer hover:underline transition-all duration-200"
          >
            @{part}
          </span>
        );
      }
      // Caso contrário, é texto normal
      return part;
    });
  };

  return (
    <span className={className}>
      {renderTextWithMentions(text)}
    </span>
  );
};