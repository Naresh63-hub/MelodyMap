import {
  CheckCircle2,
  Download,
  Loader2,
  Play,
  Plus,
  ThumbsDown,
  Music2,
} from "lucide-react";
import type { Playlist, Track } from "@/lib/library";
import { Equalizer } from "@/components/music/NowPlayingViz";
import { HeartLikeButton } from "@/components/music/ui/HeartLikeButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getOptimizedThumbnailUrl } from "@/lib/network-mode";
import { cleanSongTitle, trackSubtitle, isChannelOrLabelName } from "@/lib/track-metadata";

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
      <div className="rounded-xl border border-dashed border-hair-strong bg-chip-subtle px-5 py-10 text-center">
        <Music2 className="mx-auto h-12 w-12 text-foreground/20 mb-3" />
        <p className="text-sm text-foreground/30">
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
              "group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors sm:px-3",
              active
                ? "bg-popover"
                : "hover:bg-chip-subtle",
            )}
          >
            <button
              type="button"
              onClick={() => onPlay(track, index)}
              className="relative h-10 w-10 sm:h-11 sm:w-11 shrink-0 overflow-hidden rounded-md bg-card border border-hair transition-transform duration-150 active:scale-95"
              aria-label={`Play ${track.title}`}
            >
              <img
                src={getOptimizedThumbnailUrl(track.thumbnail)}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {active && isPlaying ? (
                  <div className="flex items-center gap-0.5">
                    <Equalizer active className="h-3.5 w-3.5 text-primary" />
                  </div>
                ) : (
                  <Play className="h-3.5 w-3.5 text-white fill-current ml-0.5" />
                )}
              </span>
              {active && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:hidden">
                  <Equalizer active className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
            </button>

            {(() => {
              const displayTitle = cleanSongTitle(track.title) || track.title;
              const displaySubtitle = trackSubtitle(track) || (track.artist && !isChannelOrLabelName(track.artist) ? track.artist : "");
              return (
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onPlay(track, index)}
                    className="block w-full min-w-0 text-left"
                  >
                    <p
                      className={cn(
                        "truncate text-sm font-semibold transition-colors duration-150",
                        active ? "text-primary" : "text-foreground group-hover:text-foreground",
                      )}
                    >
                      {displayTitle}
                    </p>
                  </button>
                  <p className="truncate text-xs text-secondary-foreground group-hover:text-foreground transition-colors duration-150 mt-0.5">
                    {onArtistClick && displaySubtitle ? (
                      <button
                        type="button"
                        onClick={() => onArtistClick(displaySubtitle)}
                        className="hover:text-foreground hover:underline transition-colors"
                      >
                        {displaySubtitle}
                      </button>
                    ) : (
                      displaySubtitle
                    )}
                    {track.reason ? ` · ${track.reason}` : ""}
                  </p>
                </div>
              );
            })()}

            <span className="hidden text-xs tabular-nums text-muted-foreground group-hover:text-secondary-foreground transition-colors sm:block">
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
                  className="rounded-full p-2 text-foreground/40 transition-colors hover:text-foreground active:scale-95"
                >
                  {downloadingIds?.has(track.id) ? (
                    <Loader2 className="h-4 w-4 animate-spin text-foreground/60" />
                  ) : downloadedIds?.has(track.id) ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </button>
              )}

              <HeartLikeButton
                liked={liked}
                onToggle={() => onToggleLike(track)}
                size="md"
              />

              {onToggleDislike && (
                <button
                  type="button"
                  onClick={() => onToggleDislike(track)}
                  aria-label="Not for me"
                  className="rounded-full p-2 text-foreground/40 transition-colors hover:text-red-400 active:scale-95"
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
                    className="rounded-full p-2 text-foreground/40 transition-colors hover:text-foreground active:scale-95"
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
