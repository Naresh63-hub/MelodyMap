import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Track } from '@/lib/library';

type Props = {
  artistName: string;
  onArtistClick: (artist: string) => void;
  className?: string;
};

export function SimilarArtistsSection({ artistName, onArtistClick, className }: Props) {
  // In a real implementation, this would fetch similar artists from YouTube Music API
  // For now, we'll show a placeholder that could be connected to an API
  
  const similarArtists = [
    `${artistName} Radio`,
    `Similar to ${artistName}`,
    `${artistName} Mix`,
  ];

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2 px-0.5">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground/90">Similar Artists</h3>
      </div>
      
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 snap-x snap-mandatory">
        {similarArtists.map((artist) => (
          <button
            key={artist}
            type="button"
            onClick={() => onArtistClick(artist)}
            className="shrink-0 px-4 py-2 rounded-full bg-chip border border-hair-strong text-xs font-medium text-foreground/80 hover:bg-chip-strong hover:text-foreground transition-all snap-start"
          >
            {artist}
          </button>
        ))}
      </div>
    </div>
  );
}
