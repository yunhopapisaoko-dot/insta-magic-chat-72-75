import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useVideoController } from '@/hooks/useVideoController';
import ProgressBar from '@/components/ui/video/ProgressBar';
import ControlBar from '@/components/ui/video/ControlBar';
import { ErrorOverlay, LoadingOverlay, PlayOverlay } from '@/components/ui/video/Overlays';

interface VideoPlayerProps {
  src: string;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  poster?: string;
  onPlayStateChange?: (isPlaying: boolean) => void;
}

const VideoPlayer = ({
  src,
  className,
  autoPlay = false,
  loop = false,
  poster,
  onPlayStateChange,
}: VideoPlayerProps) => {
  const ctrl = useVideoController({ autoPlay, loop, onPlayStateChange });

  const handleVideoClick = useCallback(() => {
    if (ctrl.showControls) ctrl.togglePlay();
    else ctrl.showControlsTemporarily();
  }, [ctrl]);

  const handleRetry = useCallback(() => {
    ctrl.showControlsTemporarily();
    ctrl.videoRef.current?.load();
  }, [ctrl]);

  return (
    <div
      className={cn('relative group overflow-hidden rounded-lg bg-background', className)}
      onMouseEnter={ctrl.showControlsTemporarily}
      onMouseMove={ctrl.showControlsTemporarily}
    >
      <video
        ref={ctrl.videoRef}
        src={src}
        poster={poster}
        className="w-full h-full object-cover cursor-pointer"
        autoPlay={autoPlay}
        loop={loop}
        muted={ctrl.isMuted}
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        onClick={handleVideoClick}
        {...ctrl.bind}
      />

      {!ctrl.isPlaying && !ctrl.error && !ctrl.loading && (
        <PlayOverlay onPlay={ctrl.togglePlay} />
      )}

      {!ctrl.error && (
        <div
          className={cn(
            'pointer-events-none absolute inset-0 transition-opacity duration-300',
            ctrl.showControls || !ctrl.isPlaying ? 'opacity-100' : 'opacity-0'
          )}
        >
          <div className="absolute bottom-12 left-4 right-4 pointer-events-auto">
            <ProgressBar
              progress={ctrl.progress}
              isIndeterminate={!Number.isFinite(ctrl.duration) || ctrl.duration <= 0}
              onSeek={(p) => ctrl.seekToPercent(p)}
            />
          </div>

          <div className="absolute bottom-2 left-0 right-0 pointer-events-auto">
            <ControlBar
              isPlaying={ctrl.isPlaying}
              isMuted={ctrl.isMuted}
              currentTime={ctrl.currentTime}
              duration={ctrl.duration}
              onTogglePlay={ctrl.togglePlay}
              onToggleMute={ctrl.toggleMute}
              onFullscreen={ctrl.requestFullscreen}
            />
          </div>
        </div>
      )}

      {ctrl.error && (
        <ErrorOverlay message={ctrl.error} onRetry={handleRetry} />
      )}

      {ctrl.loading && !ctrl.error && <LoadingOverlay />}
    </div>
  );
};

export default VideoPlayer;
