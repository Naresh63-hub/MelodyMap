import { useState } from "react";
import {
  Music2,
  User,
  Disc,
  Radio,
  Filter,
  SlidersHorizontal,
  Clock,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MediaCard } from "./MediaCard";
import type { Track } from "@/lib/library";

type SearchFilter = "all" | "songs" | "artists" | "albums" | "playlists";
type SortOption = "relevance" | "recent" | "popular";

type Props = {
  results: Track[];
  loading: boolean;
  query: string;
  onPlayTrack: (track: Track, index: number) => void;
  onToggleLike: (track: Track) => void;
  likedIds: Set<string>;
  currentId?: string;
  isPlaying: boolean;
};

export function SearchResults({
  results,
  loading,
  query,
  onPlayTrack,
  onToggleLike,
  likedIds,
  currentId,
  isPlaying,
}: Props) {
  const [filter, setFilter] = useState<SearchFilter>("all");
  const [sort, setSort] = useState<SortOption>("relevance");
  const [showFilters, setShowFilters] = useState(false);

  const filterOptions: Array<{ value: SearchFilter; label: string; icon: typeof Music2 }> = [
    { value: "all", label: "All", icon: SlidersHorizontal },
    { value: "songs", label: "Songs", icon: Music2 },
    { value: "artists", label: "Artists", icon: User },
    { value: "albums", label: "Albums", icon: Disc },
    { value: "playlists", label: "Playlists", icon: Radio },
  ];

  const sortOptions: Array<{ value: SortOption; label: string; icon: typeof Clock }> = [
    { value: "relevance", label: "Relevance", icon: TrendingUp },
    { value: "recent", label: "Recent", icon: Clock },
    { value: "popular", label: "Popular", icon: TrendingUp },
  ];

  // Mock filtering and sorting - in production, this would be done on the backend
  const filteredResults = results.filter((track) => {
    if (filter === "all") return true;
    // For demo purposes, we'll treat all results as songs
    return filter === "songs";
  });

  const sortedResults = [...filteredResults].sort((a, b) => {
    if (sort === "recent") return 0; // Would sort by date
    if (sort === "popular") return 0; // Would sort by popularity
    return 0; // relevance is default
  });

  return (
    <div className="animate-page-in">
      {/* Search header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-2">
          {query ? `Results for "${query}"` : "Search"}
        </h2>
        <p className="text-sm text-white/40">
          {loading ? "Searching..." : `${results.length} results found`}
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {filterOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                onClick={() => setFilter(option.value)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 button-press focus-ring-neon",
                  filter === option.value
                    ? "border-purple-500/50 bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-cyan-500/10 text-white shadow-[0_0_12px_rgba(168,85,247,0.15)]"
                    : "border-white/10 bg-white/[0.04] text-white/50 hover:text-white/70 hover:border-white/20",
                )}
              >
                <Icon className="h-4 w-4" />
                {option.label}
              </button>
            );
          })}
          
          <div className="ml-auto flex items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="bg-white/[0.04] border border-white/10 rounded-full px-3 py-2 text-sm text-white/70 focus:border-purple-500/50 focus:outline-none transition-colors"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-[#0a0a18]">
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-16 text-white/30">
          <div className="h-8 w-8 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
          <p className="text-sm">Searching for "{query}"...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && results.length === 0 && query && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Music2 className="h-16 w-16 text-white/20" />
          <h3 className="text-lg font-semibold text-white/60">No results found</h3>
          <p className="text-sm text-white/40 max-w-md">
            We couldn't find anything matching "{query}". Try checking your spelling or use different keywords.
          </p>
          <Button
            variant="outline"
            className="mt-4 border-white/10 text-white/70 hover:bg-white/5"
            onClick={() => window.location.reload()}
          >
            Clear search
          </Button>
        </div>
      )}

      {/* Results */}
      {!loading && sortedResults.length > 0 && (
        <div className="space-y-8">
          {/* Top result */}
          {(() => {
            const topResult = sortedResults[0];
            if (!topResult) return null;
            return (
            <section>
              <h3 className="text-sm font-semibold text-white/60 mb-4 uppercase tracking-wider">
                Top result
              </h3>
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-cyan-500/5 border border-purple-500/20 hover:border-purple-500/30 transition-all duration-300 group hover:scale-[1.02]">
                <img
                  src={topResult.thumbnail}
                  alt={topResult.title}
                  className="h-20 w-20 rounded-xl object-cover shadow-lg"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold text-white truncate group-hover:text-pink-400 transition-colors">
                    {topResult.title}
                  </p>
                  <p className="text-sm text-white/60 truncate">{topResult.artist}</p>
                  <p className="text-xs text-white/40 mt-1">Song</p>
                </div>
                <Button
                  size="lg"
                  className="rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all duration-200 hover:scale-105 button-press"
                  onClick={() => onPlayTrack(topResult, 0)}
                >
                  Play
                </Button>
              </div>
            </section>
            );
          })()}

          {/* Songs grid */}
          {sortedResults.length > 1 && (
            <section>
              <h3 className="text-sm font-semibold text-white/60 mb-4 uppercase tracking-wider">
                Songs
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 min-[1920px]:grid-cols-10 min-[2560px]:grid-cols-12 min-[3840px]:grid-cols-16 gap-4">
                {sortedResults.slice(1).map((track, index) => (
                  <MediaCard
                    key={track.id}
                    title={track.title}
                    subtitle={track.artist}
                    image={track.thumbnail}
                    playing={currentId === track.id && isPlaying}
                    active={currentId === track.id}
                    liked={likedIds.has(track.id)}
                    onPlay={() => onPlayTrack(track, index + 1)}
                    onToggleLike={() => onToggleLike(track)}
                    size="md"
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Recent searches (when no query) */}
      {!loading && !query && (
        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-white/60 mb-4 uppercase tracking-wider">
              Recent searches
            </h3>
            <div className="flex flex-wrap gap-2">
              {["Telugu songs", "Chill mix", "Workout playlist", "Romantic hits"].map((search) => (
                <button
                  key={search}
                  className="px-4 py-2 rounded-full bg-white/[0.04] border border-white/10 text-sm text-white/60 hover:text-white hover:border-white/20 transition-all duration-200 button-press"
                >
                  {search}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-white/60 mb-4 uppercase tracking-wider">
              Trending searches
            </h3>
            <div className="flex flex-wrap gap-2">
              {["New releases 2024", "Top 50 Telugu", "Bollywood hits", "Podcast recommendations"].map((search) => (
                <button
                  key={search}
                  className="px-4 py-2 rounded-full bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-purple-500/20 text-sm text-white/70 hover:text-white hover:border-purple-500/40 transition-all duration-200 button-press"
                >
                  <TrendingUp className="h-3 w-3 mr-1 inline" />
                  {search}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}