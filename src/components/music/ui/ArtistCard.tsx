import { memo, useState } from "react";
import { Play, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JioSaavnArtist } from "@/lib/artists-data";

type Props = {
  artist: JioSaavnArtist;
  onClick: (artist: JioSaavnArtist) => void;
  className?: string;
};

export const ArtistCard = memo(function ArtistCard({ artist, onClick, className }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(artist)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(artist);
        }
      }}
      className={cn(
        "group relative flex w-[116px] sm:w-[136px] shrink-0 snap-start flex-col items-center text-center cursor-pointer p-2 rounded-xl transition-all duration-200 hover:bg-chip/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className,
      )}
    >
      {/* Circular Avatar Container */}
      <div className="relative mb-2 aspect-square w-24 sm:w-28 overflow-hidden rounded-full border-2 border-hair/60 bg-card shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:border-primary/80 group-hover:shadow-md group-hover:shadow-primary/20">
        {!error ? (
          <img
            src={artist.image}
            alt={artist.name}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
            className={cn(
              "h-full w-full object-cover transition-all duration-300 group-hover:scale-105",
              !loaded && "opacity-0",
              loaded && "opacity-100",
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-card text-muted-foreground">
            <User className="h-8 w-8 opacity-40" />
          </div>
        )}

        {/* Center Hover Play Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110 active:scale-95">
            <Play className="ml-0.5 h-4 w-4 fill-current" />
          </span>
        </div>
      </div>

      {/* Artist Information */}
      <div className="w-full px-1">
        <p className="truncate text-xs sm:text-sm font-semibold leading-tight text-foreground group-hover:text-primary transition-colors">
          {artist.name}
        </p>
        <p className="truncate text-[11px] text-muted-foreground font-normal leading-tight mt-0.5">
          {artist.role || "Artist"}
        </p>
      </div>
    </div>
  );
});

export default ArtistCard;
