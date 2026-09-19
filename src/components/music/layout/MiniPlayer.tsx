import { Heart, Loader2, Pause, Play, SkipForward, Sliders } from "lucide-react";
import { cn } from "@/lib/utils";
import { Equalizer } from "@/components/music/NowPlayingViz";
import type { Track } from "@/lib/library";

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
};

/**
 * Compact mini player docked above the mobile bottom navigation.
 * Styled with Deep Royal Violet glass and ambient glow.
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
}: Props) {
  const progressPct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <div
      className="fixed z-40 border-t border-purple-500/20 bg-[#120d22]/95 backdrop-blur-2xl shadow-2xl max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl mx-auto left-0 right-0"
      style={{ bottom: "var(--mobile-nav-height, 56px)" }}
    >
      {/* Violet Progress bar at top of mini player */}
      <div className="h-0.5 w-full bg-purple-950/40">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="flex items-center gap-3 px-3.5 py-2.5">
        {/* Artwork + Track Info — tap to open full player */}
        <button
          type="button"
          onClick={onOpenPlayer}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-label={`Open player for ${track?.title ?? "no track"}`}
        >
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl shadow-md shadow-purple-950/50">
            {track?.thumbnail ? (
              <img
                src={track.thumbnail}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-purple-900/30" />
            )}
            {isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="flex items-end gap-[2px] h-4">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-[2.5px] rounded-full bg-white animate-bar"
                      style={{ animationDelay: `${i * 0.15}s`, height: "100%" }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-[13px] font-bold text-white leading-tight">
              {isPlaying && (
                <Equalizer active className="h-3 w-3 shrink-0 text-purple-400" />
              )}
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
