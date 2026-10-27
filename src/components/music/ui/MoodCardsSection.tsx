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
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";

export interface MoodItem {
  key: string;
  label: string;
  subtitle: string;
  gradient: string;
  accentColor: string;
  icon: typeof Coffee;
}

export const MOOD_ITEMS: MoodItem[] = [
  {
    key: "chill",
    label: "Chill",
    subtitle: "Relaxing, lo-fi & acoustic",
    gradient: "from-emerald-950/90 via-teal-900/50 to-zinc-950 border-emerald-500/30 hover:border-emerald-500/60",
    accentColor: "text-emerald-400 bg-emerald-500/15",
    icon: Coffee,
  },
  {
    key: "romantic",
    label: "Romantic",
    subtitle: "Love, melodies & soul",
    gradient: "from-rose-950/90 via-pink-900/50 to-zinc-950 border-rose-500/30 hover:border-rose-500/60",
    accentColor: "text-rose-400 bg-rose-500/15",
    icon: Heart,
  },
  {
    key: "upbeat workout",
    label: "Workout",
    subtitle: "High energy & motivation",
    gradient: "from-orange-950/90 via-amber-900/50 to-zinc-950 border-orange-500/30 hover:border-orange-500/60",
    accentColor: "text-orange-400 bg-orange-500/15",
    icon: Flame,
  },
  {
    key: "party",
    label: "Party",
    subtitle: "Club, dance & bangers",
    gradient: "from-purple-950/90 via-fuchsia-900/50 to-zinc-950 border-fuchsia-500/30 hover:border-fuchsia-500/60",
    accentColor: "text-fuchsia-400 bg-fuchsia-500/15",
    icon: Disc3,
  },
  {
    key: "sad hours",
    label: "Sad & Soulful",
    subtitle: "Heartbreak & deep feels",
    gradient: "from-blue-950/90 via-indigo-950/50 to-zinc-950 border-blue-500/30 hover:border-blue-500/60",
    accentColor: "text-blue-400 bg-blue-500/15",
    icon: CloudRain,
  },
  {
    key: "focus",
    label: "Focus",
    subtitle: "Study, ambient & instrumental",
    gradient: "from-cyan-950/90 via-sky-950/50 to-zinc-950 border-cyan-500/30 hover:border-cyan-500/60",
    accentColor: "text-cyan-400 bg-cyan-500/15",
    icon: Headphones,
  },
  {
    key: "late night",
    label: "Late Night",
    subtitle: "Midnight drive & calm beats",
    gradient: "from-violet-950/90 via-slate-900/50 to-zinc-950 border-violet-500/30 hover:border-violet-500/60",
    accentColor: "text-violet-400 bg-violet-500/15",
    icon: Moon,
  },
  {
    key: "devotional",
    label: "Devotional",
    subtitle: "Peaceful bhakti & bhajans",
    gradient: "from-amber-950/90 via-yellow-950/50 to-zinc-950 border-amber-500/30 hover:border-amber-500/60",
    accentColor: "text-amber-400 bg-amber-500/15",
    icon: Sun,
  },
];

type Props = {
  activeMood?: string | null | undefined;
  loadingMood?: string | null | undefined;
  isPlaying?: boolean | undefined;
  onSelectMood: (item: MoodItem) => void;
  className?: string | undefined;
};

/**
 * Clean & Simple One-Tap Mood & Vibe Selector (Spotify / YouTube Music style).
 * Replaces convoluted multi-slider settings and tiny chips with prominent visual vibe cards.
 */
export function MoodCardsSection({
  activeMood,
  loadingMood,
  isPlaying = false,
  onSelectMood,
  className,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

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
        </div>
        <span className="text-[11px] font-normal text-muted-foreground">
          Tap to Explore
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 snap-x snap-mandatory"
      >
        {MOOD_ITEMS.map((item) => {
          const isActive = activeMood === item.key;
          const isLoading = loadingMood === item.key;
          const isCurrentPlaying = isActive && isPlaying;
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
                <span className="text-sm sm:text-base font-semibold text-white tracking-tight leading-tight line-clamp-1">
                  {item.label}
                </span>
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
