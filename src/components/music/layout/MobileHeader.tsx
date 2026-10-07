import { Menu, Settings2, User } from "lucide-react";
import { StreakBadge } from "@/components/music/ui/StreakBadge";

type Props = {
  tab?: string;
  onOpenMenu?: () => void;
  onOpenSettings?: () => void;
  userInitial?: string;
  userAvatar?: string | null;
  onOpenAuth?: () => void;
};

export function MobileHeader({
  tab = "foryou",
  onOpenMenu,
  onOpenSettings,
  userInitial,
  userAvatar,
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

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-4 pb-3 header-safe-top bg-surface border-b border-hair-strong">
      <div className="flex items-center gap-2.5 min-w-0">
        {onOpenMenu && (
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open navigation menu"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-chip border border-hair-strong text-foreground/70 hover:text-foreground active:scale-95 transition-all"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}

        <div className="min-w-0">
          <h1
            suppressHydrationWarning
            className="text-base sm:text-lg font-semibold text-foreground/95 truncate leading-tight tracking-tight"
          >
            {getTitle()}
          </h1>
          {getSubtitle() && (
            <p className="text-[11px] text-neutral-400 font-normal truncate leading-tight mt-0.5">
              {getSubtitle()}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <StreakBadge />
        
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Settings"
            className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/50 hover:text-foreground/90 hover:bg-chip active:scale-95 transition-all"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        )}

        {/* Top-of-app circle user mark */}
        {onOpenAuth && (
          <button
            type="button"
            onClick={onOpenAuth}
            aria-label="Account profile"
            title="Account profile"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 hover:from-primary/30 hover:to-primary/10 border border-primary/30 text-white overflow-hidden active:scale-95 transition-all ml-0.5 ring-2 ring-primary/20 animate-avatar-glow animate-avatar-gentle"
          >
            {userAvatar ? (
              <img src={userAvatar} alt="Profile" className="h-full w-full object-cover" />
            ) : userInitial ? (
              <span className="text-xs font-medium text-foreground/90 font-bold tracking-wide">{userInitial}</span>
            ) : (
              <User className="h-3.5 w-3.5 text-foreground/70" />
            )}
          </button>
        )}
      </div>
    </header>
  );
}
