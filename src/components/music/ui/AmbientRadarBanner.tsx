import { useState, useEffect, useMemo } from "react";
import {
  Compass,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  Play,
  Radio,
  Zap,
  Wind,
} from "lucide-react";
import { getTemporalContext, type TemporalContext } from "@/lib/context-engine";
import { MOOD_ITEMS, type MoodItem } from "./MoodCardsSection";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export interface AmbientRadarBannerProps {
  onSelectMood?: ((mood: MoodItem) => void) | undefined;
  onQuickVibe?: ((queryTheme: string) => void) | undefined;
  className?: string | undefined;
}

export function AmbientRadarBanner({
  onSelectMood,
  onQuickVibe,
  className,
}: AmbientRadarBannerProps) {
  const [now, setNow] = useState(() => new Date());

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const context: TemporalContext = useMemo(() => {
    return getTemporalContext(now);
  }, [now]);

  const formattedTime = useMemo(() => {
    return now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }, [now]);

  const themeStyle = useMemo(() => {
    switch (context.timeOfDay) {
      case "morning":
        return {
          icon: Sunrise,
          badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25",
          gradientBorder: "from-amber-400/30 via-rose-400/20 to-purple-500/10",
          ambientGlow: "from-amber-500/15 via-rose-500/10 to-transparent",
          energyColor: "text-amber-500",
          description: "Fresh acoustic melodies and peaceful feel-good songs to awaken your day.",
        };
      case "afternoon":
        return {
          icon: Sun,
          badgeColor: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/25",
          gradientBorder: "from-sky-400/30 via-amber-400/20 to-indigo-500/10",
          ambientGlow: "from-sky-500/15 via-amber-500/10 to-transparent",
          energyColor: "text-sky-500",
          description: "Steady-tempo focus tracks, viral chartbusters and driving workday rhythm.",
        };
      case "evening":
        return {
          icon: Sunset,
          badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/25",
          gradientBorder: "from-purple-500/30 via-pink-500/20 to-indigo-500/15",
          ambientGlow: "from-purple-600/15 via-pink-600/10 to-transparent",
          energyColor: "text-purple-400",
          description: "Sunset acoustic warmth, mass beats, commute anthems and lively melodies.",
        };
      case "night":
      default:
        return {
          icon: Moon,
          badgeColor: "bg-indigo-500/15 text-indigo-400 border-indigo-500/25",
          gradientBorder: "from-indigo-500/30 via-purple-600/20 to-violet-900/15",
          ambientGlow: "from-indigo-600/20 via-purple-950/30 to-transparent",
          energyColor: "text-indigo-400",
          description: "Mellow lo-fi, nostalgic classics, slow reverb and deep nocturnal acoustic atmospheres.",
        };
    }
  }, [context.timeOfDay]);

  const IconComponent = themeStyle.icon;

  const handleVibeClick = (vibe: string) => {
    void triggerHaptic("selection");
    const lower = vibe.toLowerCase();
    const matchedMood = MOOD_ITEMS.find(
      (m) =>
        m.label.toLowerCase() === lower ||
        m.key.toLowerCase() === lower ||
        m.subtitle.toLowerCase().includes(lower)
    );

    if (matchedMood && onSelectMood) {
      onSelectMood(matchedMood);
    } else if (onQuickVibe) {
      onQuickVibe(`${vibe} ${context.timeOfDay} hits`);
    } else if (onSelectMood && MOOD_ITEMS[0]) {
      onSelectMood(MOOD_ITEMS[0]);
    }
  };

  const handleLaunchAmbientFlow = () => {
    void triggerHaptic("medium");
    const primaryTheme = context.queryThemes[0] || `${context.label} melodies`;
    if (onQuickVibe) {
      onQuickVibe(primaryTheme);
    } else if (onSelectMood) {
      const fallbackMood =
        context.timeOfDay === "morning"
          ? MOOD_ITEMS.find((m) => m.key === "chill")
          : context.timeOfDay === "afternoon"
          ? MOOD_ITEMS.find((m) => m.key.includes("workout"))
          : context.timeOfDay === "evening"
          ? MOOD_ITEMS.find((m) => m.key === "party" || m.key === "romantic")
          : MOOD_ITEMS.find((m) => m.key === "chill");

      if (fallbackMood) {
        onSelectMood(fallbackMood);
      }
    }
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[#E5DDF5] dark:border-white/10 bg-white/70 dark:bg-[#150F24]/80 backdrop-blur-md p-4 sm:p-5 shadow-sm transition-all",
        className
      )}
    >
      {/* Dynamic Ambient Glow Backdrop */}
      <div
        className={cn(
          "absolute -top-16 -right-16 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-40 dark:opacity-30 bg-gradient-to-br",
          themeStyle.ambientGlow
        )}
      />

      <div className="relative z-10 space-y-3.5">
        {/* Top Radar Status Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                themeStyle.badgeColor
              )}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
              </span>
              Ambient Radar
            </span>

            <span className="text-xs font-mono font-medium text-[#746A85] dark:text-muted-foreground flex items-center gap-1">
              <Compass className="h-3 w-3 text-[#8B5CF6]" />
              <span>{formattedTime}</span>
            </span>
          </div>

          <span className="text-[11px] font-semibold text-[#8B5CF6] dark:text-[#A78BFA] flex items-center gap-1">
            <Radio className="h-3 w-3 animate-pulse" />
            <span className="capitalize">{context.energy} Energy</span>
          </span>
        </div>

        {/* Hero Context Title & Tagline */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-8 w-8 rounded-xl bg-[#8B5CF6]/15 text-[#8B5CF6]">
                <IconComponent className="h-4.5 w-4.5" />
              </span>
              <h2 className="text-base sm:text-lg font-bold text-[#211536] dark:text-white tracking-tight">
                {context.label}
              </h2>
            </div>
            <p className="text-xs text-[#746A85] dark:text-[#A69ABD] max-w-lg leading-relaxed pl-10 sm:pl-10">
              {themeStyle.description}
            </p>
          </div>

          {/* Primary Quick Launch Button */}
          <div className="shrink-0 pl-10 sm:pl-0">
            <button
              type="button"
              onClick={handleLaunchAmbientFlow}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white text-xs font-semibold shadow-md shadow-[#8B5CF6]/25 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Play {context.timeOfDay} Flow</span>
            </button>
          </div>
        </div>

        {/* 1-Tap Vibe Quick Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-1 scrollbar-hide">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#746A85] dark:text-muted-foreground shrink-0 pr-1 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-amber-500" />
            Vibes:
          </span>

          {context.suggestedMoods.map((moodName) => (
            <button
              key={moodName}
              type="button"
              onClick={() => handleVibeClick(moodName)}
              className="shrink-0 px-3 py-1 rounded-full text-xs font-medium bg-white/80 dark:bg-white/5 border border-[#E5DDF5] dark:border-white/10 text-[#211536] dark:text-gray-200 hover:border-[#8B5CF6] hover:bg-[#F1EBFF] dark:hover:bg-[#8B5CF6]/20 transition-all cursor-pointer active:scale-95 shadow-2xs"
            >
              {moodName}
            </button>
          ))}

          {context.suggestedGenres.slice(0, 3).map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => handleVibeClick(genre)}
              className="shrink-0 px-3 py-1 rounded-full text-xs font-medium bg-white/40 dark:bg-white/[0.03] border border-[#E5DDF5]/60 dark:border-white/5 text-[#746A85] dark:text-muted-foreground hover:border-[#8B5CF6]/60 hover:text-[#8B5CF6] transition-all cursor-pointer active:scale-95"
            >
              {genre}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
