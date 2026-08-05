import { useEffect, useState } from "react";
import { GripVertical, ListMusic, Pause, Play, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Playlist, Track } from "@/lib/library";
import { cn } from "@/lib/utils";

type Props = {
  playlists: Playlist[];
  currentId?: string | undefined;
  isPlaying: boolean;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onRemoveTrack: (id: string, trackId: string) => void;
  onRemoveMany: (id: string, trackIds: string[]) => void;
  onMoveMany: (fromId: string, toId: string, trackIds: string[]) => void;
  onAddToQueue: (tracks: Track[]) => void;
  onReorder: (id: string, from: number, to: number) => void;
  onPlay: (tracks: Track[], index: number) => void;
};

export function PlaylistsPanel({
  playlists,
  currentId,
  isPlaying,
  onCreate,
  onRename,
  onDelete,
  onRemoveTrack,
  onRemoveMany,
  onMoveMany,
  onAddToQueue,
  onReorder,
  onPlay,
}: Props) {
  const [name, setName] = useState("");
  const [openId, setOpenId] = useState<string | null>(playlists[0]?.id ?? null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    setSelected([]);
  }, [openId]);

  const open = playlists.find((p) => p.id === openId) ?? null;
  const selectedTracks = (open?.tracks ?? []).filter((t) => selected.includes(t.id));
  const toggleSelected = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));


  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onCreate(name.trim());
          setName("");
        }}
        className="flex gap-2"
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New playlist name…"
          className="h-11 rounded-full bg-card"
        />
        <Button type="submit" className="h-11 rounded-full px-5">
          <Plus className="mr-1 h-4 w-4" />
          Create
        </Button>
      </form>

      {playlists.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 px-5 py-10 text-center text-sm text-muted-foreground">
          No playlists yet. Create one, then use the + on any song to save it here.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {playlists.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setOpenId(p.id === openId ? null : p.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
                  p.id === openId
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                <ListMusic className="h-4 w-4" />
                {p.name}
                <span className="text-xs opacity-70">{p.tracks.length}</span>
              </button>
            ))}
          </div>

          {open && (
            <section className="rounded-2xl border border-border bg-card/60 p-3 sm:p-4">
              <div className="mb-3 flex items-center gap-2">
                <Input
                  value={open.name}
                  onChange={(e) => onRename(open.id, e.target.value)}
                  className="h-9 max-w-xs bg-transparent text-sm font-semibold"
                  aria-label="Playlist name"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  disabled={open.tracks.length === 0}
                  onClick={() => onPlay(open.tracks, 0)}
                >
                  <Play className="mr-1.5 h-4 w-4" />
                  Play all
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete playlist"
                  onClick={() => {
                    onDelete(open.id);
                    setOpenId(null);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              {open.tracks.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  Empty — add songs with the + button on any track.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {open.tracks.map((track, index) => {
                    const active = track.id === currentId;
                    return (
                      <li
                        key={track.id}
                        draggable
                        onDragStart={() => setDragIndex(index)}
                        onDragEnd={() => {
                          setDragIndex(null);
                          setOverIndex(null);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setOverIndex(index);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragIndex !== null && dragIndex !== index)
                            onReorder(open.id, dragIndex, index);
                          setDragIndex(null);
                          setOverIndex(null);
                        }}
                        className={cn(
                          "group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors",
                          active ? "bg-surface shadow-lift" : "hover:bg-surface/60",
                          dragIndex === index && "opacity-50",
                          overIndex === index && dragIndex !== null && dragIndex !== index
                            ? "ring-1 ring-primary"
                            : "",
                        )}
                      >
                        <span className="cursor-grab text-muted-foreground active:cursor-grabbing">
                          <GripVertical className="h-4 w-4" />
                        </span>
                        <button
                          type="button"
                          onClick={() => onPlay(open.tracks, index)}
                          className="relative h-11 w-16 shrink-0 overflow-hidden rounded-lg bg-muted"
                          aria-label={`Play ${track.title}`}
                        >
                          <img
                            src={track.thumbnail}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                          <span className="absolute inset-0 flex items-center justify-center bg-background/55 opacity-0 transition-opacity group-hover:opacity-100">
                            {active && isPlaying ? (
                              <Pause className="h-4 w-4 text-primary" />
                            ) : (
                              <Play className="h-4 w-4 text-primary" />
                            )}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onPlay(open.tracks, index)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p
                            className={cn(
                              "truncate text-sm font-semibold",
                              active ? "text-primary" : "text-foreground",
                            )}
                          >
                            {track.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{track.artist}</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveTrack(open.id, track.id)}
                          aria-label={`Remove ${track.title} from playlist`}
                          className="rounded-full p-2 text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-2 px-2 text-[11px] text-muted-foreground">
                Drag the handle to reorder tracks.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
