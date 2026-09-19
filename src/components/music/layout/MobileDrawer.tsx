import {
  Clock,
  Disc3,
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
  User,
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
  userName?: string;
  userInitial?: string;
  userAvatar?: string | null;
  onSignIn?: () => void;
  onSignOut?: () => Promise<void> | void;
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
      <div className="relative flex w-4/5 max-w-xs flex-1 flex-col bg-[#0f0f18] border-r border-white/10 shadow-2xl z-10 animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <img
              src="/brand/app-icon.png"
              alt="MelodyMap"
              className="h-8 w-8 rounded-lg object-cover shadow-md"
            />
            <span className="font-display text-base font-bold">
              <span className="text-white">Melody</span>
              <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-300 bg-clip-text text-transparent">
                Map
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User profile section */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-white/[0.02] border-b border-white/[0.06]">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {userAvatar ? (
              <img
                src={userAvatar}
                alt=""
                className="h-10 w-10 rounded-full object-cover border border-white/15"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-white font-semibold text-sm">
                {userInitial}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{userName}</p>
              <p className="text-[11px] text-white/40">
                {isSynced ? "Account synced" : "Local guest mode"}
              </p>
            </div>
          </div>

          {!isSynced && onSignIn && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onSignIn();
              }}
              className="shrink-0 rounded-full bg-purple-600/30 border border-purple-500/40 px-3 py-1 text-xs font-semibold text-purple-200 hover:bg-purple-600/50 transition-colors"
            >
              Sign In
            </button>
          )}
        </div>

        {/* Nav Links */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5 scrollbar-hide">
          {navGroups.map((group) => (
            <div key={group.title}>
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">
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
                        "flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium transition-colors text-left",
                        active
                          ? "bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-white border border-pink-500/30"
                          : "text-white/60 hover:bg-white/[0.04] hover:text-white"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active ? "text-pink-400" : "text-white/40"
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
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium text-white/60 hover:bg-white/[0.04] hover:text-white text-left"
          >
            <Settings2 className="h-4 w-4 text-white/40" />
            <span>Settings & Preferences</span>
          </button>

          {isSynced && onSignOut ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                void onSignOut();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 text-left transition-colors"
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
                className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-purple-300 hover:bg-purple-500/10 hover:text-purple-200 text-left transition-colors"
              >
                <LogIn className="h-4 w-4 text-purple-400" />
                <span>Sign In to Sync</span>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
