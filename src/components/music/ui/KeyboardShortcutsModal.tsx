import { Command } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SHORTCUT_GROUPS = [
  {
    title: "Playback Controls",
    items: [
      { key: "Space / K", description: "Play / Pause playback" },
      { key: "N", description: "Next track" },
      { key: "P", description: "Previous track" },
      { key: "→ / L", description: "Seek forward 5s" },
      { key: "← / J", description: "Seek backward 5s" },
      { key: "S", description: "Toggle shuffle" },
      { key: "R", description: "Toggle repeat mode" },
    ],
  },
  {
    title: "Audio & Volume",
    items: [
      { key: "↑", description: "Volume Up (+5%)" },
      { key: "↓", description: "Volume Down (-5%)" },
      { key: "M", description: "Mute / Unmute" },
      { key: "E", description: "Open 10-Band Equalizer" },
    ],
  },
  {
    title: "Navigation & View",
    items: [
      { key: "F", description: "Toggle Fullscreen Player" },
      { key: "/", description: "Focus search bar" },
      { key: "?", description: "Show keyboard shortcuts" },
      { key: "Esc", description: "Close modals / Exit fullscreen" },
    ],
  },
];

export function KeyboardShortcutsModal({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg bg-popover/95 backdrop-blur-xl border border-border text-foreground p-6 sm:p-7 rounded-2xl shadow-overlay max-h-[85vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
              <Command className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-semibold text-foreground tracking-[-0.01em]">
                Keyboard Shortcuts
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground font-medium">Fast control at your fingertips</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-[0.06em] px-1">
                {group.title}
              </h3>
              <div className="rounded-xl bg-surface-hover border border-border divide-y divide-border overflow-hidden">
                {group.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between py-2 px-3 text-xs sm:text-sm hover:bg-surface-hover-strong transition-colors"
                  >
                    <span className="text-muted-foreground font-medium">{item.description}</span>
                    <kbd className="px-2.5 py-1 text-[11px] font-mono font-medium text-foreground bg-chip border border-border rounded-md">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-border flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium px-5"
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
