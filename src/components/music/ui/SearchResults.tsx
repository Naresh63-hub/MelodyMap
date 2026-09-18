import { useState } from "react";
import {
  Music2,
  User,
  Disc,
  Radio,
  SlidersHorizontal,
  TrendingUp,
  MoreVertical,
  Globe2,
  Mic,
  ListMusic,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  onToggleLike,
  onOpenOptions,
  likedIds,
  currentId,
  isPlaying,
  onClear,
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
      <div className="space-y-3 pt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3.5 p-3 rounded-2xl bg-purple-950/20 border border-purple-500/10 animate-pulse"
          >
            <div className="h-12 w-12 rounded-xl bg-purple-950/40" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-3/4 rounded bg-purple-950/40" />
              <div className="h-3 w-1/2 rounded bg-purple-950/20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // When no query or no results, show Trending Searches & Browse Cards (Screen 2)
  if (!query.trim() && results.length === 0) {
    return (
      <div className="space-y-7 animate-fade-in pt-2">
        {/* Trending Searches */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-400" />
            <h2 className="text-sm font-bold text-white">Trending Searches</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {TRENDING_SEARCH_SEEDS.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => onSearch?.(term, "songs")}
                className="rounded-full bg-[#140f24] border border-purple-500/25 px-4 py-2 text-xs font-semibold text-purple-200 hover:bg-purple-600/20 hover:text-white hover:border-purple-500/50 active:scale-95 transition-all shadow-sm"
              >
                {term}
              </button>
            ))}
          </div>
        </section>

        {/* Browse By Category Cards */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-white">Browse Categories</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                title: "Trending Hits",
                subtitle: "Top chart songs",
                icon: Music2,
                query: "top trending songs",
                type: "songs" as const,
                color: "from-purple-600/30 to-indigo-600/20",
              },
              {
                title: "Podcasts & Shows",
                subtitle: "Talks, Tech, True Crime",
                icon: Mic,
                query: "best podcast episodes",
                type: "podcasts" as const,
                color: "from-indigo-600/30 to-violet-600/20",
              },
              {
                title: "Languages",
                subtitle: "Hindi, English, Telugu...",
                icon: Globe2,
                query: "top hindi hits songs",
                type: "songs" as const,
                color: "from-fuchsia-600/30 to-purple-600/20",
              },
              {
                title: "Chill Mixes",
                subtitle: "Lofi, Focus, Relax",
                icon: ListMusic,
                query: "chill relaxing songs",
                type: "songs" as const,
                color: "from-violet-600/30 to-pink-600/20",
              },
            ].map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.title}
                  type="button"
                  onClick={() => onSearch?.(cat.query, cat.type)}
                  className={cn(
                    "flex flex-col justify-between p-4 rounded-2xl bg-[#140f24] border border-purple-500/20 text-left transition-all hover:border-purple-500/40 active:scale-[0.98] h-28 bg-gradient-to-br",
                    cat.color
                  )}
                >
                  <Icon className="h-6 w-6 text-purple-300" />
                  <div>
                    <p className="text-xs font-bold text-white leading-tight">
                      {cat.title}
                    </p>
                    <p className="text-[10px] text-purple-200/50 leading-tight mt-0.5">
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
                "rounded-full border px-3.5 py-1 text-xs font-medium transition-all",
                active
                  ? "border-purple-500 bg-purple-600/30 text-white shadow-sm shadow-purple-500/30"
                  : "border-white/10 bg-white/[0.03] text-white/50 hover:text-white"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Results Song List */}
      <div className="space-y-1.5 pt-1">
        {results.map((track, i) => {
          const active = currentId === track.id;
          return (
            <div
              key={`${track.id}-${i}`}
              className={cn(
                "flex items-center gap-3 rounded-2xl p-2.5 transition-all",
                active
                  ? "bg-purple-600/15 border border-purple-500/30"
                  : "bg-[#140f24] border border-purple-500/10 hover:bg-purple-950/30"
              )}
            >
              {/* Thumbnail + Play */}
              <button
                type="button"
                onClick={() => onPlayTrack(track, i)}
                className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl shadow-md"
              >
                <img
                  src={track.thumbnail}
                  alt=""
                  className="h-full w-full object-cover"
                />
                {active && isPlaying && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Equalizer active className="h-4 w-4 text-purple-400" />
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
                    "truncate text-xs font-bold leading-tight",
                    active ? "text-purple-300" : "text-white"
                  )}
                >
                  {track.title}
                </p>
                <p className="truncate text-[11px] text-purple-300/50 leading-tight mt-0.5 font-medium">
                  {track.artist}
                </p>
              </button>

              {/* 3-dots Menu Button */}
              {onOpenOptions && (
                <button
                  type="button"
                  onClick={() => onOpenOptions(track)}
                  aria-label="Options"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/[0.06] active:scale-90 transition-all"
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
            className="flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-600/20 px-6 py-2.5 text-xs font-semibold text-purple-200 hover:bg-purple-600/30 hover:text-white active:scale-95 transition-all shadow-md disabled:opacity-50"
          >
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin text-purple-400" /> : null}
            {loadingMore ? "Loading more..." : "Load more results"}
          </button>
        </div>
      )}
    </div>
  );
}