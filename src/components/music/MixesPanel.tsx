import { Compass, Loader2, Play, RefreshCw, Repeat, Sparkle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TrackList } from "@/components/music/TrackList";
import type { Playlist, Track } from "@/lib/library";
import { cn } from "@/lib/utils";

export type MixId = "discover" | "newrelease" | "replay";

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
}: Props) {
  const mix = MIXES.find((m) => m.id === active) ?? MIXES[0]!;

  return (
    <div>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {MIXES.map(({ id, name, blurb, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={cn(
              "rounded-2xl border p-4 text-left transition-colors",
              id === active
                ? "border-primary bg-surface"
                : "border-border bg-card hover:border-primary/50",
            )}
          >
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
          emptyMessage={
            active === "replay"
              ? "Play a few songs more than once and your Replay Mix fills up here."
              : active === "newrelease"
                ? "Listen to a few artists first — this mix tracks their newest drops."
                : "Hit Rebuild to generate a mix of artists you've never heard."
          }
        />
      )}
    </div>
  );
}
