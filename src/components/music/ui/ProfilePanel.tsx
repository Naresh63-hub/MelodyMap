import { memo, useState, useEffect, useMemo } from "react";
import {
  Camera,
  ChevronRight,
  Crown,
  Download,
  Flame,
  Heart,
  HelpCircle,
  Info,
  ListMusic,
  LogOut,
  Settings,
  Sparkles,
  Trophy,
  User,
} from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import type { NavTab } from "../layout/Sidebar";
import { CURRENT_APP_VERSION, getCurrentAppVersion } from "@/lib/app-update";
import { getStreakData, getTopListenerPercentile, evaluateUserBadges } from "@/lib/streak";
import { BadgesModal } from "./BadgesModal";

interface ProfilePanelProps {
  userName?: string | undefined;
  userEmail?: string | null | undefined;
  userAvatar?: string | null | undefined;
  likedSongsCount?: number;
  onNavigate: (tab: NavTab) => void;
  onOpenSettings: () => void;
  onSignOut?: () => Promise<void> | void;
  onSignIn?: () => void;
  isCloudAuth?: boolean;
  onCheckForUpdates?: () => void;
  onOpenInstallApp?: () => void;
}

/**
 * Screen 12: Profile and Account Overview
 * Designed with a bright premium white theme (#FFFFFF, #F8F5FF, #E9DDFB, #211536, #746A85).
 * Real account status, interactive menu items, and balanced spacing.
 */
export const ProfilePanel = memo(function ProfilePanel({
  userName = "Naresh G",
  userAvatar,
  likedSongsCount,
  onNavigate,
  onOpenSettings,
  onSignOut,
  onSignIn,
  isCloudAuth = false,
  onCheckForUpdates,
  onOpenInstallApp,
}: ProfilePanelProps) {
  const [appVersion, setAppVersion] = useState(CURRENT_APP_VERSION);
  const [showBadgesModal, setShowBadgesModal] = useState(false);

  const streakData = useMemo(() => getStreakData(), []);
  const rank = useMemo(() => getTopListenerPercentile(streakData), [streakData]);
  const badges = useMemo(() => evaluateUserBadges(streakData), [streakData]);
  const unlockedBadgesCount = useMemo(() => badges.filter((b) => b.unlocked).length, [badges]);

  useEffect(() => {
    void getCurrentAppVersion().then(setAppVersion);
  }, []);

  const menuItems = [
    {
      id: "badges",
      label: "Achievements & Badges",
      icon: Trophy,
      badge: `${unlockedBadgesCount}/${badges.length}`,
      onClick: () => {
        triggerHaptic("selection");
        setShowBadgesModal(true);
      },
    },
    {
      id: "playlists",
      label: "Playlists",
      icon: ListMusic,
      onClick: () => {
        triggerHaptic("selection");
        onNavigate("playlists");
      },
    },
    {
      id: "downloads",
      label: "Downloads",
      icon: Download,
      onClick: () => {
        triggerHaptic("selection");
        onNavigate("downloads");
      },
    },
    {
      id: "likes",
      label: "Liked Songs",
      icon: Heart,
      badge: typeof likedSongsCount === "number" && likedSongsCount > 0 ? `${likedSongsCount}` : undefined,
      onClick: () => {
        triggerHaptic("selection");
        onNavigate("likes");
      },
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      onClick: () => {
        triggerHaptic("selection");
        onOpenSettings();
      },
    },
    {
      id: "help",
      label: "Help & Support",
      icon: HelpCircle,
      onClick: () => {
        triggerHaptic("selection");
        onOpenSettings();
      },
    },
    {
      id: "about",
      label: "About MelodyMap",
      icon: Info,
      onClick: () => {
        triggerHaptic("selection");
        onOpenSettings();
      },
    },
  ];

  return (
    <div className="px-3.5 py-5 sm:px-6 lg:px-8 space-y-4 sm:space-y-5 pb-8 sm:pb-12 max-w-2xl mx-auto w-full animate-fade-in relative">
      {/* User Hero Section */}
      <div className="flex flex-col items-center text-center space-y-2.5 pt-1">
        <div className="relative group shrink-0">
          <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-gradient-to-tr from-[#8B5CF6] via-[#A855F7] to-[#FF8A35] p-1 shadow-lg shadow-purple-900/15">
            <div className="h-full w-full rounded-full overflow-hidden bg-white dark:bg-card flex items-center justify-center">
              {userAvatar ? (
                <img src={userAvatar} alt={userName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl font-extrabold text-[#8B5CF6] dark:text-primary">
                  {userName?.[0]?.toUpperCase() || "N"}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Edit Profile Photo"
            className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#8B5CF6] text-white shadow-md hover:bg-[#7C3AED] transition-transform active:scale-95 cursor-pointer"
          >
            <Camera className="h-4 w-4" />
          </button>
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#211536] dark:text-foreground tracking-tight">
            {userName}
          </h2>
          <div className="flex items-center justify-center gap-1.5 mt-1 text-xs text-[#746A85] dark:text-muted-foreground">
            <span className="font-semibold text-[#8B5CF6] dark:text-[#A855F7]">Free Plan</span>
            <span>·</span>
            <span>{isCloudAuth ? "Cloud Synced" : "Local Device"}</span>
          </div>

          {/* Edit Profile Action Button placed cleanly below account status */}
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                onOpenSettings();
              }}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-1.5 min-h-[38px] rounded-full text-xs font-semibold text-[#8B5CF6] dark:text-primary bg-white dark:bg-card hover:bg-[#F8F5FF] dark:hover:bg-surface-hover border border-[#E9DDFB] dark:border-primary/25 hover:border-[#8B5CF6]/50 shadow-xs hover:shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <span>Edit Profile</span>
            </button>
          </div>
        </div>
      </div>

      {/* Listener Status & Badges Showcase Card */}
      <div
        onClick={() => {
          triggerHaptic("selection");
          setShowBadgesModal(true);
        }}
        className="relative overflow-hidden rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-amber-500/15 via-purple-500/15 to-indigo-500/15 border border-amber-500/30 hover:border-amber-500/50 shadow-xs hover:shadow-md transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-500 text-black flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0 group-hover:scale-105 transition-transform">
              <Crown className="h-6 w-6 fill-black" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">
                  {rank.label}
                </span>
                <span className="text-muted-foreground/40">•</span>
                <span className="text-[10px] font-bold text-foreground/70">
                  {streakData.currentStreak}d Streak 🔥
                </span>
              </div>
              <h3 className="text-sm font-bold text-foreground leading-snug">
                {rank.badgeTitle}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {unlockedBadgesCount} trophies unlocked • Tap to view all
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
        </div>
      </div>

      {/* Menu Navigation Items */}
      <div className="rounded-2xl border border-[#E9DDFB] dark:border-border bg-white dark:bg-card divide-y divide-[#E9DDFB] dark:divide-border overflow-hidden shadow-xs">
        {menuItems.map(({ id, label, icon: Icon, badge, onClick }) => (
          <button
            key={id}
            type="button"
            onClick={onClick}
            className="flex w-full items-center justify-between p-3.5 sm:p-4 text-left text-sm font-medium text-[#211536] dark:text-foreground hover:bg-[#F8F5FF] dark:hover:bg-surface-hover transition-colors active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#8B5CF6]/10 text-[#8B5CF6]">
                <Icon className="h-4.5 w-4.5" />
              </div>
              <span className="font-semibold text-sm">{label}</span>
            </div>
            <div className="flex items-center gap-2">
              {badge && (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6] dark:text-[#C084FC]">
                  {badge}
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-[#746A85] dark:text-muted-foreground" />
            </div>
          </button>
        ))}
      </div>

      {/* Install App & APK */}
      {onOpenInstallApp && (
        <button
          type="button"
          onClick={onOpenInstallApp}
          className="flex w-full items-center justify-between p-3.5 rounded-2xl bg-primary/10 border border-primary/25 hover:bg-primary/15 transition-all text-left cursor-pointer active:scale-[0.99] shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
              <Download className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Install App & APK</p>
              <p className="text-[11px] text-muted-foreground">Download latest APK or install to home screen</p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-primary text-primary-foreground shadow-xs">
            Install
          </span>
        </button>
      )}

      {/* Sign In / Sign Out Button */}
      <div className="pt-1">
        {isCloudAuth ? (
          <button
            type="button"
            onClick={onSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 px-4 text-sm font-semibold text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition-colors active:scale-95 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onSignIn}
            className="mm-btn-gradient flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 px-4 text-sm font-semibold shadow-md active:scale-95 cursor-pointer text-white"
          >
            <User className="h-4 w-4" />
            <span>Sign In to MelodyMap</span>
          </button>
        )}
      </div>

      {/* Version badge */}
      <div className="flex flex-col items-center justify-center gap-1 pt-2 text-xs text-[#746A85] dark:text-muted-foreground relative z-10">
        <div className="flex items-center gap-2">
          <img src="/brand/app-icon.png" alt="MelodyMap" className="h-4.5 w-4.5 object-contain" />
          <span className="font-medium">Version {appVersion}</span>
        </div>
        {onCheckForUpdates && (
          <button
            type="button"
            onClick={onCheckForUpdates}
            className="text-[11px] text-[#8B5CF6] dark:text-violet-400 hover:underline font-semibold cursor-pointer"
          >
            Check for updates
          </button>
        )}
      </div>

      {/* Badges & Achievements Modal */}
      <BadgesModal open={showBadgesModal} onClose={() => setShowBadgesModal(false)} />
    </div>
  );
});
