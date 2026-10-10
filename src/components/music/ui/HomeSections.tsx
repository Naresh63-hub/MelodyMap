import { Music2, Sparkles, Users } from "lucide-react";
import { useMemo } from "react";
import { MediaCard } from "./MediaCard";
import { ArtistCard } from "./ArtistCard";
import { CardGrid } from "@/components/common/CardGrid";
import type { Track } from "@/lib/library";
import { trackSubtitle } from "@/lib/track-metadata";
import { getTopArtistsForLanguages, type JioSaavnArtist } from "@/lib/artists-data";

type Props = {
  dailyMix?: Track[] | undefined;
  recommended: Track[];
  userLanguages?: string[] | undefined;
  onPlayTrack: (track: Track, index: number) => void;
  onToggleLike: (track: Track) => void;
  onOpenOptions?: ((track: Track) => void) | undefined;
  onArtistClick?: ((artist: JioSaavnArtist) => void) | undefined;
  likedIds: Set<string>;
  currentId?: string | null;
  isPlaying: boolean;
  /** Show skeleton placeholders while data loads. */
  loading?: boolean;

  // Preserved for backwards compatibility
  recentlyPlayed?: Track[] | undefined;
  trending?: Track[] | undefined;
  oldSongs?: Track[] | undefined;
  newReleases?: Track[] | undefined;
};

/**
 * Official JioSaavn Home Sections:
 * 1. Daily Mix
 * 2. Top Artists (circular avatars)
 * 3. Made For You
 */
export function HomeSections({
  dailyMix,
  recommended,
  userLanguages = [],
  onPlayTrack,
  onToggleLike,
  onOpenOptions,
  onArtistClick,
  likedIds,
  currentId,
  isPlaying,
  loading = false,
}: Props) {
  const topArtists = useMemo(() => {
    return getTopArtistsForLanguages(userLanguages);
  }, [userLanguages]);

  /** Skeleton placeholder card with neutral shimmer. */
  const SkeletonCard = () => (
    <div className="space-y-2">
      <div className="aspect-square w-full rounded-xl bg-card border border-hair animate-pulse" />
      <div className="h-3 w-3/4 rounded bg-[#1c1c1c] animate-pulse" />
      <div className="h-2.5 w-1/2 rounded bg-card animate-pulse" />
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

  const hasAnyContent = (dailyMix && dailyMix.length > 0) || recommended.length > 0;

  const Section = ({
    title,
    subtitle,
    tracks,
    icon: Icon,
  }: {
    title: string;
    subtitle?: string;
    tracks: Track[];
    icon?: typeof Sparkles | typeof Music2;
  }) => {
    if (tracks.length === 0) return null;

    return (
      <section className="mb-8 animate-page-in">
        <div className="mb-3.5 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-primary" />}
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
          </div>
          {subtitle && (
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          )}
        </div>
        <CardGrid
          items={tracks.slice(0, 12)}
          renderCard={(track, index) => (
            <MediaCard
              key={track.id}
              title={track.title}
              subtitle={trackSubtitle(track)}
              image={track.thumbnail}
              playing={currentId === track.id && isPlaying}
              active={currentId === track.id}
              liked={likedIds.has(track.id)}
              onPlay={() => onPlayTrack(track, index)}
              onToggleLike={() => onToggleLike(track)}
              onMore={onOpenOptions ? () => onOpenOptions(track) : undefined}
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
          <h3 className="text-base font-semibold text-foreground/80 mb-1">Nothing here yet</h3>
          <p className="text-xs text-neutral-400 max-w-xs">
            Search for a song, pick a genre, or tune your feed to get personalized picks.
          </p>
        </div>
      )}

      {/* 1. Daily Mix */}
      {dailyMix && dailyMix.length > 0 && (
        <Section
          title="Daily Mix"
          subtitle="Updated today"
          icon={Sparkles}
          tracks={dailyMix}
        />
      )}

      {/* 2. Top Artists (Circular Avatars) */}
      {onArtistClick && topArtists.length > 0 && (
        <section className="mb-8 animate-page-in">
          <div className="mb-3.5 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Top Artists</h2>
            </div>
            <span className="text-xs text-muted-foreground">Popular right now</span>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 snap-x snap-mandatory">
            {topArtists.map((artist) => (
              <ArtistCard
                key={artist.id}
                artist={artist}
                onClick={onArtistClick}
              />
            ))}
          </div>
        </section>
      )}

      {/* 3. Made For You */}
      {recommended.length > 0 && (
        <Section
          title="Made For You"
          subtitle="Personalized for your taste"
          icon={Music2}
          tracks={recommended}
        />
      )}
    </div>
  );
}

export default HomeSections;