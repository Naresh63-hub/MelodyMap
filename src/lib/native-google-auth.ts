import { isNativeApp } from "./auth-deep-link";

declare global {
  interface Window {
    AndroidGoogleAuth?: {
      isAvailable: () => boolean;
      signIn: (webClientId: string) => void;
      signOut: () => void;
    };
    __melodymap_handle_google_id_token?: (idToken: string, email: string, displayName: string) => void;
    __melodymap_handle_google_error?: (errorMessage: string) => void;
  }
}

const LOCAL_STORAGE_GOOGLE_CLIENT_ID_KEY = "melodymap.google_client_id";

/**
 * Returns configured Google OAuth Web Client ID from build environment or local override.
 */
export function getGoogleWebClientId(): string {
  if (typeof window !== "undefined") {
    const local = localStorage.getItem(LOCAL_STORAGE_GOOGLE_CLIENT_ID_KEY);
    if (local && local.trim()) return local.trim();
  }

  const envClientId =
    (import.meta.env["VITE_GOOGLE_CLIENT_ID"] as string | undefined) ||
    (import.meta.env["VITE_GOOGLE_WEB_CLIENT_ID"] as string | undefined);

  if (envClientId && envClientId.trim()) {
    return envClientId.trim();
  }

  return "";
}

/**
 * Persists custom Google Web Client ID for native authentication testing or configuration.
 */
export function setGoogleWebClientId(clientId: string): void {
  if (typeof window === "undefined") return;
  const clean = clientId.trim();
  if (clean) {
    localStorage.setItem(LOCAL_STORAGE_GOOGLE_CLIENT_ID_KEY, clean);
  } else {
    localStorage.removeItem(LOCAL_STORAGE_GOOGLE_CLIENT_ID_KEY);
  }
}

/**
 * Checks if native Google Play Services 1-tap sign-in is available in the current runtime environment.
 */
export function isNativeGoogleAuthSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (!isNativeApp()) return false;
  try {
    return Boolean(window.AndroidGoogleAuth && window.AndroidGoogleAuth.isAvailable?.());
  } catch {
    return false;
  }
}

export interface NativeGoogleTokenResult {
  idToken: string;
  email?: string;
  displayName?: string;
}

/**
 * Launches native Android Google Sign-In bottom sheet / account picker.
 * Resolves with the Google ID Token or rejects with an error message.
 */
export function requestNativeGoogleToken(
  webClientId: string,
  timeoutMs = 120000,
): Promise<NativeGoogleTokenResult> {
  return new Promise((resolve, reject) => {
    if (!isNativeGoogleAuthSupported() || !window.AndroidGoogleAuth) {
      reject(new Error("Native Google Sign-In is not available on this device"));
      return;
    }

    const cleanClientId = webClientId.trim();
    if (!cleanClientId) {
      reject(new Error("Google Web Client ID is required for native Google Sign-In"));
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      delete window.__melodymap_handle_google_id_token;
      delete window.__melodymap_handle_google_error;
    };

    window.__melodymap_handle_google_id_token = (idToken: string, email: string, displayName: string) => {
      cleanup();
      resolve({ idToken, email, displayName });
    };

    window.__melodymap_handle_google_error = (errorMessage: string) => {
      cleanup();
      reject(new Error(errorMessage || "Google Sign-In failed"));
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error("Google Sign-In request timed out"));
    }, timeoutMs);

    try {
      window.AndroidGoogleAuth.signIn(cleanClientId);
    } catch (err: any) {
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}


/**
 * 1-tap native Google Sign-In flow for Supabase:
 * 1. Prompts native Google Play Services account picker directly in-app.
 * 2. Obtains Google ID Token.
 * 3. Exchanges ID Token with Supabase Auth via signInWithIdToken.
 */
export async function signInWithNativeGoogle(
  supabaseClient: any,
  webClientId: string,
): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const { idToken } = await requestNativeGoogleToken(webClientId);

    if (!idToken) {
      return { success: false, error: "No ID token received from Google" };
    }

    const { data, error } = await supabaseClient.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });

    if (error) throw error;

    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("melodymap.guest_mode");
        if (typeof CustomEvent !== "undefined" && typeof window.dispatchEvent === "function") {
          window.dispatchEvent(new CustomEvent("melodymap:auth-success"));
        }
      } catch (e) {
        console.warn("[NativeGoogleAuth] Storage/Event cleanup notice:", e);
      }
    }

    return { success: true, user: data?.user };
  } catch (err: any) {
    return { success: false, error: err?.message || "Native Google authentication failed" };
  }
}
