import { useEffect } from "react";
import { Trash2, X } from "lucide-react";
import type { Track } from "@/lib/library";
import { getTrackDisplayDuration } from "@/lib/track-metadata";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  track: Track | null;
  onClose: () => void;
  onConfirm: (track: Track) => void;
};

export function ConfirmDeleteModal({ open, track, onClose, onConfirm }: Props) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || !track) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
      aria-describedby="confirm-delete-desc"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Sheet / Dialog */}
      <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-card border border-hair-strong p-5 sm:p-6 shadow-2xl z-10 animate-slide-up space-y-4">
        {/* Grab bar on mobile */}
        <div className="mx-auto h-1 w-12 rounded-full bg-chip-strong sm:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h2 id="confirm-delete-title" className="text-base sm:text-lg font-bold text-foreground">
                Delete Download?
              </h2>
              <p className="text-xs text-secondary-foreground">
                Step 2: Confirm deletion
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-foreground/40 hover:bg-chip hover:text-foreground transition-colors"
            title="Cancel"
            aria-label="Cancel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Track Preview Card */}
        <div className="flex items-center gap-3 rounded-xl bg-chip/60 border border-hair p-3">
          <img
            src={track.thumbnail}
            alt=""
            className="h-12 w-12 rounded-lg object-cover border border-hair shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-sm font-semibold text-foreground">
              {track.title}
            </h4>
            <p className="truncate text-xs text-secondary-foreground">
              {track.artist}
            </p>
          </div>
          <span className="text-xs tabular-nums text-muted-foreground shrink-0 font-medium">
            {getTrackDisplayDuration(track)}
          </span>
        </div>

        <p id="confirm-delete-desc" className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          This song will be removed from your downloaded offline storage. You can still stream it anytime when connected to the internet.
        </p>

        {/* 2-Step Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="flex-1 sm:flex-initial text-xs sm:text-sm text-foreground/70 hover:text-foreground hover:bg-chip"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm(track)}
            className="flex-1 sm:flex-initial bg-red-500 hover:bg-red-600 text-white font-medium text-xs sm:text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <Trash2 className="h-4 w-4" />
            Confirm to delete
          </Button>
        </div>
      </div>
    </div>
  );
}
