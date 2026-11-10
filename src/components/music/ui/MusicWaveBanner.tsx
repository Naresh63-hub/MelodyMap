import { memo } from "react";
import { cn } from "@/lib/utils";

interface MusicWaveBannerProps {
  className?: string;
  variant?: "header" | "hero" | "subtle" | "bottom";
}

/**
 * Signature MelodyMap Flowing Music Wave Graphic
 *
 * Implements smooth, flowing wave ribbons using layered SVG curves and
 * gradients (purple #8B5CF6, violet #A855F7, pink #EC4899, and warm orange #FF8A35).
 * Blends naturally into the background using soft opacity, ambient glow, and
 * gradient masks so it never looks like a pasted or boxed graphic.
 */
export const MusicWaveBanner = memo(function MusicWaveBanner({
  className,
  variant = "header",
}: MusicWaveBannerProps) {
  if (variant === "bottom") {
    return (
      <div
        className={cn(
          "pointer-events-none absolute bottom-0 right-0 left-0 h-28 sm:h-36 overflow-hidden select-none -z-10",
          className
        )}
        style={{
          maskImage: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 60%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 60%, transparent 100%)",
        }}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 1440 180"
          preserveAspectRatio="none"
          className="h-full w-full opacity-60 dark:opacity-40 transition-opacity duration-300"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="mmBottomWaveGrad1" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.8" />
              <stop offset="35%" stopColor="#A855F7" stopOpacity="0.85" />
              <stop offset="70%" stopColor="#EC4899" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#FF8A35" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="mmBottomWaveGrad2" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#FF8A35" stopOpacity="0.25" />
              <stop offset="50%" stopColor="#EC4899" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.45" />
            </linearGradient>
            <filter id="mmBottomWaveBlur" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="8" />
            </filter>
          </defs>

          {/* Ambient luminous glow */}
          <path
            d="M0,80 C320,10 640,140 960,40 C1200,-20 1360,90 1440,50 L1440,180 L0,180 Z"
            fill="url(#mmBottomWaveGrad2)"
            filter="url(#mmBottomWaveBlur)"
            opacity="0.5"
          />

          {/* Secondary flowing ribbon */}
          <path
            d="M0,100 C340,30 660,150 980,60 C1220,10 1360,110 1440,70 L1440,180 L0,180 Z"
            fill="url(#mmBottomWaveGrad2)"
            opacity="0.6"
          />

          {/* Primary wave ribbon */}
          <path
            d="M0,115 C280,55 580,160 880,85 C1120,25 1320,120 1440,80 L1440,180 L0,180 Z"
            fill="url(#mmBottomWaveGrad1)"
          />
        </svg>
      </div>
    );
  }

  if (variant === "subtle") {
    return (
      <div
        className={cn(
          "pointer-events-none absolute top-0 right-0 left-0 h-28 overflow-hidden select-none -z-10",
          className
        )}
        style={{
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)",
        }}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 1200 160"
          preserveAspectRatio="none"
          className="h-full w-full opacity-35 dark:opacity-25"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="mmWaveGradSubtle" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.75" />
              <stop offset="35%" stopColor="#A855F7" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#EC4899" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#FF8A35" stopOpacity="0.7" />
            </linearGradient>
          </defs>
          <path
            d="M0,35 C200,100 400,10 600,55 C800,110 1000,25 1200,70 L1200,0 L0,0 Z"
            fill="url(#mmWaveGradSubtle)"
          />
        </svg>
      </div>
    );
  }

  // Default: "header" and "hero" variants
  return (
    <div
      className={cn(
        "pointer-events-none absolute top-0 right-0 left-0 h-32 sm:h-40 overflow-hidden -z-10 select-none",
        className
      )}
      style={{
        maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 65%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 65%, transparent 100%)",
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1440 220"
        preserveAspectRatio="none"
        className="h-full w-full opacity-40 dark:opacity-35 transition-opacity duration-300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Signature Multi-Color Flow: Purple -> Violet -> Pink -> Warm Orange */}
          <linearGradient id="mmWaveGrad1" x1="0%" y1="20%" x2="100%" y2="80%">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.85" />
            <stop offset="30%" stopColor="#A855F7" stopOpacity="0.9" />
            <stop offset="65%" stopColor="#EC4899" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#FF8A35" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="mmWaveGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FF8A35" stopOpacity="0.25" />
            <stop offset="40%" stopColor="#EC4899" stopOpacity="0.4" />
            <stop offset="75%" stopColor="#A855F7" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.35" />
          </linearGradient>
          <filter id="mmWaveBlur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>

        {/* Ambient background bloom with soft glow */}
        <path
          d="M0,50 C300,140 560,15 880,100 C1140,165 1320,70 1440,105 L1440,0 L0,0 Z"
          fill="url(#mmWaveGrad2)"
          filter="url(#mmWaveBlur)"
          opacity="0.55"
        />

        {/* Secondary wave ribbon */}
        <path
          d="M0,95 C340,35 660,165 960,75 C1200,5 1340,115 1440,65 L1440,0 L0,0 Z"
          fill="url(#mmWaveGrad1)"
          opacity="0.3"
        />

        {/* Dynamic flowing foreground wave ribbon */}
        <path
          d="M0,70 C260,155 520,25 820,115 C1080,185 1280,60 1440,95 L1440,0 L0,0 Z"
          fill="url(#mmWaveGrad1)"
        />
      </svg>
    </div>
  );
});
