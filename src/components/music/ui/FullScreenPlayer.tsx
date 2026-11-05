import { useState, useEffect, useRef, useMemo } from "react";
import {
  ChevronDown,
  HelpCircle,
  ListMusic,
  Loader2,
  MessageSquare,
  MoreVertical,
  Pause,
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
import { useTrackLyrics, findActiveLyricIndex } from "@/lib/use-track-lyrics";
import { extractArtworkColor, estimateArtworkColor, type ArtworkColorTheme } from "@/lib/artwork-color";
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

const FLOATING_NOTES = [
  { symbol: "♪", left: "8%", bottom: "18%", delay: "0s", duration: "4.2s", size: "text-base", color: "text-[#8B5CF6]/70 dark:text-[#A78BFA]/70", drift: "-16px" },
  { symbol: "♫", left: "20%", bottom: "36%", delay: "1.4s", duration: "5.0s", size: "text-xl", color: "text-[#A78BFA]/80 dark:text-[#C4B5FD]/80", drift: "14px" },
  { symbol: "♬", right: "10%", bottom: "22%", delay: "0.7s", duration: "4.6s", size: "text-lg", color: "text-[#C4B5FD]/75 dark:text-[#DDD6FE]/75", drift: "18px" },
  { symbol: "♪", right: "22%", bottom: "40%", delay: "2.1s", duration: "5.4s", size: "text-sm", color: "text-[#8B5CF6]/60 dark:text-[#A855F7]/70", drift: "-12px" },
  { symbol: "♩", left: "5%", bottom: "54%", delay: "2.8s", duration: "4.8s", size: "text-base", color: "text-[#A78BFA]/65 dark:text-[#C4B5FD]/65", drift: "10px" },
  { symbol: "♫", right: "7%", bottom: "60%", delay: "3.5s", duration: "4.4s", size: "text-xl", color: "text-[#8B5CF6]/75 dark:text-[#A78BFA]/80", drift: "-15px" },
];

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
  onOpenPip: _onOpenPip,
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
    onSwipeDown: onClose,
    threshold: 64,
  });

  const [showLiveLyrics, setShowLiveLyrics] = useState(false);
  const [copiedLyrics, setCopiedLyrics] = useState(false);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lyricLineRefs = useRef<(HTMLElement | null)[]>([]);
  const userScrollingLyricsRef = useRef(false);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [artworkTheme, setArtworkTheme] = useState<ArtworkColorTheme>(() =>
    estimateArtworkColor(track?.id || track?.title || "melodymap"),
  );

  useEffect(() => {
    let cancelled = false;
    void extractArtworkColor(track?.thumbnail, track?.id || track?.title).then((theme) => {
      if (!cancelled) setArtworkTheme(theme);
    });
    return () => {
      cancelled = true;
    };
  }, [track?.thumbnail, track?.id, track?.title]);

  const lyricsState = useTrackLyrics({
    title: track?.title,
    artist: track?.artist,
    trackId: track?.id,
    duration,
  });

  const [currentLyricIndex, setCurrentLyricIndex] = useState(0);

  useEffect(() => {
    if (!lyricsState.isSynced || lyricsState.syncedLyrics.length === 0) return;
    const idx = findActiveLyricIndex(lyricsState.syncedLyrics, position);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#FAF8FF] dark:bg-[#0b0813] text-[#211536] dark:text-white overflow-hidden animate-sheet-up transition-colors duration-200"
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
        className="absolute inset-0 bg-cover bg-center blur-3xl opacity-15 dark:opacity-20 scale-125 transition-all duration-700 pointer-events-none"
        style={{
          backgroundImage: `url(${track.thumbnail})`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#FAF8FF]/85 via-[#FAF8FF]/95 to-[#FAF8FF] dark:from-[#0b0813]/70 dark:via-[#0b0813]/90 dark:to-[#0b0813] pointer-events-none transition-colors duration-200" />

      {/* Main Container */}
      <div className="relative z-10 flex h-full w-full max-w-md flex-col justify-between px-6 py-5 pb-[calc(var(--mm-inset-bottom)+18px)] pt-[calc(var(--mm-inset-top)+14px)]">
        {/* Top Header */}
        <div className="flex w-full items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            aria-label="Collapse player"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-card border border-[#E5DDF5] dark:border-hair text-[#746A85] dark:text-muted-foreground hover:bg-[#F1EBFF] dark:hover:bg-chip hover:text-[#211536] dark:hover:text-foreground transition-all active:scale-95 shadow-xs cursor-pointer"
          >
            <ChevronDown className="h-5 w-5" />
          </button>

          <div className="text-center px-4 min-w-0">
            <p className="text-xs sm:text-sm font-semibold tracking-wide text-[#211536] dark:text-foreground">
              Now Playing
            </p>
            <p className="text-[11px] font-normal text-[#746A85] dark:text-muted-foreground truncate max-w-[200px] mt-0.5">
              {playlistName}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onOpenOptions?.(track)}
            aria-label="Song options"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-card border border-[#E5DDF5] dark:border-hair text-[#746A85] dark:text-muted-foreground hover:bg-[#F1EBFF] dark:hover:bg-chip hover:text-[#211536] dark:hover:text-foreground transition-all active:scale-95 shadow-xs cursor-pointer"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>

        {/* Center Area: Artwork OR Live Lyrics */}
        <div className="flex flex-col items-center justify-center my-auto w-full py-4 relative">
          {/* Pulsing Ambient Glow Aura */}
          <div
            className={cn(
              "absolute w-72 sm:w-88 h-72 sm:h-88 rounded-full blur-3xl pointer-events-none -z-0 transition-all duration-700",
              isPlaying && "mm-artwork-pulse"
            )}
            style={{
              background: artworkTheme.ambientGlow,
              opacity: isPlaying ? 0.75 : 0.4,
              animationPlayState: isPlaying ? "running" : "paused",
            }}
          />

          {/* Floating Musical Notes Animation (♪ ♫ ♬) */}
          <div
            className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0"
            aria-hidden="true"
          >
            {FLOATING_NOTES.map((note, idx) => (
              <span
                key={idx}
                className={cn(
                  "absolute font-serif select-none mm-music-note",
                  note.size,
                  note.color
                )}
                style={{
                  left: note.left,
                  right: note.right,
                  bottom: note.bottom,
                  animationPlayState: isPlaying ? "running" : "paused",
                  "--note-delay": note.delay,
                  "--note-duration": note.duration,
                  "--note-drift": note.drift,
                } as React.CSSProperties}
              >
                {note.symbol}
              </span>
            ))}
          </div>

          {!showLiveLyrics ? (
            <div
              {...doubleTapProps}
              onTouchStart={swipeStart}
              onTouchEnd={swipeEnd}
              style={{
                boxShadow: `0 0 45px ${artworkTheme.borderAccent}`,
                borderColor: artworkTheme.borderAccent,
              }}
              className="relative z-10 aspect-square w-64 sm:w-72 overflow-hidden rounded-3xl p-1.5 bg-gradient-to-b from-[#8B5CF6]/20 via-[#8B5CF6]/5 to-transparent dark:from-primary/30 dark:via-primary/10 dark:to-transparent border border-[#E5DDF5] dark:border-border ring-4 ring-[#8B5CF6]/15 dark:ring-primary/15 touch-manipulation select-none mm-artwork-glow shadow-xl"
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
            <div className="relative z-10 w-full max-w-sm h-64 sm:h-72 rounded-2xl bg-white/95 dark:bg-card/70 backdrop-blur-2xl border border-[#E5DDF5] dark:border-hair-strong shadow-2xl p-4 flex flex-col overflow-hidden animate-fade-in select-none">
              {/* Header Bar */}
              <div className="flex items-center justify-between pb-2 border-b border-[#E5DDF5] dark:border-hair shrink-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span>{lyricsState.isSynced ? "LIVE LYRICS" : "LYRICS"}</span>
                  {lyricsState.source && (
                    <span className="text-[10px] font-mono uppercase text-[#746A85] dark:text-muted-foreground">
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
                      className="p-1 rounded-full text-[#746A85] dark:text-muted-foreground hover:text-[#211536] dark:hover:text-foreground hover:bg-[#F1EBFF] dark:hover:bg-chip transition-colors cursor-pointer"
                    >
                      {copiedLyrics ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  {onOpenLyrics && (
                    <button
                      type="button"
                      onClick={onOpenLyrics}
                      title="Open full lyrics panel"
                      className="p-1 rounded-full text-[#746A85] dark:text-muted-foreground hover:text-[#211536] dark:hover:text-foreground hover:bg-[#F1EBFF] dark:hover:bg-chip transition-colors cursor-pointer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowLiveLyrics(false)}
                    className="flex items-center gap-1 text-[11px] font-medium text-[#211536] dark:text-secondary-foreground hover:text-[#8B5CF6] dark:hover:text-foreground bg-[#F1EBFF] dark:bg-chip hover:bg-[#E5DDF5] dark:hover:bg-chip-strong border border-[#E5DDF5] dark:border-hair px-2 py-0.5 rounded-full transition-all cursor-pointer"
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
                    <p className="text-xs text-[#746A85] dark:text-muted-foreground">Finding live lyrics...</p>
                  </div>
                ) : lyricsState.isInstrumental ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-2 py-8">
                    <Music2 className="h-8 w-8 text-primary" />
                    <p className="text-sm font-semibold text-[#211536] dark:text-foreground">Instrumental Song</p>
                    <p className="text-xs text-[#746A85] dark:text-muted-foreground">This track is recorded without vocals.</p>
                  </div>
                ) : lyricsState.syncedLyrics.length === 0 && !lyricsState.plainLyrics ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-2 py-8">
                    <MessageSquare className="h-8 w-8 text-[#746A85]/30 dark:text-muted-foreground/30" />
                    <p className="text-xs text-[#746A85] dark:text-muted-foreground">Lyrics not available for this track.</p>
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
                              ? "text-[#8B5CF6] dark:text-foreground font-bold text-base sm:text-lg scale-105"
                              : "text-[#746A85]/60 dark:text-muted-foreground/45 text-sm hover:text-[#211536] dark:hover:text-foreground/80",
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
                          <p key={lIdx} className="text-xs sm:text-sm text-[#211536]/85 dark:text-foreground/85 leading-relaxed">
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
              <h2 className="text-xl sm:text-2xl font-bold text-[#211536] dark:text-white truncate tracking-tight">
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
                  className="text-left text-sm sm:text-base font-medium text-[#746A85] dark:text-[#D4CBEA] hover:text-[#8B5CF6] dark:hover:text-[#A855F7] hover:underline truncate mt-0.5 transition-colors cursor-pointer block max-w-full"
                  title={
                    isPodcastTrack(track)
                      ? `View all episodes from ${track.artist}`
                      : `View ${track.artist}`
                  }
                >
                  {track.artist}
                </button>
              ) : (
                <p className="text-sm sm:text-base font-medium text-[#746A85] dark:text-[#D4CBEA] truncate mt-0.5">
                  {track.artist}
                </p>
              )}
              {(track.album || track.year) && (
                <p className="text-xs text-[#746A85]/80 dark:text-[#A69ABD] truncate mt-0.5">
                  {[track.album, track.year].filter(Boolean).join(" • ")}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <HeartLikeButton
                liked={liked}
                onToggle={onToggleLike}
                size="lg"
                className="bg-white dark:bg-card border border-[#E5DDF5] dark:border-hair text-[#746A85] dark:text-muted-foreground hover:bg-[#F1EBFF] dark:hover:bg-chip hover:text-[#211536] dark:hover:text-foreground"
              />
              {onAddToPlaylist && (
                <button
                  type="button"
                  onClick={() => onAddToPlaylist(track)}
                  aria-label="Add to playlist"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-card border border-[#E5DDF5] dark:border-hair text-[#746A85] dark:text-muted-foreground hover:text-[#211536] dark:hover:text-foreground hover:bg-[#F1EBFF] dark:hover:bg-chip active:scale-90 transition-all cursor-pointer"
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
            <div className="flex justify-between text-[11px] font-medium tabular-nums text-[#746A85] dark:text-muted-foreground">
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
                "p-2 text-[#746A85] dark:text-muted-foreground hover:text-[#211536] dark:hover:text-foreground transition-colors active:scale-95 cursor-pointer",
                shuffle && "text-primary dark:text-primary"
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
                className="relative flex items-center justify-center p-1.5 text-[#746A85] dark:text-muted-foreground hover:text-[#211536] dark:hover:text-foreground active:scale-95 transition-all cursor-pointer"
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
              className="p-2 text-[#211536] dark:text-foreground hover:text-[#211536]/80 dark:hover:text-foreground/80 disabled:opacity-30 active:scale-95 transition-all cursor-pointer"
              aria-label="Previous track"
            >
              <SkipBack className="h-6 w-6 fill-current" />
            </button>

            {/* Circular Glowing Violet Play/Pause Button */}
            <button
              type="button"
              onClick={onTogglePlay}
              disabled={isLoading}
              className="flex h-16 w-16 sm:h-18 sm:w-18 items-center justify-center rounded-full bg-gradient-to-tr from-[#8B5CF6] via-[#9333EA] to-[#A855F7] text-white shadow-xl shadow-purple-500/35 ring-4 ring-purple-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-70 cursor-pointer"
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
              className="p-2 text-[#211536] dark:text-foreground hover:text-[#211536]/80 dark:hover:text-foreground/80 disabled:opacity-30 active:scale-95 transition-all cursor-pointer"
              aria-label="Next track"
            >
              <SkipForward className="h-6 w-6 fill-current" />
            </button>

            {/* Jump Forward 5s */}
            {onSkipForward && (
              <button
                type="button"
                onClick={() => onSkipForward(5)}
                className="relative flex items-center justify-center p-1.5 text-[#746A85] dark:text-muted-foreground hover:text-[#211536] dark:hover:text-foreground active:scale-95 transition-all cursor-pointer"
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
                "relative p-2 text-[#746A85] dark:text-muted-foreground hover:text-[#211536] dark:hover:text-foreground transition-colors active:scale-95 cursor-pointer",
                repeatMode !== "off" && "text-primary dark:text-primary"
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

          {/* Screen 9: Centered Signature Lyrics Pill Button (Single Lyrics Button) */}
          <div className="flex justify-center pt-2 pb-0.5">
            <button
              type="button"
              onClick={() => setShowLiveLyrics((prev) => !prev)}
              aria-label={showLiveLyrics ? "Hide lyrics" : "Show lyrics"}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-semibold transition-all active:scale-95 cursor-pointer shadow-xs border",
                showLiveLyrics
                  ? "bg-[#8B5CF6] text-white border-[#8B5CF6] shadow-purple-500/30"
                  : "bg-[#F1EBFF] dark:bg-primary/15 text-[#8B5CF6] dark:text-primary border-[#E5DDF5] dark:border-primary/30 hover:bg-[#E5DDF5] dark:hover:bg-primary/25"
              )}
            >
              <Music2 className="h-3.5 w-3.5" />
              <span>Lyrics</span>
            </button>
          </div>

          {/* Bottom Toolbar Row: Evenly distributed Speed, EQ, Timer, Help, Queue (Mini-player and duplicate lyrics removed) */}
          <div className="flex items-center justify-between pt-3 border-t border-[#E5DDF5] dark:border-hair text-[#746A85] dark:text-muted-foreground">
            {/* Speed Badge */}
            <button
              type="button"
              onClick={cycleSpeed}
              className="flex items-center gap-1.5 rounded-full bg-[#F1EBFF] dark:bg-chip border border-[#E5DDF5] dark:border-hair px-2.5 py-1 text-xs font-medium text-[#211536] dark:text-secondary-foreground hover:bg-[#E5DDF5] dark:hover:bg-chip-strong hover:text-[#8B5CF6] dark:hover:text-foreground transition-all cursor-pointer"
            >
              <Gauge className="h-3.5 w-3.5 text-[#746A85] dark:text-muted-foreground" />
              <span>{playbackSpeed}x</span>
            </button>

            {/* Equalizer */}
            {onOpenEqualizer && (
              <button
                type="button"
                onClick={onOpenEqualizer}
                aria-label="Equalizer & FX"
                title="Equalizer & FX"
                className="flex items-center gap-1.5 rounded-full bg-[#F1EBFF] dark:bg-chip border border-[#E5DDF5] dark:border-hair px-2.5 py-1 text-xs font-medium text-[#211536] dark:text-secondary-foreground hover:bg-[#E5DDF5] dark:hover:bg-chip-strong hover:text-[#8B5CF6] dark:hover:text-foreground transition-all cursor-pointer"
              >
                <Sliders className="h-3.5 w-3.5 text-[#746A85] dark:text-muted-foreground" />
                <span className="hidden sm:inline">EQ</span>
              </button>
            )}

            {/* Sleep Timer */}
            {onOpenSleepTimer && (
              <button
                type="button"
                onClick={onOpenSleepTimer}
                aria-label="Sleep Timer"
                title={isSleepTimerActive ? `Sleep Timer: ${sleepTimerCountdown} remaining` : "Sleep Timer"}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                  isSleepTimerActive
                    ? "border-primary/40 bg-primary/15 text-primary shadow-sm font-mono"
                    : "border-[#E5DDF5] dark:border-hair bg-[#F1EBFF] dark:bg-chip text-[#211536] dark:text-secondary-foreground hover:bg-[#E5DDF5] dark:hover:bg-chip-strong hover:text-[#8B5CF6] dark:hover:text-foreground"
                )}
              >
                <Moon className={cn("h-3.5 w-3.5", isSleepTimerActive ? "text-primary" : "text-[#746A85] dark:text-muted-foreground")} />
                <span>{isSleepTimerActive ? sleepTimerCountdown : "Timer"}</span>
              </button>
            )}

            {/* Keyboard Shortcuts & Help */}
            {onOpenShortcuts && (
              <button
                type="button"
                onClick={onOpenShortcuts}
                aria-label="Keyboard Shortcuts & Help"
                title="Keyboard Shortcuts & Help (?)"
                className="p-2 text-[#746A85] dark:text-muted-foreground hover:text-[#211536] dark:hover:text-foreground hover:bg-[#F1EBFF] dark:hover:bg-chip rounded-full transition-colors cursor-pointer"
              >
                <HelpCircle className="h-5 w-5" />
              </button>
            )}

            {/* Queue / Up Next */}
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
                  "flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full transition-all active:scale-95 cursor-pointer",
                  isQueueOpen
                    ? "text-primary bg-primary/15"
                    : "text-[#746A85] dark:text-muted-foreground hover:text-[#211536] dark:hover:text-foreground hover:bg-[#F1EBFF] dark:hover:bg-chip"
                )}
              >
                <ListMusic className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
