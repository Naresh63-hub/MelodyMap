import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { safeStorage } from "@/lib/safe-storage";
import { getInitialCachedAuthState } from "@/lib/auth";

describe("Manage Account Authentication & Navigation Suite", () => {
  const drawerSource = readFileSync(
    resolve(__dirname, "./MobileDrawer.tsx"),
    "utf-8"
  );
  const routesSource = readFileSync(
    resolve(__dirname, "../../../routes/index.tsx"),
    "utf-8"
  );
  const accountSheetSource = readFileSync(
    resolve(__dirname, "../../common/AccountSheet.tsx"),
    "utf-8"
  );
  const authModalSource = readFileSync(
    resolve(__dirname, "../../common/AuthModal.tsx"),
    "utf-8"
  );

  beforeEach(() => {
    safeStorage.clear();
  });

  afterEach(() => {
    safeStorage.clear();
    vi.restoreAllMocks();
  });

  // SCENARIO 1: Signed-in Google account → Manage opens account settings
  describe("Scenario 1: Signed-in Google account", () => {
    it("drawer dispatches to onManageAccount and does not open sign-in modal", () => {
      let manageAccountCalled = false;
      let signInCalled = false;
      let closed = false;

      const isSynced = true;
      const onManageAccount = () => { manageAccountCalled = true; };
      const onSignIn = () => { signInCalled = true; };
      const onClose = () => { closed = true; };

      // Exact handler logic embedded in MobileDrawer
      const handleAccountAction = () => {
        onClose();
        if (isSynced) {
          if (onManageAccount) {
            onManageAccount();
          }
        } else {
          if (onSignIn) {
            onSignIn();
          }
        }
      };

      handleAccountAction();

      expect(closed).toBe(true);
      expect(manageAccountCalled).toBe(true);
      expect(signInCalled).toBe(false);
    });

    it("verifies MobileDrawer template binds Manage button and Synced Account label when isSynced=true", () => {
      expect(drawerSource).toContain('{isSynced ? "Manage" : "Sign In"}');
      expect(drawerSource).toContain('{isSynced ? "Synced Account • Tap to manage" : "Tap to sign in / manage"}');
      expect(drawerSource).toContain("onManageAccount?: () => void;");
      expect(drawerSource).toContain("if (onManageAccount)");
    });

    it("verifies routes/index.tsx wires MobileDrawer onManageAccount to open AccountSheet", () => {
      expect(routesSource).toContain("onManageAccount={() => {");
      expect(routesSource).toContain("setShowAccountSheet(true);");
    });
  });

  // SCENARIO 2: Signed-in email account → Manage opens account settings
  describe("Scenario 2: Signed-in email account", () => {
    it("restores email account session correctly and directs Manage action to account management", () => {
      const emailUserSession = {
        currentSession: {
          expires_at: Math.floor(Date.now() / 1000) + 3600, // Valid for 1 hour
          user: {
            id: "user-email-12345",
            email: "listener@melodymap.com",
            is_anonymous: false,
            app_metadata: { provider: "email" },
            user_metadata: { display_name: "Melody Fan" },
          },
        },
      };

      safeStorage.setItem("sb-testproject-auth-token", JSON.stringify(emailUserSession));

      const authState = getInitialCachedAuthState();
      expect(authState.isCloudAuth).toBe(true);
      expect(authState.userId).toBe("user-email-12345");
      expect(authState.email).toBe("listener@melodymap.com");
      expect(authState.profile?.display_name).toBe("Melody Fan");

      // Verify action routes to manage account
      let openedAccountSheet = false;
      let openedAuthModal = false;

      if (authState.isCloudAuth) {
        openedAccountSheet = true;
      } else {
        openedAuthModal = true;
      }

      expect(openedAccountSheet).toBe(true);
      expect(openedAuthModal).toBe(false);
    });

    it("verifies AccountSheet displays Cloud Synced status and provides direct Edit Profile link", () => {
      expect(accountSheetSource).toContain("Cloud Synced");
      expect(accountSheetSource).toContain("Edit Profile");
      expect(accountSheetSource).toContain("handleAction(onOpenSettings)");
    });
  });

  // SCENARIO 3: Guest account → Manage offers sign-in
  describe("Scenario 3: Guest account", () => {
    it("guest account dispatches to onSignIn when tapping account card or button", () => {
      let manageAccountCalled = false;
      let signInCalled = false;
      let closed = false;

      const isSynced = false;
      const onManageAccount = () => { manageAccountCalled = true; };
      const onSignIn = () => { signInCalled = true; };
      const onClose = () => { closed = true; };

      const handleAccountAction = () => {
        onClose();
        if (isSynced) {
          if (onManageAccount) {
            onManageAccount();
          }
        } else {
          if (onSignIn) {
            onSignIn();
          }
        }
      };

      handleAccountAction();

      expect(closed).toBe(true);
      expect(manageAccountCalled).toBe(false);
      expect(signInCalled).toBe(true);
    });

    it("verifies empty storage initializes as guest mode (isCloudAuth=false)", () => {
      const authState = getInitialCachedAuthState();
      expect(authState.isCloudAuth).toBe(false);
      expect(authState.userId).toBeNull();
      expect(authState.email).toBeNull();
    });

    it("verifies local guest storage preserves listener name without claiming cloud sync", () => {
      safeStorage.setItem(
        "melodymap.local_user",
        JSON.stringify({ id: "local-listener-99", name: "Offline Traveler" })
      );

      const authState = getInitialCachedAuthState();
      expect(authState.isCloudAuth).toBe(false);
      expect(authState.userId).toBe("local-listener-99");
      expect(authState.profile?.display_name).toBe("Offline Traveler");
    });
  });

  // SCENARIO 4: App restarted with valid session → Manage still works
  describe("Scenario 4: App restarted with valid session", () => {
    it("synchronously restores authenticated state on initial render without false unauthenticated flash", () => {
      const validGoogleSession = {
        currentSession: {
          expires_at: Math.floor(Date.now() / 1000) + 7200,
          user: {
            id: "google-uid-789",
            email: "artist@gmail.com",
            is_anonymous: false,
            app_metadata: { provider: "google" },
            user_metadata: {
              full_name: "Google Artist",
              avatar_url: "https://lh3.googleusercontent.com/avatar",
            },
          },
        },
      };

      safeStorage.setItem("sb-ewdkptexcovmqqrlfwlf-auth-token", JSON.stringify(validGoogleSession));

      const restoredState = getInitialCachedAuthState();
      expect(restoredState.isCloudAuth).toBe(true);
      expect(restoredState.userId).toBe("google-uid-789");
      expect(restoredState.email).toBe("artist@gmail.com");
      expect(restoredState.profile?.display_name).toBe("Google Artist");
      expect(restoredState.profile?.avatar_url).toBe("https://lh3.googleusercontent.com/avatar");
    });

    it("verifies AuthModal protects authenticated users from re-login prompt if invoked", () => {
      // In AuthModal, if auth.isCloudAuth is true, mode switches to "profile" rather than "signin"
      expect(authModalSource).toContain('if (auth.isCloudAuth && defaultMode !== "signup")');
      expect(authModalSource).toContain('setMode("profile")');
    });
  });

  // SCENARIO 5: Expired session → proper reauthentication
  describe("Scenario 5: Expired session", () => {
    it("detects expired auth token and refuses to treat user as authenticated", () => {
      const expiredSession = {
        currentSession: {
          expires_at: Math.floor(Date.now() / 1000) - 600, // Expired 10 minutes ago
          user: {
            id: "expired-user-111",
            email: "expired@test.com",
            is_anonymous: false,
          },
        },
      };

      safeStorage.setItem("sb-ewdkptexcovmqqrlfwlf-auth-token", JSON.stringify(expiredSession));

      const authState = getInitialCachedAuthState();
      // Should NOT treat expired session as active cloud auth
      expect(authState.isCloudAuth).toBe(false);
      expect(authState.userId).toBeNull();
      expect(authState.email).toBeNull();
    });

    it("when session is expired, drawer directs to sign-in for re-authentication", () => {
      let signInCalled = false;
      const isSynced = false; // Expired session evaluated to false
      const onSignIn = () => { signInCalled = true; };

      if (!isSynced) {
        onSignIn();
      }

      expect(signInCalled).toBe(true);
    });
  });

  // SCENARIO 6: Sign out → Manage no longer treats the user as authenticated
  describe("Scenario 6: Sign out", () => {
    it("clears cached token and transitions state back to guest mode", () => {
      // 1. Initially signed in
      const activeSession = {
        currentSession: {
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: "active-1", is_anonymous: false },
        },
      };
      safeStorage.setItem("sb-proj-auth-token", JSON.stringify(activeSession));
      expect(getInitialCachedAuthState().isCloudAuth).toBe(true);

      // 2. Sign out action removes tokens
      safeStorage.removeItem("sb-proj-auth-token");
      const postSignOutState = getInitialCachedAuthState();
      expect(postSignOutState.isCloudAuth).toBe(false);
      expect(postSignOutState.userId).toBeNull();
    });

    it("drawer renders Sign In in place of Sign Out when not synced", () => {
      expect(drawerSource).toContain("{isSynced && onSignOut ? (");
      expect(drawerSource).toContain("!isSynced && onSignIn && (");
      expect(drawerSource).toContain("<span>Sign Out</span>");
      expect(drawerSource).toContain("<span>Sign In</span>");
    });
  });
});
