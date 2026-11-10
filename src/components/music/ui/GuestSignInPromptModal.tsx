import React from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart, ListMusic, Sparkles, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";

interface GuestSignInPromptModalProps {
  open: boolean;
  onClose: () => void;
  actionTitle?: string | undefined;
  actionDescription?: string | undefined;
}

export function GuestSignInPromptModal({
  open,
  onClose,
  actionTitle = "Save your music everywhere",
  actionDescription = "Sign in to keep your favorites, custom playlists, and listening history synced across all your devices.",
}: GuestSignInPromptModalProps) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [googleBusy, setGoogleBusy] = React.useState(false);

  const handleGoogleSignIn = async () => {
    setGoogleBusy(true);
    try {
      const res = await auth.signInWithGoogle();
      if (res.success) {
        onClose();
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleEmailSignIn = () => {
    onClose();
    void navigate({ to: "/auth" });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className="w-[92vw] max-w-md p-0 overflow-hidden border border-[#E9DDFD] bg-[#FFFFFF] text-[#191329] shadow-[0_20px_50px_rgba(124,58,237,0.12)] rounded-3xl"
        style={{
          backgroundColor: "#FFFFFF",
          color: "#191329",
          borderColor: "#E9DDFD",
        }}
      >
        <div className="relative p-6 sm:p-8 bg-gradient-to-b from-[#FAF9FF] to-[#FFFFFF]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="absolute right-4 top-4 h-9 w-9 rounded-full flex items-center justify-center text-[#716A80] hover:text-[#191329] hover:bg-[#F3EEFF] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header Brand Badge */}
          <div className="flex flex-col items-center text-center">
            <div className="h-14 w-14 rounded-2xl bg-[#F3EEFF] border border-[#E9DDFD] flex items-center justify-center shadow-sm mb-4">
              <picture>
                <source srcSet="/brand/app-icon.webp" type="image/webp" />
                <img
                  src="/brand/app-icon.png"
                  alt="MelodyMap"
                  width={36}
                  height={36}
                  className="h-9 w-9 object-contain drop-shadow-sm select-none"
                />
              </picture>
            </div>

            <DialogTitle className="text-xl font-semibold tracking-tight text-[#191329] font-display">
              {actionTitle}
            </DialogTitle>
            <DialogDescription className="mt-1.5 text-xs text-[#716A80] max-w-xs leading-relaxed">
              {actionDescription}
            </DialogDescription>
          </div>

          {/* Value Highlights */}
          <div className="mt-5 space-y-2.5 bg-[#FAF9FF] border border-[#E9DDFD] p-3.5 rounded-2xl">
            <div className="flex items-center gap-3 text-xs text-[#191329]">
              <div className="h-7 w-7 rounded-lg bg-[#F3EEFF] flex items-center justify-center shrink-0 text-[#7C3AED]">
                <Heart className="h-3.5 w-3.5" />
              </div>
              <span className="font-medium">Sync your liked tracks across phone & laptop</span>
            </div>

            <div className="flex items-center gap-3 text-xs text-[#191329]">
              <div className="h-7 w-7 rounded-lg bg-[#F3EEFF] flex items-center justify-center shrink-0 text-[#7C3AED]">
                <ListMusic className="h-3.5 w-3.5" />
              </div>
              <span className="font-medium">Create unlimited personalized playlists</span>
            </div>

            <div className="flex items-center gap-3 text-xs text-[#191329]">
              <div className="h-7 w-7 rounded-lg bg-[#F3EEFF] flex items-center justify-center shrink-0 text-[#7C3AED]">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <span className="font-medium">Smart recommendations tuned to your taste</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 space-y-2.5">
            <Button
              type="button"
              disabled={googleBusy}
              onClick={handleGoogleSignIn}
              className="w-full h-11 rounded-xl bg-white hover:bg-[#FAF9FF] text-[#191329] border border-[#E9DDFD] font-semibold flex items-center justify-center gap-2.5 shadow-sm active:scale-[0.98] transition-all text-xs"
            >
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
              <span>{googleBusy ? "Connecting to Google..." : "Continue with Google"}</span>
            </Button>

            <Button
              type="button"
              onClick={handleEmailSignIn}
              className="w-full h-11 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold shadow-md shadow-[#7C3AED]/20 active:scale-[0.98] transition-all text-xs"
            >
              Sign in with Email
            </Button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 text-center text-xs text-[#716A80] hover:text-[#191329] font-medium transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
            >
              Keep listening as Guest
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
