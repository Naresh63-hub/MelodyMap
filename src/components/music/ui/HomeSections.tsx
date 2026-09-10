import { Clock, Flame, Music2, Star, TrendingUp } from "lucide-react";
import { MediaCard } from "./MediaCard";
import { CardGrid } from "@/components/common/CardGrid";
import { cn } from "@/lib/utils";
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
  /** Skeleton placeholder card for loading state. */
  const SkeletonCard = () => (
    <div className="animate-pulse space-y-2">
      <div className="aspect-square w-full rounded-xl bg-white/[0.06]" />
      <div className="h-3 w-3/4 rounded bg-white/[0.06]" />
      <div className="h-2.5 w-1/2 rounded bg-white/[0.04]" />
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-8">
        {[1, 2].map((section) => (
          <section key={section} className="mb-8">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-white/[0.06] animate-pulse" />
              <div className="h-5 w-32 rounded bg-white/[0.06] animate-pulse" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 min-[1920px]:grid-cols-10 min-[2560px]:grid-cols-12 min-[3840px]:grid-cols-16 gap-4">
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
    icon: Icon,
    tracks,
    showMore = true,
  }: {
    title: string;
    icon: typeof Music2;
    tracks: Track[];
    showMore?: boolean;
  }) => {
    if (tracks.length === 0) return null;

    return (
      <section className="mb-8 animate-page-in">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-pink-400 icon-glow" />
            <h2 className="text-lg font-bold text-white">{title}</h2>
          </div>
          {showMore && (
            <button className="text-xs font-medium text-white/50 hover:text-white transition-colors">
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
              className="animate-fade-in-up"
              style={{ animationDelay: `${index * 50}ms` }}
            />
          )}
          className="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 min-[1920px]:grid-cols-10 min-[2560px]:grid-cols-12 min-[3840px]:grid-cols-16"
        />
      </section>
    );
  };

  return (
    <div className="space-y-8">
      {!hasAnyContent && (
        <div className="flex flex-col items-center justify-center py-16 text-center animate-page-in">
          <Music2 className="h-12 w-12 text-white/20 mb-4" />
          <h3 className="text-lg font-semibold text-white/60 mb-2">No tracks yet</h3>
          <p className="text-sm text-white/40 max-w-xs">
            Search for a song, pick a mood, or hit refresh to get personalized picks.
          </p>
        </div>
      )}
      {recentlyPlayed.length > 0 && (
        <Section
          title="Recently played"
          icon={Clock}
          tracks={recentlyPlayed}
        />
      )}
      
      {trending.length > 0 && (
        <Section
          title="🔥 Trending & Fresh Hits"
          icon={TrendingUp}
          tracks={trending}
        />
      )}

      {newReleases.length > 0 && (
        <Section
          title="⚡ Just Dropped / Fresh Releases"
          icon={Flame}
          tracks={newReleases}
        />
      )}

      {recommended.length > 0 && (
        <Section
          title="✨ New & Old Classics Blend"
          icon={Star}
          tracks={recommended}
        />
      )}
    </div>
  );
}