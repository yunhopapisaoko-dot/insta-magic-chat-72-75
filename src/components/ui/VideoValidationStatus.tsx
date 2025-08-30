import { AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { VideoValidationResult } from '@/hooks/useVideoValidation';
import { formatFileSize, formatDuration } from '@/hooks/useVideoValidation';

interface VideoValidationStatusProps {
  isValidating: boolean;
  validationProgress: number;
  validationResult?: VideoValidationResult;
  className?: string;
}

const VideoValidationStatus = ({
  isValidating,
  validationProgress,
  validationResult,
  className
}: VideoValidationStatusProps) => {
  if (isValidating) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm font-medium">Validando vídeo...</span>
        </div>
        <Progress value={validationProgress} className="h-2" />
        <div className="text-xs text-muted-foreground text-center">
          {validationProgress}%
        </div>
      </div>
    );
  }

  if (!validationResult) {
    return null;
  }

  const { isValid, errors, warnings, fileInfo } = validationResult;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Status Header */}
      <div className="flex items-center gap-2">
        {isValid ? (
          <CheckCircle className="w-5 h-5 text-green-500" />
        ) : (
          <XCircle className="w-5 h-5 text-destructive" />
        )}
        <span className={cn(
          "font-medium",
          isValid ? "text-green-700" : "text-destructive"
        )}>
          {isValid ? "Vídeo válido" : "Vídeo inválido"}
        </span>
      </div>

      {/* File Info */}
      {fileInfo && (
        <div className="grid grid-cols-2 gap-2">
          <Badge variant="outline" className="justify-center">
            {formatFileSize(fileInfo.size)}
          </Badge>
          <Badge variant="outline" className="justify-center">
            {formatDuration(fileInfo.duration)}
          </Badge>
          <Badge variant="outline" className="justify-center">
            {fileInfo.width}x{fileInfo.height}
          </Badge>
          <Badge variant="outline" className="justify-center">
            {fileInfo.format.split('/')[1].toUpperCase()}
          </Badge>
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="space-y-2">
          {errors.map((error, index) => (
            <Alert key={index} variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((warning, index) => (
            <Alert key={index}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{warning}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}
    </div>
  );
};

export default VideoValidationStatus;