import { memo } from "react";
import { cn } from "@/lib/utils";

interface MusicWaveBannerProps {
  className?: string;
  variant?: "header" | "hero" | "subtle" | "bottom";
}

/**
 * Signature MelodyMap Flowing Music Wave Graphic
 * Matches the colorful flowing music-wave gradient ribbons shown at the top and bottom of
 * Home, Explore, Mixes, Auth, and Profile screens in the MelodyMap UI reference images.
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
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 1440 180"
          preserveAspectRatio="none"
          className="h-full w-full opacity-70 dark:opacity-40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="mmBottomWaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.85" />
              <stop offset="35%" stopColor="#9333EA" stopOpacity="0.9" />
              <stop offset="70%" stopColor="#E040FB" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#FF8A35" stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id="mmBottomWaveGradSoft" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#FF8A35" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#E040FB" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.5" />
            </linearGradient>
          </defs>
          <path
            d="M0,100 C320,30 640,160 960,60 C1200,-10 1360,110 1440,70 L1440,180 L0,180 Z"
            fill="url(#mmBottomWaveGradSoft)"
          />
          <path
            d="M0,120 C280,60 560,170 880,90 C1120,30 1320,130 1440,85 L1440,180 L0,180 Z"
            fill="url(#mmBottomWaveGrad)"
          />
        </svg>
      </div>
    );
  }
  if (variant === "subtle") {
    return (
      <div
        className={cn(
          "pointer-events-none absolute top-0 right-0 left-0 h-28 overflow-hidden opacity-30 dark:opacity-40 -z-10",
          className
        )}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 1200 160"
          preserveAspectRatio="none"
          className="h-full w-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="mmWaveGradSubtle" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.8" />
              <stop offset="25%" stopColor="#7C3AED" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#A855F7" stopOpacity="0.9" />
              <stop offset="75%" stopColor="#E040FB" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#FF8A35" stopOpacity="0.85" />
            </linearGradient>
          </defs>
          <path
            d="M0,40 C200,120 400,0 600,60 C800,120 1000,20 1200,80 L1200,0 L0,0 Z"
            fill="url(#mmWaveGradSubtle)"
          />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute top-0 right-0 left-0 h-36 sm:h-44 overflow-hidden -z-10 select-none",
        className
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1440 220"
        preserveAspectRatio="none"
        className="h-full w-full opacity-45 dark:opacity-55"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Signature Multi-Color Flow: Blue -> Purple -> Magenta -> Orange */}
          <linearGradient id="mmWaveGrad1" x1="0%" y1="30%" x2="100%" y2="70%">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.75" />
            <stop offset="22%" stopColor="#4C1D95" stopOpacity="0.85" />
            <stop offset="46%" stopColor="#7C3AED" stopOpacity="0.9" />
            <stop offset="70%" stopColor="#A855F7" stopOpacity="0.95" />
            <stop offset="85%" stopColor="#E040FB" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FF8A35" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="mmWaveGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FF8A35" stopOpacity="0.3" />
            <stop offset="35%" stopColor="#E040FB" stopOpacity="0.5" />
            <stop offset="70%" stopColor="#7C3AED" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0.4" />
          </linearGradient>
          <filter id="mmWaveBlur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="12" />
          </filter>
        </defs>

        {/* Ambient background bloom */}
        <path
          d="M0,60 C320,160 560,10 880,110 C1140,180 1320,80 1440,120 L1440,0 L0,0 Z"
          fill="url(#mmWaveGrad2)"
          filter="url(#mmWaveBlur)"
          opacity="0.6"
        />

        {/* Dynamic flowing foreground wave ribbons */}
        <path
          d="M0,80 C280,180 540,20 840,130 C1100,210 1300,70 1440,110 L1440,0 L0,0 Z"
          fill="url(#mmWaveGrad1)"
        />
        <path
          d="M0,110 C360,30 680,190 980,80 C1220,-10 1360,130 1440,70 L1440,0 L0,0 Z"
          fill="url(#mmWaveGrad1)"
          opacity="0.35"
        />
      </svg>
    </div>
  );
});
