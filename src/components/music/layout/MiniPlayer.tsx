import { useRef } from "react";
import { AlertTriangle, Loader2, Pause, Play, SkipBack, SkipForward } from "lucide-react";
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
  isReplacementSource?: boolean;
  onTogglePlay: () => void;
  onToggleLike?: () => void;
  onNext: () => void;
  onPrevious?: () => void;
  onOpenPlayer: () => void;
  onOpenEqualizer?: () => void;
  onSeek?: (seconds: number) => void;
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
  isReplacementSource = false,
  onTogglePlay,
  onToggleLike,
  onNext,
  onPrevious,
  onOpenPlayer,
  onOpenEqualizer: _onOpenEqualizer,
  onSeek,
}: Props) {
  const barRef = useRef<HTMLDivElement | null>(null);

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
      className="fixed z-40 border-t border-hair-strong bg-surface shadow-lift max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl mx-auto left-0 right-0 h-14 sm:h-16 flex flex-col justify-between safe-bottom"
      style={{ bottom: "var(--mobile-nav-height, 56px)" }}
    >
      {/* 2px Hairline Progress Indicator at Top */}
      <div
        ref={barRef}
        role="slider"
        aria-label="Seek track"
        aria-valuenow={Math.round(position)}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        onClick={handleBarClick}
        className="relative w-full h-[2px] bg-chip cursor-pointer"
      >
        <div
          className="h-full bg-primary transition-all duration-150 ease-linear"
          style={{ width: `${progressPct}%` }}
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
          <div className="relative h-10 w-10 sm:h-11 sm:w-11 shrink-0 overflow-hidden rounded-md bg-card border border-border">
            {track?.thumbnail ? (
              <img
                src={track.thumbnail}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-card" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs sm:text-[13px] font-medium text-foreground/95 leading-tight">
              {track?.title ?? "No track"}
            </p>
            <p className="truncate text-[11px] text-muted-foreground font-normal leading-tight mt-0.5">
              {track?.artist ?? "—"}
            </p>
            {isReplacementSource && (
              <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-medium text-amber-400/90 bg-amber-400/10 rounded px-1.5 py-0.5">
                <AlertTriangle className="h-2.5 w-2.5" />
                Replacement recording
              </span>
            )}
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
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-black" />
            ) : isPlaying ? (
              <Pause className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-black text-black" />
            ) : (
              <Play className="ml-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4 fill-black text-black" />
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
