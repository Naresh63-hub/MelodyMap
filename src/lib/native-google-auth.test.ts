import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isNativeGoogleAuthSupported,
  getGoogleWebClientId,
  setGoogleWebClientId,
  requestNativeGoogleToken,
  signInWithNativeGoogle,
} from "./native-google-auth";

const storage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, val: string) => storage.set(key, val),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
};

describe("native-google-auth", () => {
  beforeEach(() => {
    storage.clear();
    (globalThis as any).window = globalThis;
    (globalThis as any).localStorage = mockLocalStorage;
    delete (globalThis as any).AndroidGoogleAuth;
    delete (globalThis as any).Capacitor;
    delete (globalThis as any).__melodymap_handle_google_id_token;
    delete (globalThis as any).__melodymap_handle_google_error;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports unsupported when window.AndroidGoogleAuth is not present", () => {
    expect(isNativeGoogleAuthSupported()).toBe(false);
  });

  it("stores and retrieves custom Google Web Client ID from localStorage", () => {
    expect(getGoogleWebClientId()).toBe("");
    setGoogleWebClientId("123456789-test.apps.googleusercontent.com");
    expect(getGoogleWebClientId()).toBe("123456789-test.apps.googleusercontent.com");
    setGoogleWebClientId("");
    expect(getGoogleWebClientId()).toBe("");
  });

  it("rejects requestNativeGoogleToken when AndroidGoogleAuth is not available", async () => {
    await expect(requestNativeGoogleToken("test-client-id")).rejects.toThrow(
      "Native Google Sign-In is not available",
    );
  });

  it("rejects requestNativeGoogleToken when client ID is missing", async () => {
    (globalThis as any).Capacitor = { isNativePlatform: () => true };
    (globalThis as any).AndroidGoogleAuth = {
      isAvailable: () => true,
      signIn: vi.fn(),
      signOut: vi.fn(),
    };

    expect(isNativeGoogleAuthSupported()).toBe(true);
    await expect(requestNativeGoogleToken("")).rejects.toThrow("Google Web Client ID is required");
  });

  it("resolves token when AndroidGoogleAuth signals success callback", async () => {
    (globalThis as any).Capacitor = { isNativePlatform: () => true };

    const mockSignIn = vi.fn().mockImplementation(() => {
      setTimeout(() => {
        if ((globalThis as any).__melodymap_handle_google_id_token) {
          (globalThis as any).__melodymap_handle_google_id_token("mock-jwt-token", "user@gmail.com", "Test User");
        }
      }, 10);
    });

    (globalThis as any).AndroidGoogleAuth = {
      isAvailable: () => true,
      signIn: mockSignIn,
      signOut: vi.fn(),
    };

    const result = await requestNativeGoogleToken("test-client.apps.googleusercontent.com");
    expect(mockSignIn).toHaveBeenCalledWith("test-client.apps.googleusercontent.com");
    expect(result.idToken).toBe("mock-jwt-token");
    expect(result.email).toBe("user@gmail.com");
    expect(result.displayName).toBe("Test User");
  });

  it("signs in via signInWithNativeGoogle", async () => {
    (globalThis as any).Capacitor = { isNativePlatform: () => true };

    (globalThis as any).AndroidGoogleAuth = {
      isAvailable: () => true,
      signIn: vi.fn().mockImplementation(() => {
        setTimeout(() => {
          if ((globalThis as any).__melodymap_handle_google_id_token) {
            (globalThis as any).__melodymap_handle_google_id_token("mock-jwt-token", "user@gmail.com", "Test User");
          }
        }, 10);
      }),
      signOut: vi.fn(),
    };

    const mockSupabase = {
      auth: {
        signInWithIdToken: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123", email: "user@gmail.com" } },
          error: null,
        }),
      },
    };

    const res = await signInWithNativeGoogle(
      mockSupabase,
      "test-client.apps.googleusercontent.com",
    );

    expect(res.success).toBe(true);
    expect(mockSupabase.auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: "google",
      token: "mock-jwt-token",
    });
  });
});
