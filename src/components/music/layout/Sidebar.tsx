import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Disc3,
  Globe2,
  Heart,
  Layers,
  ListMusic,
  Mic,
  Pause,
  Play,
  Search,
  SkipForward,
  Sparkles,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NavTab =
  | "foryou"
  | "explore"
  | "mixes"
  | "podcasts"
  | "languages"
  | "search"
  | "likes"
  | "playlists"
  | "history"
  | "library";

type NavSection = {
  label: string;
  items: Array<{ id: NavTab; label: string; icon: typeof Sparkles; shortcut?: string }>;
};

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Discover",
    items: [
      { id: "foryou", label: "For you", icon: Sparkles, shortcut: "1" },
      { id: "explore", label: "Explore", icon: Compass, shortcut: "2" },
      { id: "mixes", label: "Mixes", icon: Layers, shortcut: "3" },
      { id: "podcasts", label: "Podcasts", icon: Mic, shortcut: "4" },
      { id: "languages", label: "Languages", icon: Globe2, shortcut: "5" },
      { id: "search", label: "Search", icon: Search, shortcut: "/" },
    ],
  },
  {
    label: "Your Library",
    items: [
      { id: "likes", label: "Favourites", icon: Heart, shortcut: "6" },
      { id: "playlists", label: "Playlists", icon: ListMusic, shortcut: "7" },
      { id: "history", label: "Recent", icon: Clock, shortcut: "8" },
    ],
  },
];

// Flat list for easy iteration
export const NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

type Props = {
  activeTab: NavTab;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate: (tab: NavTab) => void;
  isSynced: boolean;
  userName?: string;
  userInitial?: string;
  userAvatar?: string | null;
  // Mini-player props
  currentTitle?: string | null;
  currentArtist?: string | null;
  currentThumbnail?: string | null;
  isPlaying?: boolean;
  onPlayPause?: () => void;
  onNext?: () => void;
};

export function Sidebar({
  activeTab,
  collapsed,
  onToggleCollapse,
  onNavigate,
  isSynced,
  userName,
  userInitial: _userInitial = "L",
  userAvatar,
  currentTitle,
  currentArtist: _currentArtist,
  currentThumbnail,
  isPlaying = false,
  onPlayPause,
  onNext,
}: Props) {
  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-white/[0.06] bg-surface sidebar-transition",
        collapsed ? "w-[72px]" : "w-[260px]",
      )}
      style={{ minWidth: collapsed ? 72 : 260 }}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex items-center gap-3 border-b border-white/[0.06] px-5 pb-4 pt-5",
          collapsed && "justify-center px-2",
        )}
      >
        <div className="relative shrink-0">
          <img
            src="/brand/app-icon.png"
            alt="MelodyMap"
            className="h-8 w-8 rounded-lg object-cover shadow-sm"
          />
        </div>
        {!collapsed && (
          <div className="min-w-0 animate-fade-in-up">
            <p className="truncate text-base font-semibold tracking-tight">
              <span className="text-[#F5F5F5]">Melody</span>
              <span className="text-primary">Map</span>
            </p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#737373] font-normal">
              Music player
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-hide">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map(({ id, label, icon: Icon, shortcut }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onNavigate(id)}
                    title={collapsed ? label : undefined}
                    className={cn(
                      "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors",
                      collapsed && "justify-center px-2",
                      active
                        ? "bg-white/[0.06] text-[#F5F5F5] font-semibold"
                        : "text-[#A1A1A1] font-medium hover:bg-white/[0.03] hover:text-[#F5F5F5]",
                    )}
                  >
                    {/* Active indicator bar */}
                    {active && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2.5px] rounded-full bg-primary" />
                    )}

                    <Icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0 transition-colors",
                        active
                          ? "text-primary"
                          : "text-[#737373] group-hover:text-[#A1A1A1]",
                      )}
                    />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left truncate">{label}</span>
                        {shortcut && (
                          <span className="hidden group-hover:inline text-[10px] tabular-nums text-[#737373] font-mono">
                            {shortcut}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Mini-player (collapsed only) */}
      {collapsed && currentTitle && (
        <div className="border-t border-white/[0.06] p-2">
          <div className="flex flex-col items-center gap-2">
            {/* Album art */}
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10 shadow-lg shadow-black/40">
              {currentThumbnail ? (
                <img
                  src={currentThumbnail}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-card border border-white/[0.06]">
                  <Disc3 className="h-5 w-5 text-[#737373]" />
                </div>
              )}
              {/* Playing indicator overlay */}
              {isPlaying && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <div className="flex items-end gap-[2px] h-4">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-[3px] rounded-full bg-white animate-bar"
                        style={{ animationDelay: `${i * 0.15}s`, height: "100%" }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Play / Next buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onPlayPause}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-white/80 hover:bg-white/[0.12] hover:text-white transition-all button-press"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5 ml-0.5" />
                )}
              </button>
              <button
                type="button"
                onClick={onNext}
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:bg-white/[0.06] hover:text-white/70 transition-all button-press"
                aria-label="Next"
              >
                <SkipForward className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Truncated title */}
            <p className="w-full text-center text-[9px] text-white/40 truncate leading-tight px-1">
              {currentTitle}
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-white/[0.06] p-3">
        {/* User card (expanded only) */}
        {!collapsed && (
          <div className="mb-3 flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 hover:bg-white/[0.04] transition-colors cursor-default group/user">
            <div className="relative shrink-0">
              {isPlaying && (
                <div className="playing-ring-conic animate-avatar-ring absolute -inset-[2.5px] rounded-full opacity-90" />
              )}
              <div
                className={cn(
                  "relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-popover text-xs font-semibold text-white border border-white/10",
                  isPlaying && "shadow-[0_0_14px_rgba(56,189,248,0.4)]",
                )}
              >
                {userAvatar ? (
                  <img src={userAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-4 w-4 text-white/70" />
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-xs font-semibold text-white/90", isPlaying && "animate-name-glow")}>
                {userName ?? "Listener"}
              </p>
              <p className="truncate text-[10px] text-white/40">
                {isSynced ? "Synced to cloud" : "Local mode"}
              </p>
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && (
            <p className="px-1 text-[10px] text-white/20 font-medium">
              MelodyMap v1.0
            </p>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 transition-all duration-200 hover:bg-white/[0.06] hover:text-white/60 button-press focus-ring-neon"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
