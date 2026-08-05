import { Heart, Play, Pause, Plus } from "lucide-react";
import type { Playlist, Track } from "@/lib/library";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Props = {
  tracks: Track[];
  currentId?: string | undefined;
  isPlaying: boolean;
  likedIds: Set<string>;
  onPlay: (track: Track, index: number) => void;
  onToggleLike: (track: Track) => void;
  emptyMessage?: string;
  playlists?: Playlist[];
  onAddToPlaylist?: (playlistId: string, track: Track) => void;
  onCreatePlaylistWith?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
};

export function TrackList({
  tracks,
  currentId,
  isPlaying,
  likedIds,
  onPlay,
  onToggleLike,
  emptyMessage,
  playlists,
  onAddToPlaylist,
  onCreatePlaylistWith,
  onAddToQueue,
}: Props) {

  if (tracks.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border/70 px-5 py-10 text-center text-sm text-muted-foreground">
        {emptyMessage ?? "Nothing here yet."}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {tracks.map((track, index) => {
        const active = track.id === currentId;
        const liked = likedIds.has(track.id);
        return (
          <li
            key={track.id}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors sm:px-3",
              active ? "bg-surface shadow-lift" : "hover:bg-surface/60",
            )}
          >
            <button
              type="button"
              onClick={() => onPlay(track, index)}
              className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-muted"
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
                  <Pause className="h-5 w-5 text-primary" />
                ) : (
                  <Play className="h-5 w-5 text-primary" />
                )}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onPlay(track, index)}
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
              <p className="truncate text-xs text-muted-foreground">
                {track.artist}
                {track.reason ? ` · ${track.reason}` : ""}
              </p>
            </button>

            <span className="hidden text-xs tabular-nums text-muted-foreground sm:block">
              {track.duration}
            </span>

            <button
              type="button"
              onClick={() => onToggleLike(track)}
              aria-label={liked ? "Remove from favourites" : "Add to favourites"}
              className="rounded-full p-2 text-muted-foreground transition-colors hover:text-accent"
            >
              <Heart className={cn("h-4 w-4", liked && "fill-accent text-accent")} />
            </button>

            {onAddToPlaylist && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Add to playlist"
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:text-primary"
                >
                  <Plus className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Add to playlist</DropdownMenuLabel>
                  {(playlists ?? []).map((p) => (
                    <DropdownMenuItem key={p.id} onSelect={() => onAddToPlaylist(p.id, track)}>
                      {p.name}
                    </DropdownMenuItem>
                  ))}
                  {onCreatePlaylistWith && (
                    <>
                      {(playlists ?? []).length > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuItem onSelect={() => onCreatePlaylistWith(track)}>
                        New playlist…
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

          </li>
        );
      })}
    </ul>
  );
}
