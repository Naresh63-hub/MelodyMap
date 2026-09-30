import {
  BookOpen,
  CloudMoon,
  Dumbbell,
  Headphones,
  Heart,
  Moon,
  Music2,
  Zap,
  Pause,
  Play,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type DailyMixId =
  | "daily"
  | "telugu"
  | "chill"
  | "energy"
  | "latenight"
  | "romantic"
  | "workout"
  | "focus";

export const DAILY_MIXES: Array<{
  id: DailyMixId;
  name: string;
  mood?: string;
  icon: LucideIcon;
  accent: string;
}> = [
  { id: "daily", name: "Daily Mix 1", icon: Headphones, accent: "from-emerald-900/60 to-[#121212]" },
  { id: "telugu", name: "Telugu Hits", mood: "telugu", icon: Music2, accent: "from-amber-900/50 to-[#121212]" },
  { id: "chill", name: "Chill Mix", mood: "chill", icon: CloudMoon, accent: "from-teal-900/50 to-[#121212]" },
  { id: "energy", name: "Energy Mix", mood: "upbeat workout", icon: Zap, accent: "from-orange-900/50 to-[#121212]" },
  { id: "latenight", name: "Late Night", mood: "late night", icon: Moon, accent: "from-indigo-950/70 to-[#121212]" },
  { id: "romantic", name: "Romantic", mood: "romantic", icon: Heart, accent: "from-rose-950/60 to-[#121212]" },
  { id: "workout", name: "Workout", mood: "upbeat workout", icon: Dumbbell, accent: "from-emerald-950/70 to-[#121212]" },
  { id: "focus", name: "Deep Focus", mood: "focus", icon: BookOpen, accent: "from-blue-950/60 to-[#121212]" },
];

type Props = {
  mix: (typeof DAILY_MIXES)[number];
  active?: boolean;
  playing?: boolean;
  onSelect: () => void;
  onPlay: () => void;
};

export function DailyMixCard({ mix, active, playing, onSelect, onPlay }: Props) {
  const Icon = mix.icon;

  return (
    <div
      className={cn(
        "group/mix relative w-40 shrink-0 cursor-pointer sm:w-44 p-2 rounded-xl transition-colors hover:bg-white/[0.04]",
        active && "z-10",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "relative mb-2 aspect-[4/3] w-full overflow-hidden rounded-lg bg-[#181818] border border-white/[0.08] transition-all duration-200 button-press focus-visible:ring-2 focus-visible:ring-[#1DB954]",
          active && "ring-1 ring-[#1DB954]",
        )}
      >
        <div className={cn("absolute inset-0 bg-gradient-to-br transition-opacity duration-300", mix.accent)} />
        <div className="relative flex h-full flex-col items-start justify-between p-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/40 border border-white/[0.08] text-white/90">
            <Icon className="h-4 w-4" />
          </span>
          <p className="text-left text-sm font-semibold leading-tight text-white/95">
            {mix.name}
          </p>
        </div>

        {/* Clean solid emerald play button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPlay();
          }}
          aria-label={`Play ${mix.name}`}
          className={cn(
            "absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-[#1DB954] text-black shadow-lg shadow-black/60 transition-all duration-200 button-press",
            playing
              ? "scale-100 opacity-100"
              : "scale-90 opacity-0 group-hover/mix:scale-100 group-hover/mix:opacity-100 hover:scale-105 active:scale-95",
          )}
        >
          {playing ? (
            <Pause className="h-4 w-4 fill-black text-black" />
          ) : (
            <Play className="ml-0.5 h-4 w-4 fill-black text-black" />
          )}
        </button>
      </button>
    </div>
  );
}
