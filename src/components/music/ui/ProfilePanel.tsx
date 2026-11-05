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
  User,
} from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import { MusicWaveBanner } from "./MusicWaveBanner";
import type { NavTab } from "../layout/Sidebar";

interface ProfilePanelProps {
  userName?: string | undefined;
  userEmail?: string | null | undefined;
  userAvatar?: string | null | undefined;
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
  userAvatar,
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
    <div className="flex-1 overflow-y-auto px-3.5 py-5 sm:px-6 lg:px-8 space-y-5 sm:space-y-6 pb-28 max-w-2xl mx-auto w-full animate-fade-in relative">
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
            aria-label="Edit Profile Photo"
            className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#7C3AED] text-white shadow-md hover:bg-[#6D28D9] transition-transform active:scale-95 cursor-pointer"
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

          {/* Edit Profile Action Button placed cleanly below account status */}
          <div className="mt-3.5 flex justify-center">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                onOpenSettings();
              }}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2 min-h-[38px] rounded-full text-xs font-semibold text-primary bg-card hover:bg-surface-hover border border-primary/25 hover:border-primary/50 shadow-xs hover:shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <span>Edit Profile</span>
            </button>
          </div>
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

      {/* Version badge */}
      <div className="flex items-center justify-center gap-2 pt-4 text-xs text-muted-foreground relative z-10">
        <img src="/brand/app-icon.png" alt="MelodyMap" className="h-4 w-4 rounded-md object-contain" />
        <span>Version 1.0.9</span>
      </div>

      {/* Bottom Signature Flowing Wave Ribbon */}
      <MusicWaveBanner variant="bottom" />
    </div>
  );
});
