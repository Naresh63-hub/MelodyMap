import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Disc3,
  Globe2,
  Heart,
  History,
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
      { id: "mixes", label: "Mixes", icon: Layers, shortcut: "2" },
      { id: "podcasts", label: "Podcasts", icon: Mic, shortcut: "3" },
      { id: "languages", label: "Languages", icon: Globe2, shortcut: "4" },
      { id: "search", label: "Search", icon: Search, shortcut: "/" },
    ],
  },
  {
    label: "Your Library",
    items: [
      { id: "likes", label: "Favourites", icon: Heart, shortcut: "5" },
      { id: "playlists", label: "Playlists", icon: ListMusic, shortcut: "6" },
      { id: "history", label: "Recent", icon: Clock, shortcut: "7" },
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
  userInitial = "L",
  userAvatar,
  currentTitle,
  currentArtist,
  currentThumbnail,
  isPlaying = false,
  onPlayPause,
  onNext,
}: Props) {
  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-white/[0.06] glass-premium sidebar-transition",
        collapsed ? "w-[72px]" : "w-[272px]",
      )}
      style={{ minWidth: collapsed ? 72 : 272 }}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex items-center gap-3 border-b border-white/[0.06] px-5 pb-4 pt-5",
          collapsed && "justify-center px-2",
        )}
      >
        <div className="relative shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-400 shadow-lg shadow-purple-500/20">
            <Disc3 className="h-5 w-5 text-white animate-spin-slow" />
          </div>
          <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-cyan-500/20 blur-lg animate-pulse" />
        </div>
        {!collapsed && (
          <div className="min-w-0 animate-fade-in-up">
            <p className="truncate font-display text-xl font-bold tracking-tight">
              <span className="text-white">Melody</span>
              <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-300 bg-clip-text text-transparent">
                Map
              </span>
            </p>
            <p className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">
              Your music. Your mood.
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-premium">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">
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
                      "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 button-press focus-ring-neon",
                      collapsed && "justify-center px-2",
                      active
                        ? "bg-white/[0.08] text-white shadow-[inset_0_0_20px_rgba(168,85,247,0.08)]"
                        : "text-white/45 hover:bg-white/[0.04] hover:text-white/80",
                    )}
                  >
                    {/* Active indicator bar */}
                    {active && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-full bg-gradient-to-b from-pink-400 via-purple-400 to-cyan-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                    )}

                    <Icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0 transition-all duration-200",
                        active
                          ? "text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]"
                          : "text-white/35 group-hover:text-white/55",
                      )}
                    />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left truncate">{label}</span>
                        {shortcut && (
                          <span className="hidden group-hover:inline text-[10px] tabular-nums text-white/20 font-mono">
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
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-pink-500/30 to-purple-500/30">
                  <Disc3 className="h-5 w-5 text-white/50" />
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
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 hover:bg-white/[0.04] transition-all duration-200 cursor-default group/user">
            <div className="relative shrink-0">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-pink-500/40 to-purple-500/40 text-xs font-bold text-white ring-2 ring-purple-500/20 ring-offset-1 ring-offset-[#0a0a18] group-hover/user:ring-purple-500/40 transition-all">
                {userAvatar ? (
                  <img src={userAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-4 w-4 text-white/80" />
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0a0a18] bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white/85">
                {userName ?? "Listener"}
              </p>
              <p className="truncate text-[10px] text-white/30">
                {isSynced ? "☁ Synced to account" : "📱 Local mode"}
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
