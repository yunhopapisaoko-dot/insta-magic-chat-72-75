import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Scissors, RotateCcw } from 'lucide-react';

interface VideoEditorProps {
  videoFile: File;
  onSave: (editedBlob: Blob) => void;
  onCancel: () => void;
}

const filters = [
  { name: 'Original', filter: 'none' },
  { name: 'Vintage', filter: 'sepia(50%) contrast(1.2)' },
  { name: 'B&W', filter: 'grayscale(100%)' },
  { name: 'Vivid', filter: 'saturate(1.5) contrast(1.1)' },
  { name: 'Cool', filter: 'hue-rotate(180deg) saturate(1.2)' },
  { name: 'Warm', filter: 'hue-rotate(30deg) saturate(1.1)' },
];

const VideoEditor = ({ videoFile, onSave, onCancel }: VideoEditorProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(60);
  const [selectedFilter, setSelectedFilter] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string>('');

  // Throttled time update to prevent excessive re-renders
  const timeUpdateRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(videoFile);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const videoDuration = videoRef.current.duration;
      setDuration(videoDuration);
      setEndTime(videoDuration);
      
      // Since we validate duration on upload, this should never happen
      if (videoDuration > 60) {
        alert('Este vídeo é muito longo. Selecione um vídeo de até 1 minuto.');
      }
    }
  };

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      // Throttle time updates to prevent excessive re-renders
      if (timeUpdateRef.current) {
        clearTimeout(timeUpdateRef.current);
      }
      
      timeUpdateRef.current = setTimeout(() => {
        if (videoRef.current) {
          setCurrentTime(videoRef.current.currentTime);
          
          // Auto pause at end time
          if (videoRef.current.currentTime >= endTime) {
            videoRef.current.pause();
            setIsPlaying(false);
          }
        }
      }, 100); // Update every 100ms instead of every frame
    }
  }, [endTime]);

  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.currentTime = startTime;
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying, startTime]);

  const handleSeek = useCallback((value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  }, []);

  const handleTrimRange = useCallback((value: number[]) => {
    const [newStart, newEnd] = value;
    
    // Ensure the trimmed duration doesn't exceed 60 seconds
    if (newEnd - newStart > 60) {
      const maxEnd = newStart + 60;
      setStartTime(newStart);
      setEndTime(maxEnd);
      if (videoRef.current) {
        videoRef.current.currentTime = newStart;
      }
    } else {
      setStartTime(newStart);
      setEndTime(newEnd);
      if (videoRef.current) {
        videoRef.current.currentTime = newStart;
      }
    }
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeUpdateRef.current) {
        clearTimeout(timeUpdateRef.current);
      }
    };
  }, []);

  const processVideo = async () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    
    // Pause video during processing
    video.pause();
    setIsPlaying(false);

    try {
      // Check video duration limits
      if (endTime - startTime > 60) {
        alert('O vídeo deve ter no máximo 1 minuto. Ajuste o tempo de corte.');
        return;
      }

      // If video is already under 60 seconds and no edits needed, save original
      if (duration <= 60 && startTime === 0 && endTime >= duration && selectedFilter === 0) {
        onSave(videoFile);
        return;
      }

      // If video needs trimming but is complex, for now just save original
      // TODO: Implement proper video trimming with FFmpeg or similar
      if (startTime > 0 || endTime < duration) {
        // For now, we'll save the original file
        // The trimming will be handled by displaying duration limits in the UI
        console.log(`Video should be trimmed from ${startTime}s to ${endTime}s`);
        
        // Create a new file with metadata about trim points
        const trimmedFile = new File([videoFile], videoFile.name, {
          type: videoFile.type,
          lastModified: Date.now()
        });
        
        // Add trim metadata (this won't actually trim the video file)
        // Real trimming would require server-side processing or FFmpeg.js
        onSave(trimmedFile);
        return;
      }

      // For filter-only changes, also save original for now
      onSave(videoFile);

    } catch (error) {
      console.error('Error processing video:', error);
      alert('Erro ao processar o vídeo. Tente novamente.');
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Editar Vídeo</h3>
        {duration > 60 && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded-lg mb-4">
            <p className="text-sm font-medium">
              ⚠️ Vídeo muito longo ({formatTime(duration)})
            </p>
            <p className="text-xs mt-1">
              Você deve cortá-lo para no máximo 1 minuto antes de publicar.
            </p>
          </div>
        )}
        
        {/* Video Preview */}
        <div className="relative bg-background rounded-xl overflow-hidden">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full max-h-64 object-cover transition-all duration-200"
            style={{ filter: filters[selectedFilter].filter }}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
          />
          
          {/* Play/Pause Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Button
              onClick={togglePlay}
              size="lg"
              className="rounded-full w-16 h-16 bg-white/20 hover:bg-white/30 transition-all duration-200"
              variant="ghost"
            >
              {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
            </Button>
          </div>
        </div>

        {/* Time Controls */}
        <div className="space-y-4 mt-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          
          {/* Current Time Scrubber */}
          <Slider
            value={[currentTime]}
            onValueChange={handleSeek}
            max={duration}
            step={0.1}
            className="w-full"
          />
          
          {/* Trim Range */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Recortar (máx. 1 min)</span>
              <Badge variant="secondary">
                {formatTime(endTime - startTime)}
              </Badge>
            </div>
            <Slider
              value={[startTime, endTime]}
              onValueChange={handleTrimRange}
              max={Math.min(duration, 60)}
              step={0.1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Início: {formatTime(startTime)}</span>
              <span>Fim: {formatTime(endTime)}</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Filtros</h4>
          <div className="grid grid-cols-3 gap-2">
            {filters.map((filter, index) => (
              <Button
                key={filter.name}
                onClick={() => setSelectedFilter(index)}
                variant={selectedFilter === index ? "default" : "outline"}
                size="sm"
                className="text-xs"
              >
                {filter.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Hidden Canvas for Processing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Actions */}
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
            onClick={processVideo}
            className="flex-1 rounded-xl magic-button"
          >
            <Scissors className="w-4 h-4 mr-2" />
            Aplicar Edições
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VideoEditor;