import { useState, useCallback, memo } from "react";
import { Heart, MoreHorizontal, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

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

/** Album/playlist card with hover play button and neon glow. */
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
  const dims = size === "sm" ? "w-32" : size === "lg" ? "w-48" : "w-40";
  
  // Performance optimization: lazy image loading with error handling
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <div
      style={style}
      className={cn(
        "group/card card-hover-premium shrink-0 cursor-pointer",
        dims,
        className,
      )}
    >
      <button
        type="button"
        onClick={onPlay}
        className={cn(
          "relative mb-2.5 aspect-square w-full overflow-hidden rounded-xl bg-white/5 transition-all duration-300 button-press focus-ring-neon",
          active && "gradient-border neon-border-animate",
          !active && "hover:border-purple-500/30 border border-transparent",
        )}
      >
        {image && !imageError ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            className={cn(
              "h-full w-full object-cover transition-transform duration-300 group-hover/card:scale-110",
              !imageLoaded && "opacity-0",
              imageLoaded && "opacity-100"
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-cyan-500/10">
            <span className="text-3xl opacity-40">🎵</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 transition-opacity duration-300 group-hover/card:opacity-80" />
        <span
          className={cn(
            "absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-500 text-white shadow-lg shadow-purple-500/40 transition-all duration-200 button-press",
            playing ? "scale-100 opacity-100 animate-neon-glow" : "scale-75 opacity-0 group-hover/card:scale-100 group-hover/card:opacity-100",
          )}
        >
          {playing ? (
            <Pause className="h-4 w-4" fill="currentColor" />
          ) : (
            <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
          )}
        </span>
      </button>
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-sm font-semibold transition-colors duration-200", active ? "text-pink-400 icon-glow" : "text-white/90 group-hover/card:text-white")}>
            {title}
          </p>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-white/40 group-hover/card:text-white/60 transition-colors duration-200">{subtitle}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity duration-200 group-hover/card:opacity-100">
          {onToggleLike && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleLike(); }}
              aria-label={liked ? "Remove from favourites" : "Add to favourites"}
              className="rounded-full p-1 text-white/40 hover:text-pink-400 transition-colors button-press"
            >
              <Heart className={cn("h-3.5 w-3.5 transition-colors", liked && "fill-pink-400 text-pink-400 icon-glow")} />
            </button>
          )}
          {onMore && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMore(); }}
              aria-label="More options"
              className="rounded-full p-1 text-white/40 hover:text-white/70 transition-colors button-press"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export default memo(MediaCard);
