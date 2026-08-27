import {
  CheckCircle2,
  Download,
  Heart,
  Loader2,
  Pause,
  Play,
  Plus,
  ThumbsDown,
  Music2,
} from "lucide-react";
import type { Playlist, Track } from "@/lib/library";
import { Equalizer } from "@/components/music/NowPlayingViz";
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
  dislikedIds?: Set<string>;
  onPlay: (track: Track, index: number) => void;
  onToggleLike: (track: Track) => void;
  onToggleDislike?: (track: Track) => void;
  onArtistClick?: (artist: string) => void;
  emptyMessage?: string;
  playlists?: Playlist[];
  onAddToPlaylist?: (playlistId: string, track: Track) => void;
  onCreatePlaylistWith?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  downloadedIds?: Set<string> | undefined;
  downloadingIds?: Set<string> | undefined;
  onDownload?: ((track: Track) => void) | undefined;
  onRemoveDownload?: ((track: Track) => void) | undefined;
};

export function TrackList({
  tracks,
  currentId,
  isPlaying,
  likedIds,
  dislikedIds,
  onPlay,
  onToggleLike,
  onToggleDislike,
  onArtistClick,
  emptyMessage,
  playlists,
  onAddToPlaylist,
  onCreatePlaylistWith,
  onAddToQueue,
  downloadedIds,
  downloadingIds,
  onDownload,
  onRemoveDownload,
}: Props) {


  if (tracks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-10 text-center">
        <Music2 className="mx-auto h-12 w-12 text-white/20 mb-3" />
        <p className="text-sm text-white/30">
          {emptyMessage ?? "Nothing here yet."}
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {tracks.map((track, index) => {
        const active = track.id === currentId;
        const liked = likedIds.has(track.id);
        return (
          <li
            key={track.id}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-all duration-200 sm:px-3 button-press focus-ring-neon",
              active
                ? "bg-gradient-to-r from-pink-500/15 via-purple-500/15 to-cyan-500/5 border border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                : "hover:bg-white/[0.04] border border-transparent hover:border-white/5",
            )}
          >
            <button
              type="button"
              onClick={() => onPlay(track, index)}
              className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-white/5 transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg"
              aria-label={`Play ${track.title}`}
            >
              <img
                src={track.thumbnail}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                {active && isPlaying ? (
                  <div className="flex items-center gap-0.5">
                    <Equalizer active className="h-4 w-4 text-pink-400 icon-glow" />
                  </div>
                ) : (
                  <Play className="h-5 w-5 text-white" />
                )}
              </span>
              {active && (
                <div className="absolute left-2 top-2">
                  <Equalizer active className="h-3 w-3 text-pink-400 icon-glow" />
                </div>
              )}
            </button>

            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onPlay(track, index)}
                className="block w-full min-w-0 text-left"
              >
                <p
                  className={cn(
                    "truncate text-sm font-semibold transition-colors duration-200",
                    active ? "text-pink-400 icon-glow" : "text-white/90 group-hover:text-white",
                  )}
                >
                  {active && isPlaying && <Music2 className="inline mr-1 h-3 w-3 text-pink-400 icon-glow" />}
                  {track.title}
                </p>
              </button>
              <p className="truncate text-xs text-white/40 group-hover:text-white/60 transition-colors duration-200">
                {onArtistClick ? (
                  <button
                    type="button"
                    onClick={() => onArtistClick(track.artist)}
                    className="underline-offset-2 hover:text-pink-400 hover:underline transition-colors"
                  >
                    {track.artist}
                  </button>
                ) : (
                  track.artist
                )}
                {track.reason ? ` · ${track.reason}` : ""}
              </p>
            </div>

            <span className="hidden text-xs tabular-nums text-white/30 group-hover:text-white/50 transition-colors sm:block">
              {track.duration}
            </span>

            <div className="flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {onDownload && (
                <button
                  type="button"
                  onClick={() => {
                    if (downloadedIds?.has(track.id)) onRemoveDownload?.(track);
                    else onDownload(track);
                  }}
                  aria-label={
                    downloadedIds?.has(track.id)
                      ? "Remove offline copy"
                      : "Download for offline"
                  }
                  className="rounded-full p-2 text-white/30 transition-colors hover:text-pink-400 button-press"
                >
                  {downloadingIds?.has(track.id) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : downloadedIds?.has(track.id) ? (
                    <CheckCircle2 className="h-4 w-4 text-primary icon-glow" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => onToggleLike(track)}
                aria-label={liked ? "Remove from favourites" : "Add to favourites"}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:text-pink-400 button-press"
              >
                <Heart className={cn("h-4 w-4 transition-colors", liked && "fill-pink-400 text-pink-400 icon-glow")} />
              </button>

              {onToggleDislike && (
                <button
                  type="button"
                  onClick={() => onToggleDislike(track)}
                  aria-label="Not for me"
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:text-destructive button-press"
                >
                  <ThumbsDown
                    className={cn(
                      "h-4 w-4 transition-colors",
                      dislikedIds?.has(track.id) && "fill-destructive text-destructive",
                    )}
                  />
                </button>
              )}

              {onAddToPlaylist && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label="Add to playlist"
                    className="rounded-full p-2 text-white/30 transition-colors hover:text-pink-400 button-press"
                  >
                    <Plus className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onAddToQueue && (
                      <>
                        <DropdownMenuItem onSelect={() => onAddToQueue(track)}>
                          Add to queue
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
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
            </div>
          </li>
        );
      })}
    </ul>
  );
}
