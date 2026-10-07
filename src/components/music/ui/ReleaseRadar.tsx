import { Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Track } from '@/lib/library';

const RELEASE_RADAR_KEY = 'melodymap-release-radar';
const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

type Props = {
  allTracks: Track[];
  followedArtists: string[];
  className?: string;
};

export function ReleaseRadar({ allTracks, followedArtists, className }: Props) {
  const getNewReleases = (): Track[] => {
    // Filter tracks from followed artists
    const followedArtistSet = new Set(
      followedArtists.map(a => a.toLowerCase())
    );
    
    const artistTracks = allTracks.filter(track =>
      followedArtistSet.has(track.artist.toLowerCase())
    );
    
    // Sort by some metric (in real app, would use release date)
    // For now, we'll shuffle to simulate new content
    const shuffled = artistTracks.sort(() => Math.random() - 0.5);
    
    return shuffled.slice(0, 20);
  };

  const newReleases = getNewReleases();
  
  if (newReleases.length === 0) {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex items-center gap-2 px-0.5">
          <Radio className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground/90">Release Radar</h3>
        </div>
        
        <div className="text-xs text-muted-foreground px-0.5">
          Follow artists to see their new releases here
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2 px-0.5">
        <Radio className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground/90">Release Radar</h3>
        <span className="text-[11px] text-muted-foreground">• Updated every Friday</span>
      </div>
      
      <div className="text-xs text-muted-foreground px-0.5">
        {newReleases.length} new releases from artists you follow
      </div>
    </div>
  );
}
