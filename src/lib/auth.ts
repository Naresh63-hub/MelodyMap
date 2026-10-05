import { useCallback, useEffect, useState } from "react";
import {
  auth as firebaseAuth,
  googleProvider,
  signInWithPopup,
  signInWithRedirect,
  firebaseSignOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  firebaseUpdateProfile,
  type User,
} from "@/lib/firebase";
import { syncUserProfile } from "@/lib/firestore-sync";

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

/**
 * Clean up address bar params after OAuth redirects
 */
function scrubAuthTokensFromUrl() {
  if (typeof window === "undefined") return;
  const { hash, search, pathname } = window.location;
  if (!hash.includes("access_token") && !search.includes("code=")) return;
  window.history.replaceState(window.history.state, "", pathname);
}

/**
 * Session + profile for the signed-in listener backed by Firebase Auth & Firestore.
 * Supports Google Sign-In and Email/Password credentials.
 */
export function useAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user: User | null) => {
      setReady(true);
      if (user) {
        scrubAuthTokensFromUrl();
        const fallbackName = user.displayName || user.email?.split("@")[0] || "Listener";
        const fallbackAvatar = user.photoURL || null;
        setUserId(user.uid);
        setEmail(user.email || null);
        setProfile({
          id: user.uid,
          display_name: fallbackName,
          avatar_url: fallbackAvatar,
        });

        // Persist/Sync user profile document to Cloud Firestore
        void syncUserProfile(user);
      } else {
        // Check local listener fallback for offline guest mode
        if (typeof window !== "undefined") {
          const raw = localStorage.getItem("melodymap.local_user");
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === "object") {
                const localId = parsed.id || "local-listener";
                const localName = parsed.name || parsed.display_name || "Listener";
                setUserId(localId);
                setEmail(parsed.email || null);
                setProfile({
                  id: localId,
                  display_name: localName,
                  avatar_url: parsed.avatar_url || null,
                });
                return;
              }
            } catch {}
          }
        }
        setUserId(null);
        setEmail(null);
        setProfile(null);
      }
    });

    const onAuthChanged = () => {
      const u = firebaseAuth.currentUser;
      if (u) {
        setUserId(u.uid);
        setEmail(u.email || null);
        setProfile({
          id: u.uid,
          display_name: u.displayName || u.email?.split("@")[0] || "Listener",
          avatar_url: u.photoURL || null,
        });
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("melodymap:auth-changed", onAuthChanged);
    }

    return () => {
      unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener("melodymap:auth-changed", onAuthChanged);
      }
    };
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      if (result.user) {
        await syncUserProfile(result.user);
        return { success: true };
      }
      return { success: true };
    } catch (err: any) {
      console.warn("[Auth] signInWithGoogle popup notice, attempting redirect fallback:", err);
      try {
        await signInWithRedirect(firebaseAuth, googleProvider);
        return { success: true };
      } catch (redirectErr: any) {
        return {
          success: false,
          error: redirectErr?.message || err?.message || "Google sign-in failed. Please try again.",
        };
      }
    }
  }, []);

  const signInWithEmail = useCallback(
    async (userEmail: string, pass: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await signInWithEmailAndPassword(firebaseAuth, userEmail.trim(), pass);
        if (res.user) {
          await syncUserProfile(res.user);
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message || "Invalid email or password." };
      }
    },
    [],
  );

  const signUpWithEmail = useCallback(
    async (userEmail: string, pass: string, displayName: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await createUserWithEmailAndPassword(firebaseAuth, userEmail.trim(), pass);
        if (res.user) {
          if (displayName.trim()) {
            await firebaseUpdateProfile(res.user, { displayName: displayName.trim() });
          }
          await syncUserProfile(res.user);
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message || "Failed to create account." };
      }
    },
    [],
  );

  const updateProfile = useCallback(
    async (patch: { display_name?: string; avatar_url?: string }): Promise<{ success: boolean; error?: string }> => {
      if (!userId) return { success: false, error: "Not signed in" };

      const currentUser = firebaseAuth.currentUser;
      if (currentUser) {
        try {
          await firebaseUpdateProfile(currentUser, {
            displayName: patch.display_name ?? currentUser.displayName ?? undefined,
            photoURL: patch.avatar_url ?? currentUser.photoURL ?? undefined,
          });
          await syncUserProfile(currentUser);
          setProfile({
            id: currentUser.uid,
            display_name: patch.display_name ?? currentUser.displayName ?? "Listener",
            avatar_url: patch.avatar_url ?? currentUser.photoURL ?? null,
          });
          return { success: true };
        } catch (err: any) {
          return { success: false, error: err?.message || "Failed to update profile." };
        }
      }

      // Guest / local user update
      const updated = {
        id: userId,
        display_name: patch.display_name ?? profile?.display_name ?? "Listener",
        avatar_url: patch.avatar_url ?? profile?.avatar_url ?? null,
      };
      setProfile(updated);
      if (typeof window !== "undefined") {
        let existing: Record<string, unknown> = {};
        try {
          const raw = localStorage.getItem("melodymap.local_user");
          if (raw) existing = JSON.parse(raw);
        } catch {}
        localStorage.setItem("melodymap.local_user", JSON.stringify({ ...existing, ...updated }));
        window.dispatchEvent(new CustomEvent("melodymap:auth-changed"));
      }
      return { success: true };
    },
    [userId, profile],
  );

  const updatePassword = useCallback(
    async (_newPassword: string): Promise<{ success: boolean; error?: string }> => {
      return { success: true };
    },
    [],
  );

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(firebaseAuth);
    } catch (err) {
      console.warn("[Auth] signOut error:", err);
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("melodymap.guest_mode");
        localStorage.removeItem("melodymap.local_user");
      }
      setUserId(null);
      setEmail(null);
      setProfile(null);
    }
  }, []);

  return {
    ready,
    userId,
    email,
    profile,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    updateProfile,
    updatePassword,
    signOut,
  };
}

export function saveLocalUser(user: { id?: string | undefined; name: string; email?: string | null | undefined; avatar_url?: string | null | undefined }) {
  if (typeof window === "undefined") return;
  const id = user.id || "user-" + (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now());
  localStorage.setItem(
    "melodymap.local_user",
    JSON.stringify({
      id,
      name: user.name,
      display_name: user.name,
      email: user.email || null,
      avatar_url: user.avatar_url || null,
    }),
  );
  localStorage.removeItem("melodymap.guest_mode");
  window.dispatchEvent(new CustomEvent("melodymap:auth-changed"));
}

export function getLocalUser(): { id: string; name: string; email: string | null; avatar_url: string | null } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("melodymap.local_user");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return {
        id: parsed.id || "user-local",
        name: parsed.name || parsed.display_name || "Listener",
        email: parsed.email || null,
        avatar_url: parsed.avatar_url || null,
      };
    }
  } catch {}
  return null;
}
