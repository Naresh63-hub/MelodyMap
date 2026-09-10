import { X, Trash2, GripVertical, Music2, Pause, Play } from "lucide-react";
import { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Equalizer } from "@/components/music/NowPlayingViz";
import { Button } from "@/components/ui/button";
import type { Track } from "@/lib/library";

type Props = {
  tracks: Track[];
  index: number;
  isPlaying: boolean;
  onJump: (index: number) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
  onClose: () => void;
  onReorder?: (from: number, to: number) => void;
};

/**
 * Mobile queue panel rendered as a bottom sheet.
 * Shows now playing + upcoming tracks with drag-to-reorder support.
 */
export function MobileQueue({
  tracks,
  index,
  isPlaying,
  onJump,
  onRemove,
  onClear,
  onClose,
  onReorder,
}: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const current = tracks[index];
  const upcoming = tracks.slice(index + 1);
  const past = tracks.slice(0, index);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      {/* Sheet */}
      <div
        className="relative max-h-[80vh] flex flex-col rounded-t-3xl bg-[#12121f] border-t border-white/[0.08] shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-2 border-b border-white/[0.06]">
          <h3 className="text-base font-bold text-white">Queue</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/30">
              {tracks.length} track{tracks.length === 1 ? "" : "s"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              disabled={tracks.length === 0}
              className="text-white/40 hover:text-white text-xs"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full text-white/40 active:bg-white/[0.06]"
              aria-label="Close queue"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Track list */}
        <div className="flex-1 overflow-y-auto overscroll-none px-4 py-3">
          {/* Now Playing */}
          {current && (
            <div className="mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-pink-400/70 mb-2 px-1">
                Now Playing
              </p>
              <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-cyan-500/5 border border-purple-500/20 p-3">
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg">
                  {current.thumbnail ? (
                    <img src={current.thumbnail} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-white/[0.05]">
                      <Music2 className="h-5 w-5 text-white/20" />
                    </div>
                  )}
                  {isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="flex items-end gap-[2px] h-3">
                        {[0, 1, 2].map((j) => (
                          <div
                            key={j}
                            className="w-[2px] rounded-full bg-white animate-bar"
                            style={{ animationDelay: `${j * 0.15}s`, height: "100%" }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{current.title}</p>
                  <p className="truncate text-xs text-white/40">{current.artist}</p>
                </div>
                <Equalizer active={isPlaying} className="h-4 w-4 text-pink-400 shrink-0" />
              </div>
            </div>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-2 px-1">
                Next Up
              </p>
              <div className="space-y-1">
                {upcoming.map((track, i) => {
                  const realIndex = index + 1 + i;
                  const isDragging = dragIndex === realIndex;
                  const isOver = overIndex === realIndex;
                  return (
                    <div
                      key={`${track.id}-${realIndex}`}
                      draggable
                      onDragStart={() => setDragIndex(realIndex)}
                      onDragEnd={() => {
                        setDragIndex(null);
                        setOverIndex(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setOverIndex(realIndex);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragIndex !== null && dragIndex !== realIndex && onReorder) {
                          onReorder(dragIndex, realIndex);
                        }
                        setDragIndex(null);
                        setOverIndex(null);
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-xl p-2.5 transition-all",
                        isDragging ? "opacity-40 scale-95 bg-purple-500/10" : "active:bg-white/[0.04]",
                        isOver && dragIndex !== null && dragIndex !== realIndex
                          ? "ring-2 ring-purple-500 bg-purple-500/20"
                          : "",
                      )}
                    >
                      <span className="cursor-grab active:cursor-grabbing p-1 text-white/30 hover:text-white transition-colors">
                        <GripVertical className="h-4 w-4 shrink-0" />
                      </span>
                      <button
                        type="button"
                        onClick={() => onJump(realIndex)}
                        className="flex min-w-0 flex-1 items-center gap-3"
                      >
                        <span className="w-5 text-center text-[10px] text-white/25 tabular-nums shrink-0">
                          {realIndex + 1}
                        </span>
                        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md">
                          {track.thumbnail ? (
                            <img src={track.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="flex h-full items-center justify-center bg-white/[0.05]">
                              <Music2 className="h-3.5 w-3.5 text-white/15" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="truncate text-[13px] font-medium text-white/80">{track.title}</p>
                          <p className="truncate text-[11px] text-white/35">{track.artist}</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(realIndex)}
                        className="h-11 w-11 shrink-0 flex items-center justify-center rounded-full text-white/20 active:text-red-400"
                        aria-label={`Remove ${track.title} from queue`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {tracks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Music2 className="h-10 w-10 text-white/15 mb-3" />
              <p className="text-sm text-white/30">Queue is empty</p>
              <p className="text-xs text-white/20 mt-1">Add songs to build your queue</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
