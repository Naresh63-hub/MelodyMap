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
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrubBar } from "@/components/music/ScrubBar";
import { formatTime } from "@/lib/use-audio-player";
import { useSleepTimer } from "@/hooks/useSleepTimer";
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
  isQueueOpen?: boolean;
  onOpenLyrics?: () => void;
  onOpenSleepTimer?: () => void;
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
  isQueueOpen = false,
  onOpenLyrics,
  onOpenSleepTimer,
  onOpenEqualizer,
  onOpenPip,
  onOpenShortcuts,
  onOpenOptions,
  onAddToPlaylist,
  canNext,
  canPrevious,
}: Props) {
  const { isActive: isSleepTimerActive, formattedRemaining: sleepTimerCountdown } = useSleepTimer();

  if (!track) return null;

  const cycleSpeed = () => {
    if (!onSpeedChange) return;
    const currentIndex = SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % SPEEDS.length;
    onSpeedChange(SPEEDS[nextIndex] ?? 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#080808] overflow-hidden animate-fade-in">
      {/* Soft ambient background art glow */}
      <div
        className="absolute inset-0 bg-cover bg-center blur-3xl opacity-15 scale-125 transition-all duration-700 pointer-events-none"
        style={{
          backgroundImage: `url(${track.thumbnail})`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#080808]/70 via-[#080808]/90 to-[#080808] pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 flex h-full w-full max-w-md flex-col justify-between px-6 py-6 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-[calc(env(safe-area-inset-top,0px)+16px)]">
        {/* Top Header */}
        <div className="flex w-full items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            aria-label="Collapse player"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.04] border border-white/[0.06] text-[#A1A1A1] hover:bg-white/[0.08] hover:text-[#F5F5F5] transition-all active:scale-95"
          >
            <ChevronDown className="h-5 w-5" />
          </button>

          <div className="text-center px-4 min-w-0">
            <p className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#737373]">
              PLAYING FROM
            </p>
            <p className="text-xs font-normal text-[#A1A1A1] truncate max-w-[200px] mt-0.5">
              {playlistName}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onOpenOptions?.(track)}
            aria-label="Song options"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.04] border border-white/[0.06] text-[#A1A1A1] hover:bg-white/[0.08] hover:text-[#F5F5F5] transition-all active:scale-95"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>

        {/* Center Artwork */}
        <div className="flex flex-col items-center justify-center my-auto w-full py-4">
          <div className="relative aspect-square w-64 sm:w-72 overflow-hidden rounded-2xl shadow-2xl shadow-black/90 border border-white/[0.06]">
            <img
              src={track.thumbnail}
              alt={track.title}
              className="h-full w-full object-cover"
            />
          </div>

          {/* Track Info Row */}
          <div className="flex items-center justify-between w-full mt-6 px-1">
            <div className="min-w-0 flex-1 pr-4">
              <h2 className="text-lg sm:text-xl font-semibold text-[#F5F5F5] truncate tracking-tight">
                {track.title}
              </h2>
              <p className="text-sm font-normal text-[#A1A1A1] truncate mt-0.5">
                {track.artist}
              </p>
              {(track.album || track.year) && (
                <p className="text-xs text-[#737373] truncate mt-0.5">
                  {[track.album, track.year].filter(Boolean).join(" • ")}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleLike}
                aria-label="Favourite"
                className="flex h-10 w-10 items-center justify-center rounded-full text-[#737373] hover:text-[#F5F5F5] active:scale-90 transition-all"
              >
                <Heart
                  className={cn(
                    "h-6 w-6 transition-all",
                    liked
                      ? "fill-[#1DB954] text-[#1DB954]"
                      : "text-[#737373]"
                  )}
                />
              </button>
              {onAddToPlaylist && (
                <button
                  type="button"
                  onClick={() => onAddToPlaylist(track)}
                  aria-label="Add to playlist"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[#737373] hover:text-[#F5F5F5] active:scale-90 transition-all"
                >
                  <Plus className="h-6 w-6" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Controls Area */}
        <div className="w-full space-y-4">
          {/* Seek Scrubber Bar */}
          <div className="space-y-1">
            <ScrubBar
              position={position}
              duration={duration}
              thumbnail={track.thumbnail}
              onSeek={onSeek}
              className="w-full"
            />
            <div className="flex justify-between text-[11px] font-normal tabular-nums text-[#737373]">
              <span>{formatTime(position)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Primary Transport Controls Row */}
          <div className="flex items-center justify-between px-2">
            {/* Shuffle */}
            <button
              type="button"
              onClick={onToggleShuffle}
              className={cn(
                "p-2 text-[#737373] hover:text-[#F5F5F5] transition-colors active:scale-95",
                shuffle && "text-[#1DB954]"
              )}
              aria-label={shuffle ? "Disable shuffle" : "Enable shuffle"}
              title={shuffle ? "Shuffle: On" : "Shuffle: Off"}
            >
              <Shuffle className="h-5 w-5" />
            </button>

            {/* Jump Backward 5s */}
            {onSkipBackward && (
              <button
                type="button"
                onClick={() => onSkipBackward(5)}
                className="p-1.5 text-[#737373] hover:text-[#A1A1A1] active:scale-95 transition-all"
                title="Rewind 5 seconds"
              >
                <RotateCcw className="h-4.5 w-4.5" />
              </button>
            )}

            {/* Previous */}
            <button
              type="button"
              onClick={onPrevious}
              disabled={!canPrevious}
              className="p-2 text-[#F5F5F5] hover:text-white disabled:opacity-30 active:scale-95 transition-all"
              aria-label="Previous track"
            >
              <SkipBack className="h-6 w-6 fill-current" />
            </button>

            {/* Circular Play/Pause Button */}
            <button
              type="button"
              onClick={onTogglePlay}
              disabled={isLoading}
              className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-[#F5F5F5] text-black shadow-lg shadow-black/50 hover:scale-105 active:scale-95 transition-transform disabled:opacity-70"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-black" />
              ) : isPlaying ? (
                <Pause className="h-6 w-6 fill-current" />
              ) : (
                <Play className="ml-0.5 h-6 w-6 fill-current" />
              )}
            </button>

            {/* Next */}
            <button
              type="button"
              onClick={onNext}
              disabled={!canNext}
              className="p-2 text-[#F5F5F5] hover:text-white disabled:opacity-30 active:scale-95 transition-all"
              aria-label="Next track"
            >
              <SkipForward className="h-6 w-6 fill-current" />
            </button>

            {/* Jump Forward 5s */}
            {onSkipForward && (
              <button
                type="button"
                onClick={() => onSkipForward(5)}
                className="p-1.5 text-[#737373] hover:text-[#A1A1A1] active:scale-95 transition-all"
                title="Forward 5 seconds"
              >
                <RotateCw className="h-4.5 w-4.5" />
              </button>
            )}

            {/* Repeat */}
            <button
              type="button"
              onClick={onToggleRepeat}
              className={cn(
                "relative p-2 text-[#737373] hover:text-[#F5F5F5] transition-colors active:scale-95",
                repeatMode !== "off" && "text-[#1DB954]"
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
                <Repeat1 className="h-5 w-5 text-[#1DB954]" />
              ) : (
                <Repeat className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Bottom Toolbar Row: Speed, EQ, PiP, Shortcuts, Lyrics, Queue */}
          <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] text-[#737373]">
            {/* Left group: Speed Badge & Equalizer */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cycleSpeed}
                className="flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] px-2.5 py-1 text-xs font-normal text-[#A1A1A1] hover:text-[#F5F5F5] hover:bg-white/[0.08] transition-all"
              >
                <Gauge className="h-3.5 w-3.5 text-[#737373]" />
                <span>{playbackSpeed}x</span>
              </button>

              {onOpenEqualizer && (
                <button
                  type="button"
                  onClick={onOpenEqualizer}
                  aria-label="Equalizer & FX"
                  title="Equalizer & FX"
                  className="flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] px-2.5 py-1 text-xs font-normal text-[#A1A1A1] hover:bg-white/[0.08] hover:text-[#F5F5F5] transition-all"
                >
                  <Sliders className="h-3.5 w-3.5 text-[#737373]" />
                  <span className="hidden sm:inline">EQ</span>
                </button>
              )}

              {onOpenSleepTimer && (
                <button
                  type="button"
                  onClick={onOpenSleepTimer}
                  aria-label="Sleep Timer"
                  title={isSleepTimerActive ? `Sleep Timer: ${sleepTimerCountdown} remaining` : "Sleep Timer"}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-normal transition-all",
                    isSleepTimerActive
                      ? "border-[#1DB954]/40 bg-[#1DB954]/15 text-[#1DB954] shadow-sm font-mono font-medium"
                      : "border-white/[0.06] bg-white/[0.04] text-[#A1A1A1] hover:bg-white/[0.08] hover:text-[#F5F5F5]"
                  )}
                >
                  <Moon className={cn("h-3.5 w-3.5", isSleepTimerActive ? "text-[#1DB954]" : "text-[#737373]")} />
                  <span>{isSleepTimerActive ? sleepTimerCountdown : "Timer"}</span>
                </button>
              )}
            </div>

            {/* Right group: PiP, Shortcuts, Lyrics, Queue */}
            <div className="flex items-center gap-1 sm:gap-2">
              {onOpenPip && (
                <button
                  type="button"
                  onClick={onOpenPip}
                  aria-label="Picture-in-Picture"
                  title="Mini Floating Player"
                  className="p-2 text-[#737373] hover:text-[#F5F5F5] hover:bg-white/[0.04] rounded-full transition-colors"
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
                  className="p-2 text-[#737373] hover:text-[#F5F5F5] hover:bg-white/[0.04] rounded-full transition-colors"
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
                  className="p-2 text-[#737373] hover:text-[#F5F5F5] hover:bg-white/[0.04] rounded-full transition-colors"
                >
                  <MessageSquare className="h-5 w-5" />
                </button>
              )}

              {onOpenQueue && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenQueue();
                  }}
                  aria-label="Queue"
                  title="Queue / Up Next"
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-95",
                    isQueueOpen
                      ? "text-[#1DB954] bg-[#1DB954]/15"
                      : "text-[#737373] hover:text-[#F5F5F5] hover:bg-white/[0.06]"
                  )}
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