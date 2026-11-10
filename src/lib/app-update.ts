/**
 * MelodyMap In-App Update Engine
 * 
 * Provides:
 * 1. Automatic APK version checking via GitHub Releases.
 * 2. Strict filtering: only triggers update notifications when a successfully built
 *    APK asset (.apk) has been attached to the published release.
 * 3. Native Android installer handoff (Option B): streams download with progress
 *    and directly opens Android's package installer screen.
 * 4. Graceful web/legacy fallback: downloads APK through browser if running outside native bridge.
 * 5. Dismissal/snooze management: prevents nagging user within 24 hours of dismissal.
 */

import { App } from "@capacitor/app";
import { safeStorage } from "@/lib/safe-storage";

export const CURRENT_APP_VERSION = "1.3.9";

const GITHUB_REPO = "Naresh63-hub/MelodyMap";
const GITHUB_RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=10`;

const STORAGE_KEY_DISMISSED = "melodymap_dismissed_update_v1";
const STORAGE_KEY_LAST_CHECK = "melodymap_last_update_check_ts";
const BACKGROUND_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
const DISMISSAL_SNOOZE_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface ReleaseAsset {
  name: string;
  size: number;
  downloadUrl: string;
}

export interface AppRelease {
  version: string; // e.g. "1.4.0"
  tagName: string; // e.g. "v1.4.0"
  name: string; // e.g. "MelodyMap v1.4.0"
  notes: string; // Markdown / text body changelog
  publishedAt: string;
  apkAsset: ReleaseAsset;
}

export interface CheckUpdateResult {
  isUpdateAvailable: boolean;
  currentVersion: string;
  latestRelease: AppRelease | null;
  error?: string;
}

export interface UpdateCallbacks {
  onProgress?: (progress: number, status?: string) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
  onPermissionNeeded?: () => void;
}

declare global {
  interface Window {
    AndroidUpdate?: {
      getInstalledVersion: () => string;
      canRequestPackageInstalls: () => boolean;
      openInstallPermissionSettings: () => void;
      downloadAndInstall: (apkUrl: string, versionName: string) => void;
    };
    __melodymap_update_progress?: (progress: number, status?: string) => void;
    __melodymap_update_complete?: () => void;
    __melodymap_update_error?: (error: string) => void;
    __melodymap_update_permission_needed?: () => void;
  }
}

/**
 * Strips leading 'v', '-release', and extraneous suffixes to extract clean numeric semver.
 */
export function cleanSemver(raw: string): string {
  if (!raw) return "0.0.0";
  const cleaned = (raw.trim().replace(/^v/i, "").split("-")[0] ?? "").trim();
  const parts = cleaned.split(".").map((p) => {
    const num = parseInt(p, 10);
    return isNaN(num) ? 0 : num;
  });
  while (parts.length < 3) parts.push(0);
  return parts.slice(0, 3).join(".");
}

/**
 * Compares two semver strings (e.g. "1.4.0" vs "1.3.8").
 * Returns:
 *   1 if v1 > v2 (v1 is newer)
 *  -1 if v1 < v2 (v2 is newer)
 *   0 if v1 === v2
 */
export function compareSemver(v1: string, v2: string): number {
  const p1 = cleanSemver(v1).split(".").map(Number);
  const p2 = cleanSemver(v2).split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const num1 = p1[i] ?? 0;
    const num2 = p2[i] ?? 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Formats byte count to human-readable string (e.g. "18.4 MB").
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

/**
 * Retrieves the currently running app version:
 * 1. Native Android Update bridge
 * 2. Capacitor App.getInfo()
 * 3. Built-in CURRENT_APP_VERSION constant
 */
export async function getCurrentAppVersion(): Promise<string> {
  try {
    if (typeof window !== "undefined" && window.AndroidUpdate?.getInstalledVersion) {
      const nativeVer = window.AndroidUpdate.getInstalledVersion();
      if (nativeVer) return cleanSemver(nativeVer);
    }
  } catch (ignored) {}

  try {
    const info = await App.getInfo();
    if (info?.version) return cleanSemver(info.version);
  } catch (ignored) {}

  return CURRENT_APP_VERSION;
}

/**
 * Queries GitHub Releases API and finds the latest published release
 * that contains a verified .apk asset.
 * 
 * Strict requirement: Only releases with an attached .apk asset are considered!
 */
export async function fetchLatestApkRelease(): Promise<AppRelease | null> {
  try {
    const response = await fetch(GITHUB_RELEASES_API, {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned HTTP ${response.status}`);
    }

    const releases = (await response.json()) as Array<{
      tag_name: string;
      name?: string;
      body?: string;
      published_at: string;
      draft?: boolean;
      assets?: Array<{
        name: string;
        size: number;
        browser_download_url: string;
        content_type?: string;
      }>;
    }>;

    if (!Array.isArray(releases) || releases.length === 0) {
      return null;
    }

    for (const rel of releases) {
      if (rel.draft) continue;

      const apkAsset = rel.assets?.find((asset) => {
        const name = (asset.name || "").toLowerCase();
        return name.endsWith(".apk") || asset.content_type === "application/vnd.android.package-archive";
      });

      if (apkAsset && apkAsset.browser_download_url) {
        return {
          version: cleanSemver(rel.tag_name),
          tagName: rel.tag_name,
          name: rel.name || rel.tag_name,
          notes: rel.body || "",
          publishedAt: rel.published_at,
          apkAsset: {
            name: apkAsset.name,
            size: apkAsset.size,
            downloadUrl: apkAsset.browser_download_url,
          },
        };
      }
    }

    return null;
  } catch (err) {
    console.warn("[AppUpdate] Failed to fetch latest release from GitHub:", err);
    throw err;
  }
}

/**
 * Checks if a newer release with an APK asset is available.
 * 
 * @param options.force - If true, bypasses 24h snooze and 4h check throttle (used when manually checking in Settings)
 */
export async function checkForAppUpdate(options: { force?: boolean } = {}): Promise<CheckUpdateResult> {
  const currentVersion = await getCurrentAppVersion();

  // If running in background and recently checked, return cached negative result
  if (!options.force) {
    const lastCheckStr = safeStorage.getItem(STORAGE_KEY_LAST_CHECK);
    const lastCheck = lastCheckStr ? parseInt(lastCheckStr, 10) : 0;
    if (Date.now() - lastCheck < BACKGROUND_CHECK_INTERVAL_MS) {
      return { isUpdateAvailable: false, currentVersion, latestRelease: null };
    }
  }

  try {
    const latestRelease = await fetchLatestApkRelease();
    safeStorage.setItem(STORAGE_KEY_LAST_CHECK, String(Date.now()));

    if (!latestRelease) {
      return { isUpdateAvailable: false, currentVersion, latestRelease: null };
    }

    // Check if user dismissed this specific version recently
    if (!options.force) {
      const dismissedRaw = safeStorage.getItem(STORAGE_KEY_DISMISSED);
      if (dismissedRaw) {
        try {
          const dismissed = JSON.parse(dismissedRaw) as { version: string; time: number };
          if (
            dismissed.version === latestRelease.version &&
            Date.now() - dismissed.time < DISMISSAL_SNOOZE_MS
          ) {
            return { isUpdateAvailable: false, currentVersion, latestRelease: null };
          }
        } catch (ignored) {}
      }
    }

    const isNewer = compareSemver(latestRelease.version, currentVersion) > 0;
    return {
      isUpdateAvailable: isNewer,
      currentVersion,
      latestRelease: isNewer ? latestRelease : null,
    };
  } catch (error) {
    return {
      isUpdateAvailable: false,
      currentVersion,
      latestRelease: null,
      error: error instanceof Error ? error.message : "Failed to check for updates",
    };
  }
}

/**
 * Dismisses the update prompt for the specified version (snoozes for 24h).
 */
export function dismissUpdate(version: string): void {
  try {
    safeStorage.setItem(
      STORAGE_KEY_DISMISSED,
      JSON.stringify({ version, time: Date.now() })
    );
  } catch (ignored) {}
}

/**
 * Checks if the app has permission to install unknown APKs (Android 8.0+).
 */
export function canRequestPackageInstalls(): boolean {
  if (typeof window !== "undefined" && window.AndroidUpdate?.canRequestPackageInstalls) {
    return window.AndroidUpdate.canRequestPackageInstalls();
  }
  return true;
}

/**
 * Opens Android system settings to grant "Install unknown apps" permission for MelodyMap.
 */
export function openInstallPermissionSettings(): void {
  if (typeof window !== "undefined" && window.AndroidUpdate?.openInstallPermissionSettings) {
    window.AndroidUpdate.openInstallPermissionSettings();
  }
}

/**
 * Downloads and hands off the APK to Android's native package installer (Option B).
 * 
 * Flow:
 * 1. If running with native AndroidUpdate bridge:
 *    - Downloads APK in background with progress callbacks
 *    - Automatically launches Android's system package installer screen
 * 2. If running on Web or older APK without bridge:
 *    - Gracefully triggers direct APK download via browser
 */
export function startDownloadAndInstall(
  apkUrl: string,
  versionName: string,
  callbacks: UpdateCallbacks = {}
): void {
  if (typeof window === "undefined") return;

  if (window.AndroidUpdate?.downloadAndInstall) {
    // Native Option B flow
    window.__melodymap_update_progress = (progress, status) => {
      callbacks.onProgress?.(progress, status);
    };

    window.__melodymap_update_complete = () => {
      callbacks.onComplete?.();
    };

    window.__melodymap_update_permission_needed = () => {
      callbacks.onPermissionNeeded?.();
    };

    window.__melodymap_update_error = (error) => {
      callbacks.onError?.(error);
    };

    window.AndroidUpdate.downloadAndInstall(apkUrl, versionName);
  } else {
    // Web / Legacy fallback flow
    callbacks.onProgress?.(50, "Downloading update...");
    try {
      const link = document.createElement("a");
      link.href = apkUrl;
      link.download = `MelodyMap-${versionName}.apk`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        callbacks.onProgress?.(100, "Download started");
        callbacks.onComplete?.();
      }, 1000);
    } catch (err) {
      callbacks.onError?.(err instanceof Error ? err.message : "Failed to start download");
    }
  }
}
