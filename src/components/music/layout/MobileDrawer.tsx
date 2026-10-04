import {
  Clock,
  Compass,
  Globe2,
  Heart,
  Layers,
  ListMusic,
  LogIn,
  LogOut,
  Mic,
  Search,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavTab } from "./Sidebar";

type Props = {
  open: boolean;
  activeTab: NavTab;
  onClose: () => void;
  onNavigate: (tab: NavTab) => void;
  onOpenSettings: () => void;
  isSynced: boolean;
  userName?: string | undefined;
  userInitial?: string | undefined;
  userAvatar?: string | null | undefined;
  onSignIn?: (() => void) | undefined;
  onSignOut?: (() => Promise<void> | void) | undefined;
};

export function MobileDrawer({
  open,
  activeTab,
  onClose,
  onNavigate,
  onOpenSettings,
  isSynced,
  userName = "Listener",
  userInitial = "L",
  userAvatar,
  onSignIn,
  onSignOut,
}: Props) {
  if (!open) return null;

  const handleNav = (tab: NavTab) => {
    onNavigate(tab);
    onClose();
  };

  const navGroups = [
    {
      title: "Discover",
      items: [
        { id: "foryou" as NavTab, label: "Home (For You)", icon: Sparkles },
        { id: "explore" as NavTab, label: "Explore & Charts", icon: Compass },
        { id: "languages" as NavTab, label: "Languages & Artists", icon: Globe2 },
        { id: "podcasts" as NavTab, label: "Podcasts & Shows", icon: Mic },
        { id: "mixes" as NavTab, label: "Personal Mixes", icon: Layers },
        { id: "search" as NavTab, label: "Search Music", icon: Search },
      ],
    },
    {
      title: "Your Library",
      items: [
        { id: "likes" as NavTab, label: "Liked Songs", icon: Heart },
        { id: "playlists" as NavTab, label: "Playlists", icon: ListMusic },
        { id: "history" as NavTab, label: "Listening History", icon: Clock },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="relative flex w-4/5 max-w-xs flex-1 flex-col bg-[#121212] border-r border-white/10 shadow-2xl z-10 animate-slide-in">
        {/* Header with guaranteed clearance below Android status bar and camera cutouts */}
        <div className="flex items-center justify-between px-5 pb-4 drawer-safe-top border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <img
              src="/brand/app-icon.png"
              alt="MelodyMap"
              className="h-8 w-8 rounded-lg object-cover shadow-sm"
            />
            <span className="font-display text-base font-bold">
              <span className="text-white">Melody</span>
              <span className="text-[#1DB954]">Map</span>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User profile section */}
        {(() => {
          const displayUserName = userName === "Google Listener" ? "My Account" : userName;
          const displayInitial = displayUserName.charAt(0).toUpperCase() || "M";
          return (
            <div
              onClick={() => {
                if (onSignIn) {
                  onClose();
                  onSignIn();
                }
              }}
              className="flex items-center justify-between gap-3 px-5 py-3.5 bg-white/[0.03] hover:bg-white/[0.07] active:bg-white/[0.1] border-b border-white/[0.06] cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {userAvatar ? (
                  <img
                    src={userAvatar}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover border border-[#1DB954]/40"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#1DB954]/25 to-white/10 text-white font-bold text-xs border border-[#1DB954]/30 shadow-sm">
                    {displayInitial}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{displayUserName}</p>
                  <p className="text-[11px] text-white/50">
                    {isSynced ? "Synced Account • Tap to edit" : "Tap to sign in / manage"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                  if (onSignIn) onSignIn();
                }}
                className="shrink-0 rounded-full bg-white/[0.08] border border-white/10 px-3 py-1 text-xs font-semibold text-white/90 hover:bg-white/[0.15] transition-colors"
              >
                {isSynced ? "Manage" : "Sign In"}
              </button>
            </div>
          );
        })()}

        {/* Nav Links */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5 scrollbar-hide">
          {navGroups.map((group) => (
            <div key={group.title}>
              <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-1.5">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNav(item.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors text-left",
                        active
                          ? "bg-white/[0.08] text-white font-semibold"
                          : "text-white/60 hover:bg-white/[0.04] hover:text-white"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active ? "text-[#1DB954]" : "text-white/40"
                        )}
                      />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-white/10 space-y-1">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3.5 py-2 text-xs font-medium text-white/60 hover:bg-white/[0.04] hover:text-white text-left transition-colors"
          >
            <Settings2 className="h-4 w-4 text-white/40" />
            <span>Settings</span>
          </button>

          {isSynced && onSignOut ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                void onSignOut();
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3.5 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 text-left transition-colors"
            >
              <LogOut className="h-4 w-4 text-rose-400" />
              <span>Sign Out</span>
            </button>
          ) : (
            !isSynced && onSignIn && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSignIn();
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3.5 py-2 text-xs font-medium text-white/80 hover:bg-white/[0.06] hover:text-white text-left transition-colors"
              >
                <LogIn className="h-4 w-4 text-white/60" />
                <span>Sign In</span>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
