import { Clock, Flame, MoreVertical, Music2, TrendingUp, Disc3 } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { getOptimizedThumbnailUrl } from "@/lib/network-mode";
import type { Track } from "@/lib/library";
import { Equalizer } from "@/components/music/NowPlayingViz";
import { HeartLikeButton } from "@/components/music/ui/HeartLikeButton";
import { GenreMoodFilterBar } from "@/components/music/ui/GenreMoodFilterBar";
import { filterTracksByQuickFilters } from "@/lib/mood-genre-filters";

type Props = {
  recentlyPlayed?: Track[] | undefined;
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
  /** Active genre/mood quick filter ids (state lives in the home route). */
  quickFilterIds?: readonly string[] | undefined;
  onToggleQuickFilter?: ((id: string) => void) | undefined;
  onClearQuickFilters?: (() => void) | undefined;
  /** Instant match counts per filter id, shown on the chips. */
  quickFilterCounts?: Record<string, number> | undefined;
};

/** Horizontal scrollable row of track cards */
function HorizontalScrollRow({
  tracks,
  currentId,
  isPlaying,
  onPlayTrack,
  onToggleLike,
  likedIds,
}: {
  tracks: Track[];
  currentId?: string | null | undefined;
  isPlaying: boolean;
  onPlayTrack: (track: Track, tracks: Track[], index: number) => void;
  onToggleLike?: ((track: Track) => void) | undefined;
  likedIds?: Set<string> | undefined;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={scrollRef}
      className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 snap-x snap-mandatory"
    >
      {tracks.map((track, i) => {
        const active = currentId === track.id;
        const liked = likedIds?.has(track.id) ?? false;
        return (
          <div
            key={track.id}
            className="group relative w-[132px] shrink-0 snap-start text-left transition-transform p-1.5 rounded-xl hover:bg-chip"
          >
            <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-lg bg-card border border-hair">
              <button
                type="button"
                onClick={() => onPlayTrack(track, tracks, i)}
                className="h-full w-full block focus:outline-none"
              >
                {track.thumbnail ? (
                  <img
                    src={getOptimizedThumbnailUrl(track.thumbnail)}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
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
                          className="w-[2.5px] rounded-full bg-primary animate-bar"
                          style={{ animationDelay: `${j * 0.15}s`, height: "100%" }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </button>

              {/* Heart-shaped like button on card corner */}
              {onToggleLike && (
                <div className="absolute top-1 right-1 z-10">
                  <HeartLikeButton
                    liked={liked}
                    onToggle={() => onToggleLike(track)}
                    size="sm"
                    className="bg-black/50 backdrop-blur-md hover:bg-black/70 shadow-sm"
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => onPlayTrack(track, tracks, i)}
              className="text-left w-full focus:outline-none"
            >
              <p
                className={cn(
                  "truncate text-xs font-medium leading-tight",
                  active ? "text-primary" : "text-foreground/90 group-hover:text-foreground",
                )}
              >
                {track.title}
              </p>
              <p className="truncate text-[11px] text-muted-foreground font-normal leading-tight mt-0.5">
                {track.artist}
              </p>
            </button>
          </div>
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
  onToggleLike,
  likedIds,
}: {
  tracks: Track[];
  currentId?: string | null | undefined;
  isPlaying: boolean;
  onPlayTrack: (track: Track, tracks: Track[], index: number) => void;
  onOpenOptions?: ((track: Track) => void) | undefined;
  onToggleLike?: ((track: Track) => void) | undefined;
  likedIds?: Set<string> | undefined;
}) {
  return (
    <div className="space-y-1">
      {tracks.map((track, i) => {
        const active = currentId === track.id;
        const liked = likedIds?.has(track.id) ?? false;
        return (
          <div
            key={track.id}
            className={cn(
              "flex items-center gap-3 rounded-lg p-2 transition-colors",
              active
                ? "bg-chip-strong"
                : "hover:bg-chip-subtle",
            )}
          >
            {/* Thumbnail + Play Action */}
            <button
              type="button"
              onClick={() => onPlayTrack(track, tracks, i)}
              className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-card border border-hair"
            >
              <img
                src={getOptimizedThumbnailUrl(track.thumbnail)}
                alt=""
                className="h-full w-full object-cover"
              />
              {active && isPlaying && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Equalizer active className="h-3.5 w-3.5 text-primary" />
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
                  "truncate text-[13px] font-medium leading-tight",
                  active ? "text-primary" : "text-foreground/90",
                )}
              >
                {track.title}
              </p>
              <p className="truncate text-xs text-muted-foreground font-normal leading-tight mt-0.5">
                {track.artist}
              </p>
            </button>

            {/* Heart-shaped like toggle button */}
            {onToggleLike && (
              <HeartLikeButton
                liked={liked}
                onToggle={() => onToggleLike(track)}
                size="md"
              />
            )}

            {/* 3-dots Menu Button */}
            {onOpenOptions && (
              <button
                type="button"
                onClick={() => onOpenOptions(track)}
                aria-label="Track options"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
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
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <h2 className="text-sm font-semibold tracking-normal text-foreground/90">{title}</h2>
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
  onToggleLike,
  onOpenOptions,
  likedIds,
  currentId,
  isPlaying,
  loading = false,
  quickFilterIds = [],
  onToggleQuickFilter,
  onClearQuickFilters,
  quickFilterCounts,
}: Props) {
  // Genre & mood quick filters narrow every section instantly, on the client.
  const visibleDailyMix = filterTracksByQuickFilters(dailyMix ?? [], quickFilterIds);
  const visibleRecommended = filterTracksByQuickFilters(recommended, quickFilterIds);
  const visibleTrending = filterTracksByQuickFilters(trending, quickFilterIds);
  const visibleOldSongs = filterTracksByQuickFilters(oldSongs ?? [], quickFilterIds);
  const visibleNewReleases = filterTracksByQuickFilters(newReleases, quickFilterIds);
  const visibleRecentlyPlayed = filterTracksByQuickFilters(recentlyPlayed ?? [], quickFilterIds);

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2].map((s) => (
          <div key={s} className="space-y-3">
            <div className="h-4 w-28 rounded bg-[#1c1c1c] animate-pulse" />
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-[132px] shrink-0 space-y-2">
                  <div className="aspect-square w-full rounded-lg bg-card border border-hair animate-pulse" />
                  <div className="h-3 w-3/4 rounded bg-[#1c1c1c] animate-pulse" />
                  <div className="h-2.5 w-1/2 rounded bg-card animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const hasAny =
    visibleDailyMix.length > 0 ||
    visibleTrending.length > 0 ||
    visibleOldSongs.length > 0 ||
    visibleNewReleases.length > 0 ||
    visibleRecommended.length > 0 ||
    visibleRecentlyPlayed.length > 0;

  const filterBar = onToggleQuickFilter ? (
    <GenreMoodFilterBar
      activeIds={quickFilterIds}
      onToggle={onToggleQuickFilter}
      onClear={onClearQuickFilters ?? (() => {})}
      counts={quickFilterCounts}
      className="-mx-4 px-4"
    />
  ) : null;

  if (!hasAny) {
    return (
      <div className="space-y-6">
        {filterBar}
        {quickFilterIds.length > 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
            <Music2 className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="text-sm font-semibold text-foreground/80 mb-1">No tracks match these filters</h3>
            <p className="text-xs text-muted-foreground max-w-xs px-4">
              Pick another genre or mood, or clear the filters to see your full feed.
            </p>
            {onClearQuickFilters && (
              <button
                type="button"
                onClick={onClearQuickFilters}
                className="mt-3 rounded-full border border-hair bg-chip px-4 py-1.5 text-xs text-secondary-foreground transition hover:bg-chip-strong hover:text-foreground"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <Music2 className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="text-sm font-semibold text-foreground/80 mb-1">Nothing here yet</h3>
            <p className="text-xs text-muted-foreground max-w-xs px-4">
              Search for your favorite songs or artists to start listening.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Genre & Mood quick filters — filtering is instant and local */}
      {filterBar}

      {/* 0. Recently Played - Quick Access */}
      {visibleRecentlyPlayed.length > 0 && (
        <section className="animate-fade-in">
          <SectionHeader title="Recently Played" icon={Clock} />
          <HorizontalScrollRow
            tracks={visibleRecentlyPlayed}
            currentId={currentId}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
            onToggleLike={onToggleLike}
            likedIds={likedIds}
          />
        </section>
      )}

      {/* 1. Daily Mix */}
      {visibleDailyMix.length > 0 && (
        <section className="animate-fade-in">
          <div className="flex items-center justify-between mb-2.5 px-0.5">
            <h2 className="text-sm font-semibold tracking-normal text-foreground/90">Daily Mix</h2>
            <span className="text-[11px] font-normal text-muted-foreground">
              Updated today
            </span>
          </div>
          <HorizontalScrollRow
            tracks={visibleDailyMix}
            currentId={currentId}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
            onToggleLike={onToggleLike}
            likedIds={likedIds}
          />
        </section>
      )}

      {/* Made For You (AI / Bandit Recommendations) */}
      {visibleRecommended.length > 0 && (
        <section className="animate-fade-in">
          <SectionHeader title="Made For You" />
          <VerticalSongList
            tracks={visibleRecommended}
            currentId={currentId}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
            onOpenOptions={onOpenOptions}
            onToggleLike={onToggleLike}
            likedIds={likedIds}
          />
        </section>
      )}

      {/* 4. Trending Now (Optional if rendered in Home) */}
      {visibleTrending.length > 0 && (
        <section className="animate-fade-in">
          <SectionHeader title="Trending Now" icon={TrendingUp} />
          <VerticalSongList
            tracks={visibleTrending.slice(0, 8)}
            currentId={currentId}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
            onOpenOptions={onOpenOptions}
            onToggleLike={onToggleLike}
            likedIds={likedIds}
          />
        </section>
      )}

      {/* 5. Old Classics (Optional if rendered in Home) */}
      {visibleOldSongs.length > 0 && (
        <section className="animate-fade-in">
          <div className="flex items-center justify-between mb-2.5 px-0.5">
            <div className="flex items-center gap-2">
              <Disc3 className="h-4 w-4 text-amber-400/80" />
              <h2 className="text-sm font-semibold tracking-normal text-foreground/90">Old Classics</h2>
            </div>
            <span className="text-[11px] font-normal text-muted-foreground">
              Golden Era & Retro
            </span>
          </div>
          <HorizontalScrollRow
            tracks={visibleOldSongs}
            currentId={currentId}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
            onToggleLike={onToggleLike}
            likedIds={likedIds}
          />
        </section>
      )}

      {/* 6. New Releases (Optional if rendered in Home) */}
      {visibleNewReleases.length > 0 && (
        <section className="animate-fade-in">
          <SectionHeader title="New Releases" icon={Flame} />
          <HorizontalScrollRow
            tracks={visibleNewReleases}
            currentId={currentId}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
            onToggleLike={onToggleLike}
            likedIds={likedIds}
          />
        </section>
      )}
    </div>
  );
}
