import {
  BookOpen,
  CloudMoon,
  Dumbbell,
  Headphones,
  Heart,
  Moon,
  Music2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Pause, Play } from "lucide-react";
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
  gradient: string;
}> = [
  { id: "daily", name: "Daily Mix 01", icon: Headphones, gradient: "from-violet-600 via-purple-600 to-fuchsia-500" },
  { id: "telugu", name: "Telugu Vibes", mood: "telugu", icon: Music2, gradient: "from-orange-500 via-rose-500 to-pink-600" },
  { id: "chill", name: "Chill Mix", mood: "chill", icon: CloudMoon, gradient: "from-cyan-600 via-blue-600 to-indigo-600" },
  { id: "energy", name: "Energy Mix", mood: "upbeat workout", icon: Zap, gradient: "from-yellow-500 via-orange-500 to-red-500" },
  { id: "latenight", name: "Late Night", mood: "late night", icon: Moon, gradient: "from-indigo-700 via-purple-800 to-violet-900" },
  { id: "romantic", name: "Romantic", mood: "romantic", icon: Heart, gradient: "from-pink-500 via-rose-500 to-red-400" },
  { id: "workout", name: "Workout", mood: "upbeat workout", icon: Dumbbell, gradient: "from-lime-500 via-green-500 to-emerald-600" },
  { id: "focus", name: "Focus", mood: "focus", icon: BookOpen, gradient: "from-teal-600 via-cyan-600 to-blue-600" },
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
        "group/mix card-hover-premium relative w-44 shrink-0 cursor-pointer sm:w-48",
        active && "z-10",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "relative mb-2.5 aspect-[4/3] w-full overflow-hidden rounded-2xl transition-all duration-300 button-press focus-ring-neon",
          active ? "gradient-border neon-border-animate shadow-neon" : "border border-white/5 hover:border-purple-500/30",
        )}
      >
        <div className={cn("absolute inset-0 bg-gradient-to-br opacity-90 transition-opacity duration-300 group-hover/mix:opacity-100", mix.gradient)} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_60%)]" />
        <div className="relative flex h-full flex-col items-start justify-between p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm transition-transform duration-300 group-hover/mix:scale-110">
            <Icon className="h-5 w-5 text-white icon-glow" />
          </span>
          <p className="text-left text-sm font-bold leading-tight text-white drop-shadow-sm transition-transform duration-300 group-hover/mix:translate-x-1">
            {mix.name}
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
          aria-label={`Play ${mix.name}`}
          className={cn(
            "absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-500 text-white shadow-lg shadow-purple-500/40 transition-all duration-200 button-press",
            playing ? "scale-100 opacity-100 animate-neon-glow" : "scale-75 opacity-0 group-hover/mix:scale-100 group-hover/mix:opacity-100",
          )}
        >
          {playing ? (
            <Pause className="h-4 w-4" fill="currentColor" />
          ) : (
            <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
          )}
        </button>
      </button>
    </div>
  );
}
