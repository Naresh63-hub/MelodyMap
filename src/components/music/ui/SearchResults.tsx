import { useState } from "react";
import {
  Music2,
  TrendingUp,
  MoreVertical,
  Globe2,
  Mic,
  ListMusic,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getOptimizedThumbnailUrl } from "@/lib/network-mode";
import type { Track } from "@/lib/library";
import { Equalizer } from "@/components/music/NowPlayingViz";

export type SearchFilter = "all" | "songs" | "artists" | "albums" | "playlists";

type Props = {
  results: Track[];
  loading: boolean;
  query: string;
  onPlayTrack: (track: Track, index: number) => void;
  onToggleLike: (track: Track) => void;
  onOpenOptions?: (track: Track) => void;
  likedIds: Set<string>;
  currentId?: string | null;
  isPlaying: boolean;
  onClear?: () => void;
  onSearch?: (query: string, type?: "songs" | "podcasts") => void;
  selectedFilter?: SearchFilter;
  onFilterChange?: (filter: SearchFilter) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
};

const TRENDING_SEARCH_SEEDS = [
  "The Weeknd",
  "Taylor Swift",
  "Arijit Singh",
  "Billie Eilish",
  "Drake",
  "Ed Sheeran",
  "Dua Lipa",
  "Post Malone",
];

export function SearchResults({
  results,
  loading,
  query,
  onPlayTrack,
  onToggleLike: _onToggleLike,
  onOpenOptions,
  likedIds: _likedIds,
  currentId,
  isPlaying,
  onClear: _onClear,
  onSearch,
  selectedFilter,
  onFilterChange,
  hasMore,
  loadingMore,
  onLoadMore,
}: Props) {
  const [internalFilter, setInternalFilter] = useState<SearchFilter>("all");
  const filter = selectedFilter ?? internalFilter;

  const filterOptions: Array<{ value: SearchFilter; label: string }> = [
    { value: "all", label: "Top" },
    { value: "songs", label: "Songs" },
    { value: "artists", label: "Artists" },
    { value: "albums", label: "Albums" },
    { value: "playlists", label: "Playlists" },
  ];

  if (loading) {
    return (
      <div className="space-y-2 pt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-2 rounded-lg bg-[#161616] border border-white/[0.04] animate-pulse"
          >
            <div className="h-11 w-11 rounded-md bg-white/[0.06]" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-3/4 rounded bg-white/[0.06]" />
              <div className="h-3 w-1/2 rounded bg-white/[0.04]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // When no query or no results, show Trending Searches & Browse Cards (Screen 2)
  if (!query.trim() && results.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in pt-2">
        {/* Trending Searches */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#737373]" />
            <h2 className="text-sm font-bold text-[#F5F5F5]">Trending Searches</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {TRENDING_SEARCH_SEEDS.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => onSearch?.(term, "songs")}
                className="rounded-full bg-[#161616] border border-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-[#A1A1A1] hover:bg-[#1D1D1D] hover:text-[#F5F5F5] active:scale-95 transition-all"
              >
                {term}
              </button>
            ))}
          </div>
        </section>

        {/* Browse By Category Cards */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-[#F5F5F5]">Browse Categories</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                title: "Trending Hits",
                subtitle: "Top chart songs",
                icon: Music2,
                query: "top trending songs",
                type: "songs" as const,
              },
              {
                title: "Podcasts & Shows",
                subtitle: "Talks, Tech, True Crime",
                icon: Mic,
                query: "best podcast episodes",
                type: "podcasts" as const,
              },
              {
                title: "Languages",
                subtitle: "Hindi, English, Telugu...",
                icon: Globe2,
                query: "top hindi hits songs",
                type: "songs" as const,
              },
              {
                title: "Chill Mixes",
                subtitle: "Lofi, Focus, Relax",
                icon: ListMusic,
                query: "chill relaxing songs",
                type: "songs" as const,
              },
            ].map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.title}
                  type="button"
                  onClick={() => onSearch?.(cat.query, cat.type)}
                  className="flex flex-col justify-between p-4 rounded-xl bg-[#161616] hover:bg-[#1D1D1D] border border-white/[0.06] text-left transition-all active:scale-[0.98] h-28 group"
                >
                  <Icon className="h-5 w-5 text-[#A1A1A1] group-hover:text-[#1DB954] transition-colors" />
                  <div>
                    <p className="text-xs font-semibold text-[#F5F5F5] leading-tight">
                      {cat.title}
                    </p>
                    <p className="text-[10px] text-[#A1A1A1] leading-tight mt-0.5">
                      {cat.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in pt-1">
      {/* Category Pills Header */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {filterOptions.map((opt) => {
          const active = filter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setInternalFilter(opt.value);
                onFilterChange?.(opt.value);
              }}
              className={cn(
                "rounded-full px-3.5 py-1 text-xs transition-all",
                active
                  ? "bg-[#F5F5F5] text-black font-semibold"
                  : "bg-white/[0.04] text-[#A1A1A1] hover:text-[#F5F5F5] hover:bg-white/[0.08] border border-white/[0.06] font-medium"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Results Song List */}
      <div className="space-y-1 pt-1">
        {results.map((track, i) => {
          const active = currentId === track.id;
          return (
            <div
              key={`${track.id}-${i}`}
              className={cn(
                "group flex items-center gap-3 rounded-lg p-2 transition-colors",
                active
                  ? "bg-[#1D1D1D]"
                  : "hover:bg-white/[0.03]"
              )}
            >
              {/* Thumbnail + Play */}
              <button
                type="button"
                onClick={() => onPlayTrack(track, i)}
                className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-[#161616]"
              >
                <img
                  src={getOptimizedThumbnailUrl(track.thumbnail)}
                  alt=""
                  className="h-full w-full object-cover"
                />
                {active && isPlaying && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Equalizer active className="h-4 w-4 text-[#1DB954]" />
                  </div>
                )}
              </button>

              {/* Track Info */}
              <button
                type="button"
                onClick={() => onPlayTrack(track, i)}
                className="min-w-0 flex-1 text-left"
              >
                <p
                  className={cn(
                    "truncate text-sm font-semibold leading-tight",
                    active ? "text-[#1DB954]" : "text-[#F5F5F5]"
                  )}
                >
                  {track.title}
                </p>
                <p className="truncate text-xs text-[#A1A1A1] leading-tight mt-1 font-normal">
                  {track.artist}
                </p>
              </button>

              {/* 3-dots Menu Button */}
              {onOpenOptions && (
                <button
                  type="button"
                  onClick={() => onOpenOptions(track)}
                  aria-label="Options"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[#737373] hover:text-[#F5F5F5] hover:bg-white/[0.06] active:scale-90 transition-all"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Load More Button */}
      {hasMore && results.length > 0 && (
        <div className="flex justify-center pt-2 pb-6">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-[#161616] px-5 py-2 text-xs font-medium text-[#F5F5F5] hover:bg-[#1D1D1D] active:scale-95 transition-all disabled:opacity-50"
          >
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin text-[#1DB954]" /> : null}
            {loadingMore ? "Loading more..." : "Load more results"}
          </button>
        </div>
      )}
    </div>
  );
}