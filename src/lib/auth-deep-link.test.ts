import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isAuthCallbackUrl,
  parseAuthCallbackUrl,
  handleAuthCallback,
  getOAuthRedirectUrl,
  resetProcessedAuthCodesForTest,
  formatCallbackError,
  NATIVE_AUTH_CALLBACK_URL,
} from "./auth-deep-link";
import { safeStorage, SafeStorageImpl } from "./safe-storage";
import { Capacitor } from "@capacitor/core";

describe("Native & Web Auth Callback Handler Suite", () => {
  beforeEach(() => {
    resetProcessedAuthCodesForTest();
    safeStorage.clear();
    vi.restoreAllMocks();
  });

  describe("getOAuthRedirectUrl", () => {
    it("returns native custom scheme URI when running on native platform", () => {
      vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
      expect(getOAuthRedirectUrl()).toBe(NATIVE_AUTH_CALLBACK_URL);
      expect(getOAuthRedirectUrl()).toBe("com.melodymap.music://auth/callback");
    });

    it("returns web /auth URI when running on web platform", () => {
      vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
      const url = getOAuthRedirectUrl();
      expect(url).toContain("/auth");
    });
  });

  describe("isAuthCallbackUrl", () => {
    it("identifies valid MelodyMap native auth callback URLs", () => {
      expect(isAuthCallbackUrl("com.melodymap.music://auth/callback?code=xyz123")).toBe(true);
      expect(isAuthCallbackUrl("com.melodymap.music://auth/callback#access_token=token123")).toBe(true);
      expect(isAuthCallbackUrl("com.melodymap.music://auth-callback?code=xyz123")).toBe(true);
      expect(isAuthCallbackUrl("com.melodymap.music:/auth/callback?code=xyz123")).toBe(true);
      expect(isAuthCallbackUrl("com.melodymap.music://auth")).toBe(true);
    });

    it("identifies web auth callback URLs with tokens, codes, token_hash or errors", () => {
      expect(isAuthCallbackUrl("https://melodymap-pi.vercel.app/?code=pkce_abc")).toBe(true);
      expect(isAuthCallbackUrl("https://melodymap-pi.vercel.app/?token_hash=otp_xyz&type=signup")).toBe(true);
      expect(isAuthCallbackUrl("https://melodymap-pi.vercel.app/#access_token=tok1&refresh_token=tok2")).toBe(true);
      expect(isAuthCallbackUrl("https://melodymap-pi.vercel.app/?error=access_denied&error_code=otp_expired")).toBe(true);
      expect(isAuthCallbackUrl("https://melodymap-pi.vercel.app/auth/callback")).toBe(true);
    });

    it("rejects non-auth or plain URLs", () => {
      expect(isAuthCallbackUrl("https://melodymap-pi.vercel.app/auth")).toBe(false);
      expect(isAuthCallbackUrl("https://melodymap-pi.vercel.app/")).toBe(false);
      expect(isAuthCallbackUrl("https://accounts.google.com")).toBe(false);
      expect(isAuthCallbackUrl("com.melodymap.music://library")).toBe(false);
      expect(isAuthCallbackUrl("com.otherapp.music://auth/callback")).toBe(false);
      expect(isAuthCallbackUrl("")).toBe(false);
    });
  });

  describe("parseAuthCallbackUrl", () => {
    it("extracts authorization code for PKCE flow", () => {
      const url = "com.melodymap.music://auth/callback?code=pkce-auth-code-12345";
      const parsed = parseAuthCallbackUrl(url);
      expect(parsed).not.toBeNull();
      expect(parsed?.code).toBe("pkce-auth-code-12345");
      expect(parsed?.error).toBeUndefined();
    });

    it("extracts email confirmation token_hash and type", () => {
      const url = "https://melodymap-pi.vercel.app/?token_hash=token_hash_value_123&type=signup";
      const parsed = parseAuthCallbackUrl(url);
      expect(parsed).not.toBeNull();
      expect(parsed?.tokenHash).toBe("token_hash_value_123");
      expect(parsed?.type).toBe("signup");
    });

    it("extracts access_token and refresh_token from hash fragment", () => {
      const url =
        "com.melodymap.music://auth/callback#access_token=jwt-access-token&refresh_token=refresh-token-val&token_type=bearer";
      const parsed = parseAuthCallbackUrl(url);
      expect(parsed).not.toBeNull();
      expect(parsed?.accessToken).toBe("jwt-access-token");
      expect(parsed?.refreshToken).toBe("refresh-token-val");
    });

    it("extracts error and error_code from expired verification link", () => {
      const url =
        "https://melodymap-pi.vercel.app/?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";
      const parsed = parseAuthCallbackUrl(url);
      expect(parsed).not.toBeNull();
      expect(parsed?.error).toBe("access_denied");
      expect(parsed?.errorCode).toBe("otp_expired");
      expect(parsed?.errorDescription).toBe("Email link is invalid or has expired");
    });
  });

  describe("handleAuthCallback Scenarios", () => {
    // Scenario 9: Email confirmation callback
    it("Scenario 9: Email confirmation callback verifies token_hash with Supabase verifyOtp", async () => {
      const mockVerifyOtp = vi.fn().mockResolvedValue({
        data: { session: { access_token: "confirmed_token" }, user: { id: "user_confirmed" } },
        error: null,
      });

      const mockClient = {
        auth: {
          verifyOtp: mockVerifyOtp,
          getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        },
      };

      const onSuccess = vi.fn();
      const res = await handleAuthCallback(
        "https://melodymap-pi.vercel.app/?token_hash=valid_hash_456&type=signup",
        mockClient,
        { onSuccess },
      );

      expect(mockVerifyOtp).toHaveBeenCalledWith({
        token_hash: "valid_hash_456",
        type: "signup",
      });
      expect(res.success).toBe(true);
      expect(onSuccess).toHaveBeenCalled();
    });

    // Scenario 10: PKCE callback
    it("Scenario 10: PKCE callback exchanges code for session", async () => {
      const mockExchangeCode = vi.fn().mockResolvedValue({
        data: { session: { access_token: "pkce_jwt" }, user: { id: "pkce_user" } },
        error: null,
      });

      const mockClient = {
        auth: {
          exchangeCodeForSession: mockExchangeCode,
          getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        },
      };

      const onSuccess = vi.fn();
      const res = await handleAuthCallback(
        "https://melodymap-pi.vercel.app/?code=valid_pkce_code",
        mockClient,
        { onSuccess },
      );

      expect(mockExchangeCode).toHaveBeenCalledWith("valid_pkce_code");
      expect(res.success).toBe(true);
      expect(onSuccess).toHaveBeenCalled();
    });

    // Scenario 11: OAuth callback
    it("Scenario 11: OAuth callback sets session and clears guest mode", async () => {
      safeStorage.setItem("melodymap.guest_mode", "true");

      const onSuccess = vi.fn();
      const mockClient = {
        auth: {
          setSession: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
          getSession: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
        },
      };
      const res = await handleAuthCallback(
        "com.melodymap.music://auth/callback#access_token=token_abc&refresh_token=token_def",
        mockClient,
        { onSuccess },
      );

      expect(res.success).toBe(true);
      expect(onSuccess).toHaveBeenCalled();
      expect(safeStorage.getItem("melodymap.guest_mode")).toBeNull();
    });

    // Scenario 12: Expired verification link
    it("Scenario 12: Expired verification link returns user-friendly expired error", async () => {
      const onError = vi.fn();
      const res = await handleAuthCallback(
        "https://melodymap-pi.vercel.app/?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
        null,
        { onError },
      );

      expect(res.success).toBe(false);
      expect(res.error).toBe("Your verification link has expired. Request a new one.");
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Your verification link has expired. Request a new one." }),
      );
    });

    // Scenario 13: Duplicate callback prevention
    it("Scenario 13: Duplicate callback prevention avoids repeated exchanges", async () => {
      const onSuccess = vi.fn();
      const mockClient = {
        auth: {
          exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
          getSession: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
        },
      };
      const url = "com.melodymap.music://auth/callback?code=single-use-code-999";

      const res1 = await handleAuthCallback(url, mockClient, { onSuccess });
      expect(res1.success).toBe(true);
      expect(onSuccess).toHaveBeenCalledTimes(1);

      // Second attempt with same code
      const res2 = await handleAuthCallback(url, mockClient, { onSuccess });
      expect(res2.success).toBe(true);
      // Callback was NOT processed again
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    // Scenario 14: Session restoration
    it("Scenario 14: Session restoration dispatches auth success event and notifies listener", async () => {
      let dispatched = false;
      const fakeWindow = {
        location: { href: "https://melodymap-pi.vercel.app/#access_token=restored_token&refresh_token=restored_refresh" },
        history: { replaceState: vi.fn() },
        dispatchEvent: (e: Event) => {
          if (e.type === "melodymap:auth-success") dispatched = true;
          return true;
        },
      };

      const mockClient = {
        auth: {
          setSession: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
          getSession: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
        },
      };

      const originalWin = (globalThis as any).window;
      (globalThis as any).window = fakeWindow;

      try {
        const onSuccess = vi.fn();
        const res = await handleAuthCallback(
          "https://melodymap-pi.vercel.app/#access_token=restored_token&refresh_token=restored_refresh",
          mockClient,
          { onSuccess },
        );

        expect(res.success).toBe(true);
        expect(onSuccess).toHaveBeenCalled();
        expect(dispatched).toBe(true);
      } finally {
        (globalThis as any).window = originalWin;
      }
    });

    // Scenario 15: Guest access after authentication failure
    it("Scenario 15: Guest access after authentication failure functions safely", () => {
      // Simulate auth error format
      const friendlyError = formatCallbackError("access_denied", undefined, "User cancelled");
      expect(friendlyError).toBe("User cancelled");

      // Verify guest fallback can be stored and retrieved even in restricted storage
      safeStorage.setItem("melodymap.guest_mode", "true");
      expect(safeStorage.getItem("melodymap.guest_mode")).toBe("true");

      // Ensure that storage denies/restricts do not throw
      const throwingStorage = new SafeStorageImpl("localStorage");
      (throwingStorage as any).available = false;
      throwingStorage.setItem("melodymap.guest_mode", "true");
      expect(throwingStorage.getItem("melodymap.guest_mode")).toBe("true");
    });
  });
});
