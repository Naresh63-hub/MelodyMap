import { useRef } from "react";
import { Disc, Heart, Loader2, Moon, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Track } from "@/lib/library";

type Props = {
  track: Track | undefined;
  isPlaying: boolean;
  isLoading?: boolean;
  liked?: boolean;
  position: number;
  duration: number;
  isCrossfading?: boolean;
  isSleepTimerActive?: boolean;
  sleepTimerRemaining?: string;
  userInitial?: string;
  onTogglePlay: () => void;
  onToggleLike?: () => void;
  onNext: () => void;
  onPrevious?: () => void;
  onOpenPlayer: () => void;
  onOpenSleepTimer?: () => void;
  onOpenEqualizer?: () => void;
  onSeek?: (seconds: number) => void;
};

/**
 * Spotify-styled Mini Player dock anchored above bottom navigation.
 * Standard streaming architecture: [Rotating User Vinyl Badge + Artwork] [Song/Artist] [Sleep Timer] [Like] [Prev] [Play/Pause] [Next]
 * Very thin progress hairline on top edge.
 */
export function MiniPlayer({
  track,
  isPlaying,
  isLoading = false,
  liked = false,
  position,
  duration,
  isCrossfading = false,
  isSleepTimerActive = false,
  sleepTimerRemaining = "",
  userInitial = "N",
  onTogglePlay,
  onToggleLike,
  onNext,
  onPrevious,
  onOpenPlayer,
  onOpenSleepTimer,
  onOpenEqualizer: _onOpenEqualizer,
  onSeek,
}: Props) {
  const barRef = useRef<HTMLDivElement | null>(null);

  const progressPct =
    duration > 0 ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0;

  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || duration <= 0) return;
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  const initial = userInitial.trim().charAt(0).toUpperCase() || "N";

  return (
    <div
      className="fixed z-40 border-t border-white/[0.08] bg-[#121212]/98 backdrop-blur-2xl shadow-2xl max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl mx-auto left-0 right-0 h-14 sm:h-16 flex flex-col justify-between transition-all"
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
        className="relative w-full h-[2.5px] bg-white/[0.08] cursor-pointer group"
      >
        <div
          className="h-full bg-[#1DB954] transition-all duration-150 ease-linear group-hover:bg-[#1ed760]"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Main Track Row */}
      <div className="flex-1 flex items-center justify-between px-3 gap-2.5">
        {/* Artwork + Rotating Vinyl User Letter Circle + Title/Artist -> tap to expand */}
        <button
          type="button"
          onClick={onOpenPlayer}
          className="flex min-w-0 flex-1 items-center gap-2 text-left group"
          aria-label={`Open player for ${track?.title ?? "current track"}`}
        >
          {/* Pristine Album Thumbnail with strict boundaries (ZERO overlapping elements) */}
          <div className="h-10 w-10 sm:h-11 sm:w-11 shrink-0 overflow-hidden rounded-lg bg-[#181818] border border-white/[0.08] shadow-md">
            {track?.thumbnail ? (
              <img
                src={track.thumbnail}
                alt={track.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#181818]" />
            )}
          </div>

          {/* Dedicated Rotating User Vinyl Disc (Standalone, zero overlap, strictly bounded) */}
          <div
            className={cn(
              "relative flex h-8 w-8 sm:h-8.5 sm:w-8.5 shrink-0 items-center justify-center rounded-full bg-[#121212] border border-white/20 shadow-sm select-none transition-transform",
              isPlaying ? "animate-[spin_4s_linear_infinite]" : "rotate-0"
            )}
            title={`Listener: ${initial} • ${isPlaying ? "Playing (Vinyl Spinning)" : "Paused"}`}
          >
            {/* Vinyl record groove rings */}
            <div className="absolute inset-1 rounded-full border border-white/10 pointer-events-none" />
            <div className="relative flex h-4 w-4 sm:h-4.5 sm:w-4.5 items-center justify-center rounded-full bg-zinc-950 border border-[#1DB954] text-[#1DB954]">
              <span className="font-black text-[9px] sm:text-[10px] leading-none text-[#1DB954]">
                {initial}
              </span>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="truncate text-xs sm:text-[13px] font-bold text-[#F5F5F5] leading-tight group-hover:text-[#1DB954] transition-colors">
                {track?.title ?? "No track"}
              </p>
              {isCrossfading && (
                <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded-full animate-pulse">
                  <Disc className="h-2.5 w-2.5 animate-spin text-emerald-400" />
                  Fade
                </span>
              )}
            </div>
            <p className="truncate text-[11px] text-[#A1A1A1] leading-tight mt-0.5 font-medium">
              {track?.artist ?? "—"}
            </p>
          </div>
        </button>

        {/* Playback Controls */}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {/* Sleep Timer Controller Button */}
          {onOpenSleepTimer && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSleepTimer();
              }}
              className={cn(
                "p-1.5 sm:p-2 rounded-full transition-all active:scale-95",
                isSleepTimerActive
                  ? "text-[#1DB954] bg-[#1DB954]/15 border border-[#1DB954]/30 shadow-sm"
                  : "text-[#737373] hover:text-[#F5F5F5] hover:bg-white/[0.05]"
              )}
              aria-label="Sleep timer"
              title={isSleepTimerActive ? `Sleep timer active: ${sleepTimerRemaining}` : "Set sleep timer"}
            >
              <Moon className="h-4 w-4" />
            </button>
          )}

          {/* Like Button */}
          {onToggleLike && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleLike();
              }}
              className="p-1.5 sm:p-2 text-[#737373] hover:text-[#F5F5F5] transition-colors active:scale-95"
              aria-label={liked ? "Remove from favourites" : "Save to favourites"}
            >
              <Heart
                className={cn(
                  "h-4 w-4 transition-colors",
                  liked && "fill-[#1DB954] text-[#1DB954]",
                )}
              />
            </button>
          )}

          {/* Previous Track */}
          {onPrevious && (
            <button
              type="button"
              onClick={onPrevious}
              className="p-1.5 text-[#737373] hover:text-[#F5F5F5] transition-colors active:scale-95"
              aria-label="Previous track"
            >
              <SkipBack className="h-4 w-4 fill-current" />
            </button>
          )}

          {/* Primary Play/Pause Button */}
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={isLoading}
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-[#F5F5F5] text-black hover:scale-105 active:scale-95 transition-transform disabled:opacity-75 shadow-md shadow-black/40"
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

          {/* Next Track */}
          <button
            type="button"
            onClick={onNext}
            className="p-1.5 text-[#737373] hover:text-[#F5F5F5] transition-colors active:scale-95"
            aria-label="Next track"
          >
            <SkipForward className="h-4 w-4 fill-current" />
          </button>
        </div>
      </div>
    </div>
  );
}
