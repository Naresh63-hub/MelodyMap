import {
  AlertTriangle,
  ChevronDown,
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
import { useDragToDismiss, useDoubleTapSeek, useSwipeGestures } from "@/hooks/use-gesture-controls";
import type { Track } from "@/lib/library";
import { HeartLikeButton } from "@/components/music/ui/HeartLikeButton";
import AudioVisualizer from "./AudioVisualizer";

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
  isReplacementSource?: boolean;
  streamSource?: "youtube" | "audius" | "jamendo" | null;
  getAnalyser?: () => AnalyserNode | null;
};

const SPEEDS = [1, 1.25, 1.5, 2];

export function FullScreenPlayer({
  track,
  isPlaying,
  isLoading = false,
  liked,
  position,
  duration,
  volume: _volume,
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
  onVolumeChange: _onVolumeChange,
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
  isReplacementSource = false,
  streamSource,
  getAnalyser,
}: Props) {
  const { isActive: isSleepTimerActive, formattedRemaining: sleepTimerCountdown } = useSleepTimer();

  // Gesture controls: drag down to dismiss (finger-following), double-tap artwork to seek ±10s, swipe left/right to skip
  const { dragProps, dragY, dragging } = useDragToDismiss({ onDismiss: onClose });
  const { gestureProps: doubleTapProps, flash } = useDoubleTapSeek({
    onBackward: (s) => (onSkipBackward ? onSkipBackward(s) : onSeek(Math.max(0, position - s))),
    onForward: (s) => (onSkipForward ? onSkipForward(s) : onSeek(Math.min(duration, position + s))),
    seconds: 10,
  });
  const { onTouchStart: swipeStart, onTouchEnd: swipeEnd } = useSwipeGestures({
    onSwipeLeft: onNext,
    onSwipeRight: onPrevious,
    threshold: 80,
  });

  if (!track) return null;

  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;
  const dismissProgress = Math.min(1, Math.abs(dragY) / (viewportH * 0.9));

  const cycleSpeed = () => {
    if (!onSpeedChange) return;
    const currentIndex = SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % SPEEDS.length;
    onSpeedChange(SPEEDS[nextIndex] ?? 1);
  };

  return (
    <div
      {...dragProps}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background overflow-hidden animate-fade-in"
      style={{
        transform: dragY ? `translateY(${dragY}px)` : undefined,
        opacity: dragY ? 1 - dismissProgress * 0.85 : undefined,
        transition: dragging
          ? "none"
          : "transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.28s ease",
      }}
    >
      {/* Multi-layer gradient background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(circle at 30% 30%, rgba(56, 189, 248, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 70% 70%, rgba(233, 69, 96, 0.2) 0%, transparent 50%),
            linear-gradient(135deg, #1a0a2e 0%, #16213e 100%)
          `
        }}
      />
      {/* Soft ambient background art glow */}
      <div
        className="absolute inset-0 bg-cover bg-center blur-3xl opacity-15 scale-125 transition-all duration-700 pointer-events-none"
        style={{
          backgroundImage: `url(${track.thumbnail})`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/90 to-background pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 flex h-full w-full max-w-md flex-col justify-between px-6 py-6 pb-[calc(var(--mm-inset-bottom)+20px)] pt-[calc(var(--mm-inset-top)+16px)]">
        {/* Top Header */}
        <div className="flex w-full items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            aria-label="Collapse player"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-chip border border-hair text-secondary-foreground hover:bg-chip-strong hover:text-foreground transition-all active:scale-95"
          >
            <ChevronDown className="h-5 w-5" />
          </button>

          <div className="text-center px-4 min-w-0">
            <p className="text-[10px] font-medium tracking-[0.08em] uppercase text-muted-foreground">
              PLAYING FROM
            </p>
            <p className="text-xs font-normal text-secondary-foreground truncate max-w-[200px] mt-0.5">
              {playlistName}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onOpenOptions?.(track)}
            aria-label="Song options"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-chip border border-hair text-secondary-foreground hover:bg-chip-strong hover:text-foreground transition-all active:scale-95"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>

        {/* Center Artwork */}
        <div className="flex flex-col items-center justify-center my-auto w-full py-4">
          <div
            {...doubleTapProps}
            onTouchStart={swipeStart}
            onTouchEnd={swipeEnd}
            className={cn(
              "relative aspect-square w-64 sm:w-72 overflow-hidden rounded-xl shadow-lift border border-border touch-manipulation select-none",
              isPlaying && "album-art-pulse"
            )}
          >
            <img
              src={track.thumbnail}
              alt={track.title}
              className="h-full w-full object-cover"
            />
            {/* Double-tap seek feedback halves */}
            {flash && (
              <div
                className={cn(
                  "pointer-events-none absolute inset-y-0 w-1/2 flex items-center justify-center bg-black/35 animate-fade-in",
                  flash === "left" ? "left-0 rounded-l-xl" : "right-0 rounded-r-xl",
                )}
              >
                <span className="flex flex-col items-center gap-1 text-white">
                  {flash === "left" ? <RotateCcw className="h-6 w-6" /> : <RotateCw className="h-6 w-6" />}
                  <span className="text-xs font-semibold tabular-nums">10s</span>
                </span>
              </div>
            )}
          </div>

          {/* Track Info Row */}
          <div className="flex items-center justify-between w-full mt-6 px-1">
            <div className="min-w-0 flex-1 pr-4">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground truncate tracking-[-0.01em]">
                {track.title}
              </h2>
              <p className="text-sm font-normal text-secondary-foreground truncate mt-0.5">
                {track.artist}
              </p>
              {(track.album || track.year) && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {[track.album, track.year].filter(Boolean).join(" • ")}
                </p>
              )}
              {isReplacementSource && (
                <span className="inline-flex items-center gap-1.5 mt-1.5 text-xs font-medium text-amber-400/90 bg-amber-400/10 border border-amber-400/20 rounded-full px-2.5 py-1">
                  <AlertTriangle className="h-3 w-3" />
                  Playing replacement recording{streamSource ? ` (${streamSource})` : ""}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <HeartLikeButton
                liked={liked}
                onToggle={onToggleLike}
                size="lg"
              />
              {onAddToPlaylist && (
                <button
                  type="button"
                  onClick={() => onAddToPlaylist(track)}
                  aria-label="Add to playlist"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground active:scale-90 transition-all"
                >
                  <Plus className="h-6 w-6" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Controls Area */}
        <div className="w-full space-y-4">
          {/* Real-time frequency bars (auto-hidden for engines without an FFT tap) */}
          <AudioVisualizer getAnalyser={getAnalyser} active={isPlaying} className="h-10 sm:h-12" />
          {/* Seek Scrubber Bar */}
          <div className="space-y-1">
            <ScrubBar
              position={position}
              duration={duration}
              thumbnail={track.thumbnail}
              onSeek={onSeek}
              className="w-full"
            />
            <div className="flex justify-between text-[11px] font-normal tabular-nums text-muted-foreground">
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
                "p-2 text-muted-foreground hover:text-foreground transition-colors active:scale-95",
                shuffle && "text-primary"
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
                className="p-1.5 text-muted-foreground hover:text-secondary-foreground active:scale-95 transition-all"
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
              className="p-2 text-foreground hover:text-foreground disabled:opacity-30 active:scale-95 transition-all"
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
              className="p-2 text-foreground hover:text-foreground disabled:opacity-30 active:scale-95 transition-all"
              aria-label="Next track"
            >
              <SkipForward className="h-6 w-6 fill-current" />
            </button>

            {/* Jump Forward 5s */}
            {onSkipForward && (
              <button
                type="button"
                onClick={() => onSkipForward(5)}
                className="p-1.5 text-muted-foreground hover:text-secondary-foreground active:scale-95 transition-all"
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
                "relative p-2 text-muted-foreground hover:text-foreground transition-colors active:scale-95",
                repeatMode !== "off" && "text-primary"
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
                <Repeat1 className="h-5 w-5 text-primary" />
              ) : (
                <Repeat className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Bottom Toolbar Row: Speed, EQ, PiP, Shortcuts, Lyrics, Queue */}
          <div className="flex items-center justify-between pt-3 border-t border-hair text-muted-foreground">
            {/* Left group: Speed Badge & Equalizer */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cycleSpeed}
                className="flex items-center gap-1.5 rounded-full bg-chip border border-hair px-2.5 py-1 text-xs font-normal text-secondary-foreground hover:text-foreground hover:bg-chip-strong transition-all"
              >
                <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{playbackSpeed}x</span>
              </button>

              {onOpenEqualizer && (
                <button
                  type="button"
                  onClick={onOpenEqualizer}
                  aria-label="Equalizer & FX"
                  title="Equalizer & FX"
                  className="flex items-center gap-1.5 rounded-full bg-chip border border-hair px-2.5 py-1 text-xs font-normal text-secondary-foreground hover:bg-chip-strong hover:text-foreground transition-all"
                >
                  <Sliders className="h-3.5 w-3.5 text-muted-foreground" />
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
                      ? "border-primary/40 bg-primary/15 text-primary shadow-sm font-mono font-medium"
                      : "border-hair bg-chip text-secondary-foreground hover:bg-chip-strong hover:text-foreground"
                  )}
                >
                  <Moon className={cn("h-3.5 w-3.5", isSleepTimerActive ? "text-primary" : "text-muted-foreground")} />
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
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-chip rounded-full transition-colors"
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
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-chip rounded-full transition-colors"
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
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-chip rounded-full transition-colors"
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
                      ? "text-primary bg-primary/15"
                      : "text-muted-foreground hover:text-foreground hover:bg-chip"
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