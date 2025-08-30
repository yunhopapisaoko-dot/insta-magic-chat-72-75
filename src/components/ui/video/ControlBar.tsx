import React from 'react';
import { Button } from '@/components/ui/button';
import { Maximize2, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { formatTime } from '@/hooks/useVideoController';

interface ControlBarProps {
  isPlaying: boolean;
  isMuted: boolean;
  currentTime: number;
  duration: number; // 0 when unknown
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onFullscreen: () => void;
}

const ControlBar: React.FC<ControlBarProps> = ({
  isPlaying,
  isMuted,
  currentTime,
  duration,
  onTogglePlay,
  onToggleMute,
  onFullscreen,
}) => {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onTogglePlay} className="text-foreground hover:bg-foreground/10 w-8 h-8 p-0">
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={onToggleMute} className="text-foreground hover:bg-foreground/10 w-8 h-8 p-0">
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </Button>
        <span className="text-xs font-medium text-foreground/80">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
      <Button variant="ghost" size="sm" onClick={onFullscreen} className="text-foreground hover:bg-foreground/10 w-8 h-8 p-0">
        <Maximize2 className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default ControlBar;
