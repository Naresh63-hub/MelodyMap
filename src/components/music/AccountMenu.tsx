import { useNavigate } from "@tanstack/react-router";
import { LogOut, User } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Profile } from "@/lib/auth";

type Props = {
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  onUpdateProfile: (patch: { display_name?: string; avatar_url?: string }) => Promise<void>;
  onSignOut: () => Promise<void>;
};

/** Header account control: sign-in CTA when signed out, profile menu when signed in. */
export function AccountMenu({ userId, email, profile, onUpdateProfile, onSignOut }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");

  if (!userId) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="rounded-full"
        onClick={() => void navigate({ to: "/auth" })}
      >
        Sign in
      </Button>
    );
  }

  const label = profile?.display_name || email || "Listener";
  const initial = label.charAt(0).toUpperCase();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-semibold ring-1 ring-border transition-colors hover:bg-muted"
            aria-label="Account menu"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">
            {label}
            {email && <span className="block truncate text-xs font-normal text-muted-foreground">{email}</span>}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setName(profile?.display_name ?? "");
              setAvatar(profile?.avatar_url ?? "");
              setOpen(true);
            }}
          >
            <User className="mr-2 h-4 w-4" /> Edit profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void onSignOut()}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="dn">Display name</Label>
              <Input
                id="dn"
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="av">Avatar image URL</Label>
              <Input
                id="av"
                value={avatar}
                maxLength={500}
                onChange={(e) => setAvatar(e.target.value)}
                placeholder="https://…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                void onUpdateProfile({
                  display_name: name.trim(),
                  avatar_url: avatar.trim(),
                });
                setOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
