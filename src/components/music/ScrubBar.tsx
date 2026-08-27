import { useCallback, useRef, useState } from "react";
import { formatTime } from "@/lib/use-youtube-iframe";
import { cn } from "@/lib/utils";

type Props = {
  position: number;
  duration: number;
  thumbnail?: string | undefined;
  onSeek: (seconds: number) => void;
  className?: string;
};

/** Scrub bar with a hover thumbnail + timestamp preview. Supports keyboard seeking. */
export function ScrubBar({ position, duration, thumbnail, onSeek, className }: Props) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState(0);
  const [dragging, setDragging] = useState(false);
  /** Track if a RAF is already scheduled for throttling seek events. */
  const rafRef = useRef<number | null>(null);

  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  const ratioFrom = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const handleMove = useCallback(
    (clientX: number) => {
      const rect = barRef.current?.getBoundingClientRect();
      if (!rect) return;
      const ratio = ratioFrom(clientX);
      setHoverX(ratio * rect.width);
      setHoverTime(ratio * duration);
      if (dragging && rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          onSeek(ratio * duration);
        });
      }
    },
    [dragging, duration, onSeek],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (duration <= 0) return;
      const step = e.shiftKey ? 10 : 5; // Shift+Arrow = 10s, Arrow = 5s
      let next = position;
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
      className={cn("relative w-full select-none", className)}
      onPointerMove={(e) => handleMove(e.clientX)}
      onPointerLeave={() => {
        setHoverX(null);
        setDragging(false);
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      }}
      onPointerUp={() => {
        setDragging(false);
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      }}
    >
      {hoverX !== null && duration > 0 && (
        <div
          className="pointer-events-none absolute bottom-5 z-10 -translate-x-1/2 rounded-lg border border-border bg-card p-1 shadow-lift"
          style={{ left: hoverX }}
        >
          {thumbnail && (
            <img
              src={thumbnail}
              alt=""
              className="h-16 w-28 rounded-md object-cover"
              loading="lazy"
            />
          )}
          <p className="mt-1 text-center text-[11px] tabular-nums text-muted-foreground">
            {formatTime(hoverTime)}
          </p>
        </div>
      )}

      <div
        ref={barRef}
        role="slider"
        tabIndex={0}
        aria-label="Seek through track"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(position)}
        aria-valuetext={formatTime(position)}
        className="group flex h-5 cursor-pointer items-center focus-ring-neon"
        onKeyDown={handleKeyDown}
        onPointerDown={(e) => {
          setDragging(true);
          onSeek(ratioFrom(e.clientX) * duration);
        }}
      >
        <div className="relative h-1.5 w-full overflow-visible rounded-full bg-white/10 shadow-inner">
          <div
            className="absolute inset-y-0 left-0 rounded-full progress-gradient shadow-[0_0_12px_rgba(168,85,247,0.4)] transition-all duration-100"
            style={{ width: `${pct}%` }}
          />
          <span
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg shadow-purple-500/50 opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:scale-125 animate-neon-glow"
            style={{ left: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
