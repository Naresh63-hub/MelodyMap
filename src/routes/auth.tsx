import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

export function formatAuthError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("unauthorized-domain") || lower.includes("unauthorized domain")) {
    return "This domain is not authorized in Firebase Console. Please add this domain under Firebase Authentication > Settings > Authorized domains.";
  }
  if (
    lower.includes("invalid-credential") ||
    lower.includes("invalid login credentials") ||
    lower.includes("invalid_grant") ||
    lower.includes("wrong-password") ||
    lower.includes("user-not-found")
  ) {
    return "Incorrect email or password. Please check your details and try again.";
  }
  if (lower.includes("email not confirmed")) {
    return "Please confirm your email before signing in. Check your inbox or spam folder.";
  }
  if (
    lower.includes("email-already-in-use") ||
    lower.includes("user already registered") ||
    lower.includes("already exists")
  ) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (
    lower.includes("weak-password") ||
    lower.includes("password should be at least") ||
    lower.includes("password must be at least")
  ) {
    return "Password must be at least 6 characters long.";
  }
  if (
    lower.includes("too-many-requests") ||
    lower.includes("too many requests") ||
    lower.includes("rate limit")
  ) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("connection refused") ||
    lower.includes("network-request-failed")
  ) {
    return "Network connection issue. Please check your internet connection or continue as guest.";
  }
  if (
    lower.includes("not configured") ||
    lower.includes("missing supabase") ||
    lower.includes("missing firebase")
  ) {
    return "Authentication service is currently not configured or unavailable. Please try again later or continue as a guest.";
  }
  if (lower.includes("popup-closed-by-user") || lower.includes("cancelled")) {
    return "Sign in was cancelled.";
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
          "Sign in to MelodyMap with Google or email to sync your favourites, playlists, and recommendations across devices.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "reset_password">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [errorNote, setErrorNote] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  useEffect(() => {
    if (auth.userId && mode !== "reset_password") {
      if (typeof window !== "undefined") {
        localStorage.removeItem("melodymap.guest_mode");
      }
      void navigate({ to: "/", replace: true });
    }
  }, [navigate, mode, auth.userId]);

  const handleGoogleSignIn = async () => {
    setGoogleBusy(true);
    setErrorNote(null);
    setSuccessNote(null);
    try {
      const res = await auth.signInWithGoogle();
      if (res.success) {
        setSuccessNote("Redirecting to Google Sign-in...");
      } else {
        setErrorNote(formatAuthError(res.error || "Google Sign-in failed"));
      }
    } catch (err: any) {
      setErrorNote(formatAuthError(err?.message || "Google Sign-in failed"));
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNote(null);
    setSuccessNote(null);
    setSubmitting(true);

    if (mode === "reset_password") {
      if (!password || password.length < 6) {
        setSubmitting(false);
        setErrorNote("New password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setSubmitting(false);
        setErrorNote("Passwords do not match.");
        return;
      }
      try {
        const res = await auth.updatePassword(password);
        if (res.success) {
          setSuccessNote("Password updated! Redirecting to home...");
          setTimeout(() => {
            void navigate({ to: "/", replace: true });
          }, 800);
        } else {
          setErrorNote(formatAuthError(res.error || "Failed to update password"));
        }
      } catch (err: any) {
        setErrorNote(formatAuthError(err?.message || "Failed to update password"));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === "forgot") {
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        setSubmitting(false);
        setErrorNote("Please enter your email address.");
        return;
      }
      try {
        const res = await auth.resetPassword(trimmedEmail);
        if (res.success) {
          setSuccessNote("Password reset instructions sent to your email! Check your inbox.");
          setTimeout(() => setMode("signin"), 3000);
        } else {
          setErrorNote(formatAuthError(res.error || "Failed to send reset email"));
        }
      } catch (err: any) {
        setErrorNote(formatAuthError(err?.message || "Failed to send reset email"));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === "signup") {
      const trimmedName = name.trim();
      const trimmedEmail = email.trim();
      if (!trimmedName) {
        setSubmitting(false);
        setErrorNote("Please enter your name.");
        return;
      }
      if (!trimmedEmail || !trimmedEmail.includes("@")) {
        setSubmitting(false);
        setErrorNote("Please enter a valid email address.");
        return;
      }
      if (!password || password.length < 6) {
        setSubmitting(false);
        setErrorNote("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setSubmitting(false);
        setErrorNote("Passwords do not match.");
        return;
      }

      try {
        const res = await auth.signUpWithEmail(trimmedEmail, password, trimmedName);
        if (res.success) {
          setSuccessNote(`Welcome, ${trimmedName}! Account created.`);
          setTimeout(() => {
            void navigate({ to: "/", replace: true });
          }, 800);
        } else {
          setErrorNote(formatAuthError(res.error || "Sign-up failed"));
        }
      } catch (err: any) {
        setErrorNote(formatAuthError(err?.message || "Sign-up failed"));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === "signin") {
      const trimmedEmail = email.trim();
      if (!trimmedEmail || !trimmedEmail.includes("@")) {
        setSubmitting(false);
        setErrorNote("Please enter a valid email address.");
        return;
      }
      if (!password) {
        setSubmitting(false);
        setErrorNote("Please enter your password.");
        return;
      }

      try {
        const res = await auth.signInWithEmail(trimmedEmail, password);
        if (res.success) {
          setSuccessNote("Signed in successfully!");
          setTimeout(() => {
            void navigate({ to: "/", replace: true });
          }, 600);
        } else {
          setErrorNote(formatAuthError(res.error || "Invalid credentials"));
        }
      } catch (err: any) {
        setErrorNote(formatAuthError(err?.message || "Invalid credentials"));
      } finally {
        setSubmitting(false);
      }
    }
  };

  const continueAsGuest = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("melodymap.guest_mode", "true");
    }
    void navigate({ to: "/", replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-[#080808] px-4 py-8 sm:px-6 lg:px-8 text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-2">
          <Link
            to="/"
            className="flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to music</span>
          </Link>
        </div>

        <div className="flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1DB954]/20 to-[#1DB954]/5 border border-[#1DB954]/30 shadow-lg mb-3">
            <Sparkles className="h-6 w-6 text-[#1DB954]" />
          </div>
          <h2 className="text-center text-2xl font-semibold tracking-tight text-white">
            {mode === "signin" && "Sign in to MelodyMap"}
            {mode === "signup" && "Create an account"}
            {mode === "forgot" && "Reset your password"}
            {mode === "reset_password" && "Set new password"}
          </h2>
          <p className="mt-1.5 text-center text-xs text-white/50">
            {mode === "signin" && "Sign in with Google or email to sync across all your devices"}
            {mode === "signup" && "Create an account to keep your listening history and favourites safe"}
            {mode === "forgot" && "Enter your email to receive password reset instructions"}
            {mode === "reset_password" && "Enter a secure new password for your account"}
          </p>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl bg-[#121212] border border-white/10 p-6 sm:p-8 shadow-2xl space-y-4">
          {/* Notification alerts */}
          {errorNote && (
            <div className="flex items-center gap-2.5 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p className="flex-1">{errorNote}</p>
            </div>
          )}
          {successNote && (
            <div className="flex items-center gap-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <p className="flex-1">{successNote}</p>
            </div>
          )}

          {/* Mode Switcher */}
          {mode !== "reset_password" && mode !== "forgot" && (
            <div className="flex rounded-xl bg-white/[0.04] p-1 border border-white/5">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setErrorNote(null);
                  setSuccessNote(null);
                }}
                className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${
                  mode === "signin"
                    ? "bg-[#1DB954] text-black shadow-md"
                    : "text-white/60 hover:text-white"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setErrorNote(null);
                  setSuccessNote(null);
                }}
                className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${
                  mode === "signup"
                    ? "bg-[#1DB954] text-black shadow-md"
                    : "text-white/60 hover:text-white"
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Google Sign-in */}
          {mode !== "reset_password" && (
            <div className="space-y-3 pt-1">
              <Button
                type="button"
                variant="outline"
                disabled={googleBusy || submitting}
                onClick={handleGoogleSignIn}
                className="w-full h-11 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 border-none font-medium flex items-center justify-center gap-2.5 shadow-sm active:scale-95 transition-all text-xs"
              >
                {googleBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin text-neutral-900" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>Continue with Google</span>
              </Button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-white/10 w-full" />
                <span className="bg-[#121212] px-2 text-[10px] text-white/40 uppercase tracking-widest font-mono">
                  or with email
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-white/70 font-medium">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input
                    type="text"
                    placeholder="Your Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={submitting}
                    className="pl-9 bg-white/[0.05] border-white/10 text-white placeholder:text-white/30 h-10 rounded-xl focus:border-[#1DB954]"
                    required
                  />
                </div>
              </div>
            )}

            {mode !== "reset_password" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-white/70 font-medium">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                    className="pl-9 bg-white/[0.05] border-white/10 text-white placeholder:text-white/30 h-10 rounded-xl focus:border-[#1DB954]"
                    required
                  />
                </div>
              </div>
            )}

            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-white/70 font-medium">
                    {mode === "reset_password" ? "New Password" : "Password"}
                  </Label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setErrorNote(null);
                        setSuccessNote(null);
                      }}
                      className="text-[11px] text-[#1DB954] hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    className="pl-9 pr-9 bg-white/[0.05] border-white/10 text-white placeholder:text-white/30 h-10 rounded-xl focus:border-[#1DB954]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {(mode === "signup" || mode === "reset_password") && (
              <div className="space-y-1.5">
                <Label className="text-xs text-white/70 font-medium">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input
                    type="password"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={submitting}
                    className="pl-9 bg-white/[0.05] border-white/10 text-white placeholder:text-white/30 h-10 rounded-xl focus:border-[#1DB954]"
                    required
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting || googleBusy}
              className="w-full h-11 rounded-xl bg-[#1DB954] hover:bg-[#1aa34a] text-black font-semibold shadow-lg shadow-[#1DB954]/20 transition-all text-xs"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : mode === "signin" ? (
                "Sign In"
              ) : mode === "signup" ? (
                "Create Account"
              ) : mode === "forgot" ? (
                "Send Reset Link"
              ) : (
                "Update Password"
              )}
            </Button>
          </form>

          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="w-full py-2 text-xs text-white/60 hover:text-white transition-colors text-center"
            >
              Back to Sign In
            </button>
          )}

          <div className="pt-2 border-t border-white/[0.06] text-center">
            <button
              type="button"
              onClick={continueAsGuest}
              className="text-xs text-white/40 hover:text-white transition-colors"
            >
              Skip for now · Continue as Guest
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
