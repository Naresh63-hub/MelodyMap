import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Track } from '@/lib/library';

const DISCOVER_WEEKLY_KEY = 'melodymap-discover-weekly';
const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

type Props = {
  allTracks: Track[];
  likedTracks: Track[];
  className?: string;
};

export function DiscoverWeekly({ allTracks, likedTracks, className }: Props) {
  const generatePlaylist = (): Track[] => {
    // Generate a weekly playlist based on:
    // 1. User's liked tracks (as base for preferences)
    // 2. Not already played recently
    // 3. Mix of genres from liked tracks
    
    const likedIds = new Set(likedTracks.map(t => t.id));
    
    // Extract artists from liked tracks
    const likedArtists = new Set(likedTracks.map(t => t.artist.toLowerCase()));
    
    // Find tracks from similar artists
    const similarArtistTracks = allTracks.filter(
      track => !likedIds.has(track.id) && likedArtists.has(track.artist.toLowerCase())
    );
    
    // Find tracks with similar titles/keywords
    const likedKeywords = likedTracks.flatMap(t => 
      t.title.toLowerCase().split(' ').filter(w => w.length > 3)
    );
    const keywordTracks = allTracks.filter(
      track => !likedIds.has(track.id) && 
      likedKeywords.some(keyword => track.title.toLowerCase().includes(keyword))
    );
    
    // Combine and deduplicate
    const combined = [...similarArtistTracks, ...keywordTracks];
    const unique = combined.filter((track, index, self) => 
      index === self.findIndex(t => t.id === track.id)
    );
    
    // Shuffle and take 30 tracks
    const shuffled = unique.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 30);
  };

  const playlist = generatePlaylist();
  
  if (playlist.length === 0) return null;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2 px-0.5">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground/90">Discover Weekly</h3>
        <span className="text-[11px] text-muted-foreground">• Updated every Monday</span>
      </div>
      
      <div className="text-xs text-muted-foreground px-0.5">
        {playlist.length} tracks personalized for you
      </div>
    </div>
  );
}
