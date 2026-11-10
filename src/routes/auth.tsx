import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Compass,
  Eye,
  EyeOff,
  Headphones,
  Heart,
  Loader2,
  Lock,
  Mail,
  Mic,
  Music,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  User,
  Volume2,
} from "lucide-react";
import { useEffect, useState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { safeStorage } from "@/lib/safe-storage";
import { cn } from "@/lib/utils";

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
  if (!pwd) return { score: 0, label: "", color: "#E9DDFB" };
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
      return { score: 0, label: "Too short", color: "#E9DDFB" };
  }
}

// Decorative visual waveform heights for music aesthetic
const WAVEFORM_HEIGHTS = [
  "h-3", "h-6", "h-9", "h-5", "h-11", "h-7", "h-12", "h-6", "h-10", "h-8",
  "h-12", "h-5", "h-11", "h-7", "h-9", "h-4", "h-8", "h-3"
];

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
    <div className="min-h-screen bg-[#F8F5FF] dark:bg-[#0D0819] text-[#211536] dark:text-[#FFFFFF] selection:bg-[#F3EEFF] dark:selection:bg-[#2E1065] selection:text-[#8B5CF6] dark:selection:text-[#C084FC] transition-colors duration-300 relative overflow-x-hidden flex flex-col justify-between">
      {/* Soft Ambient Background Blooms & Floating Musical Notes matching screenshot */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-0">
        {/* Soft atmospheric lavender & violet radial blooms */}
        <div className="absolute top-12 right-12 w-80 sm:w-96 h-80 sm:h-96 rounded-full bg-gradient-to-br from-[#A855F7]/12 via-[#EC4899]/8 to-transparent blur-3xl" />
        <div className="absolute bottom-12 left-10 w-80 sm:w-96 h-80 sm:h-96 rounded-full bg-gradient-to-tr from-[#8B5CF6]/12 via-[#FF7A00]/8 to-transparent blur-3xl" />

        {/* Floating Musical Notes echoing the original UI reference */}
        <div className="absolute top-28 right-[14%] text-2xl sm:text-3xl font-serif text-[#A855F7]/35 select-none animate-pulse rotate-12 [animation-duration:4s]">
          ♪
        </div>
        <div className="absolute top-44 left-[7%] text-3xl sm:text-4xl font-serif text-[#8B5CF6]/30 select-none animate-pulse -rotate-12 [animation-duration:5s] [animation-delay:1s]">
          ♫
        </div>
        <div className="absolute top-1/3 left-[45%] text-xl font-serif text-[#EC4899]/30 select-none animate-pulse rotate-45 [animation-duration:3.5s] [animation-delay:2s]">
          ♪
        </div>
        <div className="absolute bottom-36 right-[8%] text-3xl font-serif text-[#8B5CF6]/35 select-none animate-pulse -rotate-6 [animation-duration:4.5s] [animation-delay:1.5s]">
          ♫
        </div>
        <div className="absolute bottom-24 left-[16%] text-2xl font-serif text-[#FF7A00]/25 select-none animate-pulse rotate-12 [animation-duration:6s] [animation-delay:0.5s]">
          ♪
        </div>
      </div>

      {/* TOP NAVIGATION BAR: Brand Logo + Wave Equalizer Tagline */}
      <header className="w-full flex items-center justify-between px-6 sm:px-12 py-5 lg:py-6 relative z-20 max-w-7xl mx-auto">
        {/* Left: Official MelodyMap Logo + Wordmark */}
        <Link
          to="/"
          aria-label="Back to MelodyMap Home"
          className="group flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] rounded-2xl cursor-pointer"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-[#8B5CF6]/25 rounded-2xl blur-md group-hover:blur-lg transition-all" />
            <picture>
              <source srcSet="/brand/app-icon.webp" type="image/webp" />
              <img
                src="/brand/app-icon.png"
                alt="MelodyMap"
                className="relative w-10 h-10 sm:w-11 sm:h-11 object-contain drop-shadow-sm select-none"
              />
            </picture>
          </div>
          <span className="text-xl sm:text-2xl font-black tracking-tight font-display">
            <span className="text-[#211536] dark:text-white">Melody</span>
            <span className="text-[#8B5CF6]">Map</span>
          </span>
        </Link>

        {/* Right: Tagline with Live Equalizer & Back Shortcut */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="hidden sm:flex items-center gap-2.5 text-xs lg:text-sm font-medium text-[#211536] dark:text-[#D4CBEA]">
            {/* Equalizer sound bars */}
            <div className="flex items-center gap-0.5 h-4" aria-hidden="true">
              <span className="w-1 h-2 bg-[#8B5CF6] rounded-full animate-pulse" />
              <span className="w-1 h-3.5 bg-[#A855F7] rounded-full animate-pulse [animation-delay:150ms]" />
              <span className="w-1 h-2.5 bg-[#EC4899] rounded-full animate-pulse [animation-delay:300ms]" />
              <span className="w-1 h-4 bg-[#8B5CF6] rounded-full animate-pulse [animation-delay:75ms]" />
              <span className="w-1 h-2 bg-[#A855F7] rounded-full animate-pulse [animation-delay:225ms]" />
            </div>
            <span className="tracking-wide">Your music. Your mood. Your Melody.</span>
          </div>

          <Link
            to="/"
            aria-label="Back to App"
            className="flex items-center gap-1.5 text-xs font-semibold text-[#746A85] dark:text-[#A69ABD] hover:text-[#8B5CF6] dark:hover:text-[#C084FC] transition-colors py-2 px-3 rounded-full hover:bg-white/60 dark:hover:bg-white/5 min-h-[44px] cursor-pointer"
          >
            <ArrowLeft aria-hidden="true" className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </Link>
        </div>
      </header>

      {/* MAIN CONTAINER: Two-Column Composition */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-12 flex-1 flex flex-col justify-center py-4 sm:py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* LEFT COLUMN: Hero Artwork Showcase */}
          <div className="lg:col-span-7 xl:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">
            {/* Big Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-[46px] font-black text-[#211536] dark:text-white tracking-tight leading-[1.12]">
              Your Music<br className="hidden sm:inline" />{" "}
              Journey{" "}
              <span className="bg-gradient-to-r from-[#8B5CF6] via-[#EC4899] to-[#FF7A00] bg-clip-text text-transparent">
                Awaits
              </span>
            </h1>

            {/* Subtitle & Gradient Accent Underline */}
            <div className="mt-3 inline-block">
              <p className="text-base sm:text-lg font-bold text-[#211536] dark:text-[#E2D9F3] tracking-wide">
                Discover. Feel. Play.
              </p>
              <div className="mt-1 h-1 w-20 rounded-full bg-gradient-to-r from-[#FF7A00] via-[#EC4899] to-[#8B5CF6]" />
            </div>

            {/* Centerpiece 3D Headphones on Glowing Sound Stage Artwork */}
            <div className="relative w-full max-w-[420px] my-3 sm:my-4 flex items-center justify-center lg:justify-start">
              <div className="relative flex items-center justify-center">
                {/* Dynamic Sound Aura */}
                <div
                  className="absolute inset-0 -m-6 rounded-full bg-gradient-to-tr from-[#8B5CF6]/20 via-[#EC4899]/10 to-transparent blur-xl pointer-events-none"
                  aria-hidden="true"
                />

                {/* Floating Musical Notes around the headphones */}
                <div className="absolute -left-4 top-1/3 text-lg font-serif text-[#8B5CF6]/50 select-none animate-pulse rotate-12 [animation-duration:3.2s]">
                  ♫
                </div>
                <div className="absolute -left-2 bottom-1/4 text-sm font-serif text-[#A855F7]/45 select-none animate-pulse -rotate-12 [animation-duration:4s] [animation-delay:0.8s]">
                  ♪
                </div>
                <div className="absolute -right-3 top-1/4 text-lg font-serif text-[#EC4899]/60 select-none animate-pulse rotate-45 [animation-duration:3.5s] [animation-delay:0.4s]">
                  ♪
                </div>
                <div className="absolute -right-5 bottom-1/3 text-base font-serif text-[#A855F7]/50 select-none animate-pulse -rotate-6 [animation-duration:4.2s] [animation-delay:1.2s]">
                  ♫
                </div>

                {/* 3D Hi-Fi Headphones Artwork */}
                <img
                  src="/brand/auth-headphones-3d.png"
                  alt="MelodyMap 3D Hi-Fi Sound Experience"
                  className="relative z-10 w-full h-auto max-h-[250px] sm:max-h-[290px] object-contain drop-shadow-[0_16px_35px_rgba(139,92,246,0.18)] select-none pointer-events-none transition-transform duration-500 hover:scale-102"
                />
              </div>
            </div>

            {/* Bottom Capsule Pill: 3 Highlights */}
            <div className="inline-flex flex-wrap items-center justify-center lg:justify-start gap-2.5 sm:gap-3.5 px-4 sm:px-5 py-2.5 rounded-full bg-white/80 dark:bg-[#1E1435]/80 backdrop-blur-md border border-[#E9D8FF] dark:border-purple-700/30 shadow-xs text-xs font-semibold text-[#211536] dark:text-white">
              <div className="flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span>Personalized Recommendations</span>
              </div>
              <div className="hidden sm:block h-3.5 w-px bg-[#E9D8FF] dark:bg-purple-700/50" />
              <div className="flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-[#EC4899]" />
                <span>Create Your Mixes</span>
              </div>
              <div className="hidden sm:block h-3.5 w-px bg-[#E9D8FF] dark:bg-purple-700/50" />
              <div className="flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span>Listen to Podcasts</span>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Premium Floating Authentication Card */}
          <div className="lg:col-span-5 xl:col-span-5 flex justify-center w-full">
            <div className="w-full max-w-[420px] rounded-[32px] bg-white dark:bg-[#1B132E] border border-[#E9D8FF] dark:border-purple-800/40 p-6 sm:p-8 shadow-[0_20px_50px_-10px_rgba(139,92,246,0.12)] dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)] backdrop-blur-2xl space-y-4 relative">
              {/* Card Top Logo with Glowing Halo */}
              <div className="flex justify-center -mt-1">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#8B5CF6]/20 rounded-2xl blur-md" />
                  <picture>
                    <source srcSet="/brand/app-icon.webp" type="image/webp" />
                    <img
                      src="/brand/app-icon.png"
                      alt="MelodyMap"
                      className="relative w-12 h-12 object-contain drop-shadow-sm select-none"
                    />
                  </picture>
                </div>
              </div>

              {/* Form Title & Context */}
              <div className="text-center space-y-1">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[#211536] dark:text-white font-display">
                  {mode === "signin" && "Welcome to MelodyMap"}
                  {mode === "signup" && "Join MelodyMap"}
                  {mode === "verify_email" && "Check Your Inbox"}
                  {mode === "forgot" && "Reset Password"}
                  {mode === "reset_password" && "Set New Password"}
                </h2>
                <p className="text-xs sm:text-sm text-[#746A85] dark:text-[#A69ABD]">
                  {mode === "signin" && "Sign in to continue your musical journey"}
                  {mode === "signup" && "Start your musical journey"}
                  {mode === "verify_email" && `We've sent a verification link to ${email || "your email"}.`}
                  {mode === "forgot" && "Enter your email to receive password reset instructions."}
                  {mode === "reset_password" && "Enter a secure new password for your account."}
                </p>
              </div>

              {/* Status / Error Alerts */}
              {errorNote && (
                <div
                  id="auth-error-note"
                  role="alert"
                  aria-live="assertive"
                  className="flex items-start gap-2.5 rounded-2xl bg-[#FFF5F5] dark:bg-rose-950/30 border border-[#FED7D7] dark:border-rose-800/40 p-3 text-xs text-[#C53030] dark:text-rose-300 animate-fade-in"
                >
                  <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0 mt-0.5" />
                  <p className="flex-1 font-medium leading-relaxed">{errorNote}</p>
                </div>
              )}

              {successNote && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-start gap-2.5 rounded-2xl bg-[#F1EBFF] dark:bg-purple-950/40 border border-[#E9D8FF] dark:border-purple-800/40 p-3 text-xs text-[#8B5CF6] dark:text-purple-300 animate-fade-in"
                >
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 mt-0.5" />
                  <p className="flex-1 font-medium leading-relaxed">{successNote}</p>
                </div>
              )}

              {/* Primary Social Hero: Continue with Google */}
              {mode !== "reset_password" && mode !== "verify_email" && (
                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={googleBusy || submitting}
                    onClick={handleGoogleSignIn}
                    className="w-full h-11 rounded-full bg-white dark:bg-[#23183D] hover:bg-[#FAF9FF] dark:hover:bg-[#2B1D4A] text-[#211536] dark:text-white border border-[#E9D8FF] dark:border-purple-800/40 font-semibold flex items-center justify-center gap-2.5 shadow-xs active:scale-[0.99] transition-all text-xs sm:text-sm cursor-pointer"
                  >
                    {googleBusy ? (
                      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-[#8B5CF6]" />
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

                  <div className="relative flex items-center justify-center my-1.5">
                    <div className="border-t border-[#E9D8FF] dark:border-purple-900/50 w-full" />
                    <span className="bg-white dark:bg-[#1B132E] px-2.5 text-[10px] font-bold text-[#746A85] dark:text-[#A69ABD] uppercase tracking-wider">
                      OR
                    </span>
                  </div>
                </div>
              )}

              {/* Mode Switcher Tabs */}
              {mode !== "reset_password" && mode !== "forgot" && mode !== "verify_email" && (
                <div
                  role="tablist"
                  aria-label="Authentication mode"
                  className="flex rounded-full bg-[#F1EBFF] dark:bg-[#130D22] p-1 border border-[#E9D8FF] dark:border-purple-900/40 shadow-xs"
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
                    className={`flex-1 rounded-full py-2 min-h-[44px] flex items-center justify-center text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] cursor-pointer ${
                      mode === "signin"
                        ? "bg-[#8B5CF6] text-white shadow-sm"
                        : "text-[#746A85] dark:text-[#A69ABD] hover:text-[#211536] dark:hover:text-white font-semibold"
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
                    className={`flex-1 rounded-full py-2 min-h-[44px] flex items-center justify-center text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] cursor-pointer ${
                      mode === "signup"
                        ? "bg-[#8B5CF6] text-white shadow-sm"
                        : "text-[#746A85] dark:text-[#A69ABD] hover:text-[#211536] dark:hover:text-white font-semibold"
                    }`}
                  >
                    Create Account
                  </button>
                </div>
              )}

              {/* Dedicated Verify Email Screen */}
              {mode === "verify_email" && (
                <div className="space-y-4 py-2">
                  <div className="rounded-2xl bg-[#F8F5FF] dark:bg-[#160F25] border border-[#E9D8FF] dark:border-[rgba(168,85,247,0.22)] p-4 sm:p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-2xl bg-[#F1EBFF] dark:bg-[#24183D] text-[#8B5CF6] dark:text-[#C084FC] flex items-center justify-center shrink-0 border border-[#E9D8FF] dark:border-[rgba(168,85,247,0.25)]">
                        <Mail aria-hidden="true" className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-semibold text-[#211536] dark:text-white">Verification Link Sent</p>
                        <p className="text-[11px] text-[#746A85] dark:text-[#D4CBEA] break-all font-mono mt-0.5">{email}</p>
                      </div>
                    </div>

                    <div className="text-[11px] text-[#746A85] dark:text-[#D4CBEA] space-y-1.5 border-t border-[#E9D8FF] dark:border-[rgba(168,85,247,0.18)] pt-3">
                      <p>1. Open your inbox and tap the confirmation link.</p>
                      <p>2. Check your spam or promotions folder if not received in 1 minute.</p>
                      <p className="text-[#8B5CF6] dark:text-[#C084FC] font-medium pt-1">
                        Tip: In Gmail/Outlook in-app browsers, tap (⋮) &gt; "Open in Chrome / Browser" to ensure your session persists.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={resending || resendCooldown > 0}
                      onClick={handleResendVerification}
                      className="w-full h-11 rounded-full border-[#E9D8FF] dark:border-purple-800/40 text-[#211536] dark:text-white bg-white dark:bg-[#171126] hover:bg-[#FAF9FF] dark:hover:bg-[#24183D] text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {resending ? (
                        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-[#8B5CF6]" />
                      ) : (
                        <RefreshCw aria-hidden="true" className="h-3.5 w-3.5 text-[#8B5CF6] dark:text-[#A855F7]" />
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
                      className="w-full h-11 rounded-full bg-gradient-to-r from-[#8B5CF6] via-[#A855F7] to-[#EC4899] hover:opacity-95 text-white text-xs sm:text-sm font-semibold shadow-md shadow-[#8B5CF6]/25 cursor-pointer"
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
                    <div className="space-y-1">
                      <Label htmlFor="auth-name" className="text-xs font-semibold text-[#211536] dark:text-purple-100 flex items-center gap-1.5">
                        <User aria-hidden="true" className="w-3.5 h-3.5 text-[#8B5CF6]" />
                        <span>Full Name</span>
                      </Label>
                      <div className="relative">
                        <User aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8B5CF6] pointer-events-none" />
                        <Input
                          id="auth-name"
                          name="name"
                          type="text"
                          autoComplete="name"
                          placeholder="Enter your full name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          disabled={submitting}
                          aria-invalid={Boolean(errorNote)}
                          aria-describedby={errorNote ? "auth-error-note" : undefined}
                          className="pl-11 pr-4 bg-[#EAF0FF] dark:bg-[#160F25] border-[#E9D8FF] dark:border-purple-800/40 text-[#211536] dark:text-white placeholder:text-[#746A85]/50 dark:placeholder:text-purple-400/60 h-11 rounded-full focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/30 focus:border-[#8B5CF6] text-xs font-medium"
                          required
                        />
                      </div>
                    </div>
                  )}

                  {mode !== "reset_password" && (
                    <div className="space-y-1">
                      <Label htmlFor="auth-email" className="text-xs font-semibold text-[#211536] dark:text-purple-100 flex items-center gap-1.5">
                        <Mail aria-hidden="true" className="w-3.5 h-3.5 text-[#8B5CF6]" />
                        <span>Email Address</span>
                      </Label>
                      <div className="relative">
                        <Mail aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8B5CF6] pointer-events-none" />
                        <Input
                          id="auth-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          placeholder="Enter your email address"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={submitting}
                          aria-invalid={Boolean(errorNote)}
                          aria-describedby={errorNote ? "auth-error-note" : undefined}
                          className="pl-11 pr-4 bg-[#EAF0FF] dark:bg-[#160F25] border-[#E9D8FF] dark:border-purple-800/40 text-[#211536] dark:text-white placeholder:text-[#746A85]/50 dark:placeholder:text-purple-400/60 h-11 rounded-full focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/30 focus:border-[#8B5CF6] text-xs font-medium"
                          required
                        />
                      </div>
                    </div>
                  )}

                  {mode !== "forgot" && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="auth-password" className="text-xs font-semibold text-[#211536] dark:text-purple-100 flex items-center gap-1.5">
                          <Lock aria-hidden="true" className="w-3.5 h-3.5 text-[#8B5CF6]" />
                          <span>{mode === "reset_password" ? "New Password" : "Password"}</span>
                        </Label>
                        {mode === "signin" && (
                          <button
                            type="button"
                            onClick={() => {
                              setMode("forgot");
                              setErrorNote(null);
                              setSuccessNote(null);
                            }}
                            className="text-xs text-[#8B5CF6] hover:underline font-semibold min-h-[44px] inline-flex items-center px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] rounded cursor-pointer"
                          >
                            Forgot password?
                          </button>
                        )}
                      </div>

                      <div className="relative">
                        <Lock aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8B5CF6] pointer-events-none" />
                        <Input
                          id="auth-password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete={mode === "signin" ? "current-password" : "new-password"}
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={submitting}
                          aria-invalid={Boolean(errorNote)}
                          aria-describedby={errorNote ? "auth-error-note" : undefined}
                          className="pl-11 pr-12 bg-[#EAF0FF] dark:bg-[#160F25] border-[#E9D8FF] dark:border-purple-800/40 text-[#211536] dark:text-white placeholder:text-[#746A85]/50 dark:placeholder:text-purple-400/60 h-11 rounded-full focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/30 focus:border-[#8B5CF6] text-xs font-medium"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          aria-pressed={showPassword}
                          className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#746A85] hover:text-[#211536] transition-colors rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] cursor-pointer"
                        >
                          {showPassword ? (
                            <EyeOff aria-hidden="true" className="h-4 w-4" />
                          ) : (
                            <Eye aria-hidden="true" className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      {/* Password Strength Meter */}
                      {(mode === "signup" || mode === "reset_password") && password.length > 0 && (
                        <div className="pt-1 space-y-1.5 animate-fade-in">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#746A85] dark:text-[#D4CBEA]">Password strength:</span>
                            <span className="font-semibold text-[#8B5CF6] dark:text-[#C084FC]">
                              {passwordStrength.label}
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5 h-1.5">
                            {[1, 2, 3, 4].map((bar) => (
                              <div
                                key={bar}
                                className="rounded-full transition-all duration-300"
                                style={{
                                  backgroundColor:
                                    bar <= passwordStrength.score ? passwordStrength.color : "#E9D8FF",
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {(mode === "signup" || mode === "reset_password") && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="auth-confirm-password" className="text-xs font-semibold text-[#211536] dark:text-purple-100 flex items-center gap-1.5">
                          <Lock aria-hidden="true" className="w-3.5 h-3.5 text-[#8B5CF6]" />
                          <span>Confirm Password</span>
                        </Label>
                        {passwordsMatch && (
                          <span className="text-[11px] text-[#8B5CF6] dark:text-[#C084FC] font-medium flex items-center gap-1 animate-fade-in">
                            <Check className="h-3 w-3" /> Passwords match
                          </span>
                        )}
                        {passwordsMismatch && (
                          <span className="text-[11px] text-[#C53030] dark:text-rose-400 font-medium animate-fade-in">
                            Passwords do not match
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <Lock aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8B5CF6] pointer-events-none" />
                        <Input
                          id="auth-confirm-password"
                          name="confirmPassword"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder="Confirm your password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          disabled={submitting}
                          aria-invalid={Boolean(errorNote)}
                          aria-describedby={errorNote ? "auth-error-note" : undefined}
                          className="pl-11 pr-12 bg-[#EAF0FF] dark:bg-[#160F25] border-[#E9D8FF] dark:border-purple-800/40 text-[#211536] dark:text-white placeholder:text-[#746A85]/50 dark:placeholder:text-purple-400/60 h-11 rounded-full focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/30 focus:border-[#8B5CF6] text-xs font-medium"
                          required
                        />
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={submitting || googleBusy}
                    aria-busy={submitting}
                    className="w-full h-11 sm:h-12 rounded-full bg-gradient-to-r from-[#8B5CF6] via-[#A855F7] to-[#EC4899] hover:opacity-95 text-white font-bold shadow-md shadow-[#8B5CF6]/25 active:scale-[0.99] transition-all text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submitting ? (
                      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    ) : mode === "signin" ? (
                      <>
                        <span className="font-mono text-base">&rarr;|</span>
                        <span>Sign In</span>
                      </>
                    ) : mode === "signup" ? (
                      <>
                        <span>Create Account</span>
                        <span className="font-mono text-base">&rarr;</span>
                      </>
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
                  className="w-full py-2 min-h-[44px] flex items-center justify-center text-xs text-[#746A85] dark:text-[#D4CBEA] hover:text-[#211536] dark:hover:text-white font-medium transition-colors text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] rounded-full cursor-pointer"
                >
                  Back to Sign In
                </button>
              )}

              {/* Guest Exploration Escape */}
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={continueAsGuest}
                  className="min-h-[44px] py-1.5 px-4 inline-flex items-center justify-center gap-1.5 text-xs text-[#746A85] dark:text-[#D4CBEA] hover:text-[#8B5CF6] dark:hover:text-[#C084FC] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] rounded-full hover:bg-[#F1EBFF] dark:hover:bg-[#24183D] cursor-pointer"
                >
                  <User aria-hidden="true" className="h-3.5 w-3.5 text-[#746A85] dark:text-[#A855F7]" />
                  <span>Explore as Guest &rsaquo;</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER: Minimal copyright & compliance info matching screenshot */}
      <footer className="w-full px-6 py-3 relative z-10 text-center">
        <p className="text-[11px] text-[#746A85]/70 dark:text-[#948BA8]/70">
          MelodyMap &bull; Stream everywhere with zero interruptions
        </p>
      </footer>
    </div>
  );
}
