import {
  Command,
  FastForward,
  Headphones,
  Maximize2,
  Mic,
  Moon,
  Pause,
  Play,
  Repeat,
  Rewind,
  Search,
  Shuffle,
  Sliders,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
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
      <DialogContent className="max-w-md sm:max-w-lg bg-[#0d0a1a]/95 backdrop-blur-2xl border-purple-500/20 text-white p-5 sm:p-6 rounded-3xl shadow-2xl shadow-purple-950/80 max-h-[85vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 shadow-inner">
              <Command className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-white tracking-tight">
                Keyboard Shortcuts
              </DialogTitle>
              <p className="text-[11px] text-purple-300/60 font-medium">Fast control at your fingertips</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="space-y-2">
              <h3 className="text-xs font-bold text-purple-300 uppercase tracking-wider px-1">
                {group.title}
              </h3>
              <div className="rounded-2xl bg-white/[0.02] border border-white/5 divide-y divide-white/5 overflow-hidden">
                {group.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between py-2 px-3 text-xs sm:text-sm hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="text-white/70 font-medium">{item.description}</span>
                    <kbd className="px-2.5 py-1 text-[11px] font-mono font-bold text-purple-200 bg-purple-950/50 border border-purple-500/30 rounded-lg shadow-sm">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-white/10 flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-full bg-purple-600 text-white hover:bg-purple-500 font-semibold px-5"
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
