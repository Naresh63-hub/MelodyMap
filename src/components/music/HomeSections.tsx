import { ChevronLeft, ChevronRight, Pause, Play, Plus, Heart } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Track = {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration?: number;
};

type Props = {
  title: string;
  tracks: Track[];
  currentId?: string;
  isPlaying: boolean;
  onPlay: (track: Track, index: number) => void;
  onToggleLike?: (track: Track) => void;
  likedIds?: Set<string>;
  onArtistClick?: (artist: string) => void;
  onAddToQueue?: (track: Track) => void;
  /** "See all" link */
  onSeeAll?: () => void;
};

function ScrollRow({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.7;
    scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => scroll("left")}
        className="absolute -left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/20 sm:flex"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth pb-2">
        {children}
      </div>
      <button
        type="button"
        onClick={() => scroll("right")}
        className="absolute -right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/20 sm:flex"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

function TrackCard({
  track,
  currentId,
  isPlaying,
  onPlay,
  index,
  onArtistClick,
}: {
  track: Track;
  currentId?: string | undefined;
  isPlaying: boolean;
  onPlay: (track: Track, index: number) => void;
  index: number;
  onArtistClick?: ((artist: string) => void) | undefined;
}) {
  const isActive = currentId === track.id;
  return (
    <button
      type="button"
      onClick={() => onPlay(track, index)}
      className="group/card relative w-[140px] shrink-0 text-left transition-transform hover:scale-[1.03]"
    >
      <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-xl bg-white/[0.05]">
        <img
          src={track.thumbnail}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/card:bg-black/40">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm opacity-0 transition-all group-hover/card:opacity-100 group-hover/card:scale-100 scale-75">
            {isActive && isPlaying ? (
              <Pause className="h-5 w-5 text-white" fill="white" />
            ) : (
              <Play className="h-5 w-5 text-white" fill="white" />
            )}
          </div>
        </div>
        {isActive && (
          <div className="absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black">
            <div className="flex gap-[2px]">
              <span className={cn("h-2.5 w-[2px] bg-black", isPlaying && "animate-bar")} style={{ animationDelay: "0s" }} />
              <span className={cn("h-2 w-[2px] bg-black", isPlaying && "animate-bar")} style={{ animationDelay: "0.2s" }} />
              <span className={cn("h-3 w-[2px] bg-black", isPlaying && "animate-bar")} style={{ animationDelay: "0.4s" }} />
            </div>
          </div>
        )}
      </div>
      <p className="truncate text-xs font-medium text-white/90">{track.title}</p>
      <p className="truncate text-[11px] text-white/40">{track.artist}</p>
    </button>
  );
}

export function HomeSection({ title, tracks, currentId, isPlaying, onPlay, onSeeAll, onArtistClick }: Props) {
  if (tracks.length === 0) return null;
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <div className="flex items-center gap-2">
          {onSeeAll && (
            <button type="button" onClick={onSeeAll} className="text-xs text-white/50 hover:text-white/80 transition-colors">
              See all
            </button>
          )}
        </div>
      </div>
      <ScrollRow>
        {tracks.map((track, i) => (
          <TrackCard
            key={track.id}
            track={track}
            currentId={currentId}
            isPlaying={isPlaying}
            onPlay={onPlay}
            index={i}
            onArtistClick={onArtistClick}
          />
        ))}
      </ScrollRow>
    </section>
  );
}

export function HomeListSection({
  title,
  tracks,
  currentId,
  isPlaying,
  onPlay,
  onToggleLike,
  likedIds,
  onArtistClick,
}: Props & { onToggleLike?: (track: Track) => void; likedIds?: Set<string> }) {
  if (tracks.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-bold text-white">{title}</h2>
      <div className="space-y-1">
        {tracks.slice(0, 10).map((track, i) => {
          const isActive = currentId === track.id;
          return (
            <button
              key={track.id}
              type="button"
              onClick={() => onPlay(track, i)}
              className={cn(
                "group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                isActive ? "bg-white/[0.08]" : "hover:bg-white/[0.04]",
              )}
            >
              <span className="w-5 text-center text-xs text-white/30 tabular-nums">
                {isActive && isPlaying ? (
                  <div className="flex justify-center gap-[2px]">
                    <span className="h-3 w-[2px] bg-white animate-bar" style={{ animationDelay: "0s" }} />
                    <span className="h-2 w-[2px] bg-white animate-bar" style={{ animationDelay: "0.2s" }} />
                    <span className="h-3.5 w-[2px] bg-white animate-bar" style={{ animationDelay: "0.4s" }} />
                  </div>
                ) : (
                  <span className="opacity-0 group-hover:opacity-100">
                    <Play className="h-3 w-3 inline" fill="white" />
                  </span>
                )}
              </span>
              <img src={track.thumbnail} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" loading="lazy" />
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm font-medium", isActive ? "text-white" : "text-white/80")}>
                  {track.title}
                </p>
                <p className="truncate text-xs text-white/40">{track.artist}</p>
              </div>
              {onToggleLike && likedIds && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onToggleLike(track); }}
                  className="h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/30 opacity-0 transition-opacity hover:text-pink-400 group-hover:flex"
                >
                  <Heart className={cn("h-4 w-4", likedIds.has(track.id) && "fill-pink-400 text-pink-400")} />
                </button>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
