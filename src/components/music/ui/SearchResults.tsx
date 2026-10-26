import { useState } from "react";
import {
  Music2,
  MoreVertical,
  Globe2,
  Mic,
  ListMusic,
  Loader2,
  Clock,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getOptimizedThumbnailUrl } from "@/lib/network-mode";
import { LANGUAGES, type Track } from "@/lib/library";
import { Equalizer } from "@/components/music/NowPlayingViz";
import { trackSubtitle, getTrackDisplayDuration } from "@/lib/track-metadata";
import { useSearchHistory, type RecentSearchItem } from "@/lib/search-history";
import { HeartLikeButton } from "@/components/music/ui/HeartLikeButton";
import { RecentSearchesSection } from "@/components/music/ui/RecentSearchesSection";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
  recentSearches?: RecentSearchItem[];
  onRemoveRecentSearch?: (query: string) => void;
  onClearRecentSearches?: () => void;
  userHistory?: Track[];
  userLikes?: Track[];
  userLanguages?: string[];
  onOpenLanguages?: () => void;
};

export function SearchResults(props: Props) {
  const {
    results,
    loading,
    query,
    onPlayTrack,
    onToggleLike,
    onOpenOptions,
    likedIds,
    currentId,
    isPlaying,
    onSearch,
    selectedFilter,
    onFilterChange,
    hasMore,
    loadingMore,
    onLoadMore,
    recentSearches: propsRecentSearches,
    onRemoveRecentSearch,
    onClearRecentSearches,
    userLanguages,
    onOpenLanguages,
  } = props;

  const [internalFilter, setInternalFilter] = useState<SearchFilter>("all");
  const [isLanguagePickerOpen, setIsLanguagePickerOpen] = useState(false);
  const filter = selectedFilter ?? internalFilter;

  const hookHistory = useSearchHistory();
  const recentSearches = propsRecentSearches ?? hookHistory.recentSearches;
  const _handleRemoveRecentSearch = onRemoveRecentSearch ?? hookHistory.removeSearch;
  const _handleClearRecentSearches = onClearRecentSearches ?? hookHistory.clearHistory;

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
            className="flex items-center gap-3 p-2 rounded-lg bg-card border border-hair animate-pulse"
          >
            <div className="h-11 w-11 rounded-md bg-chip" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-3/4 rounded bg-chip" />
              <div className="h-3 w-1/2 rounded bg-chip" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Language Picker Modal Dialog
  const languagePickerDialog = (
    <Dialog open={isLanguagePickerOpen} onOpenChange={setIsLanguagePickerOpen}>
      <DialogContent className="max-w-md bg-card/95 backdrop-blur-2xl border border-hair-strong text-foreground p-5 rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-1 text-left pb-3 border-b border-hair">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Globe2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Browse by Language
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Select a language to discover top hits and trending songs
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* User Preferred Languages */}
        {userLanguages && userLanguages.length > 0 && (
          <div className="pt-3 space-y-2">
            <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Your Languages
            </p>
            <div className="grid grid-cols-2 gap-2">
              {userLanguages.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => {
                    setIsLanguagePickerOpen(false);
                    onSearch?.(`top ${lang.toLowerCase()} hits songs`, "songs");
                  }}
                  className="flex items-center justify-between p-3 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/30 text-left transition-all active:scale-[0.98]"
                >
                  <div>
                    <p className="text-xs font-semibold text-primary">{lang}</p>
                    <p className="text-[10px] text-primary/80">Top hit songs</p>
                  </div>
                  <span className="text-xs text-primary font-bold">&rarr;</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* All Available Languages */}
        <div className="pt-3 space-y-2">
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            All Languages
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {LANGUAGES.map((lang) => {
              const isUserLang = userLanguages?.includes(lang);
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => {
                    setIsLanguagePickerOpen(false);
                    onSearch?.(`top ${lang.toLowerCase()} hits songs`, "songs");
                  }}
                  className={cn(
                    "flex items-center justify-between p-2.5 rounded-xl border text-left transition-all active:scale-[0.98]",
                    isUserLang
                      ? "bg-chip-strong border-hair-strong text-foreground font-semibold"
                      : "bg-chip-subtle hover:bg-chip border-hair text-secondary-foreground hover:text-foreground"
                  )}
                >
                  <span className="text-xs font-medium">{lang}</span>
                  {isUserLang && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {onOpenLanguages && (
          <div className="pt-3 border-t border-hair mt-2">
            <button
              type="button"
              onClick={() => {
                setIsLanguagePickerOpen(false);
                onOpenLanguages();
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-chip hover:bg-chip-strong border border-hair text-xs font-medium text-foreground text-center transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Manage Languages &amp; Artists preferences</span>
              <span>&rarr;</span>
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  // When no query or no results, show Recent Searches & Browse Cards
  if (!query.trim() && results.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in pt-2">
        {languagePickerDialog}

        {/* Recent Searches (stores last 5 searched artist or song terms locally) */}
        <RecentSearchesSection
          onSelectQuery={(q) => onSearch?.(q, "songs")}
          maxItems={5}
        />

        {/* Browse By Category Cards */}
        <section className="space-y-2.5">
          <h2 className="text-sm font-semibold text-foreground/90">Browse Categories</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                title: "Top Hits",
                subtitle: "Popular chart songs",
                icon: Music2,
                onClick: () => onSearch?.("top hit songs", "songs"),
              },
              {
                title: "Podcasts & Shows",
                subtitle: "Talks, Tech, True Crime",
                icon: Mic,
                onClick: () => onSearch?.("best podcast episodes", "podcasts"),
              },
              {
                title: "Languages",
                subtitle:
                  userLanguages && userLanguages.length > 0
                    ? `${userLanguages.slice(0, 3).join(", ")}${userLanguages.length > 3 ? "..." : ""}`
                    : "Hindi, English, Telugu...",
                icon: Globe2,
                onClick: () => setIsLanguagePickerOpen(true),
              },
              {
                title: "Chill Mixes",
                subtitle: "Lofi, Focus, Relax",
                icon: ListMusic,
                onClick: () => onSearch?.("chill relaxing songs", "songs"),
              },
            ].map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.title}
                  type="button"
                  onClick={cat.onClick}
                  className="flex flex-col justify-between p-4 rounded-xl bg-card hover:bg-popover border border-hair text-left transition-all active:scale-[0.98] h-28 group"
                >
                  <Icon className="h-5 w-5 text-secondary-foreground group-hover:text-primary transition-colors" />
                  <div>
                    <p className="text-xs font-semibold text-foreground leading-tight">
                      {cat.title}
                    </p>
                    <p className="text-[10px] text-secondary-foreground leading-tight mt-0.5">
                      {cat.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Explore Languages Quick Row */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-sm font-semibold text-foreground/90">Explore by Language</h2>
            <button
              type="button"
              onClick={() => setIsLanguagePickerOpen(true)}
              className="text-xs font-medium text-primary hover:underline"
            >
              See all ({LANGUAGES.length})
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1 snap-x">
            {LANGUAGES.map((lang) => {
              const isUserLang = userLanguages?.includes(lang);
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => onSearch?.(`top ${lang.toLowerCase()} hits songs`, "songs")}
                  className={cn(
                    "shrink-0 snap-start rounded-full px-3.5 py-1.5 text-xs font-medium transition-all active:scale-95 whitespace-nowrap border",
                    isUserLang
                      ? "bg-primary/15 border-primary/40 text-primary font-semibold shadow-xs"
                      : "bg-card border-hair text-secondary-foreground hover:bg-chip-strong hover:text-foreground hover:border-hair-strong"
                  )}
                >
                  {lang}
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
      {languagePickerDialog}
      {/* Category Pills Header */}
      <div className="flex max-w-full gap-2 overflow-x-auto py-2.5 px-1 scrollbar-hide snap-x scroll-px-4">
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
                "shrink-0 snap-start rounded-full px-3.5 py-1.5 text-xs transition-all active:scale-95 button-press whitespace-nowrap",
                active
                  ? "border border-primary bg-primary font-semibold text-primary-foreground shadow-sm shadow-primary/25"
                  : "border border-hair bg-card font-medium text-secondary-foreground hover:bg-chip-strong hover:text-foreground hover:border-hair-strong"
              )}
            >
              {opt.label}
            </button>
          );
        })}
        <div className="w-3 shrink-0" aria-hidden="true" />
      </div>

      {/* Results Song List or No Results */}
      {results.length === 0 ? (
        <div className="py-12 text-center space-y-3">
          <p className="text-sm font-semibold text-foreground">No results found for &ldquo;{query}&rdquo;</p>
          <p className="text-xs text-muted-foreground">Check spelling or try searching for another artist or song</p>
          {recentSearches.length > 0 && (
            <div className="pt-4 max-w-xs mx-auto">
              <p className="text-xs font-medium text-secondary-foreground mb-2">Or try a recent search:</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {recentSearches.slice(0, 4).map((item) => (
                  <button
                    key={item.query}
                    type="button"
                    onClick={() => onSearch?.(item.query, "songs")}
                    className="inline-flex items-center gap-1.5 rounded-full bg-card border border-hair px-3 py-1 text-xs text-secondary-foreground hover:text-foreground hover:bg-popover active:scale-95 transition-all"
                  >
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span>{item.query}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1 pt-1">
          {results.map((track, i) => {
          const active = currentId === track.id;
          return (
            <div
              key={`${track.id}-${i}`}
              className={cn(
                "group flex items-center gap-3 rounded-xl p-2 transition-colors border",
                active
                  ? "bg-primary/15 border-primary/30 text-primary shadow-xs"
                  : "border-transparent hover:bg-chip"
              )}
            >
              {/* Thumbnail + Play */}
              <button
                type="button"
                onClick={() => onPlayTrack(track, i)}
                className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-card"
              >
                <img
                  src={getOptimizedThumbnailUrl(track.thumbnail)}
                  alt=""
                  className="h-full w-full object-cover"
                />
                {active && isPlaying && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Equalizer active className="h-4 w-4 text-primary" />
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
                    active ? "text-primary" : "text-foreground"
                  )}
                >
                  {track.title}
                </p>
                <p className="truncate text-xs text-secondary-foreground leading-tight mt-1 font-normal">
                  {trackSubtitle(track)}
                </p>
              </button>

              {/* Song duration time & like button matching reference image */}
              <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                <span className="text-xs sm:text-sm tabular-nums text-muted-foreground font-medium">
                  {getTrackDisplayDuration(track)}
                </span>
                <HeartLikeButton
                  liked={likedIds.has(track.id)}
                  onToggle={() => onToggleLike(track)}
                  size="md"
                />
              </div>

              {/* 3-dots Menu Button */}
              {onOpenOptions && (
                <button
                  type="button"
                  onClick={() => onOpenOptions(track)}
                  aria-label="Options"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/40 hover:text-foreground hover:bg-chip active:scale-90 transition-all"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      )}

      {/* Load More Button */}
      {hasMore && results.length > 0 && (
        <div className="flex justify-center pt-2 pb-6">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 rounded-full border border-hair bg-card px-5 py-2 text-xs font-medium text-foreground hover:bg-popover active:scale-95 transition-all disabled:opacity-50"
          >
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
            {loadingMore ? "Loading more..." : "Load more results"}
          </button>
        </div>
      )}
    </div>
  );
}