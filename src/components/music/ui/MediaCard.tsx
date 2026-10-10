import { useState, memo, useRef, useCallback } from "react";
import { MoreHorizontal, Music2, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { HeartLikeButton } from "./HeartLikeButton";
import { triggerHaptic } from "@/lib/haptics";

type Props = {
  title: string;
  subtitle?: string;
  image?: string;
  playing?: boolean;
  active?: boolean;
  liked?: boolean;
  onPlay?: () => void;
  onToggleLike?: () => void;
  onMore?: () => void;
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Official JioSaavn-styled square media card:
 * - Square artwork with subtle rounded corners
 * - Center circular play button on hover/active
 * - Bottom-left heart button on artwork overlay
 * - Bottom-right 3-dots options menu on artwork overlay
 * - Bold title & subtle artist subtitle below artwork
 */
export function MediaCard({
  title,
  subtitle,
  image,
  playing,
  active,
  liked,
  onPlay,
  onToggleLike,
  onMore,
  size = "md",
  className,
  style,
}: Props) {
  const dims = size === "sm" ? "w-32" : size === "lg" ? "w-48" : "w-[140px] sm:w-[160px]";

  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = useCallback(() => {
    if (!onMore) return;
    setIsLongPressing(true);
    longPressTimerRef.current = setTimeout(() => {
      triggerHaptic("medium");
      onMore();
      setIsLongPressing(false);
    }, 800);
  }, [onMore]);

  const handleTouchEnd = useCallback(() => {
    setIsLongPressing(false);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    setIsLongPressing(false);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  return (
    <div
      style={style}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      className={cn(
        "group/card shrink-0 cursor-pointer p-1.5 sm:p-2 rounded-xl transition-all bg-card/40 hover:bg-card border border-hair hover:border-hair-strong card-modern-lift",
        isLongPressing && "scale-95 opacity-80",
        dims,
        className,
      )}
    >
      {/* Artwork Container */}
      <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-lg sm:rounded-xl bg-card border border-hair">
        <button
          type="button"
          onClick={onPlay}
          className="h-full w-full block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {image && !imageError ? (
            <img
              src={image}
              alt={title}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              className={cn(
                "h-full w-full object-cover transition-transform duration-300 group-hover/card:scale-105",
                !imageLoaded && "opacity-0",
                imageLoaded && "opacity-100",
              )}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-card text-muted-foreground">
              <Music2 className="h-8 w-8 opacity-40" />
            </div>
          )}

          {/* JioSaavn Dark Gradient Hover/Playing Overlay */}
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30 transition-opacity duration-200",
              playing || active ? "opacity-100" : "opacity-0 group-hover/card:opacity-100",
            )}
          />

          {/* Center Circular Play Button */}
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-200",
              playing
                ? "opacity-100 scale-100"
                : "opacity-0 scale-90 group-hover/card:opacity-100 group-hover/card:scale-100",
            )}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white shadow-xl transition-transform hover:scale-110 active:scale-95">
              {playing ? (
                <Pause className="h-5 w-5 fill-current" />
              ) : (
                <Play className="ml-0.5 h-5 w-5 fill-current" />
              )}
            </span>
          </div>
        </button>

        {/* Bottom-Left Heart Button (Inside Artwork Overlay) */}
        {onToggleLike && (
          <div
            className={cn(
              "absolute bottom-1.5 left-1.5 z-10 transition-opacity duration-150",
              liked ? "opacity-100" : "opacity-0 group-hover/card:opacity-100",
            )}
          >
            <HeartLikeButton
              liked={Boolean(liked)}
              onToggle={() => onToggleLike()}
              size="sm"
              className="bg-black/50 backdrop-blur-md hover:bg-black/70 shadow-sm"
            />
          </div>
        )}

        {/* Bottom-Right 3-Dots Options Menu (Inside Artwork Overlay) */}
        {onMore && (
          <div className="absolute bottom-1.5 right-1.5 z-10 opacity-0 group-hover/card:opacity-100 transition-opacity duration-150">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMore();
              }}
              aria-label="More options"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 backdrop-blur-md hover:bg-black/70 text-white/90 hover:text-white transition-colors shadow-sm"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Track Metadata (Below Artwork) */}
      <button
        type="button"
        onClick={onPlay}
        className="text-left w-full block focus:outline-none px-0.5"
      >
        <p
          className={cn(
            "truncate text-xs sm:text-sm font-semibold leading-tight transition-colors",
            active ? "text-primary" : "text-foreground group-hover/card:text-primary",
          )}
        >
          {title}
        </p>
        {subtitle && (
          <p className="truncate text-[11px] sm:text-xs text-muted-foreground font-normal leading-tight mt-0.5">
            {subtitle}
          </p>
        )}
      </button>
    </div>
  );
}

export default memo(MediaCard);
