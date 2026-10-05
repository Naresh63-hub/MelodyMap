import { useCallback, useEffect, useState } from "react";
import {
  auth,
  db,
  syncUserProfile,
  signInWithGoogle as firebaseSignInWithGoogle,
} from "@/lib/firebase";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile as firebaseUpdateProfile,
  updatePassword as firebaseUpdatePassword,
  sendPasswordResetEmail,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

/** Session + profile for the signed-in listener backed by Firebase Auth & Firestore */
export function useAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        setUserId(user.uid);
        setEmail(user.email || null);

        // Fetch or sync Firestore user profile
        try {
          const userRef = doc(db, "users", user.uid);
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const data = snap.data();
            setProfile({
              id: user.uid,
              display_name: (data["displayName"] as string) || user.displayName || user.email?.split("@")[0] || "Listener",
              avatar_url: (data["avatarUrl"] as string) || user.photoURL || null,
            });
          } else {
            const synced = await syncUserProfile(user);
            setProfile({
              id: user.uid,
              display_name: synced.displayName,
              avatar_url: synced.avatarUrl || null,
            });
          }
        } catch {
          // Fallback to auth object profile
          setProfile({
            id: user.uid,
            display_name: user.displayName || user.email?.split("@")[0] || "Listener",
            avatar_url: user.photoURL || null,
          });
        }
      } else {
        // Fallback to local guest profile if saved
        if (typeof window !== "undefined") {
          const raw = localStorage.getItem("melodymap.local_user");
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === "object") {
                const localId = parsed.id || "local-listener";
                setUserId(localId);
                setEmail(parsed.email || null);
                setProfile({
                  id: localId,
                  display_name: parsed.name || parsed.display_name || "Listener",
                  avatar_url: parsed.avatar_url || null,
                });
                setReady(true);
                return;
              }
            } catch {}
          }
        }
        setUserId(null);
        setEmail(null);
        setProfile(null);
      }
      setReady(true);
    });

    return () => unsubscribe();
  }, []);

  const updateProfile = useCallback(
    async (patch: { display_name?: string; avatar_url?: string }): Promise<{ success: boolean; error?: string }> => {
      if (!userId) return { success: false, error: "Not signed in" };

      const currentUser = auth.currentUser;
      if (!currentUser) {
        // Local mode update
        const updated: Profile = {
          id: userId,
          display_name: patch.display_name ?? profile?.display_name ?? "Listener",
          avatar_url: patch.avatar_url ?? profile?.avatar_url ?? null,
        };
        setProfile(updated);
        if (typeof window !== "undefined") {
          localStorage.setItem("melodymap.local_user", JSON.stringify(updated));
        }
        return { success: true };
      }

      try {
        // 1. Update Firebase Auth Profile
        await firebaseUpdateProfile(currentUser, {
          displayName: patch.display_name !== undefined ? patch.display_name : currentUser.displayName,
          photoURL: patch.avatar_url !== undefined ? patch.avatar_url : currentUser.photoURL,
        });

        // 2. Sync Firestore Profile Document
        const userRef = doc(db, "users", currentUser.uid);
        await setDoc(
          userRef,
          {
            displayName: patch.display_name ?? profile?.display_name ?? "Listener",
            avatarUrl: patch.avatar_url ?? profile?.avatar_url ?? "",
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );

        setProfile((prev) => ({
          id: currentUser.uid,
          display_name: patch.display_name ?? prev?.display_name ?? "Listener",
          avatar_url: patch.avatar_url ?? prev?.avatar_url ?? null,
        }));

        return { success: true };
      } catch (err: any) {
        console.warn("[Auth] updateProfile error:", err);
        return { success: false, error: err?.message || "Failed to update profile." };
      }
    },
    [userId, profile],
  );

  const updatePassword = useCallback(
    async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
      const currentUser = auth.currentUser;
      if (!currentUser) return { success: false, error: "Not signed in" };
      try {
        await firebaseUpdatePassword(currentUser, newPassword);
        return { success: true };
      } catch (err: any) {
        console.warn("[Auth] updatePassword error:", err);
        return { success: false, error: err?.message || "Failed to update password." };
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
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

  const signInWithGoogle = useCallback(async () => {
    return await firebaseSignInWithGoogle();
  }, []);

  const signInWithEmail = useCallback(async (emailInput: string, passwordInput: string) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, emailInput.trim(), passwordInput);
      await syncUserProfile(cred.user);
      return { success: true, user: cred.user };
    } catch (err: any) {
      return { success: false, error: err?.message || "Sign in failed" };
    }
  }, []);

  const signUpWithEmail = useCallback(async (emailInput: string, passwordInput: string, name?: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, emailInput.trim(), passwordInput);
      if (name) {
        await firebaseUpdateProfile(cred.user, { displayName: name.trim() });
      }
      await syncUserProfile(cred.user, name?.trim());
      return { success: true, user: cred.user };
    } catch (err: any) {
      return { success: false, error: err?.message || "Sign up failed" };
    }
  }, []);

  const resetPassword = useCallback(async (emailInput: string) => {
    try {
      await sendPasswordResetEmail(auth, emailInput.trim());
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Password reset failed" };
    }
  }, []);

  return {
    ready,
    userId,
    email,
    profile,
    updateProfile,
    updatePassword,
    signOut,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
  };
}

export function saveLocalUser(user: {
  id?: string | undefined;
  name: string;
  email?: string | null | undefined;
  avatar_url?: string | null | undefined;
}) {
  if (typeof window === "undefined") return;
  const id =
    user.id ||
    "user-" +
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now());
  localStorage.setItem(
    "melodymap.local_user",
    JSON.stringify({
      id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
    }),
  );
  window.dispatchEvent(new CustomEvent("melodymap:auth-changed"));
}
