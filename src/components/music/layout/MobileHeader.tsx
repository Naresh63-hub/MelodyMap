import { Menu, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  tab?: string;
  userInitial?: string;
  isPlaying?: boolean;
  onOpenMenu?: () => void;
  onOpenSettings?: () => void;
  onOpenAuth?: () => void;
};

export function MobileHeader({
  tab = "foryou",
  userInitial = "N",
  isPlaying = false,
  onOpenMenu,
  onOpenSettings,
  onOpenAuth,
}: Props) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const getTitle = () => {
    if (tab === "foryou") return getGreeting();
    if (tab === "languages") return "Languages & Artists";
    if (tab === "podcasts") return "Podcasts";
    if (tab === "playlists") return "Playlists";
    if (tab === "library") return "Your Library";
    if (tab === "likes") return "Favourites";
    if (tab === "history") return "Recently Played";
    if (tab === "mixes") return "Mixes";
    return "MelodyMap";
  };

  const getSubtitle = () => {
    if (tab === "foryou") return "Music picked for you";
    if (tab === "podcasts") return "Shows and episodes";
    if (tab === "languages") return "Explore music across languages";
    return "";
  };

  const initial = userInitial.trim().charAt(0).toUpperCase() || "N";

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-4 pb-3 header-safe-top bg-[#121212]/95 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="flex items-center gap-3 min-w-0">
        {onOpenMenu && (
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open navigation menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] border border-white/10 text-white/80 active:scale-95 transition-all"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <div className="min-w-0">
          <h1 suppressHydrationWarning className="text-base sm:text-lg font-bold text-white truncate leading-tight">
            {getTitle()}
          </h1>
          {getSubtitle() && (
            <p className="text-[11px] text-white/50 truncate leading-tight mt-0.5">
              {getSubtitle()}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* User Letter in Rotating Circle while playing */}
        <button
          type="button"
          onClick={onOpenAuth}
          className="relative flex items-center justify-center h-8 w-8 rounded-full bg-white/[0.06] border border-white/10 active:scale-95 transition-all p-0.5"
          title={`Profile (${initial}) • ${isPlaying ? "Playing (Vinyl Spinning)" : "Paused"}`}
          aria-label="User Account"
        >
          <div
            className={cn(
              "relative flex h-full w-full items-center justify-center rounded-full bg-[#181818] border border-[#1DB954]/50 text-white shadow-sm transition-transform",
              isPlaying ? "animate-[spin_4s_linear_infinite]" : "rotate-0"
            )}
          >
            {/* Vinyl record center groove */}
            <div className="absolute inset-1 rounded-full border border-white/15" />
            <span className="font-black text-xs text-[#1DB954]">
              {initial}
            </span>
          </div>
          {isPlaying && (
            <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-[#1DB954] ring-1 ring-[#121212] animate-pulse" />
          )}
        </button>

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Settings"
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 hover:text-white active:bg-white/[0.06] transition-colors"
          >
            <Settings2 className="h-4.5 w-4.5" />
          </button>
        )}
      </div>
    </header>
  );
}
