/**
 * Bandwidth and Network Adaptive Engine for MelodyMap.
 * Supports explicit Low Network Mode (Data Saver) as well as automatic
 * device connection detection (e.g. navigator.connection.saveData / 2G / 3G).
 */

const LOW_NETWORK_KEY = "melodymap.low_network_mode.v1";

/** Checks if the user explicitly enabled Low Network Mode or if the device reports low bandwidth/saveData */
export function isLowNetworkModeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const saved = localStorage.getItem(LOW_NETWORK_KEY);
    if (saved !== null) {
      return saved === "true";
    }
    // Auto-detect browser/network data saver or slow cellular connection
    const nav = navigator as any;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (conn) {
      if (conn.saveData === true) return true;
      if (conn.effectiveType === "slow-2g" || conn.effectiveType === "2g") return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Explicitly toggle Low Network Mode */
export function setLowNetworkMode(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOW_NETWORK_KEY, enabled ? "true" : "false");
    window.dispatchEvent(new CustomEvent("melodymap:network-mode-change", { detail: { enabled } }));
  } catch {
    // ignore quota/security errors
  }
}

/**
 * Optimizes image/thumbnail URLs for reduced data usage.
 * Replaces high-resolution YouTube thumbnails with lightweight medium-quality (mqdefault)
 * or lowers dimensions when in Low Network Mode.
 */
export function getOptimizedThumbnailUrl(originalUrl: string | undefined, isLowNetwork?: boolean): string {
  if (!originalUrl) return "";
  const lowNet = isLowNetwork ?? isLowNetworkModeEnabled();
  if (!lowNet) return originalUrl;

  // YouTube thumbnail optimization:
  // Replace maxresdefault, sddefault, hqdefault with mqdefault (320x180, ~8KB instead of ~150KB)
  if (originalUrl.includes("ytimg.com") || originalUrl.includes("ggpht.com")) {
    return originalUrl
      .replace(/\/maxresdefault(\.jpg|\.webp)?/i, "/mqdefault.jpg")
      .replace(/\/sddefault(\.jpg|\.webp)?/i, "/mqdefault.jpg")
      .replace(/\/hqdefault(\.jpg|\.webp)?/i, "/mqdefault.jpg");
  }

  // Deezer / Audius thumbnail optimization
  if (originalUrl.includes("dzcdn.net") && originalUrl.includes("1000x1000")) {
    return originalUrl.replace("1000x1000", "250x250");
  }

  return originalUrl;
}
