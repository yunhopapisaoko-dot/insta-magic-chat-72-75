import React from 'react';

interface ProgressBarProps {
  progress: number; // 0-100
  onSeek?: (percent: number) => void; // 0-1
  disabled?: boolean;
  isIndeterminate?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, onSeek, disabled, isIndeterminate }) => {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    onSeek(Math.min(1, Math.max(0, percent)));
  };

  return (
    <div className="w-full h-1 rounded-full bg-foreground/20 cursor-pointer" onClick={handleClick}>
      {isIndeterminate ? (
        <div className="relative w-full h-full overflow-hidden rounded-full">
          <div className="absolute inset-0 animate-pulse bg-foreground/30" />
        </div>
      ) : (
        <div
          className="h-full rounded-full bg-foreground transition-all duration-150"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      )}
    </div>
  );
};

export default ProgressBar;
