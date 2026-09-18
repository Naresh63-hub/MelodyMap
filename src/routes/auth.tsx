import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Disc3,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

function formatAuthError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("invalid login credentials") || lower.includes("invalid_grant")) {
    return "Incorrect email or password. Please check your details and try again.";
  }
  if (lower.includes("email not confirmed")) {
    return "Please confirm your email before signing in. Check your inbox or spam folder.";
  }
  if (lower.includes("user already registered") || lower.includes("already exists")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (lower.includes("password should be at least")) {
    return "Password must be at least 6 characters long.";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  return msg;
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
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [errorNote, setErrorNote] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setErrorNote(null);
    setSuccessNote(null);

    if (mode === "forgot") {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth`,
        });
        setBusy(false);
        if (error) {
          setErrorNote(formatAuthError(error.message));
          return;
        }
        setSuccessNote("Password reset link has been sent to your email.");
      } catch (err: any) {
        setBusy(false);
        setErrorNote(err?.message || "Failed to send reset link.");
      }
      return;
    }

    if (mode === "signup") {
      try {
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
          setErrorNote(formatAuthError(error.message));
          return;
        }
        if (!data.session) {
          setSuccessNote("Account created! Check your inbox to confirm your email, then sign in.");
          setMode("signin");
          return;
        }
        void navigate({ to: "/", replace: true });
      } catch (err: any) {
        setBusy(false);
        setErrorNote(err?.message || "Sign up failed.");
      }
      return;
    }

    // Sign in mode
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      setBusy(false);
      if (error) {
        setErrorNote(formatAuthError(error.message));
        return;
      }
      void navigate({ to: "/", replace: true });
    } catch (err: any) {
      setBusy(false);
      setErrorNote(err?.message || "Sign in failed.");
    }
  };

  const google = async () => {
    setErrorNote(null);
    setSuccessNote(null);
    setGoogleBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) {
        setGoogleBusy(false);
        setErrorNote("Google sign-in failed. Please try again.");
      }
    } catch {
      setGoogleBusy(false);
      setErrorNote("Could not initiate Google authentication.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07060d] px-4 py-8 text-foreground selection:bg-purple-500/30">
      <div className="w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="flex flex-col items-center gap-3 text-center">
          <Link
            to="/"
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-pink-500 via-purple-600 to-cyan-400 p-0.5 shadow-xl shadow-purple-500/20 hover:scale-105 transition-transform"
          >
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[#0d0a1a]">
              <Disc3 className="h-7 w-7 text-pink-400 animate-spin-slow" />
            </div>
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Melody<span className="bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-300 bg-clip-text text-transparent">Map</span>
            </h1>
            <p className="text-xs text-purple-200/60 mt-1">
              Sync your favourites, playlists, and AI picks across all your devices
            </p>
          </div>
        </div>

        {/* Auth Card */}
        <div className="rounded-3xl border border-white/10 bg-[#100d1d]/90 p-6 sm:p-7 shadow-2xl backdrop-blur-xl">
          {/* Mode Switcher */}
          {mode !== "forgot" ? (
            <div className="mb-6 flex rounded-full bg-white/[0.04] p-1 border border-white/5 text-xs font-semibold">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setErrorNote(null);
                    setSuccessNote(null);
                  }}
                  className={`flex-1 rounded-full py-2.5 transition-all duration-200 ${
                    mode === m
                      ? "bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  {m === "signin" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>
          ) : (
            <div className="mb-6 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setErrorNote(null);
                  setSuccessNote(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-purple-300 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
              </button>
              <span className="text-xs font-semibold text-white/70">Reset Password</span>
            </div>
          )}

          {/* Error Banner */}
          {errorNote && (
            <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <p className="flex-1 leading-relaxed">{errorNote}</p>
            </div>
          )}

          {/* Success Banner */}
          {successNote && (
            <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              <p className="flex-1 leading-relaxed">{successNote}</p>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs text-white/80 font-medium">Display Name</Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={60}
                    placeholder="Your name or nickname"
                    className="h-10 rounded-xl border-white/10 bg-white/[0.04] pl-10 text-xs text-white placeholder:text-white/30 focus:border-purple-500/50"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-white/80 font-medium">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <Input
                  id="email"
                  type="email"
                  required
                  maxLength={255}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="h-10 rounded-xl border-white/10 bg-white/[0.04] pl-10 text-xs text-white placeholder:text-white/30 focus:border-purple-500/50"
                />
              </div>
            </div>

            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs text-white/80 font-medium">Password</Label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setErrorNote(null);
                        setSuccessNote(null);
                      }}
                      className="text-[11px] text-purple-300 hover:text-purple-200 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    maxLength={72}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="h-10 rounded-xl border-white/10 bg-white/[0.04] pl-10 pr-10 text-xs text-white placeholder:text-white/30 focus:border-purple-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-10 rounded-xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 font-semibold text-white shadow-lg shadow-purple-500/20 hover:brightness-110 active:scale-[0.99] transition-all"
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "signin" ? (
                "Sign In to MelodyMap"
              ) : mode === "signup" ? (
                "Create Account"
              ) : (
                "Send Password Reset Link"
              )}
            </Button>
          </form>

          {mode !== "forgot" && (
            <>
              <div className="my-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                <span className="h-px flex-1 bg-white/10" />
                or continue with
                <span className="h-px flex-1 bg-white/10" />
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-10 rounded-xl border-white/10 bg-white/[0.03] text-xs font-medium text-white hover:bg-white/[0.08] hover:text-white transition-colors"
                disabled={googleBusy}
                onClick={() => void google()}
              >
                {googleBusy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.1-2 .4-2.8L1.9 6.3C.7 8.7 0 11.3 0 14s.7 5.3 1.9 7.7l3.7-2.9z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
                    />
                  </svg>
                )}
                Google Account
              </Button>
            </>
          )}
        </div>

        {/* Guest Mode Back Link */}
        <p className="text-center text-xs text-white/40">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 hover:text-purple-300 underline underline-offset-4 transition-colors"
          >
            <span>Continue listening as guest (local only)</span>
          </Link>
        </p>
      </div>
    </main>
  );
}
