import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { supabase } from "./supabase";
import { safeStorage } from "./safe-storage";

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
  tokenHash?: string | undefined;
  accessToken?: string | undefined;
  refreshToken?: string | undefined;
  error?: string | undefined;
  errorCode?: string | undefined;
  errorDescription?: string | undefined;
  type?: string | undefined;
  rawUrl: string;
}

/**
 * Validates whether a given URL string is an intent directed to MelodyMap's auth callback.
 * Supports both custom scheme (Android) and web callback URLs with tokens/codes/errors.
 */
export function isAuthCallbackUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const normalized = url.replace(/^com\.melodymap\.music:\/?\/?/i, "com.melodymap.music://");
    const parsed = new URL(normalized);

    // 1. Android custom scheme
    if (parsed.protocol.toLowerCase() === "com.melodymap.music:") {
      const host = parsed.host.toLowerCase();
      const pathname = parsed.pathname.toLowerCase();
      return (
        host === "auth-callback" ||
        (host === "auth" && (pathname === "" || pathname === "/" || pathname.startsWith("/callback"))) ||
        pathname.includes("callback")
      );
    }

    // 2. Query search parameters
    const sp = parsed.searchParams;
    if (
      sp.has("code") ||
      sp.has("token_hash") ||
      sp.has("error") ||
      sp.has("error_code") ||
      sp.has("error_description")
    ) {
      return true;
    }

    // 3. Hash fragment parameters
    if (parsed.hash && parsed.hash.length > 1) {
      const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
      if (
        hashParams.has("access_token") ||
        hashParams.has("code") ||
        hashParams.has("error") ||
        hashParams.has("error_code") ||
        hashParams.has("error_description") ||
        hashParams.has("token_hash")
      ) {
        return true;
      }
    }

    // 4. Explicit callback path
    const pathname = parsed.pathname.toLowerCase();
    if (pathname === "/auth/callback" || pathname.endsWith("/auth/callback")) {
      return true;
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
    const tokenHash = searchParams.get("token_hash") || hashParams.get("token_hash") || undefined;
    const accessToken = hashParams.get("access_token") || searchParams.get("access_token") || undefined;
    const refreshToken = hashParams.get("refresh_token") || searchParams.get("refresh_token") || undefined;
    const error = searchParams.get("error") || hashParams.get("error") || undefined;
    const errorCode = searchParams.get("error_code") || hashParams.get("error_code") || undefined;
    const errorDescription =
      searchParams.get("error_description") || hashParams.get("error_description") || undefined;
    const type = searchParams.get("type") || hashParams.get("type") || undefined;

    return {
      code,
      tokenHash,
      accessToken,
      refreshToken,
      error,
      errorCode,
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
 * Formats auth errors into user-friendly messages avoiding raw internal exceptions.
 */
export function formatCallbackError(error?: string, errorCode?: string, description?: string): string {
  const code = (errorCode || "").toLowerCase();
  const desc = (description || error || "").toLowerCase();

  if (
    code === "otp_expired" ||
    desc.includes("expired") ||
    desc.includes("invalid or has expired") ||
    desc.includes("token has expired")
  ) {
    return "Your verification link has expired. Request a new one.";
  }

  if (description) {
    return description;
  }

  if (
    code === "access_denied" ||
    desc.includes("access_denied") ||
    desc.includes("cancelled") ||
    desc.includes("user cancelled")
  ) {
    return "We couldn't complete sign-in. Please try again.";
  }

  if (desc.includes("storage") || desc.includes("localstorage") || desc.includes("access is denied")) {
    return "Your browser is restricting storage. Open MelodyMap in your regular browser to continue.";
  }

  return error || "We couldn't complete sign-in. Please try again.";
}

/**
 * Processes an incoming auth callback URL, restores session state,
 * cleans URL parameters, and dismisses any active in-app browser.
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
  if (parsed.error || parsed.errorCode) {
    const msg = formatCallbackError(parsed.error, parsed.errorCode, parsed.errorDescription);
    const err = new Error(msg);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("melodymap:auth-error", { detail: { error: msg, code: parsed.errorCode } }),
      );
    }
    options?.onError?.(err);
    return { success: false, error: msg };
  }

  // Check for duplicate callback
  const uniqueKey = parsed.code || parsed.tokenHash || parsed.accessToken || url;
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
      const client = _authClient || supabase;
      if (client?.auth) {
        if (parsed.tokenHash) {
          // Supabase email verifyOtp flow
          const verifyType = (parsed.type as any) || "signup";
          const { error } = await client.auth.verifyOtp({
            token_hash: parsed.tokenHash,
            type: verifyType,
          });

          if (error) {
            console.warn("[AuthDeepLink] verifyOtp error:", error.message);
            const friendly = formatCallbackError(error.message, undefined, error.message);
            const errObj = new Error(friendly);
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("melodymap:auth-error", { detail: { error: friendly } }));
            }
            options?.onError?.(errObj);
            return { success: false, error: friendly };
          }
        } else if (parsed.code) {
          // PKCE code exchange
          const { error } = await client.auth.exchangeCodeForSession(parsed.code);
          if (error) {
            console.warn("[AuthDeepLink] exchangeCodeForSession notice:", error.message);
          }
        } else if (parsed.accessToken && parsed.refreshToken) {
          // Direct token session setup
          const { error } = await client.auth.setSession({
            access_token: parsed.accessToken,
            refresh_token: parsed.refreshToken,
          });
          if (error) {
            console.warn("[AuthDeepLink] setSession notice:", error.message);
          }
        }
      }

      processedCodes.add(uniqueKey);

      safeStorage.removeItem("melodymap.guest_mode");
      if (typeof window !== "undefined") {
        // Clean query/hash parameters from URL without reloading
        try {
          const currentUrl = new URL(window.location.href);
          let cleaned = false;
          ["code", "token_hash", "error", "error_code", "error_description", "type"].forEach((k) => {
            if (currentUrl.searchParams.has(k)) {
              currentUrl.searchParams.delete(k);
              cleaned = true;
            }
          });
          if (currentUrl.hash && (currentUrl.hash.includes("access_token") || currentUrl.hash.includes("error"))) {
            currentUrl.hash = "";
            cleaned = true;
          }
          if (cleaned) {
            window.history.replaceState(null, "", currentUrl.toString());
          }
        } catch {}

        window.dispatchEvent(new CustomEvent("melodymap:auth-success"));
      }

      options?.onSuccess?.();
      return { success: true };
    } catch (err: any) {
      console.warn("[AuthDeepLink] Session exchange failed:", err);
      const friendly = formatCallbackError(err?.message);
      const errorObj = new Error(friendly);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("melodymap:auth-error", { detail: { error: friendly } }));
      }
      options?.onError?.(errorObj);
      return { success: false, error: friendly };
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
export async function startGoogleOAuth(authClient?: any): Promise<{ success: boolean; error?: string }> {
  const client = authClient || supabase;
  const redirectTo = getOAuthRedirectUrl();
  try {
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Could not initiate Google authentication" };
  }
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
