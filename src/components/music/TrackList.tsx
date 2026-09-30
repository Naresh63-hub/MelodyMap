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
              "group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors sm:px-3",
              active
                ? "bg-white/[0.08]"
                : "hover:bg-white/[0.04]",
            )}
          >
            <button
              type="button"
              onClick={() => onPlay(track, index)}
              className="relative h-11 w-16 sm:w-20 shrink-0 overflow-hidden rounded-md bg-white/5 transition-transform duration-200 group-hover:scale-102"
              aria-label={`Play ${track.title}`}
            >
              <img
                src={track.thumbnail}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {active && isPlaying ? (
                  <div className="flex items-center gap-0.5">
                    <Equalizer active className="h-4 w-4 text-[#1DB954]" />
                  </div>
                ) : (
                  <Play className="h-4 w-4 text-white fill-current" />
                )}
              </span>
              {active && (
                <div className="absolute left-2 top-2">
                  <Equalizer active className="h-3 w-3 text-[#1DB954]" />
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
                    active ? "text-[#1DB954]" : "text-white/90 group-hover:text-white",
                  )}
                >
                  {active && isPlaying && <Music2 className="inline mr-1 h-3 w-3 text-[#1DB954]" />}
                  {track.title}
                </p>
              </button>
              <p className="truncate text-xs text-white/50 group-hover:text-white/70 transition-colors duration-200 mt-0.5">
                {onArtistClick ? (
                  <button
                    type="button"
                    onClick={() => onArtistClick(track.artist)}
                    className="hover:text-white hover:underline transition-colors"
                  >
                    {track.artist}
                  </button>
                ) : (
                  track.artist
                )}
                {track.reason ? ` · ${track.reason}` : ""}
              </p>
            </div>

            <span className="hidden text-xs tabular-nums text-white/40 group-hover:text-white/60 transition-colors sm:block">
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
                  className="rounded-full p-2 text-white/40 transition-colors hover:text-white active:scale-95"
                >
                  {downloadingIds?.has(track.id) ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white/60" />
                  ) : downloadedIds?.has(track.id) ? (
                    <CheckCircle2 className="h-4 w-4 text-[#1DB954]" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => onToggleLike(track)}
                aria-label={liked ? "Remove from favourites" : "Add to favourites"}
                className="rounded-full p-2 text-white/40 transition-colors hover:text-white active:scale-95"
              >
                <Heart className={cn("h-4 w-4 transition-colors", liked && "fill-[#1DB954] text-[#1DB954]")} />
              </button>

              {onToggleDislike && (
                <button
                  type="button"
                  onClick={() => onToggleDislike(track)}
                  aria-label="Not for me"
                  className="rounded-full p-2 text-white/40 transition-colors hover:text-red-400 active:scale-95"
                >
                  <ThumbsDown
                    className={cn(
                      "h-4 w-4 transition-colors",
                      dislikedIds?.has(track.id) && "fill-red-500 text-red-500",
                    )}
                  />
                </button>
              )}

              {onAddToPlaylist && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label="Add to playlist"
                    className="rounded-full p-2 text-white/40 transition-colors hover:text-white active:scale-95"
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
