import { useState, useEffect, useRef, useMemo } from "react";
import {
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
  Sparkles,
  Image as ImageIcon,
  ExternalLink,
  Music2,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrubBar } from "@/components/music/ScrubBar";
import { formatTime } from "@/lib/use-audio-player";
import { useSleepTimer } from "@/hooks/useSleepTimer";
import { useDragToDismiss, useDoubleTapSeek, useSwipeGestures } from "@/hooks/use-gesture-controls";
import type { Track } from "@/lib/library";
import { HeartLikeButton } from "@/components/music/ui/HeartLikeButton";
import AudioVisualizer from "./AudioVisualizer";
import { useTrackLyrics } from "@/lib/use-track-lyrics";
import { isPodcastTrack } from "@/lib/track-filters";

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
  onArtistClick?: (artist: string, track?: Track) => void;
  onPodcastChannelClick?: (track: Track) => void;
  canNext: boolean;
  canPrevious: boolean;
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
  onArtistClick,
  onPodcastChannelClick,
  canNext,
  canPrevious,
  getAnalyser,
}: Props) {
  const { isActive: isSleepTimerActive, formattedRemaining: sleepTimerCountdown } = useSleepTimer();

  // Gesture controls: drag down to dismiss (finger-following), double-tap artwork to seek ±5s, swipe left/right to skip
  const { dragProps, dragY, dragging } = useDragToDismiss({ onDismiss: onClose });
  const { gestureProps: doubleTapProps, flash } = useDoubleTapSeek({
    onBackward: (s) => (onSkipBackward ? onSkipBackward(s) : onSeek(Math.max(0, position - s))),
    onForward: (s) => (onSkipForward ? onSkipForward(s) : onSeek(Math.min(duration, position + s))),
    seconds: 5,
  });
  const { onTouchStart: swipeStart, onTouchEnd: swipeEnd } = useSwipeGestures({
    onSwipeLeft: onNext,
    onSwipeRight: onPrevious,
    threshold: 80,
  });

  const [showLiveLyrics, setShowLiveLyrics] = useState(false);
  const [copiedLyrics, setCopiedLyrics] = useState(false);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lyricLineRefs = useRef<(HTMLElement | null)[]>([]);
  const userScrollingLyricsRef = useRef(false);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lyricsState = useTrackLyrics({
    title: track?.title,
    artist: track?.artist,
    trackId: track?.id,
    duration,
  });

  const [currentLyricIndex, setCurrentLyricIndex] = useState(0);

  useEffect(() => {
    if (!lyricsState.isSynced || lyricsState.syncedLyrics.length === 0) return;
    let idx = -1;
    for (let i = lyricsState.syncedLyrics.length - 1; i >= 0; i--) {
      const line = lyricsState.syncedLyrics[i];
      if (line && position >= line.time) {
        idx = i;
        break;
      }
    }
    if (idx !== -1 && idx !== currentLyricIndex) {
      setCurrentLyricIndex(idx);
    }
  }, [position, lyricsState.syncedLyrics, currentLyricIndex, lyricsState.isSynced]);

  const handleLyricsScroll = () => {
    userScrollingLyricsRef.current = true;
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    userScrollTimeoutRef.current = setTimeout(() => {
      userScrollingLyricsRef.current = false;
    }, 3500);
  };

  useEffect(() => {
    if (!showLiveLyrics || !lyricsState.isSynced || userScrollingLyricsRef.current) return;
    const lineEl = lyricLineRefs.current[currentLyricIndex];
    const container = lyricsContainerRef.current;
    if (!lineEl || !container) return;

    const containerH = container.clientHeight;
    const lineTop = lineEl.offsetTop;
    const lineH = lineEl.clientHeight;
    container.scrollTo({
      top: Math.max(0, lineTop - containerH / 2 + lineH / 2),
      behavior: "smooth",
    });
  }, [currentLyricIndex, showLiveLyrics, lyricsState.isSynced]);

  const handleCopyLyrics = async () => {
    if (!track) return;
    let text = "";
    if (lyricsState.plainLyrics) {
      text = lyricsState.plainLyrics;
    } else if (lyricsState.syncedLyrics.length > 0) {
      text = lyricsState.syncedLyrics.map((l) => l.text).join("\n");
    }
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(`"${track.title}" — ${track.artist}\n\n${text}`);
        setCopiedLyrics(true);
        setTimeout(() => setCopiedLyrics(false), 2000);
      }
    } catch {}
  };

  const plainParagraphs = useMemo(() => {
    if (!lyricsState.plainLyrics) return [];
    return lyricsState.plainLyrics.split(/\n\s*\n/).map((para) => para.split("\n"));
  }, [lyricsState.plainLyrics]);

  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;
  const dismissProgress = Math.min(1, Math.abs(dragY) / (viewportH * 0.9));

  const cycleSpeed = () => {
    if (!onSpeedChange) return;
    const currentIndex = SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % SPEEDS.length;
    onSpeedChange(SPEEDS[nextIndex] ?? 1);
  };

  if (!track) return null;

  return (
    <div
      {...dragProps}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background overflow-hidden animate-sheet-up"
      style={{
        transform: dragY ? `translateY(${dragY}px)` : undefined,
        opacity: dragY ? 1 - dismissProgress * 0.85 : undefined,
        transition: dragging
          ? "none"
          : "transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.28s ease",
      }}
    >
      {/* Soft ambient background art glow */}
      <div
        className="absolute inset-0 bg-cover bg-center blur-3xl opacity-15 scale-125 transition-all duration-700 pointer-events-none"
        style={{
          backgroundImage: `url(${track.thumbnail})`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/90 to-background pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 flex h-full w-full max-w-md flex-col justify-between px-6 py-5 pb-[calc(var(--mm-inset-bottom)+18px)] pt-[calc(var(--mm-inset-top)+14px)]">
        {/* Top Header */}
        <div className="flex w-full items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            aria-label="Collapse player"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-card border border-hair text-muted-foreground hover:bg-chip hover:text-foreground transition-all active:scale-95 shadow-xs"
          >
            <ChevronDown className="h-5 w-5" />
          </button>

          <div className="text-center px-4 min-w-0">
            <p className="text-xs sm:text-sm font-semibold tracking-wide text-foreground">
              Now Playing
            </p>
            <p className="text-[11px] font-normal text-muted-foreground truncate max-w-[200px] mt-0.5">
              {playlistName}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onOpenOptions?.(track)}
            aria-label="Song options"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-card border border-hair text-muted-foreground hover:bg-chip hover:text-foreground transition-all active:scale-95 shadow-xs"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>

        {/* Center Area: Artwork OR Live Lyrics */}
        <div className="flex flex-col items-center justify-center my-auto w-full py-4 relative">
          {/* Reference Image Atmospheric Ambient Violet Aura */}
          <div className="absolute w-72 sm:w-88 h-72 sm:h-88 rounded-full bg-gradient-to-tr from-[#9333EA]/35 via-[#8B5CF6]/30 to-[#6D28D9]/20 blur-3xl pointer-events-none -z-0 animate-pulse" />

          {!showLiveLyrics ? (
            <div
              {...doubleTapProps}
              onTouchStart={swipeStart}
              onTouchEnd={swipeEnd}
              className="relative z-10 aspect-square w-64 sm:w-72 overflow-hidden rounded-3xl p-1.5 bg-gradient-to-b from-primary/30 via-primary/10 to-transparent border border-primary/30 ring-4 ring-primary/15 shadow-[0_0_50px_rgba(139,92,246,0.35)] touch-manipulation select-none"
            >
              <div className="w-full h-full rounded-[20px] overflow-hidden">
                <img
                  src={track.thumbnail}
                  alt={track.title}
                  className="h-full w-full object-cover"
                />
              </div>
              {/* Double-tap seek feedback halves */}
              {flash && (
                <div
                  className={cn(
                    "pointer-events-none absolute inset-y-0 w-1/2 flex items-center justify-center bg-black/35 animate-fade-in",
                    flash === "left" ? "left-0 rounded-l-2xl" : "right-0 rounded-r-2xl",
                  )}
                >
                  <span className="flex flex-col items-center gap-1 text-white">
                    {flash === "left" ? <RotateCcw className="h-6 w-6" /> : <RotateCw className="h-6 w-6" />}
                    <span className="text-xs font-semibold tabular-nums">5s</span>
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* Live Karaoke Lyrics View */
            <div className="relative w-full max-w-sm h-64 sm:h-72 rounded-2xl bg-card/70 backdrop-blur-2xl border border-hair-strong shadow-2xl p-4 flex flex-col overflow-hidden animate-fade-in select-none">
              {/* Header Bar */}
              <div className="flex items-center justify-between pb-2 border-b border-hair shrink-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span>{lyricsState.isSynced ? "LIVE LYRICS" : "LYRICS"}</span>
                  {lyricsState.source && (
                    <span className="text-[10px] font-mono uppercase text-muted-foreground">
                      · {lyricsState.source}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!lyricsState.isInstrumental && (lyricsState.syncedLyrics.length > 0 || lyricsState.plainLyrics) && (
                    <button
                      type="button"
                      onClick={handleCopyLyrics}
                      title="Copy lyrics"
                      className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-chip transition-colors"
                    >
                      {copiedLyrics ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  {onOpenLyrics && (
                    <button
                      type="button"
                      onClick={onOpenLyrics}
                      title="Open full lyrics panel"
                      className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-chip transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowLiveLyrics(false)}
                    className="flex items-center gap-1 text-[11px] font-medium text-secondary-foreground hover:text-foreground bg-chip hover:bg-chip-strong border border-hair px-2 py-0.5 rounded-full transition-all"
                  >
                    <ImageIcon className="h-3 w-3" />
                    <span>Artwork</span>
                  </button>
                </div>
              </div>

              {/* Scrolling Lyrics List */}
              <div
                ref={lyricsContainerRef}
                onScroll={handleLyricsScroll}
                onTouchStart={handleLyricsScroll}
                onWheel={handleLyricsScroll}
                className="flex-1 overflow-y-auto py-3 px-2 scrollbar-none"
              >
                {lyricsState.loading ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-2 py-8">
                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                    <p className="text-xs text-muted-foreground">Finding live lyrics...</p>
                  </div>
                ) : lyricsState.isInstrumental ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-2 py-8">
                    <Music2 className="h-8 w-8 text-primary" />
                    <p className="text-sm font-semibold text-foreground">Instrumental Song</p>
                    <p className="text-xs text-muted-foreground">This track is recorded without vocals.</p>
                  </div>
                ) : lyricsState.syncedLyrics.length === 0 && !lyricsState.plainLyrics ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-2 py-8">
                    <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">Lyrics not available for this track.</p>
                  </div>
                ) : lyricsState.isSynced ? (
                  <div className="space-y-3 py-6">
                    {lyricsState.syncedLyrics.map((line, idx) => {
                      const isActive = idx === currentLyricIndex;
                      return (
                        <button
                          key={`${line.time}-${idx}`}
                          type="button"
                          ref={(el) => {
                            lyricLineRefs.current[idx] = el;
                          }}
                          onClick={() => onSeek(line.time)}
                          className={cn(
                            "w-full text-center transition-all duration-300 py-1.5 px-3 rounded-lg cursor-pointer",
                            isActive
                              ? "text-foreground font-bold text-base sm:text-lg scale-105"
                              : "text-muted-foreground/45 text-sm hover:text-foreground/80",
                          )}
                        >
                          {line.text}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-4 py-3 text-center">
                    {plainParagraphs.map((para, pIdx) => (
                      <div key={pIdx} className="space-y-1">
                        {para.map((line, lIdx) => (
                          <p key={lIdx} className="text-xs sm:text-sm text-foreground/85 leading-relaxed">
                            {line}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Track Info Row */}
          <div className="flex items-center justify-between w-full mt-6 px-1">
            <div className="min-w-0 flex-1 pr-4">
              <h2 className="text-xl sm:text-2xl font-bold text-white truncate tracking-tight">
                {track.title}
              </h2>
              {onPodcastChannelClick || onArtistClick ? (
                <button
                  type="button"
                  onClick={() => {
                    if (isPodcastTrack(track)) {
                      if (onPodcastChannelClick) onPodcastChannelClick(track);
                      else onArtistClick?.(track.artist, track);
                    } else {
                      onArtistClick?.(track.artist, track);
                    }
                  }}
                  className="text-left text-sm sm:text-base font-medium text-[#D4CBEA] hover:text-[#A855F7] hover:underline truncate mt-0.5 transition-colors cursor-pointer block max-w-full"
                  title={
                    isPodcastTrack(track)
                      ? `View all episodes from ${track.artist}`
                      : `View ${track.artist}`
                  }
                >
                  {track.artist}
                </button>
              ) : (
                <p className="text-sm sm:text-base font-medium text-[#D4CBEA] truncate mt-0.5">
                  {track.artist}
                </p>
              )}
              {(track.album || track.year) && (
                <p className="text-xs text-[#A69ABD] truncate mt-0.5">
                  {[track.album, track.year].filter(Boolean).join(" • ")}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <HeartLikeButton
                liked={liked}
                onToggle={onToggleLike}
                size="lg"
                className="bg-card border border-hair text-muted-foreground hover:bg-chip hover:text-foreground"
              />
              {onAddToPlaylist && (
                <button
                  type="button"
                  onClick={() => onAddToPlaylist(track)}
                  aria-label="Add to playlist"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-card border border-hair text-muted-foreground hover:text-foreground active:scale-90 transition-all"
                >
                  <Plus className="h-5 w-5" />
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
            <div className="flex justify-between text-[11px] font-medium tabular-nums text-muted-foreground">
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
                className="relative flex items-center justify-center p-1.5 text-muted-foreground hover:text-foreground active:scale-95 transition-all"
                title="Rewind 5 seconds"
              >
                <RotateCcw className="h-5 w-5" />
                <span className="absolute text-[8px] font-bold">5</span>
              </button>
            )}

            {/* Previous */}
            <button
              type="button"
              onClick={onPrevious}
              disabled={!canPrevious}
              className="p-2 text-foreground hover:text-foreground/80 disabled:opacity-30 active:scale-95 transition-all"
              aria-label="Previous track"
            >
              <SkipBack className="h-6 w-6 fill-current" />
            </button>

            {/* Circular Glowing Violet Play/Pause Button */}
            <button
              type="button"
              onClick={onTogglePlay}
              disabled={isLoading}
              className="flex h-16 w-16 sm:h-18 sm:w-18 items-center justify-center rounded-full bg-gradient-to-tr from-[#8B5CF6] via-[#9333EA] to-[#A855F7] text-white shadow-xl shadow-primary/35 ring-4 ring-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-70"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isLoading ? (
                <Loader2 className="h-7 w-7 animate-spin" />
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
              className="p-2 text-foreground hover:text-foreground/80 disabled:opacity-30 active:scale-95 transition-all"
              aria-label="Next track"
            >
              <SkipForward className="h-6 w-6 fill-current" />
            </button>

            {/* Jump Forward 5s */}
            {onSkipForward && (
              <button
                type="button"
                onClick={() => onSkipForward(5)}
                className="relative flex items-center justify-center p-1.5 text-muted-foreground hover:text-foreground active:scale-95 transition-all"
                title="Forward 5 seconds"
              >
                <RotateCw className="h-5 w-5" />
                <span className="absolute text-[8px] font-bold">5</span>
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

              <button
                type="button"
                onClick={() => setShowLiveLyrics((prev) => !prev)}
                aria-label={showLiveLyrics ? "Hide live lyrics" : "Show live lyrics"}
                title={showLiveLyrics ? "Hide lyrics (Show Artwork)" : "Show live lyrics"}
                className={cn(
                  "p-2 rounded-full transition-all active:scale-95",
                  showLiveLyrics
                    ? "text-primary bg-primary/20 shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-chip",
                )}
              >
                <MessageSquare className="h-5 w-5" />
              </button>

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