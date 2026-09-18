import {
  ChevronDown,
  Command,
  Heart,
  HelpCircle,
  ListMusic,
  Loader2,
  MessageSquare,
  MoreVertical,
  Pause,
  PictureInPicture2,
  Play,
  Repeat,
  Repeat1,
  RotateCcw,
  RotateCw,
  Shuffle,
  SkipBack,
  SkipForward,
  Sliders,
  Gauge,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrubBar } from "@/components/music/ScrubBar";
import { formatTime } from "@/lib/use-audio-player";
import type { Track } from "@/lib/library";

type Props = {
  track: Track | null;
  isPlaying: boolean;
  isLoading?: boolean;
  liked: boolean;
  position: number;
  duration: number;
  volume: number;
  playbackSpeed?: number;
  playlistName?: string;
  shuffle?: boolean;
  repeatMode?: "off" | "all" | "one";
  onToggleShuffle?: () => void;
  onToggleRepeat?: () => void;
  onTogglePlay: () => void;
  onToggleLike: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (seconds: number) => void;
  onSkipForward?: (seconds?: number) => void;
  onSkipBackward?: (seconds?: number) => void;
  onSpeedChange?: (speed: number) => void;
  onVolumeChange: (volume: number) => void;
  onClose: () => void;
  onOpenQueue?: () => void;
  onOpenLyrics?: () => void;
  onOpenEqualizer?: () => void;
  onOpenPip?: () => void;
  onOpenShortcuts?: () => void;
  onOpenOptions?: (track: Track) => void;
  onAddToPlaylist?: (track: Track) => void;
  canNext: boolean;
  canPrevious: boolean;
};

const SPEEDS = [1, 1.25, 1.5, 2];

export function FullScreenPlayer({
  track,
  isPlaying,
  isLoading = false,
  liked,
  position,
  duration,
  volume,
  playbackSpeed = 1,
  playlistName = "My Favourites",
  shuffle = false,
  repeatMode = "off",
  onToggleShuffle,
  onToggleRepeat,
  onTogglePlay,
  onToggleLike,
  onNext,
  onPrevious,
  onSeek,
  onSkipForward,
  onSkipBackward,
  onSpeedChange,
  onVolumeChange,
  onClose,
  onOpenQueue,
  onOpenLyrics,
  onOpenEqualizer,
  onOpenPip,
  onOpenShortcuts,
  onOpenOptions,
  onAddToPlaylist,
  canNext,
  canPrevious,
}: Props) {

  if (!track) return null;

  const cycleSpeed = () => {
    if (!onSpeedChange) return;
    const currentIndex = SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % SPEEDS.length;
    onSpeedChange(SPEEDS[nextIndex] ?? 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0813] overflow-hidden animate-fade-in">
      {/* Blurred background cover art glow */}
      <div
        className="absolute inset-0 bg-cover bg-center blur-3xl opacity-30 scale-125 transition-all duration-700 pointer-events-none"
        style={{
          backgroundImage: `url(${track.thumbnail})`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b0813]/60 via-[#0b0813]/85 to-[#0b0813]" />

      {/* Main Container */}
      <div className="relative z-10 flex h-full w-full max-w-md flex-col justify-between px-6 py-6 safe-top safe-bottom">
        {/* Top Header */}
        <div className="flex w-full items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            aria-label="Collapse player"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.04] border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all active:scale-95"
          >
            <ChevronDown className="h-5 w-5" />
          </button>

          <div className="text-center">
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-purple-400">
              PLAYING FROM
            </p>
            <p className="text-xs font-bold text-white/90 truncate max-w-[180px]">
              {playlistName}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onOpenOptions?.(track)}
            aria-label="Song options"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.04] border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all active:scale-95"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>

        {/* Center Artwork */}
        <div className="flex flex-col items-center justify-center my-auto w-full">
          <div className="relative aspect-square w-64 sm:w-72 overflow-hidden rounded-3xl shadow-2xl shadow-purple-950/80 ring-1 ring-purple-500/20">
            <img
              src={track.thumbnail}
              alt={track.title}
              className="h-full w-full object-cover"
            />
            {isPlaying && (
              <div className="absolute -inset-4 rounded-3xl bg-purple-600/20 blur-2xl animate-pulse -z-10" />
            )}
          </div>

          {/* Track Info Row */}
          <div className="flex items-center justify-between w-full mt-6 px-1">
            <div className="min-w-0 flex-1 pr-3">
              <h2 className="text-xl font-bold text-white truncate">
                {track.title}
              </h2>
              <p className="text-sm font-medium text-purple-300/60 truncate mt-0.5">
                {track.artist}
              </p>
              {(track.album || track.year) && (
                <p className="text-xs text-white/40 truncate mt-0.5">
                  {[track.album, track.year].filter(Boolean).join(" • ")}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleLike}
                aria-label="Favourite"
                className="flex h-10 w-10 items-center justify-center rounded-full text-white/60 hover:text-purple-400 active:scale-90 transition-all"
              >
                <Heart
                  className={cn(
                    "h-6 w-6 transition-all",
                    liked
                      ? "fill-purple-500 text-purple-500 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                      : "text-white/50"
                  )}
                />
              </button>
              {onAddToPlaylist && (
                <button
                  type="button"
                  onClick={() => onAddToPlaylist(track)}
                  aria-label="Add to playlist"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white/50 hover:text-white active:scale-90 transition-all"
                >
                  <Plus className="h-6 w-6" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Controls Area */}
        <div className="w-full space-y-5 pb-2">
          {/* Seek Scrubber Bar */}
          <div className="space-y-1.5">
            <ScrubBar
              position={position}
              duration={duration}
              thumbnail={track.thumbnail}
              onSeek={onSeek}
              className="w-full"
            />
            <div className="flex justify-between text-[11px] font-semibold tabular-nums text-purple-300/50">
              <span>{formatTime(position)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Primary Transport Controls Row */}
          <div className="flex items-center justify-between px-1">
            {/* Shuffle */}
            <button
              type="button"
              onClick={onToggleShuffle}
              className={cn(
                "p-2 text-white/40 hover:text-white transition-colors active:scale-95",
                shuffle && "text-purple-400"
              )}
              aria-label={shuffle ? "Disable shuffle" : "Enable shuffle"}
              title={shuffle ? "Shuffle: On" : "Shuffle: Off"}
            >
              <Shuffle className="h-5 w-5" />
            </button>

            {/* Jump Backward 15s */}
            {onSkipBackward && (
              <button
                type="button"
                onClick={() => onSkipBackward(15)}
                className="p-2 text-white/60 hover:text-white active:scale-95 transition-all"
                title="Rewind 15 seconds"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
            )}

            {/* Previous */}
            <button
              type="button"
              onClick={onPrevious}
              disabled={!canPrevious}
              className="p-2 text-white/70 hover:text-white disabled:opacity-30 active:scale-95 transition-all"
              aria-label="Previous track"
            >
              <SkipBack className="h-6 w-6 fill-current" />
            </button>

            {/* Giant Circular Play/Pause Button */}
            <button
              type="button"
              onClick={onTogglePlay}
              disabled={isLoading}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#0b0813] shadow-[0_0_25px_rgba(139,92,246,0.5)] hover:scale-105 active:scale-95 transition-all disabled:opacity-80"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isLoading ? (
                <Loader2 className="h-7 w-7 animate-spin text-[#0b0813]" />
              ) : isPlaying ? (
                <Pause className="h-7 w-7 fill-current" />
              ) : (
                <Play className="ml-1 h-7 w-7 fill-current" />
              )}
            </button>

            {/* Next */}
            <button
              type="button"
              onClick={onNext}
              disabled={!canNext}
              className="p-2 text-white/70 hover:text-white disabled:opacity-30 active:scale-95 transition-all"
              aria-label="Next track"
            >
              <SkipForward className="h-6 w-6 fill-current" />
            </button>

            {/* Jump Forward 30s */}
            {onSkipForward && (
              <button
                type="button"
                onClick={() => onSkipForward(30)}
                className="p-2 text-white/60 hover:text-white active:scale-95 transition-all"
                title="Forward 30 seconds"
              >
                <RotateCw className="h-5 w-5" />
              </button>
            )}

            {/* Repeat (3 states: off -> all -> one -> off) */}
            <button
              type="button"
              onClick={onToggleRepeat}
              className={cn(
                "relative p-2 text-white/40 hover:text-white transition-colors active:scale-95",
                repeatMode !== "off" && "text-purple-400"
              )}
              aria-label={`Repeat mode: ${repeatMode}`}
              title={
                repeatMode === "one"
                  ? "Repeat: Current song"
                  : repeatMode === "all"
                  ? "Repeat: All songs"
                  : "Repeat: Off"
              }
            >
              {repeatMode === "one" ? (
                <Repeat1 className="h-5 w-5 text-purple-400" />
              ) : (
                <Repeat className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Bottom Toolbar Row: Speed, EQ, PiP, Shortcuts, Lyrics, Queue */}
          <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-white/50">
            {/* Left group: Speed Badge & Equalizer */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cycleSpeed}
                className="flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/10 px-3 py-1.5 text-xs font-semibold text-purple-300 hover:text-white transition-all"
              >
                <Gauge className="h-3.5 w-3.5 text-purple-400" />
                <span>{playbackSpeed}x</span>
              </button>

              {onOpenEqualizer && (
                <button
                  type="button"
                  onClick={onOpenEqualizer}
                  aria-label="Equalizer & FX"
                  title="Equalizer & FX"
                  className="flex items-center gap-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 hover:text-white transition-all"
                >
                  <Sliders className="h-3.5 w-3.5 text-purple-400" />
                  <span className="hidden sm:inline">EQ</span>
                </button>
              )}
            </div>

            {/* Right group: PiP, Shortcuts, Lyrics, Queue */}
            <div className="flex items-center gap-2 sm:gap-3">
              {onOpenPip && (
                <button
                  type="button"
                  onClick={onOpenPip}
                  aria-label="Picture-in-Picture"
                  title="Mini Floating Player"
                  className="p-2 text-white/50 hover:text-purple-400 hover:bg-white/5 rounded-full transition-colors"
                >
                  <PictureInPicture2 className="h-5 w-5" />
                </button>
              )}

              {onOpenShortcuts && (
                <button
                  type="button"
                  onClick={onOpenShortcuts}
                  aria-label="Keyboard Shortcuts"
                  title="Keyboard Shortcuts (?)"
                  className="p-2 text-white/50 hover:text-purple-400 hover:bg-white/5 rounded-full transition-colors"
                >
                  <HelpCircle className="h-5 w-5" />
                </button>
              )}

              {onOpenLyrics && (
                <button
                  type="button"
                  onClick={onOpenLyrics}
                  aria-label="Lyrics"
                  title="Lyrics"
                  className="p-2 text-white/50 hover:text-purple-400 hover:bg-white/5 rounded-full transition-colors"
                >
                  <MessageSquare className="h-5 w-5" />
                </button>
              )}

              {onOpenQueue && (
                <button
                  type="button"
                  onClick={onOpenQueue}
                  aria-label="Queue"
                  title="Queue"
                  className="p-2 text-white/50 hover:text-purple-400 hover:bg-white/5 rounded-full transition-colors"
                >
                  <ListMusic className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}