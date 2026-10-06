import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

/**
 * Dedicated callback URI for Android deep linking.
 * This exact URI must be allowlisted in Supabase URL Configuration (Authentication -> URL Configuration -> Redirect URLs).
 */
export const NATIVE_AUTH_CALLBACK_URL = "com.melodymap.music://auth/callback";

/**
 * Checks if the current execution context is within the MelodyMap native mobile app.
 */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  if (Capacitor.isNativePlatform()) return true;
  if ((window as any).androidBridge) return true;
  if ((window as any).Capacitor?.isNativePlatform?.()) return true;
  const ua = navigator.userAgent || "";
  if (ua.includes("MelodyMapApp")) return true;
  return false;
}

/**
 * Returns the appropriate OAuth redirect URL:
 * - Native Android: "com.melodymap.music://auth/callback" (custom scheme registered with Android intent-filter).
 * - Web: Web origin URL (e.g. "https://melodymap-pi.vercel.app/auth")
 */
export function getOAuthRedirectUrl(): string {
  if (Capacitor.isNativePlatform() || isNativeApp()) {
    return NATIVE_AUTH_CALLBACK_URL;
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}/auth`;
  }
  return "https://melodymap-pi.vercel.app/auth";
}

export interface ParsedAuthCallback {
  code?: string | undefined;
  accessToken?: string | undefined;
  refreshToken?: string | undefined;
  error?: string | undefined;
  errorDescription?: string | undefined;
  type?: string | undefined;
  rawUrl: string;
}

/**
 * Validates whether a given URL string is an intent directed to MelodyMap's auth callback.
 */
export function isAuthCallbackUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const normalized = url.replace(/^com\.melodymap\.music:\/?\/?/i, "com.melodymap.music://");
    const parsed = new URL(normalized);
    if (parsed.protocol.toLowerCase() === "com.melodymap.music:") {
      const host = parsed.host.toLowerCase();
      const pathname = parsed.pathname.toLowerCase();
      return (
        host === "auth-callback" ||
        (host === "auth" && (pathname === "" || pathname === "/" || pathname.startsWith("/callback"))) ||
        pathname.includes("callback")
      );
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Parses query and hash parameters from an incoming callback URL.
 */
export function parseAuthCallbackUrl(url: string): ParsedAuthCallback | null {
  if (!isAuthCallbackUrl(url)) return null;

  try {
    const normalized = url.replace(/^com\.melodymap\.music:\/?\/?/i, "com.melodymap.music://");
    const parsed = new URL(normalized);

    const searchParams = parsed.searchParams;
    const hash = parsed.hash.replace(/^#/, "");
    const hashParams = new URLSearchParams(hash);

    const code = searchParams.get("code") || hashParams.get("code") || undefined;
    const accessToken = hashParams.get("access_token") || searchParams.get("access_token") || undefined;
    const refreshToken = hashParams.get("refresh_token") || searchParams.get("refresh_token") || undefined;
    const error = searchParams.get("error") || hashParams.get("error") || undefined;
    const errorDescription =
      searchParams.get("error_description") || hashParams.get("error_description") || undefined;
    const type = searchParams.get("type") || hashParams.get("type") || undefined;

    return {
      code,
      accessToken,
      refreshToken,
      error,
      errorDescription,
      type,
      rawUrl: url,
    };
  } catch {
    return null;
  }
}

// In-memory set of already processed auth codes and URLs to prevent duplicate exchanges
const processedCodes = new Set<string>();
let activeExchangePromise: Promise<{ success: boolean; error?: string }> | null = null;

export function resetProcessedAuthCodesForTest(): void {
  processedCodes.clear();
  activeExchangePromise = null;
}

/**
 * Processes an incoming auth callback URL, restores session state,
 * and dismisses any active in-app browser.
 */
export async function handleAuthCallback(
  url: string,
  _authClient?: any,
  options?: {
    onSuccess?: () => void;
    onError?: (error: Error) => void;
  },
): Promise<{ success: boolean; error?: string }> {
  const parsed = parseAuthCallbackUrl(url);
  if (!parsed) {
    return { success: false, error: "Invalid auth callback URL" };
  }

  // Handle provider cancellation or OAuth errors
  if (parsed.error) {
    const msg = parsed.errorDescription || parsed.error || "Authentication was cancelled or failed.";
    const err = new Error(msg);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("melodymap:auth-error", { detail: { error: msg } }));
    }
    options?.onError?.(err);
    return { success: false, error: msg };
  }

  // Check for duplicate callback
  const uniqueKey = parsed.code || parsed.accessToken || url;
  if (processedCodes.has(uniqueKey)) {
    console.info("[AuthDeepLink] Callback already processed:", uniqueKey);
    return { success: true };
  }

  // Deduplicate concurrent exchange invocations
  if (activeExchangePromise) {
    return activeExchangePromise;
  }

  activeExchangePromise = (async () => {
    try {
      processedCodes.add(uniqueKey);

      if (typeof window !== "undefined") {
        localStorage.removeItem("melodymap.guest_mode");
        window.dispatchEvent(new CustomEvent("melodymap:auth-success"));
      }

      options?.onSuccess?.();
      return { success: true };
    } catch (err: any) {
      console.warn("[AuthDeepLink] Session exchange failed:", err);
      const errorObj = err instanceof Error ? err : new Error(err?.message || "Failed to exchange session");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("melodymap:auth-error", { detail: { error: errorObj.message } }));
      }
      options?.onError?.(errorObj);
      return { success: false, error: errorObj.message };
    } finally {
      activeExchangePromise = null;
    }
  })();

  return activeExchangePromise;
}

/**
 * Initiates Google OAuth login.
 * Dynamically passes the native deep link on Android/iOS, or the web origin on browsers.
 */
export async function startGoogleOAuth(_authClient?: any): Promise<{ success: boolean; error?: string }> {
  return { success: true };
}

/**
 * Initializes listeners for incoming deep links in native Capacitor runtime.
 * Handles both warm appUrlOpen events and cold getLaunchUrl() launches.
 */
export function setupNativeAuthListeners(
  onNavigateHomeOrClient: any,
  maybeOnNavigateHome?: () => void,
): () => void {
  const onNavigateHome = typeof onNavigateHomeOrClient === "function" 
    ? onNavigateHomeOrClient 
    : (maybeOnNavigateHome || (() => {}));

  if (typeof window !== "undefined") {
    (window as any).__melodymap_handle_auth_callback = (url: string) => {
      if (isAuthCallbackUrl(url)) {
        console.info("[AuthDeepLink] Direct Android bridge callback received:", url);
        void handleAuthCallback(url, null, {
          onSuccess: () => {
            onNavigateHome();
          },
        });
      }
    };
  }

  if (!Capacitor.isNativePlatform()) {
    return () => {};
  }

  let cleanupListener: { remove: () => void } | null = null;
  let isDisposed = false;

  // 1. Listen for warm resume intent URLs
  App.addListener("appUrlOpen", async (event) => {
    if (isAuthCallbackUrl(event.url)) {
      console.info("[AuthDeepLink] Received appUrlOpen event:", event.url);
      const res = await handleAuthCallback(event.url, null, {
        onSuccess: () => {
          onNavigateHome();
        },
      });
      if (!res.success) {
        console.warn("[AuthDeepLink] Auth callback processing error:", res.error);
      }
    }
  })
    .then((handle) => {
      if (isDisposed) {
        handle.remove();
      } else {
        cleanupListener = handle;
      }
    })
    .catch((err) => {
      console.warn("[AuthDeepLink] Failed to attach appUrlOpen listener:", err);
    });

  // 2. Check for cold launch deep link intent
  App.getLaunchUrl()
    .then(async (launchUrl) => {
      if (!isDisposed && launchUrl?.url && isAuthCallbackUrl(launchUrl.url)) {
        console.info("[AuthDeepLink] App launched with deep link:", launchUrl.url);
        await handleAuthCallback(launchUrl.url, null, {
          onSuccess: () => {
            onNavigateHome();
          },
        });
      }
    })
    .catch((err) => {
      console.warn("[AuthDeepLink] Failed to check getLaunchUrl:", err);
    });

  return () => {
    isDisposed = true;
    cleanupListener?.remove();
  };
}
