import { Clock, Flame, MoreVertical, Music2, Play, Pause, Sparkles, TrendingUp, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import type { Track } from "@/lib/library";
import { Equalizer } from "@/components/music/NowPlayingViz";

type Props = {
  recentlyPlayed: Track[];
  trending: Track[];
  newReleases: Track[];
  recommended: Track[];
  onPlayTrack: (track: Track, tracks: Track[], index: number) => void;
  onToggleLike: (track: Track) => void;
  onOpenOptions?: ((track: Track) => void) | undefined;
  likedIds: Set<string>;
  currentId?: string | null | undefined;
  isPlaying: boolean;
  loading?: boolean | undefined;
};

/** Horizontal scrollable row of track cards */
function HorizontalScrollRow({
  tracks,
  currentId,
  isPlaying,
  onPlayTrack,
}: {
  tracks: Track[];
  currentId?: string | null | undefined;
  isPlaying: boolean;
  onPlayTrack: (track: Track, tracks: Track[], index: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={scrollRef}
      className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 snap-x snap-mandatory"
    >
      {tracks.map((track, i) => {
        const active = currentId === track.id;
        return (
          <button
            key={track.id}
            type="button"
            onClick={() => onPlayTrack(track, tracks, i)}
            className="group w-[136px] shrink-0 snap-start text-left transition-transform active:scale-95"
          >
            <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-2xl bg-purple-950/30 border border-purple-500/20 shadow-lg shadow-purple-950/50">
              {track.thumbnail ? (
                <img
                  src={track.thumbnail}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Music2 className="h-8 w-8 text-purple-400/40" />
                </div>
              )}

              {/* Active playing indicator badge */}
              {active && isPlaying && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="flex items-end gap-[2px] h-5">
                    {[0, 1, 2].map((j) => (
                      <div
                        key={j}
                        className="w-[3px] rounded-full bg-purple-400 animate-bar"
                        style={{ animationDelay: `${j * 0.15}s`, height: "100%" }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <p className="truncate text-xs font-bold text-white/90 leading-tight">
              {track.title}
            </p>
            <p className="truncate text-[11px] text-purple-300/60 leading-tight mt-0.5">
              {track.artist}
            </p>
          </button>
        );
      })}
    </div>
  );
}

/** Vertical song list row for Trending / Made For You */
function VerticalSongList({
  tracks,
  currentId,
  isPlaying,
  onPlayTrack,
  onOpenOptions,
}: {
  tracks: Track[];
  currentId?: string | null | undefined;
  isPlaying: boolean;
  onPlayTrack: (track: Track, tracks: Track[], index: number) => void;
  onOpenOptions?: ((track: Track) => void) | undefined;
}) {
  return (
    <div className="space-y-1.5">
      {tracks.map((track, i) => {
        const active = currentId === track.id;
        return (
          <div
            key={track.id}
            className={cn(
              "flex items-center gap-3 rounded-2xl p-2.5 transition-all",
              active
                ? "bg-purple-600/15 border border-purple-500/30"
                : "bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05]"
            )}
          >
            {/* Thumbnail + Play Action */}
            <button
              type="button"
              onClick={() => onPlayTrack(track, tracks, i)}
              className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl shadow-md"
            >
              <img
                src={track.thumbnail}
                alt=""
                className="h-full w-full object-cover"
              />
              {active && isPlaying && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Equalizer active className="h-4 w-4 text-purple-400" />
                </div>
              )}
            </button>

            {/* Track Info */}
            <button
              type="button"
              onClick={() => onPlayTrack(track, tracks, i)}
              className="min-w-0 flex-1 text-left"
            >
              <p
                className={cn(
                  "truncate text-xs font-bold leading-tight",
                  active ? "text-purple-300" : "text-white"
                )}
              >
                {track.title}
              </p>
              <p className="truncate text-[11px] text-purple-300/50 leading-tight mt-0.5">
                {track.artist}
              </p>
            </button>

            {/* 3-dots Menu Button */}
            {onOpenOptions && (
              <button
                type="button"
                onClick={() => onOpenOptions(track)}
                aria-label="Options"
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/[0.06] active:scale-90 transition-all"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SectionHeader({
  title,
  icon: Icon,
}: {
  title: string;
  icon: typeof Music2;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-purple-400" />
        <h2 className="text-sm sm:text-base font-bold text-white">{title}</h2>
      </div>
    </div>
  );
}

export function MobileHomeSections({
  recentlyPlayed,
  trending,
  newReleases,
  recommended,
  onPlayTrack,
  onToggleLike,
  onOpenOptions,
  likedIds,
  currentId,
  isPlaying,
  loading = false,
}: Props) {
  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2].map((s) => (
          <div key={s} className="space-y-3">
            <div className="h-4 w-32 rounded-lg bg-purple-950/40 animate-pulse" />
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-[136px] shrink-0 space-y-2 animate-pulse">
                  <div className="aspect-square w-full rounded-2xl bg-purple-950/30" />
                  <div className="h-3 w-3/4 rounded bg-purple-950/40" />
                  <div className="h-2.5 w-1/2 rounded bg-purple-950/20" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const hasAny =
    recentlyPlayed.length > 0 ||
    trending.length > 0 ||
    newReleases.length > 0 ||
    recommended.length > 0;

  if (!hasAny) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
        <Music2 className="h-12 w-12 text-purple-400/30 mb-3" />
        <h3 className="text-base font-bold text-white/60 mb-1">No songs yet</h3>
        <p className="text-xs text-purple-300/40 max-w-xs px-4">
          Search for your favorite songs or artists to start exploring.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* 1. Recently Played (Horizontal Carousel) */}
      {recentlyPlayed.length > 0 && (
        <section className="animate-fade-in">
          <SectionHeader title="Recently Played" icon={Clock} />
          <HorizontalScrollRow
            tracks={recentlyPlayed}
            currentId={currentId}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
          />
        </section>
      )}

      {/* 2. Trending Now (Vertical List) */}
      {trending.length > 0 && (
        <section className="animate-fade-in">
          <SectionHeader title="🔥 Trending & Fresh Hits" icon={TrendingUp} />
          <VerticalSongList
            tracks={trending.slice(0, 8)}
            currentId={currentId}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
            onOpenOptions={onOpenOptions}
          />
        </section>
      )}

      {/* 3. New & Old Classics Blend (Recommendations) */}
      {recommended.length > 0 && (
        <section className="animate-fade-in">
          <SectionHeader title="✨ New & Old Classics Blend" icon={Sparkles} />
          <VerticalSongList
            tracks={recommended}
            currentId={currentId}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
            onOpenOptions={onOpenOptions}
          />
        </section>
      )}

      {/* 4. Fresh Releases */}
      {newReleases.length > 0 && (
        <section className="animate-fade-in">
          <SectionHeader title="⚡ Just Dropped" icon={Flame} />
          <HorizontalScrollRow
            tracks={newReleases}
            currentId={currentId}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
          />
        </section>
      )}
    </div>
  );
}
