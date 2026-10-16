import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Disc3,
  Download,
  Globe2,
  Heart,
  Layers,
  ListMusic,
  Mic,
  Moon,
  Pause,
  Play,
  Search,
  Settings,
  SkipForward,
  Sparkles,
  Sun,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";

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
  | "downloads"
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
      { id: "downloads", label: "Downloads", icon: Download, shortcut: "9" },
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
  userName?: string | undefined;
  userInitial?: string | undefined;
  userAvatar?: string | null | undefined;
  // Mini-player props
  currentTitle?: string | null | undefined;
  currentArtist?: string | null | undefined;
  currentThumbnail?: string | null | undefined;
  isPlaying?: boolean;
  onPlayPause?: () => void;
  onNext?: () => void;
  onSignIn?: () => void;
  onSignOut?: () => Promise<void> | void;
  onOpenSettings?: () => void;
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
  onSignIn,
  onSignOut,
  onOpenSettings,
}: Props) {
  const { mode, setMode } = useTheme();

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-hair bg-surface sidebar-transition",
        collapsed ? "w-[72px]" : "w-[260px]",
      )}
      style={{ minWidth: collapsed ? 72 : 260 }}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex items-center gap-3 border-b border-hair px-5 pb-4 pt-5",
          collapsed && "justify-center px-2",
        )}
      >
        <div className="relative shrink-0">
          <img
            src="/brand/app-icon.png"
            alt="MelodyMap"
            className="h-8 w-8 rounded-xl object-cover shadow-sm ring-1 ring-primary/30"
          />
        </div>
        {!collapsed && (
          <div className="min-w-0 animate-fade-in-up">
            <p className="truncate text-base font-semibold tracking-tight text-foreground">
              <span>Melody</span>
              <span className="text-primary">Map</span>
            </p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
              Music player
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6 scrollbar-hide">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {section.label}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map(({ id, label, icon: Icon, shortcut }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onNavigate(id)}
                    title={collapsed ? label : undefined}
                    className={cn(
                      "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition-all duration-150",
                      collapsed && "justify-center px-2 py-2.5",
                      active
                        ? "bg-primary/15 border border-primary/30 text-primary dark:text-white font-medium"
                        : "text-secondary-foreground font-medium hover:bg-chip hover:text-foreground",
                    )}
                  >
                    {/* Active indicator bar */}
                    {active && (
                      <div className="absolute left-1.5 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full bg-primary" />
                    )}

                    <Icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0 transition-colors",
                        active
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-secondary-foreground",
                      )}
                    />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left truncate">{label}</span>
                        {shortcut && (
                          <span className="hidden group-hover:inline text-[10px] tabular-nums text-muted-foreground font-mono">
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
        <div className="border-t border-hair p-2">
          <div className="flex flex-col items-center gap-2">
            {/* Album art */}
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-chip-strong shadow-lg shadow-black/40">
              {currentThumbnail ? (
                <img
                  src={currentThumbnail}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-card border border-hair">
                  <Disc3 className="h-5 w-5 text-muted-foreground" />
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
                className="flex h-8 w-8 items-center justify-center rounded-full bg-chip-strong text-foreground/80 hover:bg-chip-strong hover:text-foreground transition-all button-press"
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
                className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/40 hover:bg-chip hover:text-foreground/70 transition-all button-press"
                aria-label="Next"
              >
                <SkipForward className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Truncated title */}
            <p className="w-full text-center text-[9px] text-foreground/40 truncate leading-tight px-1">
              {currentTitle}
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-hair p-3">
        {/* User card (expanded only) */}
        {!collapsed && (
          <div
            onClick={() => {
              if (isSynced) {
                if (onSignOut) void onSignOut();
              } else {
                if (onSignIn) onSignIn();
              }
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                if (isSynced) {
                  if (onSignOut) void onSignOut();
                } else {
                  if (onSignIn) onSignIn();
                }
              }
            }}
            title={isSynced ? "Click to sign out" : "Click to sign in"}
            className="mb-3 flex items-center gap-3 rounded-xl border border-hair bg-card px-3.5 py-2.5 hover:bg-chip transition-colors cursor-pointer group/user active:scale-[0.98]"
          >
            <div className="relative shrink-0">
              <div
                className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-semibold text-foreground border border-hair-strong"
              >
                {userAvatar ? (
                  <img src={userAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background", isSynced ? "bg-primary" : "bg-muted-foreground")} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">
                {userName ?? "Listener"}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                {isSynced ? "Synced (Click to sign out)" : "Sign in / Sync account"}
              </p>
            </div>
          </div>
        )}

        {/* Footer controls: theme switch + settings + collapse toggle */}
        <div className={cn("flex items-center", collapsed ? "flex-col gap-2 justify-center" : "justify-between")}>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMode(mode === "light" ? "dark" : "light")}
              aria-label={mode === "light" ? "Switch to Deep Violet dark mode" : "Switch to light mode"}
              title={mode === "light" ? "Theme: Light (click for Deep Violet)" : "Theme: Deep Violet (click for light)"}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/40 transition-all duration-200 hover:bg-chip hover:text-foreground button-press focus-ring-neon"
            >
              {mode === "light" ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-primary" />
              )}
            </button>

            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                aria-label="Open settings"
                title="Settings"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/40 transition-all duration-200 hover:bg-chip hover:text-foreground button-press focus-ring-neon"
              >
                <Settings className="h-4 w-4" />
              </button>
            )}
          </div>

          {!collapsed && (
            <p className="px-1 text-[10px] text-foreground/20 font-medium">
              MelodyMap
            </p>
          )}

          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/30 transition-all duration-200 hover:bg-chip hover:text-foreground/60 button-press focus-ring-neon"
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
