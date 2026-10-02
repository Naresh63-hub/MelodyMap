import { Infinity as InfinityIcon, Loader2, Pause, Play, X, GripVertical, Music2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Track } from "@/lib/library";
import { cn } from "@/lib/utils";
import { Equalizer } from "@/components/music/NowPlayingViz";

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
  onReorder?: (from: number, to: number) => void;
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
  onReorder,
}: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const upcoming = tracks.length - index - 1;

  return (
    <div className="mx-auto w-full border-b border-white/[0.06] bg-[#101010] px-4 pb-3 pt-3 sm:px-8 shadow-xl animate-slide-up">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex items-center gap-2">
          <Music2 className="h-4 w-4 text-[#1DB954]" />
          <p className="text-sm font-semibold text-[#F5F5F5]">Queue</p>
        </div>
        <span className="text-xs text-[#737373]">
          {tracks.length === 0
            ? "queue is empty"
            : `${upcoming > 0 ? upcoming : 0} song${upcoming === 1 ? "" : "s"} left`}
        </span>
        <button
          type="button"
          onClick={onToggleContinuous}
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-all duration-200 button-press",
            continuous
              ? "border-[#1DB954]/40 bg-[#1DB954]/15 text-[#F5F5F5]"
              : "border-white/[0.06] bg-transparent text-[#737373] hover:text-[#F5F5F5] hover:bg-white/[0.04]",
          )}
          aria-pressed={continuous}
        >
          {loadingMore ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1DB954]" />
          ) : (
            <InfinityIcon className="h-3.5 w-3.5" />
          )}
          Continuous
        </button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onClear} 
          disabled={tracks.length === 0}
          className="text-[#737373] hover:text-[#F5F5F5] hover:bg-white/[0.04] button-press"
        >
          Clear
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          aria-label="Close queue" 
          onClick={onClose}
          className="text-[#737373] hover:text-[#F5F5F5] hover:bg-white/[0.04] button-press"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {tracks.length === 0 ? (
        <div className="px-2 py-8 text-center">
          <Music2 className="h-12 w-12 text-white/20 mx-auto mb-3" />
          <p className="text-sm text-white/40">
            Play a song or add tracks to the queue to see the order here.
          </p>
        </div>
      ) : (
        <ul className="max-h-72 overflow-y-auto pr-2 scrollbar-premium space-y-1">
          {tracks.map((track, i) => {
            const active = i === index;
            const isPast = i < index;
            const isDragging = dragIndex === i;
            const isOver = overIndex === i;
            return (
              <li
                key={`${track.id}-${i}`}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverIndex(i);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null && dragIndex !== i && onReorder) {
                    onReorder(dragIndex, i);
                  }
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                  active 
                    ? "bg-[#1D1D1D]" 
                    : isPast 
                      ? "opacity-40" 
                      : "hover:bg-white/[0.03]",
                  isDragging && "opacity-30 scale-95",
                  isOver && dragIndex !== null && dragIndex !== i && "ring-1 ring-white/20 bg-white/[0.06]",
                )}
              >
                <span className="cursor-grab active:cursor-grabbing p-1 text-[#737373] hover:text-[#F5F5F5] transition-colors">
                  <GripVertical className="h-4 w-4" />
                </span>
                <span className="w-6 shrink-0 text-center text-xs tabular-nums text-[#737373]">
                  {active ? (
                    isPlaying ? (
                      <div className="flex items-center justify-center">
                        <Equalizer active className="h-3 w-3 text-[#1DB954]" />
                      </div>
                    ) : (
                      <Play className="h-3 w-3 text-[#1DB954] fill-current" />
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
                      "truncate text-sm transition-colors",
                      active ? "font-medium text-[#1DB954]" : "font-normal text-[#F5F5F5]",
                    )}
                  >
                    {track.title}
                  </p>
                  <p className="truncate text-xs text-[#A1A1A1] transition-colors mt-0.5">{track.artist}</p>
                </button>
                <span className="hidden text-xs tabular-nums text-[#737373] transition-colors sm:block">
                  {track.duration}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  aria-label={`Remove ${track.title} from queue`}
                  className="rounded-full p-1.5 text-[#737373] transition-colors hover:text-destructive button-press opacity-0 group-hover:opacity-100"
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
