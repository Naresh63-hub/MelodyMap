import { useState, useCallback, useMemo } from "react";
import {
  Heart,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  Maximize2,
  Minimize2,
  ListMusic,
  MessageSquare,
  Share2,
  Download,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Equalizer, SpinningArt } from "@/components/music/NowPlayingViz";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatTime } from "@/lib/use-youtube-iframe";
import type { Track } from "@/lib/library";

type Props = {
  track: Track | null;
  isPlaying: boolean;
  liked: boolean;
  position: number;
  duration: number;
  volume: number;
  onTogglePlay: () => void;
  onToggleLike: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (volume: number) => void;
  onClose: () => void;
  canNext: boolean;
  canPrevious: boolean;
};

export function FullScreenPlayer({
  track,
  isPlaying,
  liked,
  position,
  duration,
  volume,
  onTogglePlay,
  onToggleLike,
  onNext,
  onPrevious,
  onSeek,
  onVolumeChange,
  onClose,
  canNext,
  canPrevious,
}: Props) {
  const [showLyrics, setShowLyrics] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  const progressPct = useMemo(
    () => (duration > 0 ? (position / duration) * 100 : 0),
    [position, duration],
  );

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      onSeek(ratio * duration);
    },
    [duration, onSeek],
  );

  if (!track) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      {/* Cinematic blurred background */}
      <div
        className="absolute inset-0 bg-cover bg-center blur-3xl opacity-40 scale-110"
        style={{
          backgroundImage: `url(${track.thumbnail})`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/80" />
      
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/10 via-purple-500/10 to-cyan-500/10 animate-ambient" />

      {/* Content */}
      <div className="relative z-10 flex h-full w-full max-w-6xl flex-col items-center justify-between p-4 sm:p-6 md:p-8 lg:p-12">
        {/* Header */}
        <div className="flex w-full items-center justify-between">
          <button
            onClick={onClose}
            aria-label="Collapse player"
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <Minimize2 className="h-5 w-5" />
            <span className="text-sm font-medium">Collapse</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLyrics(!showLyrics)}
              aria-label={showLyrics ? "Hide lyrics" : "Show lyrics"}
              aria-pressed={showLyrics}
              className={cn(
                "p-2 rounded-full transition-colors",
                showLyrics ? "bg-white/10 text-white" : "text-white/60 hover:text-white",
              )}
            >
              <MessageSquare className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowQueue(!showQueue)}
              aria-label={showQueue ? "Hide queue" : "Show queue"}
              aria-pressed={showQueue}
              className={cn(
                "p-2 rounded-full transition-colors",
                showQueue ? "bg-white/10 text-white" : "text-white/60 hover:text-white",
              )}
            >
              <ListMusic className="h-5 w-5" />
            </button>
            {/* Share and More buttons hidden — not yet wired up */}
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-1 flex-col items-center justify-center gap-8 md:gap-12 w-full max-w-2xl">
          {/* Album art */}
          <div className="relative group">
            <div className="relative aspect-square w-full max-w-[200px] sm:max-w-md md:max-w-lg overflow-hidden rounded-3xl shadow-2xl shadow-purple-500/30 transition-transform duration-500 group-hover:scale-105">
              <img
                src={track.thumbnail}
                alt={track.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            {isPlaying && (
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-cyan-500/10 blur-2xl animate-pulse" />
            )}
          </div>

          {/* Track info */}
          <div className="text-center space-y-2 w-full px-4">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white truncate icon-glow">
              {track.title}
            </h2>
            <p className="text-base sm:text-lg text-white/60 truncate">{track.artist}</p>
          </div>

          {/* Progress bar */}
          <div className="w-full space-y-2">
            <div className="flex items-center gap-3">
              <span className="w-10 text-right text-xs tabular-nums text-white/60">
                {formatTime(position)}
              </span>
              <div
                role="progressbar"
                aria-label="Track progress"
                aria-valuemin={0}
                aria-valuemax={Math.round(duration)}
                aria-valuenow={Math.round(position)}
                className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden cursor-pointer group"
                onClick={handleProgressClick}
              >
                <div
                  className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 rounded-full transition-all duration-100 group-hover:shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="w-10 text-left text-xs tabular-nums text-white/60">
                {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 sm:gap-4 md:gap-6">
            {/* Shuffle/Repeat hidden — not yet wired up */}
            <button
              onClick={onPrevious}
              disabled={!canPrevious}
              aria-label="Previous track"
              className="p-2 sm:p-3 text-white hover:text-pink-400 transition-colors disabled:opacity-30 disabled:hover:text-white button-press"
            >
              <SkipBack className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            <button
              onClick={onTogglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="p-3 sm:p-4 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-500 text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all duration-200 hover:scale-105 button-press animate-neon-glow"
            >
              {isPlaying ? (
                <Pause className="h-6 w-6 sm:h-8 sm:w-8" fill="currentColor" />
              ) : (
                <Play className="h-6 w-6 sm:h-8 sm:w-8 ml-1" fill="currentColor" />
              )}
            </button>
            <button
              onClick={onNext}
              disabled={!canNext}
              aria-label="Next track"
              className="p-2 sm:p-3 text-white hover:text-pink-400 transition-colors disabled:opacity-30 disabled:hover:text-white button-press"
            >
              <SkipForward className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            {/* Repeat hidden — not yet wired up */}
          </div>

          {/* Additional controls */}
          <div className="flex items-center gap-4 sm:gap-6 w-full justify-center">
            <button
              onClick={onToggleLike}
              aria-label={liked ? "Unlike" : "Like"}
              className={cn(
                "p-2 transition-colors button-press",
                liked ? "text-pink-400 icon-glow" : "text-white/60 hover:text-white",
              )}
            >
              <Heart className={cn("h-5 w-5", liked && "fill-current")} />
            </button>
            {/* Download button hidden on mobile, shown on desktop */}
            <button
              aria-label="Download for offline"
              className="p-2 text-white/60 hover:text-white transition-colors button-press hidden sm:block"
            >
              <Download className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 hidden sm:flex">
              <Volume2 className="h-5 w-5 text-white/60" />
              <Slider
                value={[volume]}
                max={100}
                onValueChange={([v]) => onVolumeChange(v ?? 0)}
                className="w-20 sm:w-24"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-white/30">
            YOUR MUSIC. YOUR MOOD. YOUR MAP.
          </p>
        </div>
      </div>
    </div>
  );
}