import { useState, useEffect, useRef } from "react";
import { Moon, RotateCcw, X, Clock, Sliders } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSleepTimer } from "@/hooks/useSleepTimer";
import { SLEEP_TIMER_PRESETS } from "@/lib/sleep-timer";

type Props = {
  open: boolean;
  onClose: () => void;
  onSleep: () => void;
  volume?: number;
  onVolumeChange?: (volume: number) => void;
};

export function SleepTimerModal({
  open,
  onClose,
  onSleep,
  volume = 80,
  onVolumeChange,
}: Props) {
  const {
    isActive,
    isExpired,
    durationMinutes,
    remainingSeconds,
    formattedRemaining,
    startTimer,
    cancelTimer,
    restartTimer,
    resetExpired,
  } = useSleepTimer(onSleep);

  const [selectedMinutes, setSelectedMinutes] = useState<number>(30);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [customInput, setCustomInput] = useState<number>(20);
  const initialVolumeRef = useRef<number>(volume);

  // Sync selected minutes from running timer if active
  useEffect(() => {
    if (isActive && durationMinutes) {
      setSelectedMinutes(durationMinutes);
    }
  }, [isActive, durationMinutes]);

  // Gradual volume ramp down in final 30 seconds
  useEffect(() => {
    if (!isActive) return;
    if (remainingSeconds > 0 && remainingSeconds <= 30 && onVolumeChange) {
      const ratio = remainingSeconds / 30;
      onVolumeChange(Math.round(initialVolumeRef.current * ratio));
    } else if (remainingSeconds === 0 && onVolumeChange) {
      onVolumeChange(initialVolumeRef.current);
    }
  }, [isActive, remainingSeconds, onVolumeChange]);

  if (!open) return null;

  const handleStart = (minutes: number) => {
    resetExpired();
    startTimer(minutes);
    onClose();
  };

  const handlePresetSelect = (minutes: number) => {
    setIsCustomMode(false);
    setSelectedMinutes(minutes);
    if (isActive) {
      // User changing timer duration while active
      startTimer(minutes);
    }
  };

  const handleCustomApply = () => {
    const mins = Math.max(1, Math.min(720, customInput));
    setSelectedMinutes(mins);
    if (isActive) {
      startTimer(mins);
    }
  };

  const formatDisplayMinutes = () => {
    if (isActive) {
      return formattedRemaining;
    }
    const mins = isCustomMode ? customInput : selectedMinutes;
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${mins}m`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className="relative w-full max-w-sm rounded-2xl bg-popover border border-border p-6 shadow-overlay z-10 animate-scale-in text-center select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Moon className="h-4 w-4" />
            </div>
            <div className="text-left">
              <h2 className="text-sm font-semibold text-foreground leading-tight">Sleep Timer</h2>
              <p className="text-[11px] text-muted-foreground leading-none mt-0.5">
                {isActive
                  ? "Active • Automatically stops playback"
                  : isExpired
                  ? "Timer expired • Playback paused"
                  : "Turn off audio automatically"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-hover-strong hover:text-foreground transition-colors"
            aria-label="Close sleep timer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Circular Display */}
        <div className="my-5 relative flex flex-col items-center justify-center">
          <div
            className={cn(
              "relative flex h-40 w-40 items-center justify-center rounded-full border-2 transition-all bg-card",
              isActive
                ? "border-primary shadow-[0_0_24px_rgba(56,189,248,0.25)]"
                : isExpired
                ? "border-amber-500/50"
                : "border-hair-strong"
            )}
          >
            <div className="flex flex-col items-center">
              {isActive && (
                <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-primary mb-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  Remaining
                </span>
              )}
              {isExpired && !isActive && (
                <span className="text-[10px] font-medium uppercase tracking-wider text-amber-400 mb-1">
                  Expired
                </span>
              )}
              <span className="font-mono text-3xl font-bold tracking-tight text-foreground tabular-nums">
                {formatDisplayMinutes()}
              </span>
              <span className="text-[11px] text-muted-foreground mt-0.5">
                {isActive ? "until stop" : isCustomMode ? "custom duration" : "preset duration"}
              </span>
            </div>
          </div>
        </div>

        {/* Preset Chips */}
        <div className="space-y-2 mb-5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.06em]">
              {isActive ? "Change Duration" : "Select Duration"}
            </span>
            <button
              type="button"
              onClick={() => setIsCustomMode(!isCustomMode)}
              className={cn(
                "text-[11px] font-semibold transition-colors flex items-center gap-1",
                isCustomMode ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sliders className="h-3 w-3" />
              Custom
            </button>
          </div>

          {!isCustomMode ? (
            <div className="grid grid-cols-3 gap-2">
              {SLEEP_TIMER_PRESETS.map((p) => {
                const isSelected = selectedMinutes === p.minutes;
                return (
                  <button
                    key={p.minutes}
                    type="button"
                    onClick={() => handlePresetSelect(p.minutes)}
                    className={cn(
                      "rounded-xl border py-2 px-1 text-xs font-semibold transition-all text-center",
                      isSelected
                        ? "border-primary bg-primary/15 text-primary shadow-sm"
                        : "border-border bg-surface-hover text-secondary-foreground hover:bg-surface-hover-strong hover:text-foreground"
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface-hover p-3 text-left">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-secondary-foreground">Minutes:</span>
                <span className="text-sm font-bold text-primary tabular-nums">
                  {customInput} min
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={180}
                step={5}
                value={customInput}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setCustomInput(val);
                }}
                className="w-full accent-primary cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-medium text-muted-foreground mt-1">
                <span>5m</span>
                <span>60m (1h)</span>
                <span>120m (2h)</span>
                <span>180m (3h)</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="space-y-2">
          {isActive ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelTimer}
                className="flex-1 rounded-2xl bg-red-500/15 border border-red-500/30 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/25 active:scale-[0.99] transition-all"
              >
                Cancel Timer
              </button>
              {isCustomMode && (
                <button
                  type="button"
                  onClick={() => {
                    handleCustomApply();
                    onClose();
                  }}
                  className="rounded-2xl bg-primary py-3 px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all"
                >
                  Apply
                </button>
              )}
            </div>
          ) : isExpired ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  resetExpired();
                  restartTimer();
                  onClose();
                }}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-primary hover:bg-primary/90 py-3 text-sm font-semibold text-primary-foreground active:scale-[0.99] transition-all"
              >
                <RotateCcw className="h-4 w-4" />
                Restart ({selectedMinutes}m)
              </button>
              <button
                type="button"
                onClick={() => {
                  resetExpired();
                  handleStart(isCustomMode ? customInput : selectedMinutes);
                }}
                className="rounded-2xl border border-hair-strong bg-chip py-3 px-4 text-xs font-semibold text-foreground hover:bg-chip-strong transition-all"
              >
                New
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleStart(isCustomMode ? customInput : selectedMinutes)}
              className="w-full rounded-2xl bg-primary hover:bg-primary/90 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              <Clock className="h-4 w-4" />
              Start Sleep Timer ({isCustomMode ? customInput : selectedMinutes} min)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
