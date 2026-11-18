import { useRef, useState } from "react";
import { Loader2, Music2, Pause, Play, Radio, SkipBack, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Track } from "@/lib/library";
import { isPodcastTrack } from "@/lib/track-filters";
import { HeartLikeButton } from "@/components/music/ui/HeartLikeButton";
import { triggerHaptic } from "@/lib/haptics";

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
  onOpenJam?: () => void;
  jamActive?: boolean;
  onSeek?: (seconds: number) => void;
  onPodcastChannelClick?: (track: Track) => void;
  onArtistClick?: (artist: string, track?: Track) => void;
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
  onOpenJam,
  jamActive = false,
  onSeek,
  onPodcastChannelClick,
  onArtistClick,
  sidebarCollapsed = false,
}: Props) {
  const isPodcast = track ? isPodcastTrack(track) : false;
  const barRef = useRef<HTMLDivElement | null>(null);
  // Reset whenever the artwork source changes so a new track can attempt to load again.
  const [thumbError, setThumbError] = useState(false);
  const thumbSrc = track?.thumbnail ?? "";
  const lastThumbRef = useRef(thumbSrc);
  if (lastThumbRef.current !== thumbSrc) {
    lastThumbRef.current = thumbSrc;
    if (thumbError) setThumbError(false);
  }

  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartPos = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) {
      touchStartPos.current = { x: t.clientX, y: t.clientY, time: Date.now() };
      setIsDragging(false);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - touchStartPos.current.x;
    const dy = t.clientY - touchStartPos.current.y;

    if (Math.abs(dx) > Math.abs(dy) * 1.15 && Math.abs(dx) > 8) {
      setIsDragging(true);
      setDragX(dx * 0.42);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartPos.current;
    touchStartPos.current = null;
    if (!start) {
      setDragX(0);
      setIsDragging(false);
      return;
    }

    const t = e.changedTouches[0];
    if (!t) {
      setDragX(0);
      setIsDragging(false);
      return;
    }

    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const dt = Date.now() - start.time;

    // Swipe Up -> Expand Full Player
    if (dy < -38 && Math.abs(dy) > Math.abs(dx) * 1.25) {
      triggerHaptic("medium");
      onOpenPlayer();
      setDragX(0);
      setIsDragging(false);
      return;
    }

    // Horizontal Swipe -> Next / Previous with haptic feedback
    const threshold = 45;
    const isQuickFlick = dt < 300 && Math.abs(dx) > 25;
    if (Math.abs(dx) >= threshold || isQuickFlick) {
      if (dx < 0) {
        // Swipe Left -> Next Track
        triggerHaptic("medium");
        onNext();
      } else if (dx > 0 && onPrevious) {
        // Swipe Right -> Previous Track
        triggerHaptic("medium");
        onPrevious();
      }
    }

    setDragX(0);
    setTimeout(() => setIsDragging(false), 200);
  };

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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={cn(
        "fixed z-40 h-14 sm:h-16 flex flex-col justify-between transition-all duration-300",
        "bottom-[calc(70px+var(--mm-inset-bottom,0px))] lg:bottom-0",
        "mx-2.5 sm:mx-4 max-w-lg left-0 right-0 sm:mx-auto lg:max-w-none lg:mx-0",
        "rounded-2xl lg:rounded-none border border-purple-300/40 dark:border-purple-500/30 lg:border-x-0 lg:border-b-0 lg:border-t lg:border-hair-strong",
        "bg-white/90 dark:bg-[#150d24]/90 backdrop-blur-xl shadow-xl shadow-purple-900/10 dark:shadow-black/60",
        sidebarCollapsed ? "lg:left-[72px]" : "lg:left-[260px]",
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
            background: "linear-gradient(90deg, #8B5CF6 0%, #A855F7 100%)",
          }}
        />
      </div>

      {/* Main Track Row */}
      <div className="relative flex-1 flex items-center justify-between px-3 gap-2.5 overflow-hidden">
        {/* Swipe Feedback Cues */}
        {dragX < -15 && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] font-bold text-primary dark:text-purple-300 pointer-events-none animate-fade-in z-20 bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 backdrop-blur-sm">
            <span>Next</span>
            <SkipForward className="h-3.5 w-3.5" />
          </div>
        )}
        {dragX > 15 && onPrevious && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] font-bold text-primary dark:text-purple-300 pointer-events-none animate-fade-in z-20 bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 backdrop-blur-sm">
            <SkipBack className="h-3.5 w-3.5" />
            <span>Prev</span>
          </div>
        )}

        {/* Artwork + Title/Artist -> tap anywhere to expand to Full Player */}
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            if (isDragging) {
              e.preventDefault();
              return;
            }
            onOpenPlayer();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onOpenPlayer();
          }}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left cursor-pointer"
          style={{
            transform: `translateX(${dragX}px)`,
            transition: isDragging ? "none" : "transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)",
          }}
          aria-label={`Open player for ${track?.title ?? "current track"}`}
        >
          {/* Circular rotating vinyl disc artwork */}
          <div className="relative h-10 w-10 sm:h-11 sm:w-11 shrink-0 rounded-full p-[2px] bg-gradient-to-tr from-neutral-900 via-neutral-800 to-black shadow-sm border border-hair ring-1 ring-black/30 overflow-hidden flex items-center justify-center">
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
            <p className="truncate text-xs sm:text-[13px] font-semibold text-foreground leading-tight">
              {track?.title ?? "No track"}
            </p>
            {isPodcast ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onPodcastChannelClick && track) onPodcastChannelClick(track);
                  else if (onArtistClick && track) onArtistClick(track.artist, track);
                }}
                className="truncate text-[11px] text-muted-foreground hover:text-primary hover:underline transition-colors font-normal leading-tight mt-0.5 text-left block max-w-full"
                title={`View all episodes from ${track?.artist ?? "podcast"}`}
              >
                {track?.artist ?? "—"}
              </button>
            ) : (
              <p className="truncate text-[11px] text-muted-foreground font-normal leading-tight mt-0.5">
                {track?.artist ?? "—"}
              </p>
            )}
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {onOpenJam && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenJam();
              }}
              className={cn(
                "hidden sm:flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                jamActive ? "text-[#8B5CF6] bg-[#8B5CF6]/15 animate-pulse" : "text-muted-foreground hover:text-foreground",
              )}
              title={jamActive ? "Jam active" : "Start or Join Jam"}
              aria-label="Jam Session"
            >
              <Radio className="h-4 w-4" />
            </button>
          )}

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
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Previous track"
            >
              <SkipBack aria-hidden="true" className="h-4 w-4" />
            </button>
          )}

          {/* Primary Play/Pause Button - Deep Violet Accent */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('medium');
              onTogglePlay();
            }}
            disabled={isLoading}
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90 active:bg-primary/80 hover:scale-105 active:scale-95 transition-all disabled:opacity-75"
            aria-label={isLoading ? "Loading" : isPlaying ? "Pause" : "Play"}
          >
            {isLoading ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : isPlaying ? (
              <Pause aria-hidden="true" className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current" />
            ) : (
              <Play aria-hidden="true" className="ml-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onNext();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Next track"
          >
            <SkipForward aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
