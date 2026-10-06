import { useCallback, useRef, useState } from "react";
import { formatTime } from "@/lib/use-audio-player";
import { cn } from "@/lib/utils";

type Props = {
  position: number;
  duration: number;
  thumbnail?: string | undefined;
  onSeek: (seconds: number) => void;
  className?: string;
};

/** Scrub bar with smooth dragging, pointer capture, hover thumbnail + timestamp preview. */
export function ScrubBar({ position, duration, thumbnail, onSeek, className }: Props) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(0);
  const [seekHold, setSeekHold] = useState<number | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activePosition = isDragging ? dragPosition : seekHold !== null ? seekHold : position;

  const pct = duration > 0 ? Math.min(100, Math.max(0, (activePosition / duration) * 100)) : 0;

  const getRatio = useCallback((clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setIsDragging(true);
    const ratio = getRatio(e.clientX);
    const targetSeconds = ratio * duration;
    setDragPosition(targetSeconds);
    setHoverTime(targetSeconds);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = getRatio(e.clientX);
    const targetSeconds = ratio * duration;
    setHoverX(ratio * rect.width);
    setHoverTime(targetSeconds);

    if (isDragging) {
      setDragPosition(targetSeconds);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      e.stopPropagation();
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      setIsDragging(false);
      const ratio = getRatio(e.clientX);
      const targetSeconds = ratio * duration;
      setSeekHold(targetSeconds);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      holdTimerRef.current = setTimeout(() => {
        setSeekHold(null);
      }, 1000);
      onSeek(targetSeconds);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      setIsDragging(false);
    }
    setHoverX(null);
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (duration <= 0) return;
      const step = e.shiftKey ? 15 : 5;
      let next: number;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowUp":
          next = Math.min(position + step, duration);
          break;
        case "ArrowLeft":
        case "ArrowDown":
          next = Math.max(position - step, 0);
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = duration;
          break;
        default:
          return;
      }
      e.preventDefault();
      onSeek(next);
    },
    [duration, position, onSeek],
  );

  return (
    <div
      className={cn("relative w-full select-none touch-none", className)}
      onPointerLeave={() => {
        if (!isDragging) setHoverX(null);
      }}
    >
      {hoverX !== null && duration > 0 && (
        <div
          className="pointer-events-none absolute bottom-6 z-30 -translate-x-1/2 rounded-md border border-border bg-popover p-1.5 shadow-lift backdrop-blur-md"
          style={{ left: hoverX }}
        >
          {thumbnail && (
            <img
              src={thumbnail}
              alt=""
              className="h-16 w-28 rounded object-cover"
              loading="lazy"
            />
          )}
          <p className="mt-1 text-center text-[11px] tabular-nums font-medium text-white/90">
            {formatTime(hoverTime)}
          </p>
        </div>
      )}

      <div
        ref={barRef}
        role="slider"
        tabIndex={0}
        aria-label="Seek through audio track"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(activePosition)}
        aria-valuetext={formatTime(activePosition)}
        className="group flex h-6 cursor-pointer items-center py-2 focus:outline-none"
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div className="relative h-1 w-full overflow-visible rounded-full bg-white/20 transition-all group-hover:h-1.5">
          {/* Progress bar fill */}
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-colors",
              isDragging ? "bg-[#1DB954]" : "bg-white group-hover:bg-[#1DB954]"
            )}
            style={{ width: `${pct}%` }}
          />
          {/* Thumb handle */}
          <span
            className={cn(
              "absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md transition-transform duration-100",
              isDragging ? "scale-125 opacity-100 ring-4 ring-[#1DB954]/25" : "opacity-0 group-hover:opacity-100 group-hover:scale-110",
            )}
            style={{ left: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
