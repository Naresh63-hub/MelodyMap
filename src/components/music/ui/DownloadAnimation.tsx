import { ArrowDown, ArrowDownCircle, Check, CheckCircle2, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Track } from "@/lib/library";

type OverlayProps = {
  progress?: number | undefined;
  className?: string | undefined;
};

/**
 * Animated circular downloading overlay that renders directly over the track thumbnail.
 * Features an SVG progress track, pulsing glow, and a bouncing downward arrow.
 */
export function DownloadThumbnailOverlay({ progress, className }: OverlayProps) {
  const hasProgress = typeof progress === "number" && progress > 0;
  // Circumference of circle r=13 is ~81.68
  const circumference = 81.7;
  const strokeDashoffset = hasProgress
    ? circumference - (circumference * Math.min(100, Math.max(0, progress))) / 100
    : 40;

  return (
    <div
      className={cn(
        "absolute inset-0 z-20 flex flex-col items-center justify-center rounded-[inherit] bg-black/75 backdrop-blur-xs animate-in fade-in duration-200",
        className,
      )}
      aria-label={hasProgress ? `Downloading: ${progress}%` : "Downloading song..."}
    >
      <div className="relative flex items-center justify-center">
        {/* Animated glowing ring */}
        <svg className="h-8 w-8 -rotate-90 animate-spin text-primary" viewBox="0 0 36 36">
          <circle
            cx="18"
            cy="18"
            r="13"
            fill="none"
            className="stroke-white/15"
            strokeWidth="3.5"
          />
          <circle
            cx="18"
            cy="18"
            r="13"
            fill="none"
            className="stroke-primary transition-all duration-200 ease-out"
            strokeWidth="3.5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        {/* Central bouncing arrow */}
        <ArrowDown className="absolute h-3.5 w-3.5 text-primary animate-bounce fill-current" />
      </div>

      {hasProgress && (
        <span className="mt-0.5 text-[9px] font-bold tabular-nums text-white/90 drop-shadow-sm">
          {Math.round(progress)}%
        </span>
      )}
    </div>
  );
}

type BadgeProps = {
  isDownloading: boolean;
  isDownloaded: boolean;
  progress?: number | undefined;
  className?: string | undefined;
};

/**
 * Compact status badge for song rows (next to duration or like button).
 */
export function DownloadStatusBadge({
  isDownloading,
  isDownloaded,
  progress,
  className,
}: BadgeProps) {
  if (isDownloading) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-primary/15 border border-primary/30 px-2 py-0.5 text-[10px] font-semibold text-primary animate-pulse shadow-xs",
          className,
        )}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>
          {typeof progress === "number" && progress > 0 ? `${Math.round(progress)}%` : "Saving"}
        </span>
      </div>
    );
  }

  if (isDownloaded) {
    return (
      <span
        title="Saved for offline listening"
        className={cn(
          "inline-flex items-center text-emerald-400 transition-transform duration-200 hover:scale-110",
          className,
        )}
      >
        <ArrowDownCircle className="h-3.5 w-3.5 fill-emerald-500/20" />
      </span>
    );
  }

  return null;
}

type FloatingBannerProps = {
  track: Track | null;
  progress?: number | undefined;
  isDone?: boolean | undefined;
  onClose?: () => void;
};

/**
 * Glassmorphic floating download indicator (Spotify / Apple Music style)
 * appears at the top/bottom when a song is being saved to offline storage.
 */
export function DownloadFloatingPill({
  track,
  progress,
  isDone,
  onClose,
}: FloatingBannerProps) {
  if (!track) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto fixed top-4 sm:top-6 left-1/2 z-[100] -translate-x-1/2 animate-in fade-in slide-in-from-top-4 duration-300 max-w-[92vw]"
    >
      <div className="flex items-center gap-3 rounded-full border border-primary/40 bg-card/95 px-4 py-2.5 shadow-2xl backdrop-blur-xl ring-1 ring-white/10 shadow-primary/10">
        {/* Track Thumbnail or Icon */}
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-card border border-hair">
          {track.thumbnail ? (
            <img src={track.thumbnail} alt="" className="h-full w-full object-cover" />
          ) : (
            <Download className="m-auto h-4 w-4 text-primary" />
          )}

          {/* Mini overlay on thumbnail while downloading */}
          {!isDone && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
            </div>
          )}
        </div>

        {/* Track Title & Download Status */}
        <div className="min-w-0 max-w-[180px] sm:max-w-[220px]">
          <p className="truncate text-xs font-semibold text-foreground leading-tight">
            {track.title}
          </p>
          <p className="truncate text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
            {isDone ? (
              <span className="inline-flex items-center text-emerald-400 font-medium">
                <Check className="mr-1 h-3 w-3 stroke-[3]" />
                Saved for offline listening
              </span>
            ) : (
              <>
                <span className="text-primary font-medium">Downloading audio…</span>
                {typeof progress === "number" && progress > 0 && (
                  <span className="tabular-nums font-bold text-foreground">
                    {Math.round(progress)}%
                  </span>
                )}
              </>
            )}
          </p>
        </div>

        {/* Circular Progress or Checkmark icon */}
        <div className="shrink-0 flex items-center justify-center ml-1">
          {isDone ? (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 animate-in zoom-in duration-200">
              <CheckCircle2 className="h-4 w-4 fill-emerald-500/20" />
            </div>
          ) : (
            <div className="relative flex items-center justify-center">
              <svg className="h-6 w-6 -rotate-90 animate-spin text-primary" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" className="stroke-white/10" strokeWidth="4" />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  className="stroke-primary transition-all duration-200"
                  strokeWidth="4"
                  strokeDasharray="88"
                  strokeDashoffset={progress ? 88 - (88 * progress) / 100 : 44}
                  strokeLinecap="round"
                />
              </svg>
              <ArrowDown className="absolute h-2.5 w-2.5 text-primary animate-bounce fill-current" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
