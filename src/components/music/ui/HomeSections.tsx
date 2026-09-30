import { Clock, Flame, Music2, TrendingUp } from "lucide-react";
import { MediaCard } from "./MediaCard";
import { CardGrid } from "@/components/common/CardGrid";
import type { Track } from "@/lib/library";

type Props = {
  recentlyPlayed: Track[];
  trending: Track[];
  newReleases: Track[];
  recommended: Track[];
  onPlayTrack: (track: Track, index: number) => void;
  onToggleLike: (track: Track) => void;
  likedIds: Set<string>;
  currentId?: string | null;
  isPlaying: boolean;
  /** Show skeleton placeholders while data loads. */
  loading?: boolean;
};

export function HomeSections({
  recentlyPlayed,
  trending,
  newReleases,
  recommended,
  onPlayTrack,
  onToggleLike,
  likedIds,
  currentId,
  isPlaying,
  loading = false,
}: Props) {
  /** Skeleton placeholder card with neutral shimmer. */
  const SkeletonCard = () => (
    <div className="space-y-2">
      <div className="aspect-square w-full rounded-lg bg-[#181818] border border-white/[0.04] animate-pulse" />
      <div className="h-3 w-3/4 rounded bg-[#1c1c1c] animate-pulse" />
      <div className="h-2.5 w-1/2 rounded bg-[#181818] animate-pulse" />
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-8">
        {[1, 2].map((section) => (
          <section key={section} className="mb-8">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-4 w-32 rounded bg-[#1c1c1c] animate-pulse" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  const hasAnyContent =
    recentlyPlayed.length > 0 || trending.length > 0 || newReleases.length > 0 || recommended.length > 0;

  const Section = ({
    title,
    tracks,
    showMore = true,
  }: {
    title: string;
    tracks: Track[];
    showMore?: boolean;
  }) => {
    if (tracks.length === 0) return null;

    return (
      <section className="mb-8 animate-page-in">
        <div className="mb-3.5 flex items-center justify-between px-1">
          <h2 className="text-lg font-semibold tracking-tight text-white/95">{title}</h2>
          {showMore && (
            <button className="text-xs font-medium text-neutral-400 hover:text-white transition-colors">
              See all
            </button>
          )}
        </div>
        <CardGrid 
          items={tracks.slice(0, 12)}
          renderCard={(track, index) => (
            <MediaCard
              key={track.id}
              title={track.title}
              subtitle={track.artist}
              image={track.thumbnail}
              playing={currentId === track.id && isPlaying}
              active={currentId === track.id}
              liked={likedIds.has(track.id)}
              onPlay={() => onPlayTrack(track, index)}
              onToggleLike={() => onToggleLike(track)}
              size="md"
            />
          )}
          className="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3"
        />
      </section>
    );
  };

  return (
    <div className="space-y-6">
      {!hasAnyContent && (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-page-in">
          <Music2 className="h-10 w-10 text-neutral-600 mb-3" />
          <h3 className="text-base font-semibold text-white/80 mb-1">Nothing here yet</h3>
          <p className="text-xs text-neutral-400 max-w-xs">
            Search for a song, pick a genre, or tune your feed to get personalized picks.
          </p>
        </div>
      )}

      {recentlyPlayed.length > 0 && (
        <Section
          title="Recently Played"
          tracks={recentlyPlayed}
        />
      )}
      
      {trending.length > 0 && (
        <Section
          title="Trending Now"
          tracks={trending}
        />
      )}

      {newReleases.length > 0 && (
        <Section
          title="New Releases"
          tracks={newReleases}
        />
      )}

      {recommended.length > 0 && (
        <Section
          title="Made For You"
          tracks={recommended}
        />
      )}
    </div>
  );
}