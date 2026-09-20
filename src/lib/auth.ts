import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

/** Session + profile for the signed-in listener. Local-only when signed out. */
export function useAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const handleSession = (session: any) => {
      const u = session?.user;
      setUserId(u?.id ?? null);
      setEmail(u?.email ?? null);
      setReady(true);

      if (u) {
        const meta = u.user_metadata || {};
        const fallbackName = meta.display_name || meta.full_name || meta.name || u.email?.split("@")[0] || "Listener";
        const fallbackAvatar = meta.avatar_url || null;
        setProfile((prev) => prev || { id: u.id, display_name: fallbackName, avatar_url: fallbackAvatar });

        // Guarantee user entry is recorded in Supabase public.profiles table
        void supabase
          .from("profiles")
          .upsert(
            {
              id: u.id,
              display_name: fallbackName,
              avatar_url: fallbackAvatar,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          )
          .then(({ data, error }) => {
            if (!error && data) {
              setProfile(data as any);
            }
          })
          .catch(() => {});
      } else {
        setProfile(null);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    void supabase.auth.getSession().then(({ data }) => {
      handleSession(data.session);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    void supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setProfile(data as Profile);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const updateProfile = useCallback(
    async (patch: { display_name?: string; avatar_url?: string }): Promise<{ success: boolean; error?: string }> => {
      if (!userId) return { success: false, error: "Not signed in" };
      try {
        // 1. Update Supabase Auth user metadata
        const { error: metaError } = await supabase.auth.updateUser({
          data: {
            display_name: patch.display_name,
            avatar_url: patch.avatar_url,
          },
        });
        if (metaError) throw metaError;

        // 2. Optimistic local state update
        setProfile((prev) => ({
          id: userId,
          display_name: patch.display_name ?? prev?.display_name ?? null,
          avatar_url: patch.avatar_url ?? prev?.avatar_url ?? null,
        }));

        // 3. Sync to public profiles table if available
        try {
          const { data } = await supabase
            .from("profiles")
            .upsert({ id: userId, ...patch })
            .select("id, display_name, avatar_url")
            .maybeSingle();
          if (data) setProfile(data as Profile);
        } catch {
          // Non-blocking if table is not migrated
        }

        return { success: true };
      } catch (err: any) {
        console.warn("[Auth] updateProfile error:", err);
        return { success: false, error: err?.message || "Failed to update profile." };
      }
    },
    [userId],
  );

  const updatePassword = useCallback(
    async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
      if (!userId) return { success: false, error: "Not signed in" };
      try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        return { success: true };
      } catch (err: any) {
        console.warn("[Auth] updatePassword error:", err);
        return { success: false, error: err?.message || "Failed to update password." };
      }
    },
    [userId],
  );

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("[Auth] signOut error:", err);
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("melodymap.guest_mode");
      }
      setUserId(null);
      setEmail(null);
      setProfile(null);
    }
  }, []);

  return { ready, userId, email, profile, updateProfile, updatePassword, signOut };
}
