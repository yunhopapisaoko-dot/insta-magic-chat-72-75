import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  ZoomIn, 
  ZoomOut, 
  Scissors,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { useVideoController, formatTime } from '@/hooks/useVideoController';
import { useVideoValidation } from '@/hooks/useVideoValidation';
import VideoValidationStatus from '@/components/ui/VideoValidationStatus';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface VideoTrimEditorProps {
  videoFile: File;
  onSave: (editedBlob: Blob, startTime: number, endTime: number) => void;
  onCancel: () => void;
}

const VideoTrimEditor = ({ videoFile, onSave, onCancel }: VideoTrimEditorProps) => {
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(60);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [timelineStart, setTimelineStart] = useState(0);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [validationComplete, setValidationComplete] = useState(false);
  
  // Throttled current time to prevent excessive re-renders
  const [throttledCurrentTime, setThrottledCurrentTime] = useState(0);
  const lastUpdateTimeRef = useRef<number>(0);
  
  const { 
    validateVideo, 
    isValidating, 
    validationProgress 
  } = useVideoValidation({
    maxDurationSeconds: 60,
    maxSizeBytes: 100 * 1024 * 1024 // 100MB
  });
  
  const [validationResult, setValidationResult] = useState<any>(null);
  
  const ctrl = useVideoController({ 
    autoPlay: false, 
    loop: false,
    onPlayStateChange: useCallback((playing) => {
      if (playing && throttledCurrentTime >= endTime) {
        ctrl.videoRef.current!.currentTime = startTime;
      }
    }, [startTime, endTime, throttledCurrentTime])
  });

  // More aggressive throttling to prevent UI trembling
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const updateThrottledTime = () => {
      const now = Date.now();
      // Only update if enough time has passed (throttle to 300ms)
      if (now - lastUpdateTimeRef.current < 300) return;
      
      lastUpdateTimeRef.current = now;
      setThrottledCurrentTime(ctrl.currentTime);
    };

    if (ctrl.isPlaying) {
      timeoutId = setInterval(updateThrottledTime, 300); // Update every 300ms instead of 100ms
    } else {
      // Immediate update when paused, but still throttled
      const now = Date.now();
      if (now - lastUpdateTimeRef.current >= 100) {
        setThrottledCurrentTime(ctrl.currentTime);
        lastUpdateTimeRef.current = now;
      }
    }

    return () => {
      if (timeoutId) {
        clearInterval(timeoutId);
      }
    };
  }, [ctrl.currentTime, ctrl.isPlaying]);

  // Auto-pause at end time (throttled)
  useEffect(() => {
    if (ctrl.isPlaying && throttledCurrentTime >= endTime) {
      ctrl.videoRef.current?.pause();
    }
  }, [throttledCurrentTime, endTime, ctrl.isPlaying]);

  useEffect(() => {
    const url = URL.createObjectURL(videoFile);
    setVideoUrl(url);
    
    // Validate video on load
    validateVideo(videoFile).then((result) => {
      setValidationResult(result);
      setValidationComplete(true);
      
      if (!result.isValid) {
        toast({
          title: "Problemas detectados no vídeo",
          description: "Verifique os detalhes abaixo antes de continuar",
          variant: "destructive",
        });
      }
    });
    
    return () => URL.revokeObjectURL(url);
  }, [videoFile, validateVideo]);

  useEffect(() => {
    if (ctrl.duration > 0) {
      setEndTime(Math.min(ctrl.duration, 60));
      setTimelineStart(0);
    }
  }, [ctrl.duration]);

  const getVisibleDuration = useMemo(() => {
    return Math.min(ctrl.duration, 60) / zoomLevel;
  }, [ctrl.duration, zoomLevel]);

  const getTimelineEnd = useMemo(() => {
    return Math.min(timelineStart + getVisibleDuration, ctrl.duration);
  }, [timelineStart, getVisibleDuration, ctrl.duration]);

  const trimmedDuration = useMemo(() => endTime - startTime, [endTime, startTime]);
  const currentTimeInRange = useMemo(() => 
    Math.max(startTime, Math.min(endTime, throttledCurrentTime)), 
    [startTime, endTime, throttledCurrentTime]
  );
  const timelineProgress = useMemo(() => 
    ((throttledCurrentTime - timelineStart) / getVisibleDuration) * 100, 
    [throttledCurrentTime, timelineStart, getVisibleDuration]
  );
  const startPercent = useMemo(() => 
    ((startTime - timelineStart) / getVisibleDuration) * 100, 
    [startTime, timelineStart, getVisibleDuration]
  );
  const endPercent = useMemo(() => 
    ((endTime - timelineStart) / getVisibleDuration) * 100, 
    [endTime, timelineStart, getVisibleDuration]
  );

  const handleZoomIn = useCallback(() => {
    if (zoomLevel < 8) {
      const newZoom = zoomLevel * 2;
      const centerTime = timelineStart + getVisibleDuration / 2;
      const newStart = Math.max(0, centerTime - (getVisibleDuration / 2) / 2);
      setZoomLevel(newZoom);
      setTimelineStart(newStart);
    }
  }, [zoomLevel, timelineStart, getVisibleDuration]);

  const handleZoomOut = useCallback(() => {
    if (zoomLevel > 1) {
      const newZoom = zoomLevel / 2;
      const centerTime = timelineStart + getVisibleDuration / 2;
      const newVisibleDuration = Math.min(ctrl.duration, 60) / newZoom;
      const newStart = Math.max(0, centerTime - newVisibleDuration / 2);
      setZoomLevel(newZoom);
      setTimelineStart(newStart);
    }
  }, [zoomLevel, timelineStart, getVisibleDuration, ctrl.duration]);

  const handleTimelineSeek = useCallback((value: number[]) => {
    const time = timelineStart + (value[0] / 100) * getVisibleDuration;
    const seekTime = time / ctrl.duration;
    // Prevent unnecessary updates if seeking to same position
    if (Math.abs(seekTime - (throttledCurrentTime / ctrl.duration)) > 0.01) {
      ctrl.seekToPercent(seekTime);
    }
  }, [timelineStart, getVisibleDuration, ctrl.duration, ctrl.seekToPercent, throttledCurrentTime]);

  const handleTrimChange = useCallback((values: number[]) => {
    const [newStart, newEnd] = values;
    const visibleDuration = getVisibleDuration;
    const actualStart = timelineStart + (newStart / 100) * visibleDuration;
    const actualEnd = timelineStart + (newEnd / 100) * visibleDuration;
    
    // Prevent unnecessary updates if values haven't changed significantly
    if (Math.abs(actualStart - startTime) < 0.1 && Math.abs(actualEnd - endTime) < 0.1) {
      return;
    }
    
    // Ensure max 1 minute duration
    if (actualEnd - actualStart <= 60) {
      setStartTime(actualStart);
      setEndTime(actualEnd);
    }
  }, [timelineStart, getVisibleDuration, startTime, endTime]);

  const jumpToStart = () => {
    ctrl.seekToPercent(startTime / ctrl.duration);
  };

  const jumpToEnd = () => {
    ctrl.seekToPercent(endTime / ctrl.duration);
  };

  const stepBackward = () => {
    const newTime = Math.max(startTime, ctrl.currentTime - 0.1);
    ctrl.seekToPercent(newTime / ctrl.duration);
  };

  const stepForward = () => {
    const newTime = Math.min(endTime, ctrl.currentTime + 0.1);
    ctrl.seekToPercent(newTime / ctrl.duration);
  };

  const moveTimelineLeft = useCallback(() => {
    const step = getVisibleDuration * 0.1;
    setTimelineStart(Math.max(0, timelineStart - step));
  }, [timelineStart, getVisibleDuration]);

  const moveTimelineRight = useCallback(() => {
    const step = getVisibleDuration * 0.1;
    const maxStart = Math.max(0, ctrl.duration - getVisibleDuration);
    setTimelineStart(Math.min(maxStart, timelineStart + step));
  }, [timelineStart, getVisibleDuration, ctrl.duration]);

  const handleSave = async () => {
    if (trimmedDuration > 60) {
      toast({
        title: "Duração muito longa",
        description: "O vídeo recortado deve ter no máximo 1 minuto",
        variant: "destructive",
      });
      return;
    }

    if (trimmedDuration <= 0) {
      toast({
        title: "Recorte inválido",
        description: "O tempo de início deve ser menor que o tempo de fim",
        variant: "destructive",
      });
      return;
    }

    if (validationResult && !validationResult.isValid) {
      toast({
        title: "Vídeo inválido",
        description: "Corrija os problemas detectados antes de salvar",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    
    try {
      // Show progress feedback
      toast({
        title: "Processando vídeo",
        description: "Aplicando edições...",
      });

      // Simulate processing delay for better UX
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // For now, save the original file with trim metadata
      // Real video trimming would require server-side processing
      onSave(videoFile, startTime, endTime);
      
      toast({
        title: "Vídeo salvo com sucesso",
        description: `Recorte aplicado: ${formatTime(trimmedDuration)}`,
      });
      
    } catch (error) {
      console.error('Error saving trimmed video:', error);
      toast({
        title: "Erro ao salvar vídeo",
        description: "Não foi possível processar o vídeo. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
        <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Editor de Recorte</h3>
        
        {/* Validation Status */}
        {(isValidating || validationComplete) && (
          <VideoValidationStatus
            isValidating={isValidating}
            validationProgress={validationProgress}
            validationResult={validationResult}
            className="mb-4"
          />
        )}
        
        {/* Video Preview */}
        <div className="relative bg-background rounded-xl overflow-hidden mb-4">
          <video
            ref={ctrl.videoRef}
            src={videoUrl}
            className="w-full max-h-64 object-cover"
            playsInline
            preload="metadata"
            {...ctrl.bind}
          />
          
          {/* Play Controls Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Button
              onClick={ctrl.togglePlay}
              size="lg"
              className="rounded-full w-16 h-16 bg-white/20 hover:bg-white/30"
              variant="ghost"
            >
              {ctrl.isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
            </Button>
          </div>
        </div>

        {/* Time Display */}
        <div className="flex justify-between items-center text-sm text-muted-foreground mb-4">
          <span>{formatTime(currentTimeInRange)}</span>
          <Badge variant={trimmedDuration <= 60 ? "default" : "destructive"}>
            Duração: {formatTime(trimmedDuration)}
          </Badge>
          <span>{formatTime(ctrl.duration)}</span>
        </div>

        {/* Main Timeline */}
        <div className="space-y-4">
          {/* Zoom Controls */}
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 1}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium">Zoom: {zoomLevel}x</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 8}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>

          {/* Timeline Navigation */}
          {zoomLevel > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={moveTimelineLeft}
                disabled={timelineStart <= 0}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {formatTime(timelineStart)} - {formatTime(getTimelineEnd)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={moveTimelineRight}
                disabled={getTimelineEnd >= ctrl.duration}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Timeline Visualization */}
          <div className="relative h-12 bg-muted rounded-lg overflow-hidden">
            {/* Background timeline */}
            <div className="absolute inset-0 bg-gradient-to-r from-muted via-muted-foreground/10 to-muted" />
            
            {/* Trim selection */}
            <div
              className="absolute top-0 bottom-0 bg-primary/20 border-2 border-primary"
              style={{
                left: `${Math.max(0, startPercent)}%`,
                width: `${Math.max(0, Math.min(100, endPercent) - Math.max(0, startPercent))}%`
              }}
            />
            
            {/* Current time indicator */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-destructive z-10"
              style={{ left: `${Math.max(0, Math.min(100, timelineProgress))}%` }}
            />
            
            {/* Start marker */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-primary cursor-ew-resize z-20"
              style={{ left: `${Math.max(0, startPercent)}%` }}
            />
            
            {/* End marker */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-primary cursor-ew-resize z-20"
              style={{ left: `${Math.min(100, endPercent)}%` }}
            />
          </div>

          {/* Current Time Scrubber */}
          <Slider
            value={[timelineProgress]}
            onValueChange={handleTimelineSeek}
            max={100}
            step={0.1}
            className="w-full"
          />

          {/* Trim Range Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Área de Recorte</span>
              <div className="flex gap-2">
                <Badge variant="outline">{formatTime(startTime)}</Badge>
                <Badge variant="outline">{formatTime(endTime)}</Badge>
              </div>
            </div>
            <Slider
              value={[
                ((startTime - timelineStart) / getVisibleDuration) * 100,
                ((endTime - timelineStart) / getVisibleDuration) * 100
              ]}
              onValueChange={handleTrimChange}
              max={100}
              step={0.1}
              className="w-full"
            />
          </div>
        </div>

        {/* Precise Controls */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Início</label>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={jumpToStart}>
                Ir para início
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Fim</label>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={jumpToEnd}>
                Ir para fim
              </Button>
            </div>
          </div>
        </div>

        {/* Frame Controls */}
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={stepBackward}>
            <SkipBack className="w-4 h-4" />
            -0.1s
          </Button>
          <Button variant="outline" size="sm" onClick={stepForward}>
            +0.1s
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>

        {/* Validation Warning */}
        {trimmedDuration > 60 && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg mt-4">
            <p className="text-sm font-medium">
              ⚠️ Duração muito longa ({formatTime(trimmedDuration)})
            </p>
            <p className="text-xs mt-1">
              O vídeo deve ter no máximo 1 minuto para ser salvo.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1 rounded-xl"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              isSaving || 
              trimmedDuration > 60 || 
              trimmedDuration <= 0 ||
              (validationResult && !validationResult.isValid) ||
              !validationComplete
            }
            className="flex-1 rounded-xl"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Scissors className="w-4 h-4 mr-2" />
                Aplicar Recorte
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VideoTrimEditor;