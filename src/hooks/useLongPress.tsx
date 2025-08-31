import { useCallback, useRef } from 'react';

interface LongPressOptions {
  onLongPress: (event: React.TouchEvent | React.MouseEvent) => void;
  onClick?: (event: React.TouchEvent | React.MouseEvent) => void;
  delay?: number;
}

export const useLongPress = ({ onLongPress, onClick, delay = 500 }: LongPressOptions) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const start = useCallback((event: React.TouchEvent | React.MouseEvent) => {
    isLongPressRef.current = false;
    
    timeoutRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onLongPress(event);
    }, delay);
  }, [onLongPress, delay]);

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleClick = useCallback((event: React.TouchEvent | React.MouseEvent) => {
    if (!isLongPressRef.current && onClick) {
      onClick(event);
    }
    isLongPressRef.current = false;
  }, [onClick]);

  return {
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchCancel: clear,
    onClick: handleClick,
  };
};