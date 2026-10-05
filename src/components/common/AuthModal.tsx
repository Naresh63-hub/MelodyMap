import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  LogOut,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMode?: "signin" | "signup" | "profile";
  onSuccess?: () => void;
}

export function AuthModal({
  open,
  onOpenChange,
  defaultMode = "signin",
  onSuccess,
}: AuthModalProps) {
  const auth = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "profile" | "forgot">(defaultMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setPassword("");
      setConfirmPassword("");

      const currentName = auth.profile?.display_name || "";
      const currentEmail = auth.email || "";

      if (auth.userId && defaultMode !== "signin") {
        setMode("profile");
      } else {
        setMode(defaultMode);
      }

      setName(currentName);
      setEmail(currentEmail);
    }
  }, [open, auth.userId, auth.profile?.display_name, auth.email, defaultMode]);

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const res = await auth.signInWithGoogle();
    if (res.success) {
      setSuccessMsg("Signed in with Google successfully!");
      setTimeout(() => {
        setBusy(false);
        onOpenChange(false);
        onSuccess?.();
      }, 700);
    } else {
      setBusy(false);
      setErrorMsg(res.error || "Google sign-in could not be completed.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setBusy(true);

    if (mode === "profile") {
      const trimmedName = name.trim();
      if (!trimmedName) {
        setBusy(false);
        setErrorMsg("Please enter your display name.");
        return;
      }
      const res = await auth.updateProfile({ display_name: trimmedName });
      if (res.success) {
        setSuccessMsg("Profile updated successfully!");
        setTimeout(() => {
          setBusy(false);
          onOpenChange(false);
          onSuccess?.();
        }, 800);
      } else {
        setBusy(false);
        setErrorMsg(res.error || "Failed to update profile.");
      }
      return;
    }

    if (mode === "signin") {
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        setBusy(false);
        setErrorMsg("Please enter your email.");
        return;
      }
      if (!password) {
        setBusy(false);
        setErrorMsg("Please enter your password.");
        return;
      }

      const res = await auth.signInWithEmail(trimmedEmail, password);
      if (res.success) {
        setSuccessMsg("Welcome back! Signed in successfully.");
        setTimeout(() => {
          setBusy(false);
          onOpenChange(false);
          onSuccess?.();
        }, 800);
      } else {
        setBusy(false);
        setErrorMsg(res.error || "Failed to sign in. Please check your credentials.");
      }
      return;
    }

    if (mode === "signup") {
      const trimmedName = name.trim();
      const trimmedEmail = email.trim();
      if (!trimmedName) {
        setBusy(false);
        setErrorMsg("Please enter your full name.");
        return;
      }
      if (!trimmedEmail || !trimmedEmail.includes("@")) {
        setBusy(false);
        setErrorMsg("Please enter a valid email address.");
        return;
      }
      if (!password || password.length < 6) {
        setBusy(false);
        setErrorMsg("Password must be at least 6 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setBusy(false);
        setErrorMsg("Passwords do not match.");
        return;
      }

      const res = await auth.signUpWithEmail(trimmedEmail, password, trimmedName);
      if (res.success) {
        setSuccessMsg(`Account created! Welcome, ${trimmedName}.`);
        setTimeout(() => {
          setBusy(false);
          onOpenChange(false);
          onSuccess?.();
        }, 800);
      } else {
        setBusy(false);
        setErrorMsg(res.error || "Failed to create account.");
      }
      return;
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    await auth.signOut();
    setSuccessMsg("Signed out successfully.");
    setTimeout(() => {
      setBusy(false);
      onOpenChange(false);
      onSuccess?.();
    }, 600);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#121212] border-white/10 text-white p-6 shadow-2xl rounded-2xl">
        <DialogHeader className="space-y-1.5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1DB954]/20 to-[#1DB954]/5 border border-[#1DB954]/30 mb-1">
            {mode === "profile" ? (
              <UserCheck className="h-6 w-6 text-[#1DB954]" />
            ) : (
              <Sparkles className="h-6 w-6 text-[#1DB954]" />
            )}
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            {mode === "signin" && "Sign In to MelodyMap"}
            {mode === "signup" && "Create MelodyMap Account"}
            {mode === "profile" && "Account Profile"}
            {mode === "forgot" && "Reset Password"}
          </DialogTitle>
          <DialogDescription className="text-sm text-white/50">
            {mode === "signin" && "Sign in with Google or email to sync your music & favorites."}
            {mode === "signup" && "Create an account to keep your music across all devices."}
            {mode === "profile" && "Manage your display name and active account."}
            {mode === "forgot" && "We'll send you instructions to reset your password."}
          </DialogDescription>
        </DialogHeader>

        {/* Tab Switcher for Sign In / Sign Up */}
        {mode !== "profile" && mode !== "forgot" && (
          <div className="flex rounded-xl bg-white/[0.04] p-1 border border-white/5">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
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
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                mode === "signup"
                  ? "bg-[#1DB954] text-black shadow-md"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Google One-Click Sign-In Button */}
        {mode !== "profile" && (
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={handleGoogleSignIn}
              className="w-full h-11 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 border-none font-semibold shadow-md flex items-center justify-center gap-3 transition-all"
            >
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
              <span>Continue with Google</span>
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                <span className="bg-[#121212] px-3 text-white/40">or with email</span>
              </div>
            </div>
          </div>
        )}

        {/* Feedback messages */}
        {errorMsg && (
          <div className="flex items-center gap-2.5 rounded-xl bg-red-500/10 border border-red-500/25 px-3.5 py-2.5 text-xs text-red-400 animate-fade-in">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="flex items-center gap-2.5 rounded-xl bg-[#1DB954]/10 border border-[#1DB954]/30 px-3.5 py-2.5 text-xs text-[#1DB954] animate-fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Display Name input (Signup and Profile mode) */}
          {(mode === "signup" || mode === "profile") && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-white/70">Your Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <Input
                  type="text"
                  placeholder="e.g. Naresh"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy}
                  className="pl-9 bg-white/[0.05] border-white/10 text-white placeholder:text-white/30 h-10 rounded-xl focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954]"
                  required
                />
              </div>
            </div>
          )}

          {/* Email input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-white/70">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy || mode === "profile"}
                className="pl-9 bg-white/[0.05] border-white/10 text-white placeholder:text-white/30 h-10 rounded-xl focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954] disabled:opacity-60"
                required
              />
            </div>
          </div>

          {/* Password inputs (Signin and Signup) */}
          {mode !== "profile" && mode !== "forgot" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-white/70">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  className="pl-9 pr-9 bg-white/[0.05] border-white/10 text-white placeholder:text-white/30 h-10 rounded-xl focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954]"
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

          {/* Confirm Password (Signup) */}
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-white/70">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={busy}
                  className="pl-9 bg-white/[0.05] border-white/10 text-white placeholder:text-white/30 h-10 rounded-xl focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954]"
                  required
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            <Button
              type="submit"
              disabled={busy}
              className="w-full h-11 rounded-xl bg-[#1DB954] hover:bg-[#1aa34a] text-black font-semibold shadow-lg shadow-[#1DB954]/20 transition-all text-sm"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : mode === "signin" ? (
                "Sign In"
              ) : mode === "signup" ? (
                "Create Account"
              ) : (
                "Save Profile Changes"
              )}
            </Button>

            {mode === "profile" && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={handleSignOut}
                className="w-full h-10 rounded-xl bg-white/[0.03] hover:bg-red-500/10 text-white/80 hover:text-red-400 border-white/10 hover:border-red-500/30 transition-all text-xs"
              >
                <LogOut className="h-3.5 w-3.5 mr-2" />
                Sign Out / Switch Account
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
