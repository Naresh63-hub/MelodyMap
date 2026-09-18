import { useState, useRef } from "react";
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
  FastForward,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
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
  onSignOut,
  onLibraryRestored,
}: Props) {
  const [activeSection, setActiveSection] = useState<"languages" | "picks" | "playback" | "account">("languages");
  const [sponsorBlockOn, setSponsorBlockOn] = useState<boolean>(getSponsorBlockEnabled);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleToggleSponsorBlock = (val: boolean) => {
    setSponsorBlockOn(val);
    setSponsorBlockEnabled(val);
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
      <DialogContent className="max-h-[88vh] w-full max-w-2xl overflow-y-auto border-white/10 bg-[#0d0d17]/95 p-0 text-white backdrop-blur-2xl shadow-2xl rounded-2xl scrollbar-hide">
        {/* Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-[#0d0d17]/90 px-6 py-4 backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 shadow-md">
              <Sliders className="h-4 w-4 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">Settings &amp; Preferences</DialogTitle>
              <p className="text-[11px] text-white/40">Customize song languages, AI recommendations, playback, and account</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex border-b border-white/[0.06] bg-white/[0.02] px-6 py-2 gap-2 overflow-x-auto scrollbar-hide">
          <button
            type="button"
            onClick={() => setActiveSection("languages")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all shrink-0",
              activeSection === "languages"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
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
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all shrink-0",
              activeSection === "picks"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
            )}
          >
            <Sparkles className="h-3.5 w-3.5 text-pink-400" />
            Tune AI Picks
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("playback")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all shrink-0",
              activeSection === "playback"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
            )}
          >
            <Volume2 className="h-3.5 w-3.5 text-purple-400" />
            Audio &amp; Playback
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("account")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all shrink-0",
              activeSection === "account"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
            )}
          >
            <User className="h-3.5 w-3.5 text-emerald-400" />
            Account &amp; Backup
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-6">
          {activeSection === "languages" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Song Languages &amp; Favorite Artists</h3>
                  <p className="text-xs text-white/40 mt-0.5">
                    Customize the languages you listen to and the artists you love. MelodyMap personalizes all mixes, charts, and recommendations based on these preferences.
                  </p>
                </div>

                <div className="h-px bg-white/[0.06]" />

                <LanguageArtistPicker
                  languages={settings.languages}
                  artists={settings.artists}
                  onChange={(patch) => onUpdateSettings(patch)}
                  actionLabel="Open Languages Tab"
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
                    className="rounded-xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 text-xs font-semibold text-white shadow-md hover:brightness-110"
                  >
                    Apply &amp; Refresh Picks
                  </Button>
                </div>
              </div>
            </div>
          )}
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

          {activeSection === "playback" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5 space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Continuous Auto-Play</h3>
                    <p className="text-xs text-white/40 mt-0.5">
                      Automatically start similar songs when current queue ends
                    </p>
                  </div>
                  <Switch checked={continuous} onCheckedChange={onContinuousChange} />
                </div>

                <div className="h-px bg-white/[0.06]" />

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white">SponsorBlock Auto-Skip</h3>
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                        Pro
                      </span>
                    </div>
                    <p className="text-xs text-white/40 mt-0.5">
                      Automatically skip intros, non-music sponsor segments, and outros in videos & podcasts
                    </p>
                  </div>
                  <Switch checked={sponsorBlockOn} onCheckedChange={handleToggleSponsorBlock} />
                </div>

                <div className="h-px bg-white/[0.06]" />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Audio Equalizer & Crossfader</h3>
                    <p className="text-xs text-white/40 mt-0.5">
                      10-band hardware EQ, loudness compressor & equal-power crossfading
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
                      className="rounded-full border-purple-500/30 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20"
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
                      Automatically fade out and pause music after specified duration
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
                      className="rounded-full border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/10"
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
                      View hotkeys for playback, navigation, and queue controls
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
                      className="rounded-full border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/10"
                    >
                      <Keyboard className="mr-1.5 h-3.5 w-3.5" />
                      View Shortcuts
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeSection === "account" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-base font-bold text-white shadow-md">
                    {userProfile?.avatar_url ? (
                      <img
                        src={userProfile.avatar_url}
                        alt=""
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      userProfile?.display_name?.[0]?.toUpperCase() ?? userEmail?.[0]?.toUpperCase() ?? "L"
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-white">
                      {userProfile?.display_name || userEmail?.split("@")[0] || "Guest Listener"}
                    </h3>
                    <p className="text-xs text-white/40 truncate">
                      {userEmail || "Local session (data saved on this device)"}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-400">
                      <ShieldCheck className="h-3 w-3" />
                      <span>{userId ? "Synced to cloud database" : "Local-first storage active"}</span>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-white/[0.06]" />

                {/* 1-Click Library JSON Backup & Restore */}
                <div className="space-y-3 pt-1">
                  <div>
                    <h3 className="text-sm font-semibold text-white">1-Click Library Backup & Restore</h3>
                    <p className="text-xs text-white/40 mt-0.5">
                      Export all your playlists, liked tracks, listening history, and algorithm preferences as a JSON file.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2.5 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportBackup}
                      className="rounded-xl border-purple-500/30 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20 text-xs"
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Export Library JSON
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/10 text-xs"
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
                    <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs text-purple-300">
                      {backupStatus.includes("fail") ? (
                        <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      )}
                      <span>{backupStatus}</span>
                    </div>
                  )}
                </div>

                <div className="h-px bg-white/[0.06]" />

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-white/40">MelodyMap Personal Edition v1.2</span>
                  {userId && onSignOut ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        onOpenChange(false);
                        void onSignOut();
                      }}
                      className="rounded-full text-xs font-semibold"
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
                      className="rounded-full bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 text-xs font-semibold text-white shadow-md hover:brightness-110"
                    >
                      Sign In to Cloud Sync
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

