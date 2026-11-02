import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Compass,
  Eye,
  EyeOff,
  HelpCircle,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  Sparkles,
  User,
} from "lucide-react";
import { useEffect, useState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { safeStorage } from "@/lib/safe-storage";

export function formatAuthError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("unauthorized-domain") || lower.includes("unauthorized domain")) {
    return "This domain is not authorized. Please add this domain under Authentication > Settings > Authorized domains / Redirect URLs.";
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
    lower.includes("otp_expired") ||
    lower.includes("email link is invalid") ||
    lower.includes("token has expired") ||
    lower.includes("expired token")
  ) {
    return "Your verification link has expired or is invalid. Please request a new verification link.";
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
    lower.includes("missing supabase")
  ) {
    return "Authentication service is currently not configured or unavailable. Please try again later or continue as a guest.";
  }
  if (
    lower.includes("localstorage") ||
    lower.includes("access is denied") ||
    lower.includes("quotaexceeded")
  ) {
    return "Browser storage is restricted in this window. You can still explore as a guest or open in a standard browser.";
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

type AuthMode = "signin" | "signup" | "forgot" | "reset_password" | "verify_email";

function getPasswordStrength(pwd: string): { score: number; label: string; color: string } {
  if (!pwd) return { score: 0, label: "", color: "#E9DDFD" };
  let score = 0;
  if (pwd.length >= 6) score += 1;
  if (pwd.length >= 9) score += 1;
  if (/[0-9]/.test(pwd) && /[a-zA-Z]/.test(pwd)) score += 1;
  if (/[^a-zA-Z0-9]/.test(pwd)) score += 1;

  switch (score) {
    case 1:
      return { score: 1, label: "Weak", color: "#C4B5FD" };
    case 2:
      return { score: 2, label: "Fair", color: "#A78BFA" };
    case 3:
      return { score: 3, label: "Good", color: "#9333EA" };
    case 4:
      return { score: 4, label: "Strong", color: "#7C3AED" };
    default:
      return { score: 0, label: "Too short", color: "#E9DDFD" };
  }
}

function AuthPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const formId = useId();

  const [mode, setMode] = useState<AuthMode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [errorNote, setErrorNote] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  // Parse initial recovery or callback intent from URL or global events
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash || "";
    const search = window.location.search || "";
    const fullParams = new URLSearchParams(search + (hash.startsWith("#") ? "?" + hash.slice(1) : ""));

    if (fullParams.get("type") === "recovery" || hash.includes("type=recovery")) {
      setMode("reset_password");
    }

    const err = fullParams.get("error_description") || fullParams.get("error");
    if (err) {
      setErrorNote(formatAuthError(decodeURIComponent(err.replace(/\+/g, " "))));
    }

    const onRecovery = () => setMode("reset_password");
    window.addEventListener("melodymap:password-recovery", onRecovery);
    return () => window.removeEventListener("melodymap:password-recovery", onRecovery);
  }, []);

  // Redirect to home if user is signed in (unless resetting password)
  useEffect(() => {
    if (auth.userId && mode !== "reset_password") {
      safeStorage.removeItem("melodymap.guest_mode");
      void navigate({ to: "/", replace: true });
    }
  }, [navigate, mode, auth.userId]);

  // Resend cooldown timer countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleGoogleSignIn = async () => {
    setGoogleBusy(true);
    setErrorNote(null);
    setSuccessNote(null);
    try {
      const res = await auth.signInWithGoogle();
      if (res.success) {
        setSuccessNote("Connecting with Google...");
      } else {
        setErrorNote(formatAuthError(res.error || "Google Sign-in failed"));
      }
    } catch (err: any) {
      setErrorNote(formatAuthError(err?.message || "Google Sign-in failed"));
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleResendVerification = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorNote("Please enter your email address.");
      return;
    }
    setResending(true);
    setErrorNote(null);
    try {
      const res = await auth.resendVerificationEmail(trimmedEmail);
      if (res.success) {
        setSuccessNote("Verification email resent! Please check your inbox or spam.");
        setResendCooldown(45);
      } else {
        setErrorNote(formatAuthError(res.error || "Failed to resend verification email"));
      }
    } catch (err: any) {
      setErrorNote(formatAuthError(err?.message || "Failed to resend verification email"));
    } finally {
      setResending(false);
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
          setSuccessNote("Password reset instructions sent! Check your inbox.");
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
          if (res.requiresVerification) {
            setMode("verify_email");
            setSuccessNote(`Verification email sent to ${trimmedEmail}!`);
            setResendCooldown(30);
          } else {
            setSuccessNote(`Welcome, ${trimmedName}! Account created.`);
            setTimeout(() => {
              void navigate({ to: "/", replace: true });
            }, 800);
          }
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

  const continueAsGuest = async () => {
    try {
      if (typeof supabase?.auth?.signInAnonymously === "function") {
        await supabase.auth.signInAnonymously({
          options: {
            data: { display_name: "Listener" },
          },
        });
      }
    } catch {}
    safeStorage.setItem("melodymap.guest_mode", "true");
    void navigate({ to: "/", replace: true });
  };

  const passwordStrength = getPasswordStrength(password);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div
      className="flex min-h-screen flex-col justify-center px-4 py-8 sm:px-6 lg:px-8 selection:bg-[#F3EEFF] selection:text-[#7C3AED]"
      style={{
        backgroundColor: "#FAF9FF",
        color: "#191329",
      }}
    >
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Navigation Escape Back to Music */}
        <div className="flex justify-center mb-2">
          <Link
            to="/"
            className="flex items-center gap-2 text-xs text-[#716A80] hover:text-[#191329] transition-colors py-2 px-3 rounded-full hover:bg-[#F3EEFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] min-h-[44px]"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            <span className="font-medium">Back to music</span>
          </Link>
        </div>

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3 group">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#7C3AED]/20 to-[#9333EA]/20 blur-md opacity-70 group-hover:opacity-100 transition duration-300" />
            <picture>
              <source srcSet="/brand/app-icon.webp" type="image/webp" />
              <img
                src="/brand/app-icon.png"
                alt="MelodyMap"
                loading="eager"
                fetchPriority="high"
                width={56}
                height={56}
                className="relative h-14 w-14 rounded-2xl object-contain shadow-sm border border-[#E9DDFD] bg-white p-1"
              />
            </picture>
          </div>

          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#191329] font-display">
            {mode === "signin" && "Your music. Your mood. Your Melody."}
            {mode === "signup" && "Join MelodyMap"}
            {mode === "verify_email" && "Check your inbox"}
            {mode === "forgot" && "Reset your password"}
            {mode === "reset_password" && "Set new password"}
          </h1>

          <p className="mt-1.5 text-xs sm:text-sm text-[#716A80] max-w-sm leading-relaxed">
            {mode === "signin" && "Sign in to keep your music, playlists and discoveries in sync."}
            {mode === "signup" && "Create your free account to save favorites and listen across devices."}
            {mode === "verify_email" && `We've sent a verification link to ${email || "your email"}.`}
            {mode === "forgot" && "Enter your email to receive password reset instructions."}
            {mode === "reset_password" && "Enter a secure new password for your account."}
          </p>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div
          className="rounded-3xl bg-white border border-[#E9DDFD] p-6 sm:p-8 shadow-[0_12px_40px_rgba(124,58,237,0.08)] space-y-4"
          style={{ backgroundColor: "#FFFFFF" }}
        >
          {/* Notifications & Status Banners */}
          {errorNote && (
            <div
              id="auth-error-note"
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-2.5 rounded-2xl bg-[#FFF5F5] border border-[#FED7D7] p-3.5 text-xs text-[#C53030]"
            >
              <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="flex-1 font-medium leading-relaxed">{errorNote}</p>
            </div>
          )}

          {successNote && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-start gap-2.5 rounded-2xl bg-[#F3EEFF] border border-[#E9DDFD] p-3.5 text-xs text-[#7C3AED]"
            >
              <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="flex-1 font-medium leading-relaxed">{successNote}</p>
            </div>
          )}

          {/* Primary Social Hero: Continue with Google */}
          {mode !== "reset_password" && mode !== "verify_email" && (
            <div className="space-y-2.5 pt-1">
              <Button
                type="button"
                variant="outline"
                disabled={googleBusy || submitting}
                onClick={handleGoogleSignIn}
                className="w-full h-11 rounded-2xl bg-white hover:bg-[#FAF9FF] text-[#191329] border border-[#E9DDFD] font-semibold flex items-center justify-center gap-2.5 shadow-sm active:scale-[0.99] transition-all text-xs"
              >
                {googleBusy ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-[#7C3AED]" />
                ) : (
                  <svg aria-hidden="true" focusable="false" className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
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

              <div className="relative flex items-center justify-center my-3.5">
                <div className="border-t border-[#E9DDFD] w-full" />
                <span className="bg-white px-3 text-[10px] text-[#716A80] uppercase tracking-wider font-medium">
                  or continue with email
                </span>
              </div>
            </div>
          )}

          {/* Mode Switcher Tabs */}
          {mode !== "reset_password" && mode !== "forgot" && mode !== "verify_email" && (
            <div
              role="tablist"
              aria-label="Authentication mode"
              className="flex rounded-2xl bg-[#FAF9FF] p-1 border border-[#E9DDFD]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signin"}
                aria-controls="auth-form"
                onClick={() => {
                  setMode("signin");
                  setErrorNote(null);
                  setSuccessNote(null);
                }}
                className={`flex-1 rounded-xl py-2 min-h-[44px] flex items-center justify-center text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] ${
                  mode === "signin"
                    ? "bg-[#7C3AED] text-white shadow-sm"
                    : "text-[#716A80] hover:text-[#191329]"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                aria-controls="auth-form"
                onClick={() => {
                  setMode("signup");
                  setErrorNote(null);
                  setSuccessNote(null);
                }}
                className={`flex-1 rounded-xl py-2 min-h-[44px] flex items-center justify-center text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] ${
                  mode === "signup"
                    ? "bg-[#7C3AED] text-white shadow-sm"
                    : "text-[#716A80] hover:text-[#191329]"
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Dedicated Verify Email Screen */}
          {mode === "verify_email" && (
            <div className="space-y-4 py-2">
              <div className="rounded-2xl bg-[#FAF9FF] border border-[#E9DDFD] p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[#F3EEFF] text-[#7C3AED] flex items-center justify-center shrink-0">
                    <Mail aria-hidden="true" className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#191329]">Verification link sent</p>
                    <p className="text-[11px] text-[#716A80] break-all">{email}</p>
                  </div>
                </div>

                <div className="text-[11px] text-[#716A80] space-y-1.5 border-t border-[#E9DDFD] pt-2.5">
                  <p>1. Open your email app and click the confirmation link.</p>
                  <p>2. Check your spam/junk folder if not received in 1 minute.</p>
                  <p className="text-[#7C3AED] font-medium">
                    Tip: If opened in Gmail/Outlook webview, tap (⋮) &gt; "Open in Chrome / Browser" to keep your session saved.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={resending || resendCooldown > 0}
                  onClick={handleResendVerification}
                  className="w-full h-11 rounded-2xl border-[#E9DDFD] text-[#191329] hover:bg-[#FAF9FF] text-xs font-semibold flex items-center justify-center gap-2"
                >
                  {resending ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-[#7C3AED]" />
                  ) : (
                    <RefreshCw aria-hidden="true" className="h-3.5 w-3.5 text-[#7C3AED]" />
                  )}
                  <span>
                    {resendCooldown > 0
                      ? `Resend available in ${resendCooldown}s`
                      : "Resend verification link"}
                  </span>
                </Button>

                <Button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setErrorNote(null);
                    setSuccessNote(null);
                  }}
                  className="w-full h-11 rounded-2xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold shadow-md shadow-[#7C3AED]/20"
                >
                  I've confirmed my email · Sign In
                </Button>
              </div>
            </div>
          )}

          {/* Form Content */}
          {mode !== "verify_email" && (
            <form id="auth-form" onSubmit={handleSubmit} className="space-y-3.5">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="auth-name" className="text-xs font-semibold text-[#191329]">
                    Full Name
                  </Label>
                  <div className="relative">
                    <User aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#716A80] pointer-events-none" />
                    <Input
                      id="auth-name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      placeholder="Jane Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={submitting}
                      aria-invalid={Boolean(errorNote)}
                      aria-describedby={errorNote ? "auth-error-note" : undefined}
                      className="pl-10 bg-[#FAF9FF] border-[#E9DDFD] text-[#191329] placeholder:text-[#716A80]/70 h-11 rounded-2xl focus-visible:ring-2 focus-visible:ring-[#7C3AED]/40 focus:border-[#7C3AED]"
                      required
                    />
                  </div>
                </div>
              )}

              {mode !== "reset_password" && (
                <div className="space-y-1.5">
                  <Label htmlFor="auth-email" className="text-xs font-semibold text-[#191329]">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#716A80] pointer-events-none" />
                    <Input
                      id="auth-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={submitting}
                      aria-invalid={Boolean(errorNote)}
                      aria-describedby={errorNote ? "auth-error-note" : undefined}
                      className="pl-10 bg-[#FAF9FF] border-[#E9DDFD] text-[#191329] placeholder:text-[#716A80]/70 h-11 rounded-2xl focus-visible:ring-2 focus-visible:ring-[#7C3AED]/40 focus:border-[#7C3AED]"
                      required
                    />
                  </div>
                </div>
              )}

              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auth-password" className="text-xs font-semibold text-[#191329]">
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
                        className="text-xs text-[#7C3AED] hover:text-[#6D28D9] font-medium min-h-[44px] inline-flex items-center px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] rounded"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <Lock aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#716A80] pointer-events-none" />
                    <Input
                      id="auth-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={submitting}
                      aria-invalid={Boolean(errorNote)}
                      aria-describedby={errorNote ? "auth-error-note" : undefined}
                      className="pl-10 pr-12 bg-[#FAF9FF] border-[#E9DDFD] text-[#191329] placeholder:text-[#716A80]/70 h-11 rounded-2xl focus-visible:ring-2 focus-visible:ring-[#7C3AED]/40 focus:border-[#7C3AED]"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#716A80] hover:text-[#191329] transition-colors rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
                    >
                      {showPassword ? (
                        <EyeOff aria-hidden="true" className="h-4 w-4" />
                      ) : (
                        <Eye aria-hidden="true" className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* Password Strength Meter (for Sign Up and Password Reset) */}
                  {(mode === "signup" || mode === "reset_password") && password.length > 0 && (
                    <div className="pt-1 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#716A80]">Password strength:</span>
                        <span className="font-semibold text-[#7C3AED]">{passwordStrength.label}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 h-1.5">
                        {[1, 2, 3, 4].map((bar) => (
                          <div
                            key={bar}
                            className="rounded-full transition-all duration-300"
                            style={{
                              backgroundColor:
                                bar <= passwordStrength.score ? passwordStrength.color : "#E9DDFD",
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(mode === "signup" || mode === "reset_password") && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auth-confirm-password" className="text-xs font-semibold text-[#191329]">
                      Confirm Password
                    </Label>
                    {passwordsMatch && (
                      <span className="text-[11px] text-[#7C3AED] font-medium flex items-center gap-1">
                        <Check className="h-3 w-3" /> Passwords match
                      </span>
                    )}
                    {passwordsMismatch && (
                      <span className="text-[11px] text-[#C53030] font-medium">
                        Passwords do not match
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Lock aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#716A80] pointer-events-none" />
                    <Input
                      id="auth-confirm-password"
                      name="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={submitting}
                      aria-invalid={Boolean(errorNote)}
                      aria-describedby={errorNote ? "auth-error-note" : undefined}
                      className="pl-10 pr-12 bg-[#FAF9FF] border-[#E9DDFD] text-[#191329] placeholder:text-[#716A80]/70 h-11 rounded-2xl focus-visible:ring-2 focus-visible:ring-[#7C3AED]/40 focus:border-[#7C3AED]"
                      required
                    />
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting || googleBusy}
                aria-busy={submitting}
                className="w-full h-11 rounded-2xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold shadow-md shadow-[#7C3AED]/20 active:scale-[0.99] transition-all text-xs"
              >
                {submitting ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin mr-2" />
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
          )}

          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setErrorNote(null);
                setSuccessNote(null);
              }}
              className="w-full py-2 min-h-[44px] flex items-center justify-center text-xs text-[#716A80] hover:text-[#191329] font-medium transition-colors text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] rounded-xl"
            >
              Back to Sign In
            </button>
          )}

          {/* Guest Exploration Escape */}
          <div className="pt-3 border-t border-[#E9DDFD] text-center">
            <button
              type="button"
              onClick={continueAsGuest}
              className="min-h-[44px] py-2 px-4 inline-flex items-center justify-center gap-1.5 text-xs text-[#716A80] hover:text-[#7C3AED] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] rounded-full hover:bg-[#F3EEFF]"
            >
              <Compass aria-hidden="true" className="h-3.5 w-3.5 text-[#7C3AED]" />
              <span>Explore as Guest &rarr;</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
