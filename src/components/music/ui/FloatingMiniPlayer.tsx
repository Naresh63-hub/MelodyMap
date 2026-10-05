import { useEffect, useRef, useState } from "react";
import {
  Disc,
  Heart,
  Maximize2,
  Moon,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Track } from "@/lib/library";
import { formatTime } from "@/lib/use-audio-player";

type Props = {
  track: Track | null;
  isPlaying: boolean;
  isLoading?: boolean;
  liked?: boolean;
  position: number;
  duration: number;
  volume: number;
  isCrossfading?: boolean;
  isSleepTimerActive?: boolean;
  sleepTimerRemaining?: string;
  userInitial?: string;
  onTogglePlay: () => void;
  onToggleLike?: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (volume: number) => void;
  onOpenFullScreen: () => void;
  onOpenSleepTimer?: () => void;
  onClose: () => void;
};

export function FloatingMiniPlayer({
  track,
  isPlaying,
  isLoading = false,
  liked = false,
  position,
  duration,
  volume: _volume,
  isCrossfading = false,
  isSleepTimerActive = false,
  sleepTimerRemaining = "",
  userInitial = "N",
  onTogglePlay,
  onToggleLike,
  onNext,
  onPrevious,
  onSeek,
  onVolumeChange: _onVolumeChange,
  onOpenFullScreen,
  onOpenSleepTimer,
  onClose,
}: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [positionCoords, setPositionCoords] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPosition, setScrubPosition] = useState(0);
  const scrubberRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPositionCoords({
        x: dragRef.current.posX + dx,
        y: dragRef.current.posY + dy,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Early returns must come AFTER every hook call so hook order is stable
  // across renders (track appearing/disappearing used to reorder hooks).
  if (!track) return null;

  const activePosition = isScrubbing ? scrubPosition : position;
  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (activePosition / duration) * 100)) : 0;

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, input, a, .scrubber-bar")) return;
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: positionCoords?.x ?? 0,
      posY: positionCoords?.y ?? 0,
    };
  };

  const getScrubRatio = (clientX: number) => {
    const rect = scrubberRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const handleScrubPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setIsScrubbing(true);
    const ratio = getScrubRatio(e.clientX);
    setScrubPosition(ratio * duration);
  };

  const handleScrubPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing || duration <= 0) return;
    e.stopPropagation();
    const ratio = getScrubRatio(e.clientX);
    setScrubPosition(ratio * duration);
  };

  const handleScrubPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    setIsScrubbing(false);
    if (duration > 0) {
      const ratio = getScrubRatio(e.clientX);
      onSeek(ratio * duration);
    }
  };

  const handleScrubPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    setIsScrubbing(false);
  };

  const initial = userInitial.trim().charAt(0).toUpperCase() || "N";

  return (
    <div
      onMouseDown={handleMouseDown}
      style={
        positionCoords
          ? {
              transform: `translate(${positionCoords.x}px, ${positionCoords.y}px)`,
            }
          : undefined
      }
      className={cn(
        "fixed bottom-20 right-4 z-50 w-80 sm:w-88 rounded-2xl bg-[#101010]/95 backdrop-blur-2xl border border-white/[0.08] text-white shadow-2xl shadow-black/80 overflow-hidden transition-shadow select-none",
        isDragging && "cursor-grabbing ring-1 ring-white/30"
      )}
    >
      {/* Background ambient glow */}
      <div
        className="absolute inset-0 bg-cover bg-center blur-2xl opacity-15 pointer-events-none -z-10"
        style={{ backgroundImage: `url(${track.thumbnail})` }}
      />

      {/* Scrubber at top */}
      <div
        ref={scrubberRef}
        role="slider"
        tabIndex={0}
        aria-label="Seek track"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(activePosition)}
        className="scrubber-bar group relative h-2 w-full bg-white/15 cursor-pointer touch-none select-none flex items-center"
        onPointerDown={handleScrubPointerDown}
        onPointerMove={handleScrubPointerMove}
        onPointerUp={handleScrubPointerUp}
        onPointerCancel={handleScrubPointerCancel}
      >
        <div
          className="h-1 w-full bg-white group-hover:bg-[#1DB954] transition-all rounded-full"
          style={{ width: `${progressPct}%` }}
        />
        <span
          className={cn(
            "absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md transition-transform duration-75",
            isScrubbing ? "scale-125 opacity-100 ring-2 ring-[#1DB954]/40" : "opacity-0 group-hover:opacity-100 scale-100",
          )}
          style={{ left: `${progressPct}%` }}
        />
      </div>

      {/* Main card body */}
      <div className="p-3.5 space-y-3">
        {/* Header: Draggable handle & Action buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Mini Player</span>
            {isSleepTimerActive && (
              <button
                type="button"
                onClick={onOpenSleepTimer}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1DB954]/15 border border-[#1DB954]/30 text-[#1DB954] text-[10px] font-bold animate-pulse active:scale-95 transition-all"
                title={`Sleep timer: ${sleepTimerRemaining} remaining`}
              >
                <Moon className="h-3 w-3" />
                <span>{sleepTimerRemaining}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onOpenFullScreen}
              title="Expand to Fullscreen"
              className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close Mini Player"
              className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Track Thumbnail, Dedicated Rotating User Vinyl Disc & Info */}
        <div className="flex items-center gap-2.5">
          {/* Pristine Album Thumbnail (No overlapping elements) */}
          <div className="relative h-12 w-12 shrink-0 rounded-lg overflow-hidden border border-white/[0.08] bg-[#161616] shadow-md">
            <img src={track.thumbnail} alt={track.title} className="h-full w-full object-cover" />
            {isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="flex items-end gap-0.5 h-3.5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-0.5 bg-[#1DB954] rounded-full animate-bar"
                      style={{ animationDelay: `${i * 0.15}s`, height: "100%" }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Dedicated Rotating User Vinyl Disc (Standalone, zero overlap, strict boundaries) */}
          <div
            className={cn(
              "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#121212] border border-white/20 shadow-sm select-none transition-transform",
              isPlaying ? "animate-[spin_4s_linear_infinite]" : "rotate-0"
            )}
            title={`Listener: ${initial} • ${isPlaying ? "Playing (Vinyl Spinning)" : "Paused"}`}
          >
            <div className="absolute inset-1 rounded-full border border-white/10 pointer-events-none" />
            <div className="relative flex h-4 w-4 items-center justify-center rounded-full bg-zinc-950 border border-[#1DB954] text-[#1DB954]">
              <span className="font-black text-[9px] leading-none text-[#1DB954]">
                {initial}
              </span>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <h4 className="text-xs font-bold text-[#F5F5F5] truncate leading-tight">{track.title}</h4>
              {isCrossfading && (
                <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1 py-0.2 rounded animate-pulse">
                  <Disc className="h-2.5 w-2.5 animate-spin" />
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#A1A1A1] truncate mt-0.5 leading-tight font-medium">
              {track.artist}
            </p>
            <div className="flex items-center justify-between text-[10px] text-[#737373] mt-1 tabular-nums font-mono">
              <span>{formatTime(position)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        {/* Transport Controls */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 flex-1 justify-center">
            {/* Sleep Timer Controller Button */}
            {onOpenSleepTimer && (
              <button
                type="button"
                onClick={onOpenSleepTimer}
                className={cn(
                  "p-1.5 rounded-full active:scale-90 transition-all",
                  isSleepTimerActive
                    ? "text-[#1DB954] bg-[#1DB954]/15 border border-[#1DB954]/30 shadow-sm"
                    : "text-[#737373] hover:text-[#F5F5F5] hover:bg-white/5"
                )}
                aria-label="Sleep timer"
                title={isSleepTimerActive ? `Sleep timer active: ${sleepTimerRemaining}` : "Set sleep timer"}
              >
                <Moon className="h-4 w-4" />
              </button>
            )}

            {onToggleLike && (
              <button
                type="button"
                onClick={onToggleLike}
                className="p-1.5 rounded-full active:scale-90 transition-all text-[#737373] hover:text-[#F5F5F5] hover:bg-white/5"
                aria-label={liked ? "Remove from favourites" : "Add to favourites"}
                title={liked ? "In your favourites" : "Save to favourites"}
              >
                <Heart
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    liked ? "fill-[#1DB954] text-[#1DB954] scale-110" : "hover:scale-110"
                  )}
                />
              </button>
            )}

            <button
              type="button"
              onClick={onPrevious}
              className="p-1.5 rounded-full text-[#A1A1A1] hover:text-[#F5F5F5] active:scale-95 transition-all"
              aria-label="Previous track"
            >
              <SkipBack className="h-4 w-4 fill-current" />
            </button>

            <button
              type="button"
              onClick={onTogglePlay}
              disabled={isLoading}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F5F5] text-black shadow-md hover:scale-105 active:scale-95 transition-transform"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="ml-0.5 h-4 w-4 fill-current" />
              )}
            </button>

            <button
              type="button"
              onClick={onNext}
              className="p-1.5 rounded-full text-white/60 hover:text-white active:scale-95 transition-all"
              aria-label="Next track"
            >
              <SkipForward className="h-4 w-4 fill-current" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
