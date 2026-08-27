import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Disc3, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageArtistPicker } from "@/components/music/ui/LanguageArtistPicker";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_SETTINGS, SETTINGS_KEY, type RecSettings } from "@/lib/library";

/** Reads saved languages/artists so the picker is pre-filled on return visits. */
function readSavedPick(): { languages: string[]; artists: string[] } {
  if (typeof window === "undefined") return { languages: [], artists: [] };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<RecSettings>) : {};
    return {
      languages: parsed.languages ?? [],
      artists: parsed.artists ?? [],
    };
  } catch {
    return { languages: [], artists: [] };
  }
}

/** Seeds the app's settings with the languages/artists picked at sign-in. */
function persistPick(languages: string[], artists: string[]) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    const current = raw ? (JSON.parse(raw) as Partial<RecSettings>) : {};
    window.localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, ...current, languages, artists }),
    );
  } catch {
    /* storage unavailable — the pick just won't be seeded */
  }
}

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — MelodyMap" },
      {
        name: "description",
        content:
          "Sign in to MelodyMap to sync your favourites, playlists and AI music picks across devices.",
      },
      { property: "og:title", content: "Sign in — MelodyMap" },
      {
        property: "og:description",
        content: "Sync your favourites, playlists and AI picks across every device.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [languages, setLanguages] = useState<string[]>([]);
  const [artists, setArtists] = useState<string[]>([]);

  useEffect(() => {
    const saved = readSavedPick();
    setLanguages(saved.languages);
    setArtists(saved.artists);
  }, []);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNote(null);
    // Seed language-based song picks before leaving the page.
    persistPick(languages, artists);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { display_name: name.trim() || email.split("@")[0] },
        },
      });
      setBusy(false);
      if (error) {
        setNote(error.message);
        return;
      }
      if (!data.session) {
        setNote("Check your inbox to confirm your email, then sign in.");
        return;
      }
      void navigate({ to: "/", replace: true });
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) {
      setNote(error.message);
      return;
    }
    void navigate({ to: "/", replace: true });
  };

  const google = async () => {
    setNote(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setNote("Google sign-in failed. Please try again.");
      return;
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-melodymap shadow-player">
            <Disc3 className="h-7 w-7 text-primary" />
          </span>
          <div>
            <h1 className="text-2xl font-bold">MelodyMap</h1>
            <p className="text-xs text-muted-foreground">
              Sync your favourites, playlists and picks everywhere
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-lift">
          <div className="mb-5 flex rounded-full bg-secondary p-1 text-sm">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded-full py-2 font-medium transition-colors ${
                  mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Display name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  placeholder="What should we call you?"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                maxLength={255}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                maxLength={72}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3.5">
              <LanguageArtistPicker
                languages={languages}
                artists={artists}
                onChange={(patch) => {
                  if (patch.languages) setLanguages(patch.languages);
                  if (patch.artists) setArtists(patch.artists);
                }}
              />
            </div>

            <Button type="submit" className="w-full font-semibold" disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "signin" ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={() => void google()}>
            Continue with Google
          </Button>

          {note && <p className="mt-4 text-center text-sm text-muted-foreground">{note}</p>}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          <Link to="/" className="underline underline-offset-4">
            Keep listening without an account
          </Link>
        </p>
      </div>
    </main>
  );
}
