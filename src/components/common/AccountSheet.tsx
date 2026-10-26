import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  User,
  Settings2,
  Sliders,
  Radio,
  Moon,
  Globe2,
  LogOut,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface AccountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
  onOpenEqualizer?: () => void;
  onOpenJam?: () => void;
  onOpenSleepTimer?: () => void;
  onOpenLanguages?: () => void;
  onSignIn?: () => void;
  onSignOut?: () => void;
  jamActive?: boolean;
  jamParticipantsCount?: number;
}

export function AccountSheet({
  open,
  onOpenChange,
  onOpenSettings,
  onOpenEqualizer,
  onOpenJam,
  onOpenSleepTimer,
  onOpenLanguages,
  onSignIn,
  onSignOut,
  jamActive = false,
  jamParticipantsCount = 1,
}: AccountSheetProps) {
  const auth = useAuth();

  const isGuest = !auth.isCloudAuth;
  const displayName = auth.profile?.display_name || auth.email?.split("@")[0] || "Listener";
  const email = auth.email || "Guest Mode (Local Only)";
  const avatarUrl = auth.profile?.avatar_url;
  const initial = displayName ? (displayName.charAt(0).toUpperCase() || "U") : "U";

  const handleAction = (callback?: () => void) => {
    onOpenChange(false);
    if (callback) {
      setTimeout(callback, 150);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-2xl border border-hair-strong text-foreground p-0 shadow-2xl rounded-2xl overflow-hidden animate-scale-in">
        {/* Header Profile Section */}
        <div className="relative bg-gradient-to-b from-primary/15 via-primary/5 to-transparent p-6 pb-4 border-b border-hair">
          <DialogHeader className="text-left space-y-0">
            <div className="flex items-center gap-3.5">
              {/* Avatar */}
              <div className="relative h-14 w-14 shrink-0 rounded-2xl overflow-hidden ring-2 ring-primary/40 bg-chip flex items-center justify-center shadow-md">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-foreground">{initial}</span>
                )}
                {/* Status indicator pip */}
                <div
                  className={cn(
                    "absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background",
                    auth.isCloudAuth ? "bg-emerald-500" : "bg-neutral-500",
                  )}
                  title={auth.isCloudAuth ? "Synced with Cloud" : "Guest Mode"}
                />
              </div>

              {/* Name & Badge */}
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold text-foreground truncate tracking-tight">
                  {displayName}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground truncate mt-0.5">
                  {email}
                </DialogDescription>
                <div className="mt-1.5 flex items-center gap-1.5">
                  {auth.isCloudAuth ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Cloud Synced
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-chip text-muted-foreground border border-hair">
                      Guest Mode
                    </span>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* If Guest, show 1-tap Google sign-in prompt */}
          {isGuest && (
            <div className="mt-4 p-3 rounded-xl bg-chip/60 border border-hair flex items-center justify-between gap-3 animate-fade-in">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">Sync across devices</p>
                <p className="text-[11px] text-muted-foreground truncate">Keep favourites & history safe</p>
              </div>
              <Button
                size="sm"
                onClick={() => handleAction(onSignIn)}
                className="shrink-0 h-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-3 shadow-sm"
              >
                Sign In
              </Button>
            </div>
          )}
        </div>

        {/* Quick Menu Options */}
        <div className="p-3 space-y-1">
          {/* Settings & Preferences */}
          <button
            type="button"
            onClick={() => handleAction(onOpenSettings)}
            className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl hover:bg-chip transition-all active:scale-[0.99] group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-chip group-hover:bg-primary/20 border border-hair flex items-center justify-center transition-colors">
                <Settings2 className="h-4 w-4 text-foreground group-hover:text-primary transition-colors" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Settings & Preferences</p>
                <p className="text-[11px] text-muted-foreground">Audio quality, leveling, theme, data backup</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>

          {/* Audio Equalizer */}
          {onOpenEqualizer && (
            <button
              type="button"
              onClick={() => handleAction(onOpenEqualizer)}
              className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl hover:bg-chip transition-all active:scale-[0.99] group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-chip group-hover:bg-primary/20 border border-hair flex items-center justify-center transition-colors">
                  <Sliders className="h-4 w-4 text-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">10-Band Equalizer</p>
                  <p className="text-[11px] text-muted-foreground">Bass boost, acoustic presets, sound balance</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          )}

          {/* Jam Session */}
          {onOpenJam && (
            <button
              type="button"
              onClick={() => handleAction(onOpenJam)}
              className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl hover:bg-chip transition-all active:scale-[0.99] group text-left"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "h-9 w-9 rounded-xl border flex items-center justify-center transition-colors",
                    jamActive
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-chip group-hover:bg-primary/20 border border-hair text-foreground group-hover:text-primary",
                  )}
                >
                  <Radio className={cn("h-4 w-4", jamActive && "animate-pulse")} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-foreground">Jam Session</p>
                    {jamActive && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-primary/20 text-primary border border-primary/30">
                        {jamParticipantsCount} live
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Listen in real-time with friends</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          )}

          {/* Sleep Timer */}
          {onOpenSleepTimer && (
            <button
              type="button"
              onClick={() => handleAction(onOpenSleepTimer)}
              className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl hover:bg-chip transition-all active:scale-[0.99] group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-chip group-hover:bg-primary/20 border border-hair flex items-center justify-center transition-colors">
                  <Moon className="h-4 w-4 text-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Sleep Timer</p>
                  <p className="text-[11px] text-muted-foreground">Auto-stop playback when you fall asleep</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          )}

          {/* Languages & Artists */}
          {onOpenLanguages && (
            <button
              type="button"
              onClick={() => handleAction(onOpenLanguages)}
              className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl hover:bg-chip transition-all active:scale-[0.99] group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-chip group-hover:bg-primary/20 border border-hair flex items-center justify-center transition-colors">
                  <Globe2 className="h-4 w-4 text-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Languages & Preferred Artists</p>
                  <p className="text-[11px] text-muted-foreground">Customize your home recommendations</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          )}
        </div>

        {/* Footer / Account Management */}
        <div className="p-4 pt-3 border-t border-hair bg-chip-subtle/50 space-y-2">
          {auth.isCloudAuth ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => handleAction(onSignOut)}
              className="w-full h-10 rounded-xl bg-card hover:bg-red-500/10 text-muted-foreground hover:text-red-400 border-hair hover:border-red-500/30 text-xs font-medium transition-all"
            >
              <LogOut className="h-3.5 w-3.5 mr-2" />
              Sign Out
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => handleAction(onSignIn)}
              className="w-full h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground border-none text-xs font-semibold shadow-md transition-all"
            >
              <User className="h-3.5 w-3.5 mr-2" />
              Sign in with Google
            </Button>
          )}

          <p className="text-center text-[10px] text-muted-foreground/60 tracking-wider font-mono">
            MelodyMap v1.3.8 · Pure Sound
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
