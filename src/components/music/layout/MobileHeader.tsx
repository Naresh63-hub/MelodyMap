import { Bell, Disc3, Menu, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  tab?: string;
  onOpenMenu?: () => void;
  onOpenSettings?: () => void;
};

export function MobileHeader({ tab = "foryou", onOpenMenu, onOpenSettings }: Props) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning 👋";
    if (hour < 17) return "Good Afternoon ☀️";
    return "Good Evening 🌙";
  };

  const getTitle = () => {
    if (tab === "foryou") return getGreeting();
    if (tab === "languages") return "Languages & Artists";
    if (tab === "podcasts") return "Podcasts & Shows";
    if (tab === "playlists") return "Your Playlists";
    if (tab === "library") return "Your Library";
    if (tab === "likes") return "Liked Songs";
    if (tab === "history") return "Recently Played";
    if (tab === "mixes") return "Personal Mixes";
    return "MelodyMap";
  };

  const getSubtitle = () => {
    if (tab === "foryou") return "Let's play some music";
    if (tab === "podcasts") return "Discover top audio shows";
    if (tab === "languages") return "Explore music across languages";
    return "Your personalized music space";
  };

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-[#0b0813]/95 backdrop-blur-xl border-b border-purple-500/15">
      <div className="flex items-center gap-3 min-w-0">
        {onOpenMenu && (
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open navigation menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-950/40 border border-purple-500/20 text-white/80 active:scale-95 transition-all"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-white truncate leading-tight">
            {getTitle()}
          </h1>
          <p className="text-[11px] text-purple-300/50 truncate leading-tight mt-0.5">
            {getSubtitle()}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Settings"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/50 hover:text-white active:bg-white/[0.06] transition-colors"
          >
            <Settings2 className="h-5 w-5" />
          </button>
        )}
      </div>
    </header>
  );
}
