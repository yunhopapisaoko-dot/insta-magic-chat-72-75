import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface StoryProgressProps {
  stories: any[];
  currentIndex: number;
  progress: number;
  className?: string;
}

export const StoryProgress = ({ 
  stories, 
  currentIndex, 
  progress, 
  className 
}: StoryProgressProps) => {
  return (
    <div className={cn("flex space-x-1", className)}>
      {stories.map((_, index) => (
        <div
          key={index}
          className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden"
        >
          <div
            className={cn(
              "h-full transition-all duration-100",
              index <= currentIndex ? "bg-white" : "bg-white/30"
            )}
            style={{
              width: index < currentIndex ? '100%' : 
                     index === currentIndex ? `${progress}%` : '0%'
            }}
          />
        </div>
      ))}
    </div>
  );
};

interface TimeRemainingIndicatorProps {
  expiresAt: string;
  className?: string;
}

export const TimeRemainingIndicator = ({ 
  expiresAt, 
  className 
}: TimeRemainingIndicatorProps) => {
  const [timeRemaining, setTimeRemaining] = useState({ hours: 0, minutes: 0, expired: false });

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const remaining = expiry - now;
      
      if (remaining <= 0) {
        setTimeRemaining({ expired: true, hours: 0, minutes: 0 });
        return;
      }
      
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      
      setTimeRemaining({ expired: false, hours, minutes });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [expiresAt]);

  if (timeRemaining.expired) {
    return (
      <div className={cn("text-xs text-red-400 font-medium", className)}>
        Expirado
      </div>
    );
  }

  return (
    <div className={cn("text-xs text-white/70 font-medium", className)}>
      {timeRemaining.hours > 0 
        ? `${timeRemaining.hours}h ${timeRemaining.minutes}m restantes`
        : `${timeRemaining.minutes}m restantes`
      }
    </div>
  );
};