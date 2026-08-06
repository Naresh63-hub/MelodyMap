import { useRef, useState } from "react";
import { formatTime } from "@/lib/use-youtube-player";
import { cn } from "@/lib/utils";

type Props = {
  position: number;
  duration: number;
  thumbnail?: string | undefined;
  onSeek: (seconds: number) => void;
  className?: string;
};

/** Scrub bar with a hover thumbnail + timestamp preview. */
export function ScrubBar({ position, duration, thumbnail, onSeek, className }: Props) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState(0);
  const [dragging, setDragging] = useState(false);

  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  const ratioFrom = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const handleMove = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = ratioFrom(clientX);
    setHoverX(ratio * rect.width);
    setHoverTime(ratio * duration);
    if (dragging) onSeek(ratio * duration);
  };

  return (
    <div
      className={cn("relative w-full select-none", className)}
      onPointerMove={(e) => handleMove(e.clientX)}
      onPointerLeave={() => {
        setHoverX(null);
        setDragging(false);
      }}
      onPointerUp={() => setDragging(false)}
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
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(position)}
        className="group flex h-5 cursor-pointer items-center"
        onPointerDown={(e) => {
          setDragging(true);
          onSeek(ratioFrom(e.clientX) * duration);
        }}
      >
        <div className="relative h-1.5 w-full overflow-visible rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary"
            style={{ width: `${pct}%` }}
          />
          <span
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-0 transition-opacity group-hover:opacity-100"
            style={{ left: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
