import { useState, memo } from "react";
import { Heart, MoreHorizontal, Music2, Pause, Play } from "lucide-react";
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

/**
 * Editorial music card with restrained 8px radius, subtle scale, and solid emerald play control.
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
  const dims = size === "sm" ? "w-32" : size === "lg" ? "w-48" : "w-40";

  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <div
      style={style}
      className={cn(
        "group/card shrink-0 cursor-pointer p-2 rounded-xl transition-colors hover:bg-white/[0.04]",
        dims,
        className,
      )}
    >
      <button
        type="button"
        onClick={onPlay}
        className={cn(
          "relative mb-2 aspect-square w-full overflow-hidden rounded-lg bg-[#181818] border border-white/[0.08] transition-all duration-200 button-press focus-visible:ring-2 focus-visible:ring-[#1DB954]",
          active && "ring-1 ring-[#1DB954]",
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
              "h-full w-full object-cover transition-transform duration-300 group-hover/card:scale-[1.02]",
              !imageLoaded && "opacity-0",
              imageLoaded && "opacity-100",
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#1c1c1c] text-neutral-500">
            <Music2 className="h-8 w-8 opacity-40" />
          </div>
        )}

        {/* Subtle hover overlay */}
        <div className="absolute inset-0 bg-black/20 opacity-0 transition-opacity duration-200 group-hover/card:opacity-100" />

        {/* Clean Circular Play Button */}
        <span
          className={cn(
            "absolute bottom-2.5 right-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-[#1DB954] text-black shadow-lg shadow-black/60 transition-all duration-200",
            playing
              ? "scale-100 opacity-100"
              : "scale-90 opacity-0 group-hover/card:scale-100 group-hover/card:opacity-100 hover:scale-105 active:scale-95",
          )}
        >
          {playing ? (
            <Pause className="h-4 w-4 fill-black text-black" />
          ) : (
            <Play className="ml-0.5 h-4 w-4 fill-black text-black" />
          )}
        </span>
      </button>

      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-[13px] font-medium leading-snug transition-colors",
              active ? "text-[#1DB954]" : "text-white/90 group-hover/card:text-white",
            )}
          >
            {title}
          </p>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-neutral-400 group-hover/card:text-neutral-300">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover/card:opacity-100">
          {onToggleLike && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleLike();
              }}
              aria-label={liked ? "Remove from favourites" : "Add to favourites"}
              className="rounded-full p-1 text-neutral-400 hover:text-white transition-colors"
            >
              <Heart
                className={cn(
                  "h-3.5 w-3.5 transition-colors",
                  liked && "fill-[#1DB954] text-[#1DB954]",
                )}
              />
            </button>
          )}
          {onMore && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMore();
              }}
              aria-label="More options"
              className="rounded-full p-1 text-neutral-400 hover:text-white transition-colors"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(MediaCard);
