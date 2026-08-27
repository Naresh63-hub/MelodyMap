import { Clock, X } from "lucide-react";
import { useSleepTimer } from "@/hooks/useSleepTimer";

interface SleepTimerProps {
  onSleep: () => void;
}

export function SleepTimer({ onSleep }: SleepTimerProps) {
  const {
    formattedRemaining,
    isActive,
    startTimer,
    cancelTimer,
  } = useSleepTimer(onSleep);

  const presets = [15, 30, 45, 60]; // minutes

  if (!isActive) {
    return (
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <div className="flex gap-1">
          {presets.map((minutes) => (
            <button
              key={minutes}
              onClick={() => startTimer(minutes)}
              className="rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {minutes}m
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5">
      <Clock className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium text-foreground">
        {formattedRemaining}
      </span>
      <button
        onClick={cancelTimer}
        className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}