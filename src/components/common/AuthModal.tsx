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

  // Sync current profile info when modal opens or profile changes
  useEffect(() => {
    if (open) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setPassword("");
      setConfirmPassword("");

      const currentName = auth.profile?.display_name || "";
      const currentEmail = auth.email || "";

      setName(currentName);
      setEmail(currentEmail);

      if (defaultMode && (defaultMode === "signin" || defaultMode === "signup")) {
        setMode(defaultMode);
      } else if (auth.isCloudAuth) {
        setMode("profile");
      } else {
        setMode(defaultMode || "signin");
      }
    }
  }, [open, auth.userId, auth.profile, auth.email, defaultMode]);

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await auth.signInWithGoogle();
      if (res.success) {
        setSuccessMsg("Signed in with Google successfully!");
        setTimeout(() => {
          setBusy(false);
          onOpenChange(false);
          onSuccess?.();
        }, 600);
      } else {
        setErrorMsg(res.error || "Google Sign-in failed.");
        setBusy(false);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Google Sign-in error.");
      setBusy(false);
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
        setErrorMsg("Display name cannot be empty.");
        return;
      }
      try {
        const res = await auth.updateProfile({ display_name: trimmedName });
        if (res.success) {
          setSuccessMsg("Profile updated successfully!");
          setTimeout(() => {
            setBusy(false);
            onOpenChange(false);
            onSuccess?.();
          }, 800);
        } else {
          setErrorMsg(res.error || "Failed to update profile.");
          setBusy(false);
        }
      } catch (err: any) {
        setErrorMsg(err?.message || "Profile update error.");
        setBusy(false);
      }
      return;
    }

    if (mode === "forgot") {
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        setBusy(false);
        setErrorMsg("Please enter your email address.");
        return;
      }
      try {
        const res = await auth.resetPassword(trimmedEmail);
        if (res.success) {
          setSuccessMsg("Password reset email sent! Check your inbox.");
          setTimeout(() => {
            setBusy(false);
            setMode("signin");
          }, 2000);
        } else {
          setErrorMsg(res.error || "Failed to send reset email.");
          setBusy(false);
        }
      } catch (err: any) {
        setErrorMsg(err?.message || "Reset password error.");
        setBusy(false);
      }
      return;
    }

    if (mode === "signup") {
      const trimmedName = name.trim();
      const trimmedEmail = email.trim();
      if (!trimmedName) {
        setBusy(false);
        setErrorMsg("Please enter your name.");
        return;
      }
      if (!trimmedEmail || !trimmedEmail.includes("@")) {
        setBusy(false);
        setErrorMsg("Please enter a valid email address.");
        return;
      }
      if (password.length < 6) {
        setBusy(false);
        setErrorMsg("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setBusy(false);
        setErrorMsg("Passwords do not match.");
        return;
      }

      try {
        const res = await auth.signUpWithEmail(trimmedEmail, password, trimmedName);
        if (res.success) {
          setSuccessMsg("Account created! Please check your email to confirm.");
          setTimeout(() => {
            setBusy(false);
            onOpenChange(false);
            onSuccess?.();
          }, 1200);
        } else {
          setErrorMsg(res.error || "Sign-up failed.");
          setBusy(false);
        }
      } catch (err: any) {
        setErrorMsg(err?.message || "Sign-up error.");
        setBusy(false);
      }
      return;
    }

    if (mode === "signin") {
      const trimmedEmail = email.trim();
      if (!trimmedEmail || !trimmedEmail.includes("@")) {
        setBusy(false);
        setErrorMsg("Please enter a valid email address.");
        return;
      }
      if (!password) {
        setBusy(false);
        setErrorMsg("Please enter your password.");
        return;
      }

      try {
        const res = await auth.signInWithEmail(trimmedEmail, password);
        if (res.success) {
          setSuccessMsg("Signed in successfully!");
          setTimeout(() => {
            setBusy(false);
            onOpenChange(false);
            onSuccess?.();
          }, 800);
        } else {
          setErrorMsg(res.error || "Incorrect email or password.");
          setBusy(false);
        }
      } catch (err: any) {
        setErrorMsg(err?.message || "Sign-in error.");
        setBusy(false);
      }
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
      <DialogContent className="sm:max-w-md bg-popover border border-border text-foreground p-6 shadow-overlay rounded-2xl">
        <DialogHeader className="space-y-1.5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 mb-1">
            {mode === "profile" ? (
              <UserCheck className="h-6 w-6 text-primary" />
            ) : (
              <Sparkles className="h-6 w-6 text-primary" />
            )}
          </div>
          <DialogTitle className="text-xl font-semibold tracking-[-0.01em]">
            {mode === "signin" && "Sign In to MelodyMap"}
            {mode === "signup" && "Create MelodyMap Account"}
            {mode === "profile" && "Account Profile"}
            {mode === "forgot" && "Reset Password"}
          </DialogTitle>
          <DialogDescription className="text-xs text-foreground/50">
            {mode === "signin" && "Sign in with Google or email to sync your favourites & history."}
            {mode === "signup" && "Create an account to securely save playlists and music preferences."}
            {mode === "profile" && "Manage your display name and active account."}
            {mode === "forgot" && "We'll send you instructions to reset your password."}
          </DialogDescription>
        </DialogHeader>

        {/* Feedback alerts */}
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3.5 py-2.5 text-xs text-red-400 animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p className="flex-1">{errorMsg}</p>
          </div>
        )}
        {successMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2.5 text-xs text-emerald-400 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <p className="flex-1">{successMsg}</p>
          </div>
        )}

        {/* Primary Hero: Google One-Tap / OAuth Button */}
        {mode !== "profile" && (
          <div className="space-y-2.5 pt-1">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={handleGoogleSignIn}
              className="w-full h-11 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 border-none font-semibold flex items-center justify-center gap-2.5 shadow-md active:scale-95 transition-all text-xs"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
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
            <p className="text-center text-[11px] text-muted-foreground font-medium">
              Instant 1-tap sign-in & account creation
            </p>

            <div className="relative flex items-center justify-center my-3">
              <div className="border-t border-hair-strong w-full" />
              <span className="bg-popover px-2.5 text-[10px] text-foreground/50 uppercase tracking-widest font-mono">
                or with email
              </span>
            </div>

            {/* Email Mode Switcher */}
            {mode !== "forgot" && (
              <div className="flex rounded-xl bg-chip p-1 border border-hair">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${
                    mode === "signin"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-foreground/60 hover:text-foreground"
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
                  className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${
                    mode === "signup"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-foreground/60 hover:text-foreground"
                  }`}
                >
                  Create Account
                </button>
              </div>
            )}
          </div>
        )}

        {mode === "profile" && !auth.isCloudAuth && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-300 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
              <div className="flex-1">
                <p className="font-semibold text-amber-300">Local Offline Profile</p>
                <p className="text-[11px] text-amber-300/80 mt-0.5 leading-relaxed">
                  You are currently using a local device profile. Connect your MelodyMap cloud account to use Jam Sessions and sync playlists.
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setMode("signin");
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs h-8 rounded-lg shadow-sm"
            >
              Sign In or Create Cloud Account
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Display Name Input */}
          {(mode === "signup" || mode === "profile") && (
            <div className="space-y-1.5">
              <Label className="text-xs text-foreground/70 font-medium">Display Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
                <Input
                  type="text"
                  placeholder="Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy}
                  className="pl-9 bg-chip border-hair-strong text-foreground placeholder:text-foreground/30 h-10 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
            </div>
          )}

          {/* Email Input */}
          {mode !== "profile" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-foreground/70 font-medium">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                  className="pl-9 bg-chip border-hair-strong text-foreground placeholder:text-foreground/30 h-10 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
            </div>
          )}

          {/* Password Input */}
          {mode !== "profile" && mode !== "forgot" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-foreground/70 font-medium">Password</Label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  className="pl-9 pr-9 bg-chip border-hair-strong text-foreground placeholder:text-foreground/30 h-10 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Confirm Password (only for Sign Up) */}
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-foreground/70 font-medium">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
                <Input
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={busy}
                  className="pl-9 bg-chip border-hair-strong text-foreground placeholder:text-foreground/30 h-10 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary"
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
              className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-lg shadow-primary/20 transition-all text-xs"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : mode === "signin" ? (
                "Sign In"
              ) : mode === "signup" ? (
                "Create Account"
              ) : mode === "profile" ? (
                "Save Profile Changes"
              ) : (
                "Send Reset Link"
              )}
            </Button>

            {mode === "profile" && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={handleSignOut}
                className="w-full h-10 rounded-xl bg-chip-subtle hover:bg-red-500/10 text-foreground/80 hover:text-red-400 border-hair-strong hover:border-red-500/30 transition-all text-xs font-normal"
              >
                <LogOut className="h-3.5 w-3.5 mr-2" />
                Sign Out / Switch Account
              </Button>
            )}

            {mode === "forgot" && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setMode("signin")}
                className="w-full h-9 rounded-xl text-xs text-foreground/60 hover:text-foreground hover:bg-chip"
              >
                Back to Sign In
              </Button>
            )}

            {mode !== "profile" && (
              <div className="pt-2 border-t border-hair text-center">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="min-h-[36px] py-1 px-3 inline-flex items-center justify-center text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg"
                >
                  Skip for now · Continue as Guest
                </button>
              </div>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
