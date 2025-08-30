import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseVideoControllerOptions {
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  onPlayStateChange?: (isPlaying: boolean) => void;
}

export interface UseVideoControllerResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  isPlaying: boolean;
  isMuted: boolean;
  currentTime: number;
  duration: number; // 0 when unknown
  progress: number; // 0-100
  error: string | null;
  loading: boolean;
  showControls: boolean;
  // actions
  togglePlay: () => void;
  toggleMute: () => void;
  requestFullscreen: () => void;
  seekToPercent: (percent: number) => void; // 0-1
  showControlsTemporarily: () => void;
  // handlers to bind on <video>
  bind: {
    onLoadStart: () => void;
    onLoadedMetadata: () => void;
    onDurationChange: () => void;
    onLoadedData: () => void;
    onCanPlay: () => void;
    onTimeUpdate: () => void;
    onPlay: () => void;
    onPause: () => void;
    onError: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  };
}

export function useVideoController(options?: UseVideoControllerOptions): UseVideoControllerResult {
  const { autoPlay = false, loop = false, muted = true, onPlayStateChange } = options || {};

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(!!muted);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showControls, setShowControls] = useState(false);

  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triedDurationFix = useRef(false);
  const timeUpdateThrottleRef = useRef<NodeJS.Timeout | null>(null);

  const clearHideControlsTimer = () => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
  };

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    clearHideControlsTimer();
    hideControlsTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  const setFiniteDuration = useCallback((value: number) => {
    if (Number.isFinite(value) && !Number.isNaN(value) && value > 0) {
      setDuration(value);
      return true;
    }
    return false;
  }, []);

  const tryFixInfinityDuration = useCallback(() => {
    const v = videoRef.current;
    if (!v || triedDurationFix.current) return;
    triedDurationFix.current = true;

    // 1) Try seekable range end
    try {
      if (v.seekable && v.seekable.length > 0) {
        const end = v.seekable.end(v.seekable.length - 1);
        if (setFiniteDuration(end)) return;
      }
    } catch {}

    // 2) Force durationchange by seeking far ahead (Chrome/WebM fix)
    try {
      const huge = 1e101; // triggers durationchange
      v.currentTime = huge;
    } catch {}
  }, [setFiniteDuration]);

  const onLoadStart = useCallback(() => {
    setError(null);
    setLoading(true);
    setDuration(0);
    setCurrentTime(0);
    setProgress(0);
    triedDurationFix.current = false;
  }, []);

  const onLoadedMetadata = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    // Try to read a valid duration
    if (!setFiniteDuration(v.duration)) {
      tryFixInfinityDuration();
    } else {
      setLoading(false);
    }
  }, [setFiniteDuration, tryFixInfinityDuration]);

  const onDurationChange = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (setFiniteDuration(v.duration)) {
      setLoading(false);
      // If we previously jumped to a huge time, reset to 0
      try {
        if (v.currentTime > v.duration) v.currentTime = 0;
      } catch {}
    }
  }, [setFiniteDuration]);

  const onLoadedData = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!setFiniteDuration(v.duration)) {
      tryFixInfinityDuration();
    } else {
      setLoading(false);
    }
  }, [setFiniteDuration, tryFixInfinityDuration]);

  const onCanPlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!setFiniteDuration(v.duration)) {
      tryFixInfinityDuration();
    } else {
      setLoading(false);
      if (autoPlay) {
        v.play().catch(() => {});
      }
    }
  }, [autoPlay, setFiniteDuration, tryFixInfinityDuration]);

  const onTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    
    // Throttle time updates to prevent excessive re-renders
    if (timeUpdateThrottleRef.current) {
      clearTimeout(timeUpdateThrottleRef.current);
    }
    
    timeUpdateThrottleRef.current = setTimeout(() => {
      if (!v) return;
      const ct = v.currentTime;
      const dur = v.duration;

      if (Number.isFinite(ct)) setCurrentTime(ct);

      if (Number.isFinite(dur) && dur > 0) {
        const p = (ct / dur) * 100;
        if (Number.isFinite(p)) setProgress(Math.min(100, Math.max(0, p)));
      }
    }, 100); // Update every 100ms instead of every frame
  }, []);

  const onPlay = useCallback(() => {
    setIsPlaying(true);
    onPlayStateChange?.(true);
  }, [onPlayStateChange]);

  const onPause = useCallback(() => {
    setIsPlaying(false);
    onPlayStateChange?.(false);
  }, [onPlayStateChange]);

  const onError = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    const err = v.error;
    let msg = 'Erro ao carregar vídeo';
    if (err) {
      switch (err.code) {
        case err.MEDIA_ERR_ABORTED:
          msg = 'Carregamento interrompido';
          break;
        case err.MEDIA_ERR_NETWORK:
          msg = 'Erro de rede';
          break;
        case err.MEDIA_ERR_DECODE:
          msg = 'Erro de decodificação';
          break;
        case err.MEDIA_ERR_SRC_NOT_SUPPORTED:
          msg = 'Formato não suportado';
          break;
      }
    }
    setError(msg);
    setLoading(false);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  }, []);

  const requestFullscreen = useCallback(() => {
    const v = videoRef.current;
    v?.requestFullscreen?.();
  }, []);

  const seekToPercent = useCallback((percent: number) => {
    const v = videoRef.current;
    if (!v) return;
    if (!(Number.isFinite(duration) && duration > 0)) return;
    const clamped = Math.min(1, Math.max(0, percent));
    v.currentTime = clamped * duration;
  }, [duration]);

  // keep muted state in sync when element mounts
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      videoRef.current.loop = loop;
    }
  }, [isMuted, loop]);

  // Cleanup throttle timeout on unmount
  useEffect(() => {
    return () => {
      clearHideControlsTimer();
      if (timeUpdateThrottleRef.current) {
        clearTimeout(timeUpdateThrottleRef.current);
      }
    };
  }, []);

  return {
    videoRef,
    isPlaying,
    isMuted,
    currentTime,
    duration,
    progress,
    error,
    loading,
    showControls,
    togglePlay,
    toggleMute,
    requestFullscreen,
    seekToPercent,
    showControlsTemporarily,
    bind: {
      onLoadStart,
      onLoadedMetadata,
      onDurationChange,
      onLoadedData,
      onCanPlay,
      onTimeUpdate,
      onPlay,
      onPause,
      onError,
    },
  };
}

export function formatTime(time: number) {
  if (!Number.isFinite(time) || Number.isNaN(time) || time < 0) return '0:00';
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
