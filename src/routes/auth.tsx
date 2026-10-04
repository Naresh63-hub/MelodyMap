import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseEnv, supabase } from "@/integrations/supabase/client";
import { isNativeApp, startGoogleOAuth } from "@/lib/auth-deep-link";
import {
  isNativeGoogleAuthSupported,
  getGoogleWebClientId,
  setGoogleWebClientId,
  signInWithNativeGoogle,
} from "@/lib/native-google-auth";

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

function isRecoveryUrl(): boolean {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash;
  const search = window.location.search;
  return (
    hash.includes("type=recovery") ||
    search.includes("type=recovery") ||
    search.includes("reset=true")
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "reset_password">(() => {
    return isRecoveryUrl() ? "reset_password" : "signin";
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(() => {
    if (typeof window !== "undefined") {
      if (isRecoveryUrl()) return false;
      const h = window.location.hash;
      const s = window.location.search;
      return h.includes("access_token") || s.includes("code=");
    }
    return false;
  });
  const [errorNote, setErrorNote] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(() => {
    return isRecoveryUrl() ? "Password recovery link verified. Enter your new password below." : null;
  });
  const [showGoogleConfigModal, setShowGoogleConfigModal] = useState(false);
  const [customGoogleClientId, setCustomGoogleClientId] = useState(() => getGoogleWebClientId());
  const [copiedSha1, setCopiedSha1] = useState(false);
  const supabaseEnv = getSupabaseEnv();
  const isConfigured = supabaseEnv.isConfigured;

  useEffect(() => {
    if (!isConfigured) return;

    if (isRecoveryUrl()) {
      setOauthLoading(false);
      setMode("reset_password");
      setSuccessNote("Password recovery link verified. Enter your new password below.");
    }

    const isNative = isNativeApp();
    const isMobileBrowser = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const hasAuthParams = typeof window !== "undefined" && (
      window.location.search.includes("code=") ||
      window.location.hash.includes("access_token=") ||
      window.location.search.includes("native_return")
    );
    const isReturningToApp = !isNative && isMobileBrowser && hasAuthParams;

    if (isReturningToApp && typeof window !== "undefined") {
      const returnDeepLink = `com.melodymap.music://auth/callback${window.location.search}${window.location.hash}`;
      try {
        window.location.href = returnDeepLink;
      } catch {}
    }

    // Listen for auth state change (Google OAuth exchange, email confirmation, recovery, etc.)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || isRecoveryUrl()) {
        setOauthLoading(false);
        setMode("reset_password");
        setSuccessNote("Password recovery link verified. Enter your new password below.");
        return;
      }

      if (session && mode !== "reset_password" && !isRecoveryUrl()) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("melodymap.guest_mode");
        }
        if (!isReturningToApp) {
          void navigate({ to: "/", replace: true });
        }
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (isRecoveryUrl()) {
        setOauthLoading(false);
        setMode("reset_password");
        setSuccessNote("Password recovery link verified. Enter your new password below.");
        return;
      }

      if (data.session && mode !== "reset_password") {
        if (typeof window !== "undefined") {
          localStorage.removeItem("melodymap.guest_mode");
        }
        if (!isReturningToApp) {
          void navigate({ to: "/", replace: true });
        }
      }
    });

    const onAuthError = (event: Event) => {
      const custom = event as CustomEvent<{ error: string }>;
      setGoogleBusy(false);
      setOauthLoading(false);
      if (custom.detail?.error) {
        setErrorNote(custom.detail.error);
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("melodymap:auth-error", onAuthError);
    }

    return () => {
      authListener.subscription.unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener("melodymap:auth-error", onAuthError);
      }
    };
  }, [navigate, isConfigured, mode]);

  const handleContinueAsGuest = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("melodymap.guest_mode", "true");
    }
    void navigate({ to: "/", replace: true });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setErrorNote(null);
    setSuccessNote(null);

    if (!isConfigured) {
      if (mode === "reset_password" || mode === "forgot") {
        setBusy(false);
        setErrorNote("Password reset requires a cloud account. You can sign in directly or continue as guest.");
        return;
      }

      // Free flow of login: immediately log in locally
      const displayName = name.trim() || email.split("@")[0] || "Listener";
      if (typeof window !== "undefined") {
        localStorage.setItem("melodymap.guest_mode", "true");
        localStorage.setItem(
          "melodymap.local_user",
          JSON.stringify({
            id: "local-" + crypto.randomUUID(),
            name: displayName,
            email: email.trim(),
          }),
        );
      }
      setBusy(false);
      void navigate({ to: "/", replace: true });
      return;
    }

    if (mode === "reset_password") {
      if (!password || password.length < 6) {
        setBusy(false);
        setErrorNote("New password must be at least 6 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setBusy(false);
        setErrorNote("Passwords do not match. Please re-type your new password.");
        return;
      }

      try {
        // If an OTP code was entered manually, verify it first
        if (otpCode.trim() && email.trim()) {
          const { error: otpErr } = await supabase.auth.verifyOtp({
            email: email.trim(),
            token: otpCode.trim(),
            type: "recovery",
          });
          if (otpErr) {
            setBusy(false);
            setErrorNote(formatAuthError(otpErr.message));
            return;
          }
        }

        const { error } = await supabase.auth.updateUser({
          password: password,
        });

        setBusy(false);
        if (error) {
          setErrorNote(formatAuthError(error.message));
          return;
        }

        setSuccessNote("Password updated successfully! Welcome back to MelodyMap.");
        if (typeof window !== "undefined") {
          localStorage.removeItem("melodymap.guest_mode");
        }
        setTimeout(() => {
          void navigate({ to: "/", replace: true });
        }, 1200);
      } catch (err: any) {
        setBusy(false);
        setErrorNote(err?.message || "Failed to update password.");
      }
      return;
    }

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
        setSuccessNote(
          "Password reset link sent! Check your inbox (or spam) to open the reset link, or enter your 6-digit code below.",
        );
        // Switch to allow entering OTP / new password
        setMode("reset_password");
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
          const msg = error.message?.toLowerCase() || "";
          if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("connection")) {
            const displayName = name.trim() || email.split("@")[0] || "Listener";
            if (typeof window !== "undefined") {
              localStorage.setItem("melodymap.guest_mode", "true");
              localStorage.setItem(
                "melodymap.local_user",
                JSON.stringify({
                  id: "local-" + crypto.randomUUID(),
                  name: displayName,
                  email: email.trim(),
                }),
              );
            }
            void navigate({ to: "/", replace: true });
            return;
          }
          setErrorNote(formatAuthError(error.message));
          return;
        }

        if (data?.user) {
          try {
            await supabase.from("profiles").upsert(
              {
                id: data.user.id,
                display_name: name.trim() || email.split("@")[0] || null,
                avatar_url: null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id" }
            );
          } catch (e) {
            console.warn("[Auth] Profile upsert notice:", e);
          }
        }

        if (!data.session) {
          setSuccessNote("Account created! Check your inbox to confirm your email, then sign in.");
          setMode("signin");
          return;
        }
        void navigate({ to: "/", replace: true });
      } catch {
        setBusy(false);
        const displayName = name.trim() || email.split("@")[0] || "Listener";
        if (typeof window !== "undefined") {
          localStorage.setItem("melodymap.guest_mode", "true");
          localStorage.setItem(
            "melodymap.local_user",
            JSON.stringify({
              id: "local-" + crypto.randomUUID(),
              name: displayName,
              email: email.trim(),
            }),
          );
        }
        void navigate({ to: "/", replace: true });
      }
      return;
    }

    // Sign in mode
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      setBusy(false);
      if (error) {
        const msg = error.message?.toLowerCase() || "";
        if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("connection")) {
          const displayName = email.split("@")[0] || "Listener";
          if (typeof window !== "undefined") {
            localStorage.setItem("melodymap.guest_mode", "true");
            localStorage.setItem(
              "melodymap.local_user",
              JSON.stringify({
                id: "local-" + crypto.randomUUID(),
                name: displayName,
                email: email.trim(),
              }),
            );
          }
          void navigate({ to: "/", replace: true });
          return;
        }
        setErrorNote(formatAuthError(error.message));
        return;
      }

      if (data?.user) {
        try {
          const meta = data.user.user_metadata || {};
          await supabase.from("profiles").upsert(
            {
              id: data.user.id,
              display_name: meta["display_name"] || meta["full_name"] || meta["name"] || email.split("@")[0] || null,
              avatar_url: meta["avatar_url"] || null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          );
        } catch (e) {
          console.warn("[Auth] Sign-in profile sync notice:", e);
        }
      }

      void navigate({ to: "/", replace: true });
    } catch {
      setBusy(false);
      const displayName = email.split("@")[0] || "Listener";
      if (typeof window !== "undefined") {
        localStorage.setItem("melodymap.guest_mode", "true");
        localStorage.setItem(
          "melodymap.local_user",
          JSON.stringify({
            id: "local-" + crypto.randomUUID(),
            name: displayName,
            email: email.trim(),
          }),
        );
      }
      void navigate({ to: "/", replace: true });
    }
  };

  const google = async (forceWeb = false) => {
    setErrorNote(null);
    setSuccessNote(null);

    if (!isConfigured) {
      if (typeof window !== "undefined") {
        localStorage.setItem("melodymap.guest_mode", "true");
        localStorage.setItem(
          "melodymap.local_user",
          JSON.stringify({
            id: "local-google-" + crypto.randomUUID(),
            name: "Listener",
            email: "listener@local.dev",
          }),
        );
      }
      void navigate({ to: "/", replace: true });
      return;
    }

    setGoogleBusy(true);

    // 1. Direct Native Google Play Services 1-Tap Sign-In inside APK
    if (!forceWeb && isNativeGoogleAuthSupported()) {
      const clientId = customGoogleClientId.trim() || getGoogleWebClientId();
      if (!clientId) {
        setGoogleBusy(false);
        setShowGoogleConfigModal(true);
        return;
      }

      try {
        const res = await signInWithNativeGoogle(supabase, clientId);
        setGoogleBusy(false);
        if (res.success) {
          void navigate({ to: "/", replace: true });
          return;
        } else {
          setErrorNote(res.error || "Google Sign-In failed. Please try again.");
          return;
        }
      } catch (err: any) {
        setGoogleBusy(false);
        setErrorNote(err?.message || "Could not initiate native Google Sign-In.");
        return;
      }
    }

    // 2. Standard Web OAuth redirect
    try {
      const res = await startGoogleOAuth(supabase);
      if (!res.success) {
        setGoogleBusy(false);
        setErrorNote(res.error || "Google sign-in failed. Please try again.");
      }
    } catch (err: any) {
      setGoogleBusy(false);
      setErrorNote(err?.message || "Could not initiate Google authentication.");
    }
  };

  const isNative = isNativeApp();
  const isMobileBrowser = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const hasAuthParams = typeof window !== "undefined" && (
    window.location.search.includes("code=") ||
    window.location.hash.includes("access_token=") ||
    window.location.search.includes("native_return")
  );
  const isReturningToApp = !isNative && isMobileBrowser && hasAuthParams;

  if (isReturningToApp) {
    const returnDeepLink = `com.melodymap.music://auth/callback${typeof window !== "undefined" ? window.location.search + window.location.hash : ""}`;
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-black px-4 py-8 text-foreground text-center">
        <div className="flex flex-col items-center gap-5 max-w-sm w-full bg-[#121212] p-8 rounded-3xl border border-white/10 shadow-2xl animate-fade-in">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl p-0.5 shadow-xl bg-[#1DB954]/20 text-[#1DB954]">
            <CheckCircle2 className="h-9 w-9 text-[#1DB954]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Authenticated!</h2>
            <p className="text-xs text-neutral-400">Opening the MelodyMap app...</p>
          </div>
          <a
            href={returnDeepLink}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-[#1DB954] text-black font-bold text-sm hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[#1DB954]/20"
          >
            Open MelodyMap App
          </a>
          <button
            type="button"
            onClick={() => void navigate({ to: "/", replace: true })}
            className="text-xs text-neutral-500 hover:text-neutral-400 underline pt-2"
          >
            Continue in browser instead
          </button>
        </div>
      </main>
    );
  }

  if (oauthLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-black px-4 py-8 text-foreground">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl p-0.5 shadow-2xl shadow-black/60 animate-pulse">
            <img
              src="/brand/app-icon.png"
              alt="MelodyMap"
              className="h-full w-full rounded-2xl object-cover"
            />
          </div>
          <div className="flex items-center gap-2 text-white/70">
            <Loader2 className="h-5 w-5 animate-spin text-[#1DB954]" />
            <span className="text-sm font-semibold">Completing secure sign-in...</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 py-8 text-foreground selection:bg-white/20">
      <div className="w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="flex flex-col items-center gap-3 text-center">
          <Link
            to="/"
            className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-xl shadow-black/40 hover:scale-105 transition-transform"
          >
            <img
              src="/brand/app-icon.png"
              alt="MelodyMap"
              className="h-full w-full rounded-2xl object-cover"
            />
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Melody<span className="text-[#1DB954]">Map</span>
            </h1>
            <p className="text-xs text-white/50 mt-1">
              Your personalized music space
            </p>
          </div>
        </div>

        {/* Auth Card */}
        <div className="rounded-2xl border border-white/10 bg-[#121212] p-6 sm:p-7 shadow-2xl">
          {/* Mode Switcher */}
          {mode === "signin" || mode === "signup" ? (
            <div className="mb-6 flex rounded-full bg-white/[0.04] p-1 border border-white/10 text-xs font-semibold">
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
                      ? "bg-white text-black font-semibold shadow-sm"
                      : "text-white/60 hover:text-white"
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
                className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
              </button>
              <span className="text-xs font-semibold text-white/70">
                {mode === "reset_password" ? "Set New Password" : "Reset Password"}
              </span>
            </div>
          )}

          {/* Error Banner */}
          {errorNote && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <p className="flex-1 leading-relaxed">{errorNote}</p>
            </div>
          )}

          {/* Success Banner */}
          {successNote && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300 animate-in fade-in">
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
                    className="h-10 rounded-xl border-white/10 bg-white/[0.04] pl-10 text-xs text-white placeholder:text-white/30 focus:border-white/30"
                  />
                </div>
              </div>
            )}

            {/* Email Address */}
            {(mode === "signin" || mode === "signup" || mode === "forgot" || (mode === "reset_password" && !isRecoveryUrl())) && (
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
                    className="h-10 rounded-xl border-white/10 bg-white/[0.04] pl-10 text-xs text-white placeholder:text-white/30 focus:border-white/30"
                  />
                </div>
              </div>
            )}

            {/* Optional 6-digit OTP code for reset_password mode */}
            {mode === "reset_password" && !isRecoveryUrl() && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="otpCode" className="text-xs text-white/80 font-medium">
                    Reset Code / Token <span className="text-white/40 font-normal">(if received in email)</span>
                  </Label>
                </div>
                <Input
                  id="otpCode"
                  type="text"
                  maxLength={32}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="e.g. 123456 or token"
                  className="h-10 rounded-xl border-white/10 bg-white/[0.04] px-3.5 text-xs text-white placeholder:text-white/30 focus:border-white/30 font-mono"
                />
              </div>
            )}

            {/* Password input for Sign In / Sign Up */}
            {(mode === "signin" || mode === "signup") && (
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
                      className="text-[11px] text-white/50 hover:text-white transition-colors cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    maxLength={72}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="h-10 rounded-lg border-white/10 bg-white/[0.06] pl-10 pr-10 text-xs text-white placeholder:text-white/40 focus:border-white/30"
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

            {/* Password input & confirmation for reset_password mode */}
            {mode === "reset_password" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="new-password" className="text-xs text-white/80 font-medium">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      maxLength={72}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter at least 6 characters"
                      className="h-10 rounded-lg border-white/10 bg-white/[0.06] pl-10 pr-10 text-xs text-white placeholder:text-white/40 focus:border-white/30"
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

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password" className="text-xs text-white/80 font-medium">Confirm New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                    <Input
                      id="confirm-password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      maxLength={72}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your new password"
                      className="h-10 rounded-lg border-white/10 bg-white/[0.06] pl-10 text-xs text-white placeholder:text-white/40 focus:border-white/30"
                    />
                  </div>
                </div>
              </>
            )}

            <Button
              type="submit"
              className="w-full h-11 rounded-full bg-white hover:bg-white/90 font-semibold text-black text-sm active:scale-[0.99] transition-all cursor-pointer shadow-md"
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin text-black" />
              ) : mode === "signin" ? (
                "Sign In"
              ) : mode === "signup" ? (
                "Create Account"
              ) : mode === "forgot" ? (
                "Send Reset Link"
              ) : (
                "Save Password & Continue"
              )}
            </Button>

            {mode === "signin" && (
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={handleContinueAsGuest}
                  className="text-xs text-white/60 hover:text-white transition-colors cursor-pointer"
                >
                  Or continue without signing in →
                </button>
              </div>
            )}

            {mode === "forgot" && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode("reset_password");
                    setErrorNote(null);
                    setSuccessNote(null);
                  }}
                  className="text-xs text-white/60 hover:text-white underline underline-offset-4 transition-colors cursor-pointer"
                >
                  Already have a reset code? Enter new password
                </button>
              </div>
            )}
          </form>

          {mode !== "forgot" && mode !== "reset_password" && (
            <>
              <div className="my-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                <span className="h-px flex-1 bg-white/10" />
                or continue with
                <span className="h-px flex-1 bg-white/10" />
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-11 rounded-full border-white/10 bg-white/[0.04] text-xs font-semibold text-white hover:bg-white/[0.08] hover:text-white transition-colors"
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

              {isNativeGoogleAuthSupported() && (
                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => setShowGoogleConfigModal(true)}
                    className="inline-flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>Native 1-Tap Sign-In Settings</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {showGoogleConfigModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#121212] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-400" />
                  <h3 className="text-sm font-semibold text-white">Native 1-Tap Google Sign-In</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGoogleConfigModal(false)}
                  className="text-white/40 hover:text-white p-1 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-xs text-white/60 leading-relaxed">
                Sign in with 1 tap directly inside the APK without opening Chrome. Enter your Google OAuth Web Client ID (from Google Cloud Console / Supabase).
              </p>

              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/50 font-medium">Debug SHA-1 Fingerprint</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof navigator !== "undefined" && navigator.clipboard) {
                        void navigator.clipboard.writeText("F8:B9:BB:8B:0D:1A:D0:B8:2F:11:04:A9:13:94:32:C3:57:EE:6C:AB");
                        setCopiedSha1(true);
                        setTimeout(() => setCopiedSha1(false), 2000);
                      }
                    }}
                    className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer"
                  >
                    {copiedSha1 ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedSha1 ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="font-mono text-[10px] text-white/70 break-all bg-black/40 p-1.5 rounded select-all">
                  F8:B9:BB:8B:0D:1A:D0:B8:2F:11:04:A9:13:94:32:C3:57:EE:6C:AB
                </p>
                <p className="text-[10px] text-white/40">
                  Package: <span className="text-white/70 font-mono select-all">com.melodymap.music</span>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="googleClientId" className="text-xs text-white/80 font-medium">
                  Google OAuth Web Client ID
                </Label>
                <Input
                  id="googleClientId"
                  value={customGoogleClientId}
                  onChange={(e) => setCustomGoogleClientId(e.target.value)}
                  placeholder="e.g. 123456789-xxxx.apps.googleusercontent.com"
                  className="h-10 rounded-xl border-white/10 bg-white/[0.04] px-3.5 text-xs text-white placeholder:text-white/30 font-mono"
                />
              </div>

              <div className="space-y-2 pt-2">
                <Button
                  type="button"
                  disabled={!customGoogleClientId.trim()}
                  onClick={() => {
                    setGoogleWebClientId(customGoogleClientId.trim());
                    setShowGoogleConfigModal(false);
                    void google(false);
                  }}
                  className="w-full h-10 rounded-full bg-indigo-500 hover:bg-indigo-600 font-semibold text-white text-xs cursor-pointer shadow-md"
                >
                  Save & 1-Tap Sign In
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowGoogleConfigModal(false);
                    void google(true);
                  }}
                  className="w-full h-9 rounded-full text-white/60 hover:text-white text-xs cursor-pointer"
                >
                  Continue in Chrome / Browser Instead
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Free flow footer */}
        <p className="text-center text-xs text-white/40">
          <button
            type="button"
            onClick={handleContinueAsGuest}
            className="hover:text-white transition-colors cursor-pointer"
          >
            <span>Skip and listen as guest (local only)</span>
          </button>
        </p>
      </div>
    </main>
  );
}
