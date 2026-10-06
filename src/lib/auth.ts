import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getOAuthRedirectUrl } from "@/lib/auth-deep-link";
import type { User } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

/** Session + profile for the signed-in listener backed by Supabase Auth & PostgreSQL */
export function useAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  // Sync profile from Supabase profiles table
  const fetchProfile = useCallback(async (user: User) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (data && !error) {
        setProfile({
          id: user.id,
          display_name: data.display_name || user.user_metadata?.["display_name"] || user.email?.split("@")[0] || "Listener",
          avatar_url: data.avatar_url || user.user_metadata?.["avatar_url"] || null,
        });
        return;
      }

      // Upsert default profile if not exists
      const fallbackName = user.user_metadata?.["display_name"] || user.user_metadata?.["full_name"] || user.email?.split("@")[0] || "Listener";
      const fallbackAvatar = user.user_metadata?.["avatar_url"] || null;
      await supabase.from("profiles").upsert({
        id: user.id,
        display_name: fallbackName,
        avatar_url: fallbackAvatar,
        updated_at: new Date().toISOString(),
      });

      setProfile({
        id: user.id,
        display_name: fallbackName,
        avatar_url: fallbackAvatar,
      });
    } catch {
      setProfile({
        id: user.id,
        display_name: user.user_metadata?.["display_name"] || user.email?.split("@")[0] || "Listener",
        avatar_url: user.user_metadata?.["avatar_url"] || null,
      });
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Listen to Supabase auth events
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setUserId(session.user.id);
        setEmail(session.user.email || null);
        await fetchProfile(session.user);
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

    // Check initial session
    void supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        setUserId(session.user.id);
        setEmail(session.user.email || null);
        await fetchProfile(session.user);
      }
      setReady(true);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const updateProfile = useCallback(
    async (patch: { display_name?: string; avatar_url?: string }): Promise<{ success: boolean; error?: string }> => {
      if (!userId) return { success: false, error: "Not signed in" };

      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData.session?.user;

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
        const { error } = await supabase.from("profiles").upsert({
          id: currentUser.id,
          display_name: patch.display_name ?? profile?.display_name ?? "Listener",
          avatar_url: patch.avatar_url ?? profile?.avatar_url ?? null,
          updated_at: new Date().toISOString(),
        });

        if (error) throw error;

        setProfile((prev) => ({
          id: currentUser.id,
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
      try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
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
      await supabase.auth.signOut();
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

  const signInWithGoogle = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const redirectUrl = getOAuthRedirectUrl();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.warn("[Auth] signInWithGoogle error:", err);
      return { success: false, error: err?.message || "Google sign in failed" };
    }
  }, []);

  const signInWithEmail = useCallback(async (emailInput: string, passwordInput: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput.trim(),
        password: passwordInput,
      });
      if (error) throw error;
      if (data.user) {
        await fetchProfile(data.user);
      }
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err?.message || "Sign in failed" };
    }
  }, [fetchProfile]);

  const signUpWithEmail = useCallback(async (emailInput: string, passwordInput: string, name?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: emailInput.trim(),
        password: passwordInput,
        options: {
          data: {
            display_name: name?.trim(),
            full_name: name?.trim(),
          },
        },
      });
      if (error) throw error;
      if (data.user) {
        await fetchProfile(data.user);
      }
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err?.message || "Sign up failed" };
    }
  }, [fetchProfile]);

  const resetPassword = useCallback(async (emailInput: string) => {
    try {
      const redirectUrl = typeof window !== "undefined" ? `${window.location.origin}/auth` : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(
        emailInput.trim(),
        redirectUrl ? { redirectTo: redirectUrl } : {},
      );
      if (error) throw error;
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
