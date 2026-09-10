import { useState, useEffect, useRef } from "react";
import { Moon, Play, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  onSleep: () => void;
  volume?: number;
  onVolumeChange?: (volume: number) => void;
};

const PRESETS = [
  { label: "15 min", minutes: 15 },
  { label: "30 min", minutes: 30 },
  { label: "45 min", minutes: 45 },
  { label: "60 min", minutes: 60 },
  { label: "End of Track", minutes: -1 },
];

export function SleepTimerModal({
  open,
  onClose,
  onSleep,
  volume = 80,
  onVolumeChange,
}: Props) {
  const [selectedMinutes, setSelectedMinutes] = useState(30);
  const [activeEndTime, setActiveEndTime] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const initialVolumeRef = useRef(volume);

  useEffect(() => {
    if (!activeEndTime) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((activeEndTime - now) / 1000));
      setRemainingSeconds(diff);

      // Gradual volume ramp down in final 30 seconds
      if (diff > 0 && diff <= 30 && onVolumeChange) {
        const fadeRatio = diff / 30;
        onVolumeChange(Math.round(initialVolumeRef.current * fadeRatio));
      }

      if (diff <= 0) {
        setActiveEndTime(null);
        if (onVolumeChange) onVolumeChange(initialVolumeRef.current);
        onSleep();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeEndTime, onSleep, onVolumeChange]);

  if (!open) return null;

  const startTimer = () => {
    if (selectedMinutes > 0) {
      const end = Date.now() + selectedMinutes * 60 * 1000;
      setActiveEndTime(end);
      setRemainingSeconds(selectedMinutes * 60);
    } else {
      // End of track mode
      onClose();
    }
  };

  const cancelTimer = () => {
    setActiveEndTime(null);
    setRemainingSeconds(0);
  };

  const formatTimerDisplay = () => {
    if (activeEndTime) {
      const m = Math.floor(remainingSeconds / 60);
      const s = remainingSeconds % 60;
      return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${selectedMinutes}:00`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-sm rounded-3xl bg-[#140f24] border border-purple-500/30 p-6 shadow-2xl shadow-purple-950/60 z-10 animate-scale-in text-center">
        {/* Header */}
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-2">
            <Moon className="h-5 w-5 text-purple-400" />
            <h2 className="text-lg font-bold text-white">Sleep Timer</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Circular Timer Dial */}
        <div className="my-6 relative flex flex-col items-center justify-center">
          <div className="relative flex h-48 w-48 items-center justify-center rounded-full border-4 border-purple-900/40 bg-purple-950/20 shadow-[0_0_30px_rgba(139,92,246,0.2)]">
            <div className="absolute inset-2 rounded-full border-2 border-dashed border-purple-500/30 animate-spin-slow" />
            <div className="flex flex-col items-center">
              <span className="font-display text-3xl font-bold tracking-tight text-white tabular-nums">
                {formatTimerDisplay()}
              </span>
              <span className="text-xs text-purple-300/60 mt-0.5">min</span>
            </div>
          </div>
          <p className="mt-4 text-xs text-white/50">
            {activeEndTime
              ? "Playback will automatically stop when timer reaches 0"
              : "When timer ends: Playback will stop"}
          </p>
        </div>

        {/* Preset Chips */}
        {!activeEndTime && (
          <div className="flex flex-wrap justify-center gap-1.5 mb-6">
            {PRESETS.map((p) => {
              const active = selectedMinutes === p.minutes;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setSelectedMinutes(p.minutes)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                    active
                      ? "border-purple-500 bg-purple-600/30 text-white shadow-sm shadow-purple-500/20"
                      : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Action Button */}
        {activeEndTime ? (
          <button
            type="button"
            onClick={cancelTimer}
            className="w-full rounded-2xl bg-red-500/20 border border-red-500/30 py-3.5 text-sm font-bold text-red-300 hover:bg-red-500/30 transition-all"
          >
            Stop Timer
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              startTimer();
              onClose();
            }}
            className="w-full rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-600/30 hover:shadow-purple-600/50 active:scale-[0.99] transition-all"
          >
            Start Timer
          </button>
        )}
      </div>
    </div>
  );
}
