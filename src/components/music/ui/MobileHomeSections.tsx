import { Clock, Flame, MoreVertical, Music2, TrendingUp, Disc3 } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { getOptimizedThumbnailUrl } from "@/lib/network-mode";
import type { Track } from "@/lib/library";
import { Equalizer } from "@/components/music/NowPlayingViz";

type Props = {
  recentlyPlayed: Track[];
  trending: Track[];
  oldSongs?: Track[] | undefined;
  newReleases: Track[];
  recommended: Track[];
  dailyMix?: Track[] | undefined;
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
            className="group w-[132px] shrink-0 snap-start text-left transition-transform active:scale-[0.98] p-1.5 rounded-xl hover:bg-white/[0.04]"
          >
            <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-lg bg-[#161616] border border-white/[0.06]">
              {track.thumbnail ? (
                <img
                  src={getOptimizedThumbnailUrl(track.thumbnail)}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-neutral-500">
                  <Music2 className="h-7 w-7 opacity-40" />
                </div>
              )}

              {/* Active playing indicator */}
              {active && isPlaying && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="flex items-end gap-[2px] h-4">
                    {[0, 1, 2].map((j) => (
                      <div
                        key={j}
                        className="w-[2.5px] rounded-full bg-[#1DB954] animate-bar"
                        style={{ animationDelay: `${j * 0.15}s`, height: "100%" }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <p
              className={cn(
                "truncate text-xs font-semibold leading-tight",
                active ? "text-[#1DB954]" : "text-[#F5F5F5] group-hover:text-white",
              )}
            >
              {track.title}
            </p>
            <p className="truncate text-[11px] text-[#A1A1A1] leading-tight mt-0.5">
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
    <div className="space-y-1">
      {tracks.map((track, i) => {
        const active = currentId === track.id;
        return (
          <div
            key={track.id}
            className={cn(
              "flex items-center gap-3 rounded-lg p-2 transition-colors",
              active
                ? "bg-[#1D1D1D]"
                : "hover:bg-white/[0.03]",
            )}
          >
            {/* Thumbnail + Play Action */}
            <button
              type="button"
              onClick={() => onPlayTrack(track, tracks, i)}
              className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-[#161616] border border-white/[0.06]"
            >
              <img
                src={getOptimizedThumbnailUrl(track.thumbnail)}
                alt=""
                className="h-full w-full object-cover"
              />
              {active && isPlaying && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Equalizer active className="h-3.5 w-3.5 text-[#1DB954]" />
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
                  "truncate text-[13px] font-semibold leading-tight",
                  active ? "text-[#1DB954]" : "text-[#F5F5F5]",
                )}
              >
                {track.title}
              </p>
              <p className="truncate text-xs text-[#A1A1A1] leading-tight mt-0.5">
                {track.artist}
              </p>
            </button>

            {/* 3-dots Menu Button */}
            {onOpenOptions && (
              <button
                type="button"
                onClick={() => onOpenOptions(track)}
                aria-label="Track options"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#737373] hover:text-[#F5F5F5] transition-colors"
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
  icon?: typeof Music2 | typeof TrendingUp | typeof Clock | typeof Flame | typeof Disc3;
}) {
  return (
    <div className="flex items-center justify-between mb-2.5 px-0.5">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-[#737373]" />}
        <h2 className="text-sm font-bold tracking-tight text-[#F5F5F5]">{title}</h2>
      </div>
    </div>
  );
}

export function MobileHomeSections({
  recentlyPlayed,
  trending,
  oldSongs,
  newReleases,
  recommended,
  dailyMix,
  onPlayTrack,
  onToggleLike: _onToggleLike,
  onOpenOptions,
  likedIds: _likedIds,
  currentId,
  isPlaying,
  loading = false,
}: Props) {
  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2].map((s) => (
          <div key={s} className="space-y-3">
            <div className="h-4 w-28 rounded bg-[#1c1c1c] animate-pulse" />
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-[132px] shrink-0 space-y-2">
                  <div className="aspect-square w-full rounded-lg bg-[#181818] border border-white/[0.04] animate-pulse" />
                  <div className="h-3 w-3/4 rounded bg-[#1c1c1c] animate-pulse" />
                  <div className="h-2.5 w-1/2 rounded bg-[#181818] animate-pulse" />
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
    (dailyMix && dailyMix.length > 0) ||
    trending.length > 0 ||
    (oldSongs && oldSongs.length > 0) ||
    newReleases.length > 0 ||
    recommended.length > 0;

  return (
    <div className="space-y-6" suppressHydrationWarning>
      {!hasAny && (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
          <Music2 className="h-10 w-10 text-neutral-600 mb-3" />
          <h3 className="text-sm font-semibold text-white/80 mb-1">Nothing here yet</h3>
          <p className="text-xs text-neutral-400 max-w-xs px-4">
            Search for your favorite songs or artists to start listening.
          </p>
        </div>
      )}

      {/* 1. Daily Mix */}
      {dailyMix && dailyMix.length > 0 && (
        <section className="animate-fade-in">
          <div className="flex items-center justify-between mb-2.5 px-0.5">
            <h2 className="text-sm font-bold tracking-tight text-[#F5F5F5]">Daily Mix</h2>
            <span className="text-[11px] font-normal text-[#737373]">
              Updated today
            </span>
          </div>
          <HorizontalScrollRow
            tracks={dailyMix}
            currentId={currentId}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
          />
        </section>
      )}

      {/* 2. Recently Played (Jump Back In) */}
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

      {/* 3. Made For You (AI / Bandit Recommendations) */}
      {recommended.length > 0 && (
        <section className="animate-fade-in">
          <SectionHeader title="Made For You" />
          <VerticalSongList
            tracks={recommended}
            currentId={currentId}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
            onOpenOptions={onOpenOptions}
          />
        </section>
      )}

      {/* 4. Trending Now (Optional if rendered in Home) */}
      {trending && trending.length > 0 && (
        <section className="animate-fade-in">
          <SectionHeader title="Trending Now" icon={TrendingUp} />
          <VerticalSongList
            tracks={trending.slice(0, 8)}
            currentId={currentId}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
            onOpenOptions={onOpenOptions}
          />
        </section>
      )}

      {/* 5. Old Classics (Optional if rendered in Home) */}
      {oldSongs && oldSongs.length > 0 && (
        <section className="animate-fade-in">
          <div className="flex items-center justify-between mb-2.5 px-0.5">
            <div className="flex items-center gap-2">
              <Disc3 className="h-4 w-4 text-amber-400/80" />
              <h2 className="text-sm font-bold tracking-tight text-[#F5F5F5]">Old Classics</h2>
            </div>
            <span className="text-[11px] font-normal text-[#737373]">
              Golden Era & Retro
            </span>
          </div>
          <HorizontalScrollRow
            tracks={oldSongs}
            currentId={currentId}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
          />
        </section>
      )}

      {/* 6. New Releases (Optional if rendered in Home) */}
      {newReleases && newReleases.length > 0 && (
        <section className="animate-fade-in">
          <SectionHeader title="New Releases" icon={Flame} />
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
