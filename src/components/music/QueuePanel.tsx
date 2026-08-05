import { Infinity as InfinityIcon, Loader2, Pause, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Track } from "@/lib/library";
import { cn } from "@/lib/utils";

type Props = {
  tracks: Track[];
  index: number;
  isPlaying: boolean;
  continuous: boolean;
  loadingMore: boolean;
  onToggleContinuous: () => void;
  onJump: (index: number) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
  onClose: () => void;
};

export function QueuePanel({
  tracks,
  index,
  isPlaying,
  continuous,
  loadingMore,
  onToggleContinuous,
  onJump,
  onRemove,
  onClear,
  onClose,
}: Props) {
  const upcoming = tracks.length - index - 1;

  return (
    <div className="mx-auto max-w-5xl border-b border-border px-4 pb-3 pt-3 sm:px-6">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-sm font-semibold">Up next</p>
        <span className="text-xs text-muted-foreground">
          {tracks.length === 0
            ? "queue is empty"
            : `${upcoming > 0 ? upcoming : 0} song${upcoming === 1 ? "" : "s"} left`}
        </span>
        <button
          type="button"
          onClick={onToggleContinuous}
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
            continuous
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}
          aria-pressed={continuous}
        >
          {loadingMore ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <InfinityIcon className="h-3.5 w-3.5" />
          )}
          Continuous
        </button>
        <Button variant="ghost" size="sm" onClick={onClear} disabled={tracks.length === 0}>
          Clear
        </Button>
        <Button variant="ghost" size="icon" aria-label="Close queue" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {tracks.length === 0 ? (
        <p className="px-2 py-6 text-center text-sm text-muted-foreground">
          Play a song or add tracks to the queue to see the order here.
        </p>
      ) : (
        <ul className="max-h-64 overflow-y-auto pr-1">
          {tracks.map((track, i) => {
            const active = i === index;
            return (
              <li
                key={`${track.id}-${i}`}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-2 py-1.5",
                  active ? "bg-surface" : i < index ? "opacity-50" : "hover:bg-surface/60",
                )}
              >
                <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
                  {active ? (
                    isPlaying ? (
                      <Pause className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Play className="h-3.5 w-3.5 text-primary" />
                    )
                  ) : (
                    i + 1
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => onJump(i)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p
                    className={cn(
                      "truncate text-sm",
                      active ? "font-semibold text-primary" : "text-foreground",
                    )}
                  >
                    {track.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{track.artist}</p>
                </button>
                <span className="hidden text-xs tabular-nums text-muted-foreground sm:block">
                  {track.duration}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  aria-label={`Remove ${track.title} from queue`}
                  className="rounded-full p-1.5 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
