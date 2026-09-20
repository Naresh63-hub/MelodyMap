import { useCallback, useRef, useState } from "react";
import { Heart, Loader2, Pause, Play, SkipForward, Sliders } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Track } from "@/lib/library";
import { formatTime } from "@/lib/use-audio-player";

type Props = {
  track: Track | undefined;
  isPlaying: boolean;
  isLoading?: boolean;
  liked?: boolean;
  position: number;
  duration: number;
  onTogglePlay: () => void;
  onToggleLike?: () => void;
  onNext: () => void;
  onOpenPlayer: () => void;
  onOpenEqualizer?: () => void;
  onSeek?: (seconds: number) => void;
};

/**
 * Compact mini player docked above the mobile bottom navigation.
 * Styled with Deep Royal Violet glass and ambient glow.
 * Features an interactive, draggable scrub bar at the top with touch-friendly controls.
 */
export function MiniPlayer({
  track,
  isPlaying,
  isLoading = false,
  liked = false,
  position,
  duration,
  onTogglePlay,
  onToggleLike,
  onNext,
  onOpenPlayer,
  onOpenEqualizer,
  onSeek,
}: Props) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(0);

  const activePosition = isDragging ? dragPosition : position;
  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (activePosition / duration) * 100)) : 0;

  const getRatio = useCallback((clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onSeek || duration <= 0) return;
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setIsDragging(true);
    const ratio = getRatio(e.clientX);
    const target = ratio * duration;
    setDragPosition(target);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || duration <= 0) return;
    e.stopPropagation();
    const ratio = getRatio(e.clientX);
    setDragPosition(ratio * duration);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    setIsDragging(false);
    if (onSeek && duration > 0) {
      const ratio = getRatio(e.clientX);
      onSeek(ratio * duration);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    setIsDragging(false);
  };

  return (
    <div
      className="fixed z-40 border-t border-purple-500/20 bg-[#120d22]/95 backdrop-blur-2xl shadow-2xl max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl mx-auto left-0 right-0"
      style={{ bottom: "var(--mobile-nav-height, 56px)" }}
    >
      {/* Interactive Draggable Scrub Bar at Top of MiniPlayer */}
      <div
        ref={barRef}
        role="slider"
        tabIndex={0}
        aria-label="Seek track"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(activePosition)}
        className="group relative -mt-2 h-4 w-full cursor-pointer touch-none select-none flex items-center py-1.5"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {/* Floating timestamp tooltip while dragging */}
        {isDragging && duration > 0 && (
          <div
            className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded-md bg-purple-900/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg backdrop-blur-sm border border-purple-400/30"
            style={{ left: `${progressPct}%` }}
          >
            {formatTime(dragPosition)} / {formatTime(duration)}
          </div>
        )}

        {/* Track groove */}
        <div className="relative h-1 w-full bg-purple-950/60 rounded-full transition-all group-hover:h-1.5 overflow-visible">
          <div
            className="h-full bg-gradient-to-r from-purple-500 via-indigo-400 to-pink-500 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.5)] transition-all duration-75"
            style={{ width: `${progressPct}%` }}
          />
          {/* Thumb handle */}
          <span
            className={cn(
              "absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md shadow-purple-600/50 transition-transform duration-75",
              isDragging ? "scale-125 opacity-100 ring-2 ring-purple-400" : "opacity-0 group-hover:opacity-100 scale-100",
            )}
            style={{ left: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 px-3.5 py-2.5">
        {/* Artwork + Track Info — tap to open full player */}
        <button
          type="button"
          onClick={onOpenPlayer}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-label={`Open player for ${track?.title ?? "no track"}`}
        >
          <div
            className={cn(
              "relative h-11 w-11 shrink-0 overflow-hidden rounded-xl shadow-md shadow-purple-950/50 transition-all duration-300",
              isPlaying && "ring-2 ring-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.35)]"
            )}
          >
            {track?.thumbnail ? (
              <img
                src={track.thumbnail}
                alt=""
                className={cn(
                  "h-full w-full object-cover transition-transform duration-500",
                  isPlaying && "scale-105"
                )}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-purple-900/30" />
            )}
            {isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[0.5px]">
                <div className="flex items-end gap-[2px] h-4">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-[2.5px] rounded-full bg-white animate-bar shadow-[0_0_6px_rgba(255,255,255,0.8)]"
                      style={{ animationDelay: `${i * 0.15}s`, height: "100%" }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-white leading-tight">
              <span className="truncate">{track?.title ?? "Pick a song"}</span>
            </p>
            <p className="truncate text-[11px] text-purple-300/60 leading-tight mt-0.5 font-medium">
              {track?.artist ?? "—"}
            </p>
          </div>
        </button>

        {/* Transport controls */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          {onToggleLike && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleLike();
              }}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full active:scale-90 transition-all",
                liked
                  ? "text-pink-400 hover:text-pink-300 hover:bg-pink-500/10 shadow-[0_0_12px_rgba(244,114,182,0.35)]"
                  : "text-purple-300/70 hover:text-white hover:bg-white/5"
              )}
              aria-label={liked ? "Remove from favourites" : "Add to favourites (trains AI recommendations)"}
              title={liked ? "In your favourites" : "Save to favourites (tunes your recommendations)"}
            >
              <Heart
                className={cn(
                  "h-4 w-4 transition-all duration-200",
                  liked ? "fill-pink-500 text-pink-500 scale-110 drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]" : "hover:scale-110"
                )}
              />
            </button>
          )}

          {onOpenEqualizer && (
            <button
              type="button"
              onClick={onOpenEqualizer}
              className="flex h-9 w-9 items-center justify-center rounded-full text-purple-300 hover:text-white hover:bg-white/5 active:scale-90 transition-all"
              aria-label="Equalizer & FX"
              title="Equalizer & FX"
            >
              <Sliders className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onTogglePlay}
            disabled={isLoading}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-600 text-white shadow-md shadow-purple-600/40 active:scale-90 transition-all disabled:opacity-80"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : isPlaying ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            )}
          </button>

          <button
            type="button"
            onClick={onNext}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/60 hover:text-white active:scale-90 transition-all"
            aria-label="Next track"
          >
            <SkipForward className="h-4 w-4 fill-current" />
          </button>
        </div>
      </div>
    </div>
  );
}
