import {
  CloudRain,
  Coffee,
  Disc3,
  Flame,
  Headphones,
  Heart,
  Loader2,
  Moon,
  Pause,
  Play,
  Sparkles,
  Sun,
} from "lucide-react";
import { useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";

export interface MoodItem {
  key: string;
  label: string;
  subtitle: string;
  gradient: string;
  accentColor: string;
  icon: typeof Coffee;
  gradientColors?: string[] | undefined;
}

export const MOOD_ITEMS: MoodItem[] = [
  {
    key: "chill",
    label: "Chill",
    subtitle: "Relaxing, lo-fi & acoustic",
    gradient: "from-[#36D6B5] via-[#8BEBD5] to-[#D8FFF3] border-white/70 hover:border-white shadow-[0_4px_14px_rgba(54,214,181,0.22)]",
    gradientColors: ["#36D6B5", "#8BEBD5", "#D8FFF3"],
    accentColor: "text-[#0C735D] bg-white/80 border border-white/60 shadow-2xs",
    icon: Coffee,
  },
  {
    key: "romantic",
    label: "Romantic",
    subtitle: "Love, melodies & soul",
    gradient: "from-[#F36A9A] via-[#FFAAC8] to-[#FFE0EC] border-white/70 hover:border-white shadow-[0_4px_14px_rgba(243,106,154,0.22)]",
    gradientColors: ["#F36A9A", "#FFAAC8", "#FFE0EC"],
    accentColor: "text-[#CF1E5E] bg-white/80 border border-white/60 shadow-2xs",
    icon: Heart,
  },
  {
    key: "upbeat workout",
    label: "Workout",
    subtitle: "High energy & motivation",
    gradient: "from-[#FF963D] via-[#FFC078] to-[#FFE5C5] border-white/70 hover:border-white shadow-[0_4px_14px_rgba(255,150,61,0.22)]",
    gradientColors: ["#FF963D", "#FFC078", "#FFE5C5"],
    accentColor: "text-[#D45300] bg-white/80 border border-white/60 shadow-2xs",
    icon: Flame,
  },
  {
    key: "party",
    label: "Party",
    subtitle: "Club, dance & bangers",
    gradient: "from-[#B65AF2] via-[#DB9BFF] to-[#F1D7FF] border-white/70 hover:border-white shadow-[0_4px_14px_rgba(182,90,242,0.22)]",
    gradientColors: ["#B65AF2", "#DB9BFF", "#F1D7FF"],
    accentColor: "text-[#8818D1] bg-white/80 border border-white/60 shadow-2xs",
    icon: Disc3,
  },
  {
    key: "sad hours",
    label: "Sad & Soulful",
    subtitle: "Heartbreak & deep feels",
    gradient: "from-[#6D8FF5] via-[#A9C4FF] to-[#E1EAFF] border-white/70 hover:border-white shadow-[0_4px_14px_rgba(109,143,245,0.22)]",
    gradientColors: ["#6D8FF5", "#A9C4FF", "#E1EAFF"],
    accentColor: "text-[#244EC9] bg-white/80 border border-white/60 shadow-2xs",
    icon: CloudRain,
  },
  {
    key: "focus",
    label: "Focus",
    subtitle: "Study, ambient & instrumental",
    gradient: "from-[#35BFD9] via-[#8AE4F0] to-[#D8F8FC] border-white/70 hover:border-white shadow-[0_4px_14px_rgba(53,191,217,0.22)]",
    gradientColors: ["#35BFD9", "#8AE4F0", "#D8F8FC"],
    accentColor: "text-[#007C92] bg-white/80 border border-white/60 shadow-2xs",
    icon: Headphones,
  },
  {
    key: "late night",
    label: "Late Night",
    subtitle: "Midnight drive & calm beats",
    gradient: "from-[#9270F5] via-[#C3A5FF] to-[#E9DDFF] border-white/70 hover:border-white shadow-[0_4px_14px_rgba(146,112,245,0.22)]",
    gradientColors: ["#9270F5", "#C3A5FF", "#E9DDFF"],
    accentColor: "text-[#5E30E3] bg-white/80 border border-white/60 shadow-2xs",
    icon: Moon,
  },
  {
    key: "devotional",
    label: "Devotional",
    subtitle: "Peaceful bhakti & bhajans",
    gradient: "from-[#F4B942] via-[#FFD982] to-[#FFF1CC] border-white/70 hover:border-white shadow-[0_4px_14px_rgba(244,185,66,0.22)]",
    gradientColors: ["#F4B942", "#FFD982", "#FFF1CC"],
    accentColor: "text-[#A86E00] bg-white/80 border border-white/60 shadow-2xs",
    icon: Sun,
  },
];

export type TimeOfDayPeriod = "morning" | "afternoon" | "evening" | "night";

export interface TimeOfDayMoodContext {
  period: TimeOfDayPeriod;
  badgeLabel: string;
  recommendedKeys: string[];
}

/**
 * Returns dynamic mood recommendations tailored to the local time of day:
 * - Morning (5:00 - 11:59): Devotional, Chill, Focus
 * - Afternoon (12:00 - 16:59): Focus, Workout, Chill
 * - Evening (17:00 - 21:59): Romantic, Party, Chill
 * - Late Night (22:00 - 4:59): Late Night, Sad & Soulful, Chill
 */
export function getTimeOfDayMoodContext(date: Date = new Date()): TimeOfDayMoodContext {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) {
    return {
      period: "morning",
      badgeLabel: "Morning",
      recommendedKeys: ["devotional", "chill", "focus"],
    };
  }
  if (hour >= 12 && hour < 17) {
    return {
      period: "afternoon",
      badgeLabel: "Afternoon",
      recommendedKeys: ["focus", "upbeat workout", "chill"],
    };
  }
  if (hour >= 17 && hour < 22) {
    return {
      period: "evening",
      badgeLabel: "Evening",
      recommendedKeys: ["romantic", "party", "chill"],
    };
  }
  return {
    period: "night",
    badgeLabel: "Late Night",
    recommendedKeys: ["late night", "sad hours", "chill"],
  };
}

type Props = {
  activeMood?: string | null | undefined;
  loadingMood?: string | null | undefined;
  isPlaying?: boolean | undefined;
  onSelectMood: (item: MoodItem) => void;
  className?: string | undefined;
  currentDate?: Date | undefined;
};

/**
 * Clean & Simple One-Tap Mood & Vibe Selector (Spotify / YouTube Music style).
 * Dynamically highlights time-of-day relevant moods while preserving manual user selection.
 */
export function MoodCardsSection({
  activeMood,
  loadingMood,
  isPlaying = false,
  onSelectMood,
  className,
  currentDate,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const timeContext = useMemo(() => getTimeOfDayMoodContext(currentDate), [currentDate]);

  // Order cards: prioritize time-of-day moods first while preserving full collection
  const orderedItems = useMemo(() => {
    return [...MOOD_ITEMS].sort((a, b) => {
      const aRec = timeContext.recommendedKeys.includes(a.key);
      const bRec = timeContext.recommendedKeys.includes(b.key);
      if (aRec && !bRec) return -1;
      if (!aRec && bRec) return 1;
      return 0;
    });
  }, [timeContext]);

  const handleClick = (item: MoodItem) => {
    triggerHaptic("selection");
    onSelectMood(item);
  };

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Moods & Vibes
          </h2>
          <span className="inline-flex items-center rounded-full bg-primary/15 border border-primary/30 px-2 py-0.5 text-[10px] font-medium text-primary">
            {timeContext.badgeLabel}
          </span>
        </div>
        <span className="text-[11px] font-normal text-muted-foreground">
          Tap to Explore
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 snap-x snap-mandatory"
      >
        {orderedItems.map((item) => {
          const isActive = activeMood === item.key;
          const isLoading = loadingMood === item.key;
          const isCurrentPlaying = isActive && isPlaying;
          const isSuggested = timeContext.recommendedKeys.includes(item.key);
          const Icon = item.icon;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleClick(item)}
              aria-label={`Play ${item.label} vibe`}
              className={cn(
                "group/mood relative shrink-0 snap-start rounded-2xl border p-3.5 text-left transition-all duration-200 active:scale-[0.97]",
                "w-[144px] sm:w-[164px] h-[96px] sm:h-[104px] flex flex-col justify-between overflow-hidden",
                "bg-gradient-to-br shadow-sm",
                item.gradient,
                isActive
                  ? "ring-2 ring-primary/80 border-primary shadow-md shadow-primary/20 scale-[1.01]"
                  : "hover:shadow-md",
              )}
            >
              {/* Header: Label & Icon */}
              <div className="flex items-start justify-between gap-1 z-10">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm sm:text-base font-semibold text-white tracking-tight leading-tight line-clamp-1">
                    {item.label}
                  </span>
                  {isSuggested && !isActive && (
                    <span className="shrink-0 rounded-full bg-white/20 px-1.5 py-0.5 text-[8px] sm:text-[9px] font-semibold uppercase tracking-wider text-white">
                      Now
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover/mood:scale-110",
                    item.accentColor,
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </div>

              {/* Footer: Subtitle & Play / Status Button */}
              <div className="flex items-end justify-between gap-2 z-10 mt-auto">
                <p className="text-[10px] sm:text-[11px] text-white/70 line-clamp-2 leading-tight font-normal">
                  {item.subtitle}
                </p>

                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-200 shadow-md",
                    isActive
                      ? "bg-primary text-primary-foreground scale-100 ring-2 ring-white/20"
                      : "bg-white/15 text-white backdrop-blur-sm group-hover/mood:bg-primary group-hover/mood:text-primary-foreground group-hover/mood:scale-105",
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isCurrentPlaying ? (
                    <Pause className="h-3.5 w-3.5 fill-current" />
                  ) : (
                    <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
                  )}
                </div>
              </div>

              {/* Ambient radial glow effect */}
              <div
                className={cn(
                  "pointer-events-none absolute -right-6 -bottom-6 h-24 w-24 rounded-full blur-2xl opacity-30 transition-opacity duration-300",
                  isActive ? "opacity-60 bg-primary" : "group-hover/mood:opacity-50",
                )}
                aria-hidden="true"
              />
            </button>
          );
        })}
        <div className="w-2 shrink-0" aria-hidden="true" />
      </div>
    </section>
  );
}
