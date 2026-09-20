import { useState, useRef, useEffect } from "react";
import {
  Sliders,
  Sparkles,
  Volume2,
  Clock,
  Keyboard,
  ShieldCheck,
  User,
  LogOut,
  X,
  Download,
  Upload,
  Globe2,
  CheckCircle2,
  AlertCircle,
  Camera,
  KeyRound,
  Check,
  Loader2,
  Sparkle,
  HardDrive,
  Copy,
  ChevronRight,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RecSettingsPanel } from "@/components/music/RecSettingsPanel";
import { LanguageArtistPicker } from "@/components/music/ui/LanguageArtistPicker";
import {
  exportLibraryData,
  importLibraryData,
  type RecSettings,
} from "@/lib/library";
import {
  getSponsorBlockEnabled,
  setSponsorBlockEnabled,
} from "@/lib/sponsorblock";
import type { Profile } from "@/lib/auth";
import { cn } from "@/lib/utils";

const PRESET_AVATARS = [
  { id: "cyber-dj", label: "Cyber DJ", url: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=160&auto=format&fit=crop&q=80" },
  { id: "vinyl-lover", label: "Vinyl Lover", url: "https://images.unsplash.com/photo-1539185441755-769473a23570?w=160&auto=format&fit=crop&q=80" },
  { id: "neon-beats", label: "Neon Beats", url: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=160&auto=format&fit=crop&q=80" },
  { id: "acoustic-soul", label: "Acoustic", url: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=160&auto=format&fit=crop&q=80" },
  { id: "synth-wave", label: "Synthwave", url: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=160&auto=format&fit=crop&q=80" },
  { id: "headphones", label: "Chill Vibes", url: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=160&auto=format&fit=crop&q=80" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: RecSettings;
  onUpdateSettings: (patch: Partial<RecSettings>) => void;
  onResetSettings: () => void;
  onApplyRecs: () => void;
  recLoading: boolean;
  onOpenLanguages: () => void;
  continuous: boolean;
  onContinuousChange: (v: boolean) => void;
  onOpenEqualizer?: () => void;
  onOpenSleepTimer?: () => void;
  onOpenShortcuts?: () => void;
  userId?: string | null;
  userEmail?: string | null;
  userProfile?: Profile | null;
  onUpdateProfile?: (patch: { display_name?: string; avatar_url?: string }) => Promise<{ success: boolean; error?: string } | void>;
  onUpdatePassword?: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  onSignOut?: () => Promise<void>;
  onLibraryRestored?: () => void;
};

export function SettingsModal({
  open,
  onOpenChange,
  settings,
  onUpdateSettings,
  onResetSettings,
  onApplyRecs,
  recLoading,
  onOpenLanguages,
  continuous,
  onContinuousChange,
  onOpenEqualizer,
  onOpenSleepTimer,
  onOpenShortcuts,
  userId,
  userEmail,
  userProfile,
  onUpdateProfile,
  onUpdatePassword,
  onSignOut,
  onLibraryRestored,
}: Props) {
  const [activeSection, setActiveSection] = useState<"account" | "languages" | "picks" | "playback">("account");
  const [sponsorBlockOn, setSponsorBlockOn] = useState<boolean>(getSponsorBlockEnabled);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Profile Edit State
  const [displayName, setDisplayName] = useState(userProfile?.display_name || "");
  const [avatarUrl, setAvatarUrl] = useState(userProfile?.avatar_url || "");
  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Password Change State
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Synchronize initial profile values when userProfile changes
  useEffect(() => {
    if (userProfile) {
      if (userProfile.display_name) setDisplayName(userProfile.display_name);
      if (userProfile.avatar_url) setAvatarUrl(userProfile.avatar_url);
    } else if (userEmail) {
      setDisplayName((prev) => prev || userEmail.split("@")[0] || "");
    }
  }, [userProfile, userEmail]);

  const handleToggleSponsorBlock = (val: boolean) => {
    setSponsorBlockOn(val);
    setSponsorBlockEnabled(val);
  };

  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      setProfileFeedback({ type: "error", msg: "Display name cannot be empty." });
      return;
    }
    setProfileSaving(true);
    setProfileFeedback(null);
    try {
      const trimmedAvatar = avatarUrl.trim();
      const res = await onUpdateProfile?.({
        display_name: displayName.trim(),
        ...(trimmedAvatar ? { avatar_url: trimmedAvatar } : {}),
      });
      setProfileSaving(false);
      if (res && !res.success) {
        setProfileFeedback({ type: "error", msg: res.error || "Failed to update profile." });
      } else {
        setProfileFeedback({ type: "success", msg: "Profile details updated successfully!" });
        setTimeout(() => setProfileFeedback(null), 3500);
      }
    } catch (err: any) {
      setProfileSaving(false);
      setProfileFeedback({ type: "error", msg: err?.message || "Error updating profile." });
    }
  };

  const handleSavePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setPasswordFeedback({ type: "error", msg: "Password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: "error", msg: "Passwords do not match." });
      return;
    }
    setPasswordSaving(true);
    setPasswordFeedback(null);
    try {
      const res = await onUpdatePassword?.(newPassword);
      setPasswordSaving(false);
      if (res && !res.success) {
        setPasswordFeedback({ type: "error", msg: res.error || "Failed to update password." });
      } else {
        setPasswordFeedback({ type: "success", msg: "Password changed successfully!" });
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          setPasswordFeedback(null);
          setIsChangingPassword(false);
        }, 2500);
      }
    } catch (err: any) {
      setPasswordSaving(false);
      setPasswordFeedback({ type: "error", msg: err?.message || "Failed to change password." });
    }
  };

  const handleExportBackup = () => {
    try {
      const data = exportLibraryData();
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `melodymap-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupStatus("Backup downloaded successfully!");
      setTimeout(() => setBackupStatus(null), 4000);
    } catch {
      setBackupStatus("Failed to create backup.");
      setTimeout(() => setBackupStatus(null), 4000);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") {
        const res = importLibraryData(text);
        if (res.success) {
          setBackupStatus("Library restored! Updating state...");
          setTimeout(() => {
            if (onLibraryRestored) {
              onLibraryRestored();
            } else {
              window.location.reload();
            }
          }, 800);
        } else {
          setBackupStatus(`Import failed: ${res.error || "Unknown error"}`);
          setTimeout(() => setBackupStatus(null), 5000);
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border-white/10 bg-[#0c0a15]/95 p-0 text-white backdrop-blur-3xl shadow-2xl rounded-3xl scrollbar-hide">
        {/* Header - Native App Style */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.08] bg-[#0c0a15]/90 px-6 py-4 backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-pink-500 via-purple-600 to-indigo-600 shadow-lg shadow-purple-500/20">
              <Sliders className="h-4 w-4 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white tracking-tight">Settings &amp; Profile</DialogTitle>
              <p className="text-[11px] text-purple-200/50">Personalize identity, recommendations, audio &amp; cloud sync</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close Settings"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.04] text-white/50 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Section Navigation Pills */}
        <div className="flex border-b border-white/[0.06] bg-white/[0.02] px-6 py-2.5 gap-2 overflow-x-auto scrollbar-hide">
          <button
            type="button"
            onClick={() => setActiveSection("account")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all shrink-0 cursor-pointer",
              activeSection === "account"
                ? "bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-white border border-purple-500/30 shadow-sm"
                : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
            )}
          >
            <User className="h-3.5 w-3.5 text-pink-400" />
            Profile &amp; Account
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("languages")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all shrink-0 cursor-pointer",
              activeSection === "languages"
                ? "bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-white border border-purple-500/30 shadow-sm"
                : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
            )}
          >
            <Globe2 className="h-3.5 w-3.5 text-cyan-400" />
            Languages &amp; Artists
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("picks")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all shrink-0 cursor-pointer",
              activeSection === "picks"
                ? "bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-white border border-purple-500/30 shadow-sm"
                : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
            )}
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            AI Taste Picks
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("playback")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all shrink-0 cursor-pointer",
              activeSection === "playback"
                ? "bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-white border border-purple-500/30 shadow-sm"
                : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
            )}
          >
            <Volume2 className="h-3.5 w-3.5 text-purple-400" />
            Playback &amp; Hardware
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-6">
          {/* 1. PROFILE & ACCOUNT SECTION */}
          {activeSection === "account" && (
            <div className="space-y-5">
              {/* Profile Card */}
              <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6 space-y-5 shadow-lg backdrop-blur-md">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
                  {/* Glowing Avatar with Edit Overlay */}
                  <div className="relative group shrink-0">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-pink-500 via-purple-600 to-indigo-600 text-2xl font-bold text-white shadow-xl shadow-purple-500/25 ring-4 ring-white/10 overflow-hidden">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="Avatar"
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <span>
                          {displayName?.[0]?.toUpperCase() || userEmail?.[0]?.toUpperCase() || "M"}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEditingAvatar((v) => !v)}
                      aria-label="Change avatar"
                      className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-purple-600 text-white shadow-md hover:bg-purple-500 transition-colors cursor-pointer ring-2 ring-[#0c0a15]"
                    >
                      <Camera className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Profile Details & Inline Name Edit */}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
                        {userId ? "MelodyMap Listener" : "Guest Listener"}
                      </span>
                      <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                        <ShieldCheck className="h-3 w-3" />
                        <span>{userId ? "Cloud Synced" : "Local Device"}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="displayNameInput" className="text-[11px] text-white/50 font-medium">
                        Display Name
                      </Label>
                      <div className="flex items-center gap-2 max-w-md">
                        <Input
                          id="displayNameInput"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          maxLength={50}
                          placeholder="Your display name"
                          className="h-9 rounded-xl border-white/10 bg-white/[0.04] px-3 text-xs text-white placeholder:text-white/30 focus:border-purple-500/50"
                        />
                        <Button
                          size="sm"
                          disabled={profileSaving}
                          onClick={handleSaveProfile}
                          className="h-9 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-xs font-semibold text-white hover:brightness-110 shadow-md shrink-0 cursor-pointer"
                        >
                          {profileSaving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <Check className="mr-1 h-3.5 w-3.5" /> Save
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <p className="text-[11px] text-white/40 truncate">
                      {userEmail || "Signed in locally (guest mode). Your playlists & favorites stay on this device."}
                    </p>
                  </div>
                </div>

                {/* Avatar Picker Accordion */}
                {isEditingAvatar && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-white">Choose a Music Avatar Persona</h4>
                      <button
                        type="button"
                        onClick={() => setIsEditingAvatar(false)}
                        className="text-[11px] text-white/40 hover:text-white"
                      >
                        Done
                      </button>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                      {PRESET_AVATARS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setAvatarUrl(p.url);
                          }}
                          className={cn(
                            "flex flex-col items-center gap-1.5 rounded-xl p-2 border transition-all cursor-pointer",
                            avatarUrl === p.url
                              ? "border-purple-500 bg-purple-500/20 shadow-md ring-2 ring-purple-500/30"
                              : "border-white/5 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]"
                          )}
                        >
                          <img
                            src={p.url}
                            alt={p.label}
                            className="h-10 w-10 rounded-full object-cover shadow-sm"
                          />
                          <span className="text-[10px] text-white/70 truncate w-full text-center">{p.label}</span>
                        </button>
                      ))}
                    </div>

                    <div className="pt-2 space-y-1">
                      <Label htmlFor="customAvatarInput" className="text-[10px] text-white/40">
                        Or paste image URL:
                      </Label>
                      <Input
                        id="customAvatarInput"
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        placeholder="https://example.com/avatar.jpg"
                        className="h-8 rounded-lg border-white/10 bg-white/[0.02] text-xs text-white placeholder:text-white/20"
                      />
                    </div>
                  </div>
                )}

                {/* Profile Feedback Toast */}
                {profileFeedback && (
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-xl p-3 text-xs animate-in fade-in",
                      profileFeedback.type === "success"
                        ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border border-rose-500/30 bg-rose-500/10 text-rose-300"
                    )}
                  >
                    {profileFeedback.type === "success" ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                    )}
                    <span>{profileFeedback.msg}</span>
                  </div>
                )}
              </div>

              {/* Password & Security Card (For Logged-in Users) */}
              {userId && (
                <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5 space-y-4 shadow-lg backdrop-blur-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/20 text-purple-300">
                        <KeyRound className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">Password &amp; Security</h4>
                        <p className="text-xs text-white/40">Update your account login password</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsChangingPassword((v) => !v)}
                      className="rounded-xl border-white/10 bg-white/[0.04] text-xs text-white/80 hover:bg-white/10 cursor-pointer"
                    >
                      {isChangingPassword ? "Cancel" : "Change Password"}
                    </Button>
                  </div>

                  {isChangingPassword && (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3 animate-in fade-in">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="newPassInput" className="text-xs text-white/60">New Password</Label>
                          <Input
                            id="newPassInput"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="At least 6 characters"
                            className="h-9 rounded-xl border-white/10 bg-white/[0.04] text-xs text-white placeholder:text-white/30"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="confirmPassInput" className="text-xs text-white/60">Confirm New Password</Label>
                          <Input
                            id="confirmPassInput"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-type password"
                            className="h-9 rounded-xl border-white/10 bg-white/[0.04] text-xs text-white placeholder:text-white/30"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          size="sm"
                          disabled={passwordSaving}
                          onClick={handleSavePassword}
                          className="h-9 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-xs font-semibold text-white hover:brightness-110 shadow-md cursor-pointer"
                        >
                          {passwordSaving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            "Update Password"
                          )}
                        </Button>
                      </div>

                      {passwordFeedback && (
                        <div
                          className={cn(
                            "flex items-center gap-2 rounded-xl p-2.5 text-xs animate-in fade-in",
                            passwordFeedback.type === "success"
                              ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : "border border-rose-500/30 bg-rose-500/10 text-rose-300"
                          )}
                        >
                          {passwordFeedback.type === "success" ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                          ) : (
                            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                          )}
                          <span>{passwordFeedback.msg}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Library Backup & Restore Card */}
              <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5 space-y-4 shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-300">
                    <HardDrive className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Library Backup &amp; Portability</h4>
                    <p className="text-xs text-white/40">1-Click export and import of all playlists, likes, and history</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportBackup}
                    className="rounded-xl border-purple-500/30 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20 text-xs font-medium cursor-pointer"
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Export Library JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/10 text-xs font-medium cursor-pointer"
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    Import Backup JSON
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                </div>

                {backupStatus && (
                  <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3.5 py-2 text-xs text-purple-300 animate-in fade-in">
                    {backupStatus.includes("fail") ? (
                      <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    )}
                    <span>{backupStatus}</span>
                  </div>
                )}
              </div>

              {/* Footer Session Action */}
              <div className="flex items-center justify-between pt-2 px-1">
                <span className="text-xs text-white/30 font-mono">MelodyMap Native v2.0</span>
                {userId && onSignOut ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      void onSignOut();
                    }}
                    className="rounded-full text-xs font-semibold px-4 cursor-pointer shadow-md"
                  >
                    <LogOut className="mr-1.5 h-3.5 w-3.5" />
                    Sign Out
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      if (typeof window !== "undefined") {
                        window.location.href = "/auth";
                      }
                    }}
                    className="rounded-full bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 text-xs font-semibold text-white shadow-lg shadow-purple-500/20 hover:brightness-110 cursor-pointer"
                  >
                    Sign In / Sync Account
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* 2. LANGUAGES & ARTISTS SECTION */}
          {activeSection === "languages" && (
            <div className="space-y-4">
              <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6 space-y-4 shadow-lg backdrop-blur-md">
                <div>
                  <h3 className="text-sm font-semibold text-white">Song Languages &amp; Favorite Artists</h3>
                  <p className="text-xs text-white/40 mt-0.5">
                    Select the languages and artists you listen to. MelodyMap customizes your daily mixes, charts, and recommendations based on these preferences.
                  </p>
                </div>

                <div className="h-px bg-white/[0.06]" />

                <LanguageArtistPicker
                  languages={settings.languages}
                  artists={settings.artists}
                  onChange={(patch) => onUpdateSettings(patch)}
                  actionLabel="Open Full Languages Tab"
                  onAction={() => {
                    onOpenChange(false);
                    onOpenLanguages();
                  }}
                />

                <div className="h-px bg-white/[0.06]" />

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <span className="text-[11px] text-white/40">
                    {settings.languages.length} language(s), {settings.artists.length} artist(s) selected
                  </span>
                  <Button
                    size="sm"
                    onClick={() => {
                      onApplyRecs();
                      onOpenChange(false);
                    }}
                    className="rounded-xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 text-xs font-semibold text-white shadow-md hover:brightness-110 cursor-pointer"
                  >
                    Apply &amp; Refresh Picks
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 3. AI PICKS SECTION */}
          {activeSection === "picks" && (
            <div className="space-y-4">
              <RecSettingsPanel
                settings={settings}
                onChange={onUpdateSettings}
                onReset={onResetSettings}
                onApply={() => {
                  onApplyRecs();
                  onOpenChange(false);
                }}
                loading={recLoading}
                onOpenLanguages={() => {
                  onOpenChange(false);
                  onOpenLanguages();
                }}
              />
            </div>
          )}

          {/* 4. AUDIO & PLAYBACK HARDWARE SECTION */}
          {activeSection === "playback" && (
            <div className="space-y-4">
              <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6 space-y-5 shadow-lg backdrop-blur-md">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Continuous Queue Auto-Play</h3>
                    <p className="text-xs text-white/40 mt-0.5">
                      Automatically queue and stream similar songs when current playback concludes
                    </p>
                  </div>
                  <Switch checked={continuous} onCheckedChange={onContinuousChange} />
                </div>

                <div className="h-px bg-white/[0.06]" />

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white">SponsorBlock Auto-Skip</h3>
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                        Pro
                      </span>
                    </div>
                    <p className="text-xs text-white/40 mt-0.5">
                      Automatically bypass intros, sponsorship pitches, and silent outros in YouTube streams &amp; podcasts
                    </p>
                  </div>
                  <Switch checked={sponsorBlockOn} onCheckedChange={handleToggleSponsorBlock} />
                </div>

                <div className="h-px bg-white/[0.06]" />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">10-Band Hardware Equalizer &amp; Crossfader</h3>
                    <p className="text-xs text-white/40 mt-0.5">
                      Fine-tune 32Hz–16kHz frequencies, loudness compression &amp; seamless crossfade
                    </p>
                  </div>
                  {onOpenEqualizer && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onOpenChange(false);
                        onOpenEqualizer();
                      }}
                      className="rounded-xl border-purple-500/30 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20 text-xs font-semibold cursor-pointer"
                    >
                      <Sliders className="mr-1.5 h-3.5 w-3.5" />
                      Open Equalizer
                    </Button>
                  )}
                </div>

                <div className="h-px bg-white/[0.06]" />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Sleep Timer</h3>
                    <p className="text-xs text-white/40 mt-0.5">
                      Schedule music to fade out gently after a preset duration
                    </p>
                  </div>
                  {onOpenSleepTimer && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onOpenChange(false);
                        onOpenSleepTimer();
                      }}
                      className="rounded-xl border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/10 text-xs cursor-pointer"
                    >
                      <Clock className="mr-1.5 h-3.5 w-3.5" />
                      Set Sleep Timer
                    </Button>
                  )}
                </div>

                <div className="h-px bg-white/[0.06]" />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Keyboard Shortcuts</h3>
                    <p className="text-xs text-white/40 mt-0.5">
                      View hotkeys for playback, scrub, volume, and queue navigation
                    </p>
                  </div>
                  {onOpenShortcuts && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onOpenChange(false);
                        onOpenShortcuts();
                      }}
                      className="rounded-xl border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/10 text-xs cursor-pointer"
                    >
                      <Keyboard className="mr-1.5 h-3.5 w-3.5" />
                      View Hotkeys
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
