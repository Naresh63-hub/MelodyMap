import { useState, useCallback } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeartLikeButtonProps {
  liked: boolean;
  onToggle: (e: React.MouseEvent) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  ariaLabel?: string;
}

/**
 * Interactive heart-shaped 'like' toggle button with subtle scale-up bounce
 * animation and persistent color change.
 */
export function HeartLikeButton({
  liked,
  onToggle,
  className,
  size = "md",
  ariaLabel,
}: HeartLikeButtonProps) {
  const [isBouncing, setIsBouncing] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      // Trigger scale-up bounce animation
      setIsBouncing(true);
      setTimeout(() => setIsBouncing(false), 300);

      onToggle(e);
    },
    [onToggle],
  );

  const iconSizes = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const buttonSizes = {
    sm: "h-7 w-7",
    md: "h-8 w-8",
    lg: "h-9 w-9",
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel || (liked ? "Remove from favourites" : "Save to favourites")}
      aria-pressed={liked}
      title={liked ? "Remove from favourites" : "Save to favourites"}
      className={cn(
        "relative flex items-center justify-center rounded-full transition-all focus:outline-none active:scale-90",
        buttonSizes[size],
        liked
          ? "text-[#1DB954] hover:text-[#1ed760]"
          : "text-white/40 hover:text-white/80 hover:bg-white/[0.04]",
        className,
      )}
    >
      <Heart
        className={cn(
          iconSizes[size],
          "transition-all duration-200 transform",
          liked
            ? "fill-[#1DB954] text-[#1DB954] drop-shadow-[0_0_6px_rgba(29,185,84,0.4)]"
            : "fill-transparent",
          isBouncing && "scale-125",
        )}
      />
      {/* Subtle pulse ring on click */}
      {isBouncing && (
        <span className="absolute inset-0 rounded-full animate-ping bg-[#1DB954]/25 pointer-events-none" />
      )}
    </button>
  );
}
