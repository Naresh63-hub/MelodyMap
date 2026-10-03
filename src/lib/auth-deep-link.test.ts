import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isAuthCallbackUrl,
  parseAuthCallbackUrl,
  handleAuthCallback,
  getOAuthRedirectUrl,
  resetProcessedAuthCodesForTest,
  NATIVE_AUTH_CALLBACK_URL,
} from "./auth-deep-link";
import { Capacitor } from "@capacitor/core";

describe("Native Auth Deep Link Handler", () => {
  beforeEach(() => {
    resetProcessedAuthCodesForTest();
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
    it("identifies valid MelodyMap auth callback URLs", () => {
      expect(isAuthCallbackUrl("com.melodymap.music://auth/callback?code=xyz123")).toBe(true);
      expect(isAuthCallbackUrl("com.melodymap.music://auth/callback#access_token=token123")).toBe(true);
      expect(isAuthCallbackUrl("com.melodymap.music://auth-callback?code=xyz123")).toBe(true);
      expect(isAuthCallbackUrl("com.melodymap.music:/auth/callback?code=xyz123")).toBe(true);
      expect(isAuthCallbackUrl("com.melodymap.music://auth")).toBe(true);
    });

    it("rejects non-auth or external URLs", () => {
      expect(isAuthCallbackUrl("https://melodymap-pi.vercel.app/auth")).toBe(false);
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

    it("extracts access_token and refresh_token from hash fragment", () => {
      const url =
        "com.melodymap.music://auth/callback#access_token=jwt-access-token&refresh_token=refresh-token-val&token_type=bearer";
      const parsed = parseAuthCallbackUrl(url);
      expect(parsed).not.toBeNull();
      expect(parsed?.accessToken).toBe("jwt-access-token");
      expect(parsed?.refreshToken).toBe("refresh-token-val");
    });

    it("extracts error parameters from cancelled OAuth flow", () => {
      const url =
        "com.melodymap.music://auth/callback?error=access_denied&error_description=User+denied+access";
      const parsed = parseAuthCallbackUrl(url);
      expect(parsed).not.toBeNull();
      expect(parsed?.error).toBe("access_denied");
      expect(parsed?.errorDescription).toBe("User denied access");
    });
  });

  describe("handleAuthCallback", () => {
    it("exchanges authorization code using Supabase exchangeCodeForSession", async () => {
      const mockSupabase = {
        auth: {
          exchangeCodeForSession: vi.fn().mockResolvedValue({
            data: { session: { user: { id: "user_123" } } },
            error: null,
          }),
        },
      };

      const onSuccess = vi.fn();
      const res = await handleAuthCallback(
        "com.melodymap.music://auth/callback?code=valid-code-789",
        mockSupabase,
        { onSuccess },
      );

      expect(res.success).toBe(true);
      expect(mockSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith("valid-code-789");
      expect(onSuccess).toHaveBeenCalled();
    });

    it("sets session when tokens are provided in hash fragment", async () => {
      const mockSupabase = {
        auth: {
          setSession: vi.fn().mockResolvedValue({
            data: { session: { user: { id: "user_456" } } },
            error: null,
          }),
        },
      };

      const onSuccess = vi.fn();
      const res = await handleAuthCallback(
        "com.melodymap.music://auth/callback#access_token=token_abc&refresh_token=token_def",
        mockSupabase,
        { onSuccess },
      );

      expect(res.success).toBe(true);
      expect(mockSupabase.auth.setSession).toHaveBeenCalledWith({
        access_token: "token_abc",
        refresh_token: "token_def",
      });
      expect(onSuccess).toHaveBeenCalled();
    });

    it("prevents duplicate callbacks and does not re-exchange already processed code", async () => {
      const mockSupabase = {
        auth: {
          exchangeCodeForSession: vi.fn().mockResolvedValue({
            data: { session: { user: { id: "user_123" } } },
            error: null,
          }),
        },
      };

      const url = "com.melodymap.music://auth/callback?code=single-use-code-999";
      const res1 = await handleAuthCallback(url, mockSupabase);
      expect(res1.success).toBe(true);
      expect(mockSupabase.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);

      // Re-delivery of the exact same callback URL
      const res2 = await handleAuthCallback(url, mockSupabase);
      expect(res2.success).toBe(true);
      // exchangeCodeForSession must NOT have been called again!
      expect(mockSupabase.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    });

    it("handles OAuth errors and reports failure cleanly without crashing", async () => {
      const mockSupabase = {
        auth: {
          exchangeCodeForSession: vi.fn(),
        },
      };

      const onError = vi.fn();
      const res = await handleAuthCallback(
        "com.melodymap.music://auth/callback?error=access_denied&error_description=User+cancelled",
        mockSupabase,
        { onError },
      );

      expect(res.success).toBe(false);
      expect(res.error).toBe("User cancelled");
      expect(onError).toHaveBeenCalled();
      expect(mockSupabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    });

    it("returns error on session exchange failure", async () => {
      const mockSupabase = {
        auth: {
          exchangeCodeForSession: vi.fn().mockResolvedValue({
            data: null,
            error: new Error("Code has expired or is invalid"),
          }),
        },
      };

      const onError = vi.fn();
      const res = await handleAuthCallback(
        "com.melodymap.music://auth/callback?code=expired-code",
        mockSupabase,
        { onError },
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain("expired");
      expect(onError).toHaveBeenCalled();
    });
  });
});
