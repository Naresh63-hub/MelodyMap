import { Dices, Menu, Radio, Search, User } from "lucide-react";
import { MusicWaveBanner } from "@/components/music/ui/MusicWaveBanner";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

type Props = {
  tab?: string;
  onOpenMenu?: () => void;
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
  userInitial?: string;
  userAvatar?: string | null;
  onOpenAuth?: () => void;
  onOpenJam?: () => void;
  jamActive?: boolean;
  jamParticipantsCount?: number;
  onSurpriseMe?: () => void;
  surpriseLoading?: boolean;
};

export function MobileHeader({
  tab = "foryou",
  onOpenMenu,
  onOpenSearch,
  onOpenSettings: _onOpenSettings,
  userInitial,
  userAvatar,
  onOpenAuth,
  onOpenJam,
  jamActive = false,
  jamParticipantsCount = 1,
  onSurpriseMe,
  surpriseLoading = false,
}: Props) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning! ☀️";
    if (hour < 17) return "Good afternoon! ☀️";
    return "Good Evening! ☀️";
  };

  const getTitle = () => {
    if (tab === "foryou") return getGreeting();
    if (tab === "stories") return "Audio Stories";
    if (tab === "languages") return "Languages";
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
    if (tab === "foryou") return "Let's find your perfect vibe";
    if (tab === "stories") return "Epics · Warriors · Bedtime Tales";
    if (tab === "podcasts") return "Learn · Feel · Be Inspired";
    if (tab === "languages") return "Explore Music in Your Language";
    if (tab === "mixes") return "Curated for your vibe";
    if (tab === "downloads") return "Available offline";
    return "";
  };

  return (
    <header className="sticky top-0 z-20 relative flex items-center justify-between px-4 pb-3 header-safe-top bg-background/70 dark:bg-background/60 backdrop-blur-md border-b border-hair-strong overflow-hidden">
      <MusicWaveBanner />
      <div className="flex items-center gap-2.5 min-w-0 z-10">
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

        <picture className="shrink-0 flex items-center justify-center">
          <source srcSet="/brand/app-icon.webp" type="image/webp" />
          <img
            src="/brand/app-icon.png"
            alt="MelodyMap"
            width={36}
            height={36}
            className="h-9 w-9 sm:h-10 sm:w-10 object-contain drop-shadow-sm shrink-0 select-none"
          />
        </picture>

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
        {/* Surprise Me / Serendipity 1-Tap Exploration */}
        {onSurpriseMe && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              onSurpriseMe();
            }}
            disabled={surpriseLoading}
            aria-label="Surprise Me (Serendipity)"
            title="Surprise Me — Discover fresh music"
            className="flex h-9 w-9 sm:h-9.5 sm:w-9.5 shrink-0 items-center justify-center rounded-full bg-card hover:bg-card/90 border border-hair text-primary hover:text-primary active:scale-95 transition-all shadow-xs min-h-[38px] min-w-[38px] cursor-pointer disabled:opacity-50"
          >
            <Dices className={cn("h-4.5 w-4.5", surpriseLoading && "animate-spin")} />
          </button>
        )}

        {/* Quick Search Action */}
        {onOpenSearch && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              onOpenSearch();
            }}
            aria-label="Search songs, artists, podcasts"
            title="Search"
            className="flex h-9 w-9 sm:h-9.5 sm:w-9.5 shrink-0 items-center justify-center rounded-full bg-card hover:bg-card/90 border border-hair text-foreground/80 hover:text-foreground active:scale-95 transition-all shadow-xs min-h-[38px] min-w-[38px] cursor-pointer"
          >
            <Search className="h-4.5 w-4.5" />
          </button>
        )}

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
