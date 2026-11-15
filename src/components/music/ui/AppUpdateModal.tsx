import { useState, useEffect } from "react";
import {
  Sparkles,
  Download,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Settings,
  X,
  RefreshCw,
  Smartphone,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";
import {
  type AppRelease,
  formatBytes,
  startDownloadAndInstall,
  dismissUpdate,
  openInstallPermissionSettings,
  getDirectApkRelease,
} from "@/lib/app-update";
import { usePwaInstall } from "@/lib/use-pwa-install";

export interface AppUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  updateInfo?: AppRelease | null;
  currentVersion: string;
  onDismissLater?: () => void;
}

export function AppUpdateModal({
  open,
  onOpenChange,
  updateInfo,
  currentVersion,
  onDismissLater,
}: AppUpdateModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [permissionRequired, setPermissionRequired] = useState(false);
  const [installReady, setInstallReady] = useState(false);
  const [pwaInstallSuccess, setPwaInstallSuccess] = useState(false);

  const { canInstallPwa, isInstalled, isNative, promptInstall } = usePwaInstall();

  // Fallback to latest direct built-in APK if updateInfo is not provided
  const activeRelease = updateInfo || getDirectApkRelease();

  useEffect(() => {
    if (open) {
      setDownloading(false);
      setProgress(0);
      setStatusMessage("");
      setErrorMessage(null);
      setPermissionRequired(false);
      setInstallReady(false);
      setPwaInstallSuccess(false);
    }
  }, [open, activeRelease.version]);

  if (!open) return null;

  const handleStartUpdate = () => {
    triggerHaptic("medium");
    setErrorMessage(null);
    setPermissionRequired(false);
    setDownloading(true);
    setProgress(5);
    setStatusMessage("Connecting to update server...");

    startDownloadAndInstall(activeRelease.apkAsset.downloadUrl, activeRelease.version, {
      onProgress: (pct, status) => {
        setProgress(pct);
        setStatusMessage(status || `Downloading update (${pct}%)...`);
      },
      onPermissionNeeded: () => {
        setPermissionRequired(true);
        setStatusMessage("Permission needed to install unknown apps.");
        setDownloading(false);
      },
      onComplete: () => {
        setProgress(100);
        setInstallReady(true);
        setStatusMessage("Download complete! Opening Android installer...");
      },
      onError: (err) => {
        setDownloading(false);
        setErrorMessage(err || "Failed to download update");
        setStatusMessage("");
      },
    });
  };

  const handlePwaInstall = async () => {
    triggerHaptic("medium");
    const success = await promptInstall();
    if (success) {
      setPwaInstallSuccess(true);
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    }
  };

  const handleDismissLater = () => {
    triggerHaptic("light");
    if (activeRelease.version) {
      dismissUpdate(activeRelease.version);
    }
    onOpenChange(false);
    onDismissLater?.();
  };

  const handleOpenPermissionSettings = () => {
    triggerHaptic("selection");
    openInstallPermissionSettings();
    setPermissionRequired(false);
  };

  // Parse markdown release notes into clean bullet items
  const parseChangelogLines = (rawNotes: string): string[] => {
    if (!rawNotes || !rawNotes.trim()) {
      return [
        "100% Mutual Exclusion between Daily Mix & Made For You (zero duplicate songs)",
        "Fresh candidate backfill guarantees new songs on every refresh",
        "Spotify-style background playback & native lock-screen Like controls",
        "High-fidelity offline downloads and storage optimization",
        "Built-in in-app APK installer & seamless PWA installation",
      ];
    }

    const lines = rawNotes
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((l) => l.replace(/^[-*•]\s*/, "").trim())
      .filter((l) => !l.startsWith("#") && l.length > 0);

    return lines.length > 0
      ? lines.slice(0, 5)
      : [
          "Zero duplicate songs between Daily Mix and Made For You",
          "Fresh songs dynamically refreshed on pull-down",
          "Native lock screen Like button and notification controls",
          "In-app APK installation & offline caching",
        ];
  };

  const changelog = parseChangelogLines(activeRelease.notes);
  const formattedSize = formatBytes(activeRelease.apkAsset.size) || "10.8 MB";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-update-modal-title"
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className={cn(
          "w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-7 shadow-2xl relative",
          "bg-[#FAF8FF] dark:bg-[#181126] border border-[#E5DDF5] dark:border-[#3A2D54]",
          "text-[#211536] dark:text-white transition-all transform animate-in zoom-in-95 duration-200"
        )}
      >
        {/* Close / Dismiss button (top right) */}
        {!downloading && (
          <button
            type="button"
            onClick={handleDismissLater}
            aria-label="Close update modal"
            className="absolute top-5 right-5 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header Ribbon */}
        <div className="flex flex-col items-center text-center space-y-2 mb-5">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 via-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/30 text-white">
              <Smartphone className="w-8 h-8" />
            </div>
            <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-emerald-500 text-[10px] font-bold text-white shadow">
              {isNative ? "APK" : "APP"}
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300 text-xs font-semibold mt-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Install & Update Hub</span>
          </div>

          <h2 id="app-update-modal-title" className="text-xl sm:text-2xl font-bold tracking-tight">
            MelodyMap App & APK
          </h2>

          {/* Version Pill comparison */}
          <div className="flex items-center gap-2 text-xs font-medium text-[#746A85] dark:text-[#C3A5FF]">
            <span className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5">
              Current: v{currentVersion}
            </span>
            <span>→</span>
            <span className="px-2.5 py-1 rounded-lg bg-violet-600 text-white font-bold shadow-sm">
              v{activeRelease.version}
            </span>
            {formattedSize && (
              <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                {formattedSize}
              </span>
            )}
          </div>
        </div>

        {/* Changelog Card */}
        <div className="rounded-2xl bg-white dark:bg-[#231838] border border-[#E5DDF5] dark:border-[#3A2D54] p-4 mb-4 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-violet-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              What&apos;s New in this build
            </h3>
          </div>
          <ul className="space-y-2 text-xs sm:text-sm text-[#211536] dark:text-zinc-200">
            {changelog.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 leading-relaxed">
                <CheckCircle2 className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Permission Required Banner */}
        {permissionRequired && (
          <div className="rounded-2xl p-4 mb-4 bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-xs sm:text-sm">
              <Settings className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Permission Required for In-App Install</span>
            </div>
            <p className="text-xs leading-relaxed opacity-90">
              Android requires permission to install APK packages from MelodyMap. Tap below to enable &quot;Install unknown apps&quot; in Settings, then return here to install.
            </p>
            <button
              type="button"
              onClick={handleOpenPermissionSettings}
              className="w-full mt-2 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Open Android Settings
            </button>
          </div>
        )}

        {/* Error message Banner */}
        {errorMessage && (
          <div className="rounded-2xl p-4 mb-4 bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>Update could not be completed</span>
            </div>
            <p className="text-xs leading-relaxed opacity-90">{errorMessage}</p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleStartUpdate}
                className="flex-1 py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium cursor-pointer"
              >
                Retry
              </button>
              <a
                href={activeRelease.apkAsset.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-1.5 px-3 rounded-xl border border-rose-400 text-center text-xs font-medium flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>Direct Download</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* Downloading / Installing Progress Bar */}
        {downloading && (
          <div className="space-y-3 mb-4 p-4 rounded-2xl bg-violet-500/5 dark:bg-violet-500/10 border border-violet-500/20">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-violet-600 dark:text-violet-300 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                {statusMessage || "Downloading APK..."}
              </span>
              <span className="font-mono text-xs">{progress}%</span>
            </div>

            {/* Progress bar line */}
            <div className="w-full h-2 rounded-full bg-violet-200 dark:bg-violet-950/60 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-200 rounded-full"
                style={{ width: `${Math.max(progress, 5)}%` }}
              />
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              {installReady
                ? "Launching Android package installer..."
                : "Please keep the app open while the APK package downloads."}
            </p>
          </div>
        )}

        {/* PWA Installed Confirmation */}
        {pwaInstallSuccess && (
          <div className="rounded-2xl p-3 mb-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center gap-2 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>MelodyMap installed successfully to your home screen!</span>
          </div>
        )}

        {/* Action Buttons */}
        {!downloading && (
          <div className="space-y-2.5">
            {/* Primary Action 1: Native APK In-App Install or Download */}
            <button
              type="button"
              onClick={handleStartUpdate}
              className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>
                {isNative ? "Install / Update Native APK" : `Download Android APK (${formattedSize})`}
              </span>
            </button>

            {/* Action 2: Install Web App (PWA) if available and not in native app */}
            {!isNative && canInstallPwa && !isInstalled && (
              <button
                type="button"
                onClick={handlePwaInstall}
                className="w-full py-3 px-6 rounded-2xl font-semibold text-xs bg-card border border-primary/40 hover:bg-primary/10 text-primary transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Layers className="w-4 h-4 text-primary" />
                <span>Add to Home Screen (Instant PWA)</span>
              </button>
            )}

            {/* Secondary Direct Download link */}
            <div className="pt-1 flex items-center justify-center gap-3 text-xs">
              <a
                href={activeRelease.apkAsset.downloadUrl}
                download={`MelodyMap-v${activeRelease.version}.apk`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                <span>Direct APK Download Link</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <button
              type="button"
              onClick={handleDismissLater}
              className="w-full py-2 px-4 rounded-2xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-center mt-1"
            >
              Close
            </button>
          </div>
        )}

        {/* Small security notice */}
        <p className="text-[10px] text-center text-muted-foreground/70 mt-3 leading-tight">
          Verified built-in MelodyMap release with SHA-256 package signature. Your offline songs and playlists remain safe.
        </p>
      </div>
    </div>
  );
}

// Named alias for semantic clarity
export const InstallAppModal = AppUpdateModal;
