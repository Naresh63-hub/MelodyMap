import { Compass, Loader2, Play, RefreshCw, Repeat, Sparkle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TrackList } from "@/components/music/TrackList";
import type { Playlist, Track } from "@/lib/library";
import { cn } from "@/lib/utils";

export type MixId = "discover" | "newrelease" | "replay" | "explore" ;

export const MIXES: Array<{
  id: MixId;
  name: string;
  blurb: string;
  icon: typeof Compass;
}> = [
  {
    id: "discover",
    name: "Discover Mix",
    blurb: "New artists you've never heard that match your sonic profile.",
    icon: Compass,
  },
  {
    id: "newrelease",
    name: "New Release Mix",
    blurb: "The newest drops from the artists you listen to most.",
    icon: Sparkle,
  },
  {
    id: "replay",
    name: "Replay Mix",
    blurb: "The songs you've had on repeat these last few weeks.",
    icon: Repeat,
  },
  {
    id: "explore",
    name: "New Songs",
    blurb: "Fresh tracks and new releases trending right now.",
    icon: Sparkles,
  },
];

type Props = {
  active: MixId;
  tracks: Track[];
  loading: boolean;
  currentId?: string | undefined;
  isPlaying: boolean;
  likedIds: Set<string>;
  dislikedIds: Set<string>;
  playlists: Playlist[];
  onSelect: (id: MixId) => void;
  onRefresh: () => void;
  onPlayAll: () => void;
  onPlay: (track: Track, index: number) => void;
  onToggleLike: (track: Track) => void;
  onToggleDislike: (track: Track) => void;
  onArtistClick: (artist: string) => void;
  onAddToPlaylist: (playlistId: string, track: Track) => void;
  onCreatePlaylistWith: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  downloadedIds?: Set<string>;
  downloadingIds?: Set<string>;
  onDownload?: (track: Track) => void;
  onRemoveDownload?: (track: Track) => void;
  drops?: Array<{ artist: string; title: string; videoId: string; thumbnail: string }> | undefined;
  onPlayDrop?: ((drop: { artist: string; title: string; videoId: string; thumbnail: string }) => void) | undefined;
};

export function MixesPanel({
  active,
  tracks,
  loading,
  currentId,
  isPlaying,
  likedIds,
  dislikedIds,
  playlists,
  onSelect,
  onRefresh,
  onPlayAll,
  onPlay,
  onToggleLike,
  onToggleDislike,
  onArtistClick,
  onAddToPlaylist,
  onCreatePlaylistWith,
  onAddToQueue,
  downloadedIds,
  downloadingIds,
  onDownload,
  onRemoveDownload,
  drops,
  onPlayDrop,
}: Props) {
  const mix = MIXES.find((m) => m.id === active) ?? MIXES[0]!;

  return (
    <div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MIXES.map(({ id, name, blurb, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={cn(
              "relative rounded-2xl border p-4 text-left transition-colors",
              id === active
                ? "border-primary bg-surface"
                : "border-border bg-card hover:border-primary/50",
            )}
          >
            {id === "newrelease" && drops && drops.length > 0 && (
              <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                <Sparkles className="h-3 w-3" />
                {drops.length} new
              </span>
            )}
            <span
              className={cn(
                "mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full",
                id === active ? "bg-primary text-primary-foreground" : "bg-secondary text-primary",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <p className="text-sm font-semibold">{name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{blurb}</p>
          </button>
        ))}
      </div>

      {drops && drops.length > 0 && active === "newrelease" && (
        <div className="mb-4 rounded-2xl border border-primary/30 bg-primary/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            New from your artists
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            They dropped fresh tracks this week — tap play to hear the newest one.
          </p>
          <ul className="mt-3 space-y-2">
            {drops.map((drop) => (
              <li
                key={drop.videoId}
                className="flex items-center gap-3 rounded-xl bg-card/70 p-2"
              >
                <img
                  src={drop.thumbnail}
                  alt=""
                  className="h-10 w-16 shrink-0 rounded-md object-cover"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{drop.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{drop.artist}</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0 rounded-full"
                  onClick={() => onPlayDrop?.(drop)}
                >
                  <Play className="mr-1.5 h-3.5 w-3.5" />
                  Play
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-bold">{mix.name}</h2>
        <Button
          variant="secondary"
          className="rounded-full"
          onClick={onPlayAll}
          disabled={tracks.length === 0}
        >
          <Play className="mr-2 h-4 w-4" />
          Play mix
        </Button>
        {active !== "replay" && (
          <Button variant="ghost" className="rounded-full" onClick={onRefresh} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Rebuild
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm">Building your {mix.name.toLowerCase()}…</p>
        </div>
      ) : (
        <TrackList
          tracks={tracks}
          currentId={currentId}
          isPlaying={isPlaying}
          likedIds={likedIds}
          dislikedIds={dislikedIds}
          playlists={playlists}
          onPlay={onPlay}
          onToggleLike={onToggleLike}
          onToggleDislike={onToggleDislike}
          onArtistClick={onArtistClick}
          onAddToPlaylist={onAddToPlaylist}
          onCreatePlaylistWith={onCreatePlaylistWith}
          onAddToQueue={onAddToQueue}
          downloadedIds={downloadedIds}
          downloadingIds={downloadingIds}
          onDownload={onDownload}
          onRemoveDownload={onRemoveDownload}
          emptyMessage={
            active === "replay"
              ? "Play a few songs more than once and your Replay Mix fills up here."
              : active === "newrelease"
                ? "Listen to a few artists first — this mix tracks their newest drops."
                : active === "explore"
                  ? "Fresh new tracks will show up here — hit Rebuild."
                  : "Hit Rebuild to generate a mix of artists you've never heard."
          }
        />
      )}
    </div>
  );
}
