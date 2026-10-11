import { useRef, useState } from "react";
import { Loader2, Music2, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Track } from "@/lib/library";
import { HeartLikeButton } from "@/components/music/ui/HeartLikeButton";
import { triggerHaptic } from "@/lib/haptics";
import { useSwipeGestures } from "@/hooks/use-gesture-controls";

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
  onPrevious?: () => void;
  onOpenPlayer: () => void;
  onOpenEqualizer?: () => void;
  onSeek?: (seconds: number) => void;
  sidebarCollapsed?: boolean;
};

/**
 * Clean, human-designed music player dock anchored above bottom navigation.
 * Standard streaming architecture: [Artwork] [Song/Artist] [Like] [Prev] [Play/Pause] [Next]
 * Very thin progress hairline on top edge.
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
  onPrevious,
  onOpenPlayer,
  onOpenEqualizer: _onOpenEqualizer,
  onSeek,
  sidebarCollapsed = false,
}: Props) {
  const barRef = useRef<HTMLDivElement | null>(null);
  // Reset whenever the artwork source changes so a new track can attempt to load again.
  const [thumbError, setThumbError] = useState(false);
  const thumbSrc = track?.thumbnail ?? "";
  const lastThumbRef = useRef(thumbSrc);
  if (lastThumbRef.current !== thumbSrc) {
    lastThumbRef.current = thumbSrc;
    if (thumbError) setThumbError(false);
  }

  // Swipe up anywhere on the dock expands the full-screen player
  const swipeProps = useSwipeGestures({ onSwipeUp: onOpenPlayer });

  const progressPct =
    duration > 0 ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0;

  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || duration <= 0) return;
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  return (
    <div
      {...swipeProps}
      className={cn(
        "fixed z-40 border-t border-hair-strong bg-surface shadow-lift h-14 sm:h-16 flex flex-col justify-between safe-bottom bottom-[var(--mobile-nav-height,56px)] lg:bottom-0 left-0 right-0 transition-all duration-300",
        sidebarCollapsed ? "lg:left-[72px]" : "lg:left-[260px]"
      )}
    >
      {/* 2.5px Progress Indicator at Top */}
      <div
        ref={barRef}
        role="slider"
        aria-label="Seek track"
        aria-valuenow={Math.round(position)}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        onClick={handleBarClick}
        className="relative w-full h-[2.5px] bg-chip cursor-pointer overflow-hidden"
      >
        <div
          className="h-full transition-all duration-150 ease-linear rounded-r-full"
          style={{
            width: `${progressPct}%`,
            background: "linear-gradient(90deg, #f7809c 0%, #fb7185 100%)",
          }}
        />
      </div>

      {/* Main Track Row */}
      <div className="flex-1 flex items-center justify-between px-3 gap-2.5">
        {/* Artwork + Title/Artist -> tap anywhere to expand to Full Player */}
        <button
          type="button"
          onClick={onOpenPlayer}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          aria-label={`Open player for ${track?.title ?? "current track"}`}
        >
          {/* Circular rotating vinyl disc artwork */}
          <div className="relative h-10 w-10 sm:h-11 sm:w-11 shrink-0 rounded-full p-[2px] bg-gradient-to-tr from-neutral-900 via-neutral-800 to-black shadow-md border border-white/10 ring-1 ring-black/50 overflow-hidden flex items-center justify-center">
            <div
              className="h-full w-full rounded-full overflow-hidden relative flex items-center justify-center animate-vinyl-spin select-none"
              style={{
                animationPlayState: isPlaying ? "running" : "paused",
              }}
            >
              {track?.thumbnail && !thumbError ? (
                <img
                  src={track.thumbnail}
                  alt=""
                  onError={() => setThumbError(true)}
                  className="h-full w-full object-cover rounded-full pointer-events-none select-none"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-card text-muted-foreground rounded-full">
                  <Music2 className="h-4 w-4" />
                </div>
              )}
              {/* Vinyl center spindle hole */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#121214] border border-white/30 shadow-inner z-10 pointer-events-none" />
              {/* Subtle vinyl groove ring border */}
              <div className="absolute inset-0 rounded-full border border-black/40 pointer-events-none z-10" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs sm:text-[13px] font-medium text-foreground/95 leading-tight">
              {track?.title ?? "No track"}
            </p>
            <p className="truncate text-[11px] text-muted-foreground font-normal leading-tight mt-0.5">
              {track?.artist ?? "—"}
            </p>
          </div>
        </button>

        {/* Playback Controls */}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {onToggleLike && (
            <HeartLikeButton
              liked={liked}
              onToggle={() => onToggleLike()}
              size="md"
            />
          )}

          {onPrevious && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onPrevious();
              }}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Previous track"
            >
              <SkipBack className="h-4 w-4" />
            </button>
          )}

          {/* Primary Play/Pause Button */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('medium');
              onTogglePlay();
            }}
            disabled={isLoading}
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-foreground text-background hover:scale-105 active:scale-95 transition-transform disabled:opacity-75"
            aria-label={isLoading ? "Loading" : isPlaying ? "Pause" : "Play"}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current" />
            ) : (
              <Play className="ml-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onNext();
            }}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Next track"
          >
            <SkipForward className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
