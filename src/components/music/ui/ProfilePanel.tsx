import { memo } from "react";
import {
  Camera,
  ChevronRight,
  Download,
  Heart,
  HelpCircle,
  Info,
  ListMusic,
  LogOut,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";
import { MusicWaveBanner } from "./MusicWaveBanner";
import type { NavTab } from "../layout/Sidebar";

interface ProfilePanelProps {
  userName?: string | undefined;
  userEmail?: string | null | undefined;
  userAvatar?: string | null | undefined;
  songsPlayedCount?: number;
  listeningHours?: number;
  onNavigate: (tab: NavTab) => void;
  onOpenSettings: () => void;
  onSignOut?: () => Promise<void> | void;
  onSignIn?: () => void;
  isCloudAuth?: boolean;
}

/**
 * Screen 12: Profile and Account Overview
 * Matches the uploaded UI reference images for both Midnight Music (Dark)
 * and Purple Dream (Light).
 */
export const ProfilePanel = memo(function ProfilePanel({
  userName = "Naresh G",
  userEmail,
  userAvatar,
  songsPlayedCount = 128,
  listeningHours = 24,
  onNavigate,
  onOpenSettings,
  onSignOut,
  onSignIn,
  isCloudAuth = false,
}: ProfilePanelProps) {
  const menuItems = [
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
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6 pb-28 max-w-2xl mx-auto w-full animate-fade-in relative">
      {/* User Hero Section */}
      <div className="flex flex-col items-center text-center space-y-3 pt-2">
        <div className="relative group shrink-0">
          <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-gradient-to-tr from-[#7C3AED] via-[#A855F7] to-[#FF8A35] p-1 shadow-lg shadow-purple-900/20">
            <div className="h-full w-full rounded-full overflow-hidden bg-card flex items-center justify-center">
              {userAvatar ? (
                <img src={userAvatar} alt={userName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-primary">
                  {userName?.[0]?.toUpperCase() || "N"}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Edit Profile"
            className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#7C3AED] text-white shadow-md hover:bg-[#6D28D9] transition-transform active:scale-95"
          >
            <Camera className="h-4 w-4" />
          </button>
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            {userName}
          </h2>
          <div className="flex items-center justify-center gap-1.5 mt-1 text-xs text-muted-foreground">
            <span className="font-medium text-[#7C3AED] dark:text-[#A855F7]">Free Plan</span>
            <span>·</span>
            <span>{isCloudAuth ? "Cloud Synced" : "Local Device"}</span>
          </div>
        </div>
      </div>

      {/* Your Stats Card */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span>Your Stats</span>
          <Sparkles className="h-3.5 w-3.5 text-[#7C3AED]" />
        </div>

        <div className="grid grid-cols-2 gap-3 divide-x divide-border">
          <div className="text-center px-2">
            <p className="text-2xl sm:text-3xl font-bold text-foreground font-display">
              {songsPlayedCount}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Songs</p>
          </div>
          <div className="text-center px-2">
            <p className="text-2xl sm:text-3xl font-bold text-foreground font-display">
              {listeningHours}h
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Listening</p>
          </div>
        </div>

        {/* Screen 18: Edit Profile Action Button */}
        <div className="pt-3 mt-3 border-t border-border flex justify-center">
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold text-primary border border-primary/30 hover:bg-primary/10 transition-colors active:scale-95 cursor-pointer"
          >
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      {/* Menu Navigation Items */}
      <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden shadow-xs">
        {menuItems.map(({ id, label, icon: Icon, onClick }) => (
          <button
            key={id}
            type="button"
            onClick={onClick}
            className="flex w-full items-center justify-between p-3.5 sm:p-4 text-left text-sm font-medium text-foreground hover:bg-surface-hover transition-colors active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-4.5 w-4.5" />
              </div>
              <span className="font-medium">{label}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>

      {/* Sign In / Sign Out Button */}
      <div className="pt-2">
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
            className="mm-btn-gradient flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 px-4 text-sm font-semibold shadow-md active:scale-95 cursor-pointer"
          >
            <User className="h-4 w-4" />
            <span>Sign In to MelodyMap</span>
          </button>
        )}
      </div>

      {/* Version badge matching Screen 11 */}
      <div className="flex items-center justify-center gap-2 pt-4 text-xs text-muted-foreground relative z-10">
        <img src="/brand/app-icon.png" alt="MelodyMap" className="h-4 w-4 rounded-md object-contain" />
        <span>Version 1.0.9</span>
      </div>

      {/* Screen 18: Bottom Signature Flowing Wave Ribbon */}
      <MusicWaveBanner variant="bottom" />
    </div>
  );
});
