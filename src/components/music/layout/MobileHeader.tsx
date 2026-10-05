import { Menu, Settings2 } from "lucide-react";

type Props = {
  tab?: string;
  onOpenMenu?: () => void;
  onOpenSettings?: () => void;
};

export function MobileHeader({ tab = "foryou", onOpenMenu, onOpenSettings }: Props) {
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

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-4 pb-3 header-safe-top bg-[#121212]/95 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="flex items-center gap-3 min-w-0">
        {onOpenMenu && (
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open navigation menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] border border-white/10 text-white/80 active:scale-95 transition-all"
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
