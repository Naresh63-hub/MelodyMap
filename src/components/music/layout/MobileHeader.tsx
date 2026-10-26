import { Menu, Radio, User } from "lucide-react";
import { StreakBadge } from "@/components/music/ui/StreakBadge";
import { cn } from "@/lib/utils";

type Props = {
  tab?: string;
  onOpenMenu?: () => void;
  onOpenSettings?: () => void;
  userInitial?: string;
  userAvatar?: string | null;
  onOpenAuth?: () => void;
  onOpenJam?: () => void;
  jamActive?: boolean;
  jamParticipantsCount?: number;
};

export function MobileHeader({
  tab = "foryou",
  onOpenMenu,
  onOpenSettings: _onOpenSettings,
  userInitial,
  userAvatar,
  onOpenAuth,
  onOpenJam,
  jamActive = false,
  jamParticipantsCount = 1,
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
    if (tab === "downloads") return "Downloaded Songs";
    if (tab === "mixes") return "Mixes";
    return "MelodyMap";
  };

  const getSubtitle = () => {
    if (tab === "foryou") return "Music picked for you";
    if (tab === "podcasts") return "Shows and episodes";
    if (tab === "languages") return "Explore music across languages";
    if (tab === "downloads") return "Available offline";
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
            className="flex lg:hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card border border-hair text-secondary-foreground hover:text-foreground active:scale-95 transition-all"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}

        <img
          src="/brand/app-icon.png"
          alt="MelodyMap"
          className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl object-contain ring-1 ring-primary/30 shrink-0 shadow-sm"
        />

        <div className="min-w-0">
          <h1
            suppressHydrationWarning
            className="text-base sm:text-lg font-semibold text-foreground truncate leading-tight tracking-tight"
          >
            {getTitle()}
          </h1>
          {getSubtitle() && (
            <p className="text-[11px] text-muted-foreground font-normal truncate leading-tight mt-0.5">
              {getSubtitle()}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <StreakBadge />

        {/* Live Jam badge if active session is running */}
        {onOpenJam && jamActive && (
          <button
            type="button"
            onClick={onOpenJam}
            aria-label="Jam Session active"
            title={`Jam Session active (${jamParticipantsCount} listening)`}
            className="flex h-8 sm:h-9 items-center gap-1.5 px-2.5 rounded-full text-xs font-medium bg-[#8B5CF6]/20 border border-[#8B5CF6]/50 text-[#8B5CF6] active:scale-95 transition-all shadow-xs"
          >
            <Radio className="h-3.5 w-3.5 animate-pulse text-[#8B5CF6]" />
            <span className="hidden sm:inline font-semibold text-[11px]">{jamParticipantsCount} in Jam</span>
            <span className="sm:hidden h-1.5 w-1.5 rounded-full bg-[#8B5CF6] animate-ping" />
          </button>
        )}

        {/* Unified Profile & Settings Avatar — Tapping opens Account & Settings Sheet */}
        {onOpenAuth && (
          <button
            type="button"
            onClick={onOpenAuth}
            aria-label="Profile and Settings"
            title="Profile, Settings & Account"
            className="flex h-9 w-9 sm:h-9.5 sm:w-9.5 shrink-0 items-center justify-center rounded-full bg-chip hover:bg-chip-strong border border-hair-strong text-foreground overflow-hidden active:scale-95 transition-all ring-2 ring-primary/40 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[40px] min-w-[40px]"
          >
            {userAvatar ? (
              <img src={userAvatar} alt="Profile" className="h-full w-full object-cover" />
            ) : userInitial ? (
              <span className="text-xs font-bold text-foreground tracking-wide">{userInitial}</span>
            ) : (
              <User className="h-4 w-4 text-foreground/80" />
            )}
          </button>
        )}
      </div>
    </header>
  );
}
