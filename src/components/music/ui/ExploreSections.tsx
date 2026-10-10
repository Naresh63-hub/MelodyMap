import { Disc3, Flame, MoreHorizontal, MoreVertical, Music2, Pause, Play, TrendingUp } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import type { Track } from "@/lib/library";
import { Equalizer } from "@/components/music/NowPlayingViz";
import { HeartLikeButton } from "@/components/music/ui/HeartLikeButton";
import { trackSubtitle } from "@/lib/track-metadata";

type Props = {
  trending: Track[];
  oldSongs?: Track[] | undefined;
  newReleases: Track[];
  onPlayTrack: (track: Track, tracks: Track[], index: number) => void;
  onOpenOptions?: ((track: Track) => void) | undefined;
  onToggleLike?: ((track: Track) => void) | undefined;
  likedIds?: Set<string> | undefined;
  currentId?: string | null | undefined;
  isPlaying: boolean;
  loading?: boolean | undefined;
};

/** Horizontal scrollable row of JioSaavn-styled track cards */
function HorizontalScrollRow({
  tracks,
  currentId,
  isPlaying,
  onPlayTrack,
  onToggleLike,
  onOpenOptions,
  likedIds,
}: {
  tracks: Track[];
  currentId?: string | null | undefined;
  isPlaying: boolean;
  onPlayTrack: (track: Track, tracks: Track[], index: number) => void;
  onToggleLike?: ((track: Track) => void) | undefined;
  onOpenOptions?: ((track: Track) => void) | undefined;
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
        const playing = active && isPlaying;

        return (
          <div
            key={track.id}
            className="group/card relative w-[138px] sm:w-[156px] shrink-0 snap-start text-left p-1.5 rounded-xl transition-all hover:bg-chip/50"
          >
            {/* JioSaavn Square Artwork Container */}
            <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-xl bg-card border border-hair">
              <button
                type="button"
                onClick={() => onPlayTrack(track, tracks, i)}
                className="h-full w-full block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {track.thumbnail ? (
                  <img
                    src={track.thumbnail}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-300 group-hover/card:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <Music2 className="h-7 w-7 opacity-40" />
                  </div>
                )}

                {/* JioSaavn Dark Gradient Hover/Playing Overlay */}
                <div
                  className={cn(
                    "absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30 transition-opacity duration-200",
                    active ? "opacity-100" : "opacity-0 group-hover/card:opacity-100",
                  )}
                />

                {/* Center Circular Play Button */}
                <div
                  className={cn(
                    "absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-200",
                    playing
                      ? "opacity-100 scale-100"
                      : "opacity-0 scale-90 group-hover/card:opacity-100 group-hover/card:scale-100",
                  )}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white shadow-xl transition-transform hover:scale-110 active:scale-95">
                    {playing ? (
                      <Pause className="h-5 w-5 fill-current" />
                    ) : (
                      <Play className="ml-0.5 h-5 w-5 fill-current" />
                    )}
                  </span>
                </div>
              </button>

              {/* Bottom-Left Heart Button (Inside Artwork Overlay) */}
              {onToggleLike && (
                <div
                  className={cn(
                    "absolute bottom-1.5 left-1.5 z-10 transition-opacity duration-150",
                    liked ? "opacity-100" : "opacity-0 group-hover/card:opacity-100",
                  )}
                >
                  <HeartLikeButton
                    liked={liked}
                    onToggle={() => onToggleLike(track)}
                    size="sm"
                    className="bg-black/50 backdrop-blur-md hover:bg-black/70 shadow-sm"
                  />
                </div>
              )}

              {/* Bottom-Right 3-Dots Options Menu (Inside Artwork Overlay) */}
              {onOpenOptions && (
                <div className="absolute bottom-1.5 right-1.5 z-10 opacity-0 group-hover/card:opacity-100 transition-opacity duration-150">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenOptions(track);
                    }}
                    aria-label="Track options"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 backdrop-blur-md hover:bg-black/70 text-white/90 hover:text-white transition-colors shadow-sm"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Title & Artist below artwork */}
            <button
              type="button"
              onClick={() => onPlayTrack(track, tracks, i)}
              className="text-left w-full block focus:outline-none px-0.5"
            >
              <p
                className={cn(
                  "truncate text-xs sm:text-sm font-semibold leading-tight transition-colors",
                  active ? "text-primary" : "text-foreground group-hover/card:text-primary",
                )}
              >
                {track.title}
              </p>
              <p className="truncate text-[11px] sm:text-xs text-muted-foreground font-normal leading-tight mt-0.5">
                {trackSubtitle(track)}
              </p>
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Vertical song list row for Trending Songs */
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
              "flex items-center gap-3 rounded-xl p-2 transition-colors",
              active ? "bg-chip-strong" : "hover:bg-chip-subtle",
            )}
          >
            {/* Thumbnail + Play Action */}
            <button
              type="button"
              onClick={() => onPlayTrack(track, tracks, i)}
              className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-card border border-hair"
            >
              <img
                src={track.thumbnail}
                alt=""
                className="h-full w-full object-cover"
              />
              {active && isPlaying && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Equalizer active className="h-4 w-4 text-primary" />
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
                  "truncate text-[13px] sm:text-sm font-semibold leading-tight",
                  active ? "text-primary" : "text-foreground",
                )}
              >
                {track.title}
              </p>
              <p className="truncate text-xs text-muted-foreground font-normal leading-tight mt-0.5">
                {trackSubtitle(track)}
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
  subtitle,
}: {
  title: string;
  icon?: typeof TrendingUp | typeof Flame | typeof Disc3;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-3 px-0.5">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-primary" />}
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      {subtitle && (
        <span className="text-[11px] font-normal text-muted-foreground">
          {subtitle}
        </span>
      )}
    </div>
  );
}

/**
 * JioSaavn Explore Feed:
 * STRICTLY contains ONLY:
 * 1. New Releases (fresh official JioSaavn releases)
 * 2. Trending Songs (top charts in user's language)
 * 3. Old Songs (Golden Era & Retro classics)
 */
export function ExploreSections({
  trending,
  oldSongs,
  newReleases,
  onPlayTrack,
  onOpenOptions,
  onToggleLike,
  likedIds,
  currentId,
  isPlaying,
  loading = false,
}: Props) {
  if (loading) {
    return (
      <div className="space-y-6 pt-2">
        {[1, 2].map((s) => (
          <div key={s} className="space-y-3">
            <div className="h-4 w-28 rounded bg-[#1c1c1c] animate-pulse" />
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-[138px] shrink-0 space-y-2">
                  <div className="aspect-square w-full rounded-xl bg-card border border-hair animate-pulse" />
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

  return (
    <div className="space-y-7 pt-1 animate-fade-in">
      {/* 1. New Releases */}
      {newReleases.length > 0 && (
        <section>
          <SectionHeader title="New Releases" icon={Flame} subtitle="Fresh official drops" />
          <HorizontalScrollRow
            tracks={newReleases}
            currentId={currentId}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
            onToggleLike={onToggleLike}
            onOpenOptions={onOpenOptions}
            likedIds={likedIds}
          />
        </section>
      )}

      {/* 2. Trending Songs */}
      {trending.length > 0 && (
        <section>
          <SectionHeader title="Trending Songs" icon={TrendingUp} subtitle="Top charts in your language" />
          <VerticalSongList
            tracks={trending.slice(0, 12)}
            currentId={currentId}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
            onOpenOptions={onOpenOptions}
            onToggleLike={onToggleLike}
            likedIds={likedIds}
          />
        </section>
      )}

      {/* 3. Old Songs / Golden Era */}
      {oldSongs && oldSongs.length > 0 && (
        <section>
          <SectionHeader title="Old Songs" icon={Disc3} subtitle="Golden Era & Retro hits" />
          <HorizontalScrollRow
            tracks={oldSongs}
            currentId={currentId}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
            onToggleLike={onToggleLike}
            onOpenOptions={onOpenOptions}
            likedIds={likedIds}
          />
        </section>
      )}
    </div>
  );
}

export default ExploreSections;
