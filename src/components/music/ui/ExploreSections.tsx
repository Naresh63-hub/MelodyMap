import { Disc3, Flame, MoreVertical, Music2, TrendingUp } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import type { Track } from "@/lib/library";
import { Equalizer } from "@/components/music/NowPlayingViz";

type Props = {
  trending: Track[];
  oldSongs?: Track[] | undefined;
  newReleases: Track[];
  onPlayTrack: (track: Track, tracks: Track[], index: number) => void;
  onOpenOptions?: ((track: Track) => void) | undefined;
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
                  src={track.thumbnail}
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

/** Vertical song list row for Trending */
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
              active ? "bg-[#1D1D1D]" : "hover:bg-white/[0.03]",
            )}
          >
            {/* Thumbnail + Play Action */}
            <button
              type="button"
              onClick={() => onPlayTrack(track, tracks, i)}
              className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-[#161616] border border-white/[0.06]"
            >
              <img
                src={track.thumbnail}
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
  subtitle,
}: {
  title: string;
  icon?: typeof TrendingUp | typeof Flame | typeof Disc3;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-2.5 px-0.5">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-[#737373]" />}
        <h2 className="text-sm font-bold tracking-tight text-[#F5F5F5]">{title}</h2>
      </div>
      {subtitle && (
        <span className="text-[11px] font-normal text-[#737373]">
          {subtitle}
        </span>
      )}
    </div>
  );
}

export function ExploreSections({
  trending,
  oldSongs,
  newReleases,
  onPlayTrack,
  onOpenOptions,
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
                <div key={i} className="w-[132px] shrink-0 space-y-2">
                  <div className="aspect-square w-full rounded-lg bg-[#161616] border border-white/[0.04] animate-pulse" />
                  <div className="h-3 w-3/4 rounded bg-[#1c1c1c] animate-pulse" />
                  <div className="h-2.5 w-1/2 rounded bg-[#161616] animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-1 animate-fade-in">
      {/* 1. Trending Hits */}
      {trending.length > 0 && (
        <section>
          <SectionHeader title="Trending Now" icon={TrendingUp} subtitle="Top charts in your language" />
          <VerticalSongList
            tracks={trending.slice(0, 8)}
            currentId={currentId}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
            onOpenOptions={onOpenOptions}
          />
        </section>
      )}

      {/* 2. New Releases */}
      {newReleases.length > 0 && (
        <section>
          <SectionHeader title="New Releases" icon={Flame} subtitle="Fresh drops" />
          <HorizontalScrollRow
            tracks={newReleases}
            currentId={currentId}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
          />
        </section>
      )}

      {/* 3. Old Classics & Evergreens */}
      {oldSongs && oldSongs.length > 0 && (
        <section>
          <SectionHeader title="Old Classics" icon={Disc3} subtitle="Golden Era & Retro hits" />
          <HorizontalScrollRow
            tracks={oldSongs}
            currentId={currentId}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
          />
        </section>
      )}
    </div>
  );
}
