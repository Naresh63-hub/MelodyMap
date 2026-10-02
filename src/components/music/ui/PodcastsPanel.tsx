import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Headphones,
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Search,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { discoverPodcastsServerFn, getPodcastEpisodesServerFn } from "@/lib/music.functions";
import type { Podcast, PodcastEpisode } from "@/lib/podcast.types";
import type { Track } from "@/lib/library";
import { cn } from "@/lib/utils";

const POPULAR_LANGUAGES = [
  "Telugu",
  "Hindi",
  "Tamil",
  "English",
  "Kannada",
  "Malayalam",
  "Punjabi",
  "Bengali",
  "Marathi",
];

const PODCAST_TOPICS = [
  "All",
  "News & Politics",
  "Comedy",
  "Stories & Drama",
  "Tech & Science",
  "Culture & Society",
  "Business & Finance",
  "Health & Wellness",
  "Motivation",
];

export interface PodcastsPanelProps {
  currentTrackId?: string | undefined;
  isPlaying?: boolean | undefined;
  onPlayEpisode: (episode: PodcastEpisode, allEpisodes: PodcastEpisode[], index: number) => void;
  onPause?: () => void;
  onResume?: () => void;
  podcastHistory: Track[];
  onClearPodcastHistory: () => void;
  onPlayHistoryTrack: (track: Track, allHistory: Track[], index: number) => void;
  userLanguages: string[];
  onOpenSettings?: () => void;
}

export function PodcastsPanel({
  currentTrackId,
  isPlaying = false,
  onPlayEpisode,
  onPause,
  onResume,
  podcastHistory,
  onClearPodcastHistory,
  onPlayHistoryTrack,
  userLanguages,
  onOpenSettings,
}: PodcastsPanelProps) {
  const runDiscover = useServerFn(discoverPodcastsServerFn);
  const runGetEpisodes = useServerFn(getPodcastEpisodesServerFn);

  // Active language state (prioritize user preference)
  const initialLanguage =
    userLanguages.length > 0 && userLanguages[0] ? userLanguages[0] : "Telugu";
  const [selectedLanguage, setSelectedLanguage] = useState<string>(initialLanguage);

  // Discovery / search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("All");

  const [shows, setShows] = useState<Podcast[]>([]);
  const [loadingShows, setLoadingShows] = useState(false);
  const [showsError, setShowsError] = useState<string | null>(null);

  // Level 2: Selected Show & Episode state
  const [selectedShow, setSelectedShow] = useState<Podcast | null>(null);
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [episodesError, setEpisodesError] = useState<string | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);

  // Stale request token tracking
  const requestIdRef = useRef(0);

  // 1. Debounce Search Input (450ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 450);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 2. Fetch Shows when language, debouncedQuery, or topic changes
  const fetchShows = useCallback(
    async (lang: string, query: string, topic: string) => {
      const currentReqId = ++requestIdRef.current;
      setLoadingShows(true);
      setShowsError(null);

      try {
        const topicParam = topic !== "All" ? topic : undefined;
        const queryParam = query.length > 0 ? query : undefined;

        const res = await runDiscover({
          data: {
            language: lang,
            query: queryParam,
            topic: topicParam,
            limit: 30,
          },
        });

        // Ignore stale responses
        if (currentReqId !== requestIdRef.current) return;

        setShows(res.podcasts || []);
      } catch (err: unknown) {
        if (currentReqId !== requestIdRef.current) return;
        const msg = err instanceof Error ? err.message : "Failed to load podcasts";
        setShowsError(msg);
        setShows([]);
      } finally {
        if (currentReqId === requestIdRef.current) {
          setLoadingShows(false);
        }
      }
    },
    [runDiscover],
  );

  // Auto-fetch on parameter changes
  useEffect(() => {
    if (!selectedShow) {
      void fetchShows(selectedLanguage, debouncedQuery, selectedTopic);
    }
  }, [fetchShows, selectedLanguage, debouncedQuery, selectedTopic, selectedShow]);

  // 3. Select Show & Load Episodes
  const handleSelectShow = useCallback(
    async (show: Podcast) => {
      setSelectedShow(show);
      setShowFullDescription(false);
      setEpisodes([]);
      setEpisodesError(null);
      setLoadingEpisodes(true);

      try {
        const res = await runGetEpisodes({
          data: {
            podcastId: show.id,
            limit: 60,
          },
        });
        setEpisodes(res.episodes || []);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load episodes";
        setEpisodesError(msg);
        setEpisodes([]);
      } finally {
        setLoadingEpisodes(false);
      }
    },
    [runGetEpisodes],
  );

  const handleBackToShows = useCallback(() => {
    setSelectedShow(null);
    setEpisodes([]);
  }, []);

  const handleLanguageChange = useCallback((lang: string) => {
    setSelectedLanguage(lang);
    setSearchQuery("");
    setDebouncedQuery("");
    setSelectedShow(null);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setDebouncedQuery("");
  }, []);

  // Format date helper
  const formatDate = (iso?: string) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return null;
    }
  };

  // =========================================================================
  // LEVEL 2: SHOW DETAIL & EPISODES VIEW
  // =========================================================================
  if (selectedShow) {
    const isShowPlaying = episodes.some((ep) => ep.id === currentTrackId && isPlaying);

    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleBackToShows}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white/70 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>All Shows</span>
          </button>
          <span className="text-xs px-2.5 py-1 rounded-full bg-white/[0.06] text-white/60 font-medium">
            {selectedLanguage}
          </span>
        </div>

        {/* Show Header Card */}
        <div className="p-5 md:p-6 rounded-2xl bg-[#121212] border border-white/[0.08] flex flex-col md:flex-row gap-5 items-start">
          <div className="relative shrink-0 w-32 h-32 md:w-44 md:h-44 rounded-xl overflow-hidden bg-[#181818] border border-white/[0.08] shadow-lg">
            {selectedShow.artworkUrl ? (
              <img
                src={selectedShow.artworkUrl}
                alt={selectedShow.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-white/30">
                <Mic className="h-12 w-12" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/[0.08] text-white/70">
                {selectedShow.category || "Podcast"}
              </span>
              {selectedShow.language && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.05] text-white/60">
                  {selectedShow.language}
                </span>
              )}
            </div>

            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-white tracking-tight leading-tight">
              {selectedShow.title}
            </h1>
            <p className="text-sm text-white/60 mt-1 font-medium">{selectedShow.publisher}</p>

            {selectedShow.description && (
              <div className="mt-3">
                <p
                  className={cn(
                    "text-xs md:text-sm text-white/70 leading-relaxed",
                    !showFullDescription && "line-clamp-2 md:line-clamp-3",
                  )}
                >
                  {selectedShow.description}
                </p>
                {selectedShow.description.length > 140 && (
                  <button
                    type="button"
                    onClick={() => setShowFullDescription((prev) => !prev)}
                    className="text-xs text-white/40 hover:text-white mt-1 underline underline-offset-2"
                  >
                    {showFullDescription ? "Show less" : "Read more"}
                  </button>
                )}
              </div>
            )}

            {episodes.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center gap-3">
                <Button
                  onClick={() => {
                    const firstEp = episodes[0];
                    if (!firstEp) return;
                    if (currentTrackId === firstEp.id) {
                      if (isPlaying) onPause?.();
                      else onResume?.();
                    } else {
                      onPlayEpisode(firstEp, episodes, 0);
                    }
                  }}
                  className="rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-semibold px-5 h-9 text-xs"
                >
                  {isShowPlaying ? (
                    <>
                      <Pause className="h-3.5 w-3.5 fill-current mr-1.5" />
                      Pause Show
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current mr-1.5" />
                      Play Latest Episode
                    </>
                  )}
                </Button>
                <span className="text-xs text-white/50">{episodes.length} episodes available</span>
              </div>
            )}
          </div>
        </div>

        {/* Episodes Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <h2 className="text-base font-semibold text-white">Episodes</h2>
            <span className="text-xs text-white/40">{episodes.length} episodes</span>
          </div>

          {loadingEpisodes ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/40">
              <Loader2 className="h-6 w-6 animate-spin text-[#1DB954]" />
              <p className="text-xs">Loading episodes…</p>
            </div>
          ) : episodesError ? (
            <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.08] text-center space-y-2">
              <p className="text-xs text-rose-400">{episodesError}</p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void handleSelectShow(selectedShow)}
                className="text-xs"
              >
                Try Again
              </Button>
            </div>
          ) : episodes.length === 0 ? (
            <div className="py-12 text-center text-white/40 space-y-1">
              <p className="text-sm font-medium">No playable episodes found for this show.</p>
              <p className="text-xs text-white/30">Please try another show from the catalogue.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {episodes.map((ep, idx) => {
                const isCurrentEp = currentTrackId === ep.id;
                const isThisPlaying = isCurrentEp && isPlaying;
                const dateLabel = formatDate(ep.publishedAt);

                return (
                  <div
                    key={ep.id}
                    className={cn(
                      "group p-3 md:p-4 rounded-xl transition-colors flex items-start gap-3.5",
                      isCurrentEp
                        ? "bg-white/[0.06] border border-[#1DB954]/30"
                        : "hover:bg-white/[0.03] border border-transparent",
                    )}
                  >
                    {/* Play / Status Control */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isCurrentEp) {
                          if (isPlaying) onPause?.();
                          else onResume?.();
                        } else {
                          onPlayEpisode(ep, episodes, idx);
                        }
                      }}
                      className={cn(
                        "shrink-0 mt-0.5 h-10 w-10 rounded-full flex items-center justify-center transition-transform active:scale-95",
                        isThisPlaying
                          ? "bg-[#1DB954] text-black shadow-md shadow-[#1DB954]/20"
                          : isCurrentEp
                            ? "bg-white text-black"
                            : "bg-white/[0.08] text-white hover:bg-[#1DB954] hover:text-black",
                      )}
                      title={isThisPlaying ? "Pause" : "Play"}
                    >
                      {isThisPlaying ? (
                        <Pause className="h-4 w-4 fill-current" />
                      ) : (
                        <Play className="h-4 w-4 fill-current ml-0.5" />
                      )}
                    </button>

                    {/* Episode Metadata */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3
                          className={cn(
                            "text-sm font-medium leading-snug line-clamp-1",
                            isCurrentEp ? "text-[#1DB954]" : "text-white group-hover:text-white",
                          )}
                        >
                          {ep.title}
                        </h3>
                        {isThisPlaying && (
                          <div className="flex items-end gap-0.5 h-3">
                            <span className="w-0.5 h-3 bg-[#1DB954] animate-pulse" />
                            <span className="w-0.5 h-2 bg-[#1DB954] animate-pulse delay-75" />
                            <span className="w-0.5 h-3.5 bg-[#1DB954] animate-pulse delay-150" />
                          </div>
                        )}
                      </div>

                      {ep.description && (
                        <p className="text-xs text-white/50 line-clamp-2 mt-1 leading-relaxed">
                          {ep.description}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-2 text-[11px] text-white/40">
                        {dateLabel && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {dateLabel}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {ep.duration || "Full Episode"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // LEVEL 1: SHOWS DISCOVERY & SEARCH GRID
  // =========================================================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Podcasts</h1>
          <p className="text-xs text-white/50 mt-0.5">
            Discover audio shows and series in{" "}
            <span className="text-white font-medium">{selectedLanguage}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenSettings && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenSettings}
              className="rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white border-white/[0.08] text-xs h-8"
            >
              Topics
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void fetchShows(selectedLanguage, debouncedQuery, selectedTopic)}
            disabled={loadingShows}
            className="rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white border-white/[0.08] text-xs h-8"
          >
            {loadingShows ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Language Filter Pills */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
          Language
        </span>
        <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-hide">
          {POPULAR_LANGUAGES.map((lang) => {
            const isActive = selectedLanguage.toLowerCase() === lang.toLowerCase();
            return (
              <button
                key={lang}
                type="button"
                onClick={() => handleLanguageChange(lang)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors font-medium",
                  isActive
                    ? "border-[#1DB954]/50 bg-[#1DB954]/15 text-[#1DB954]"
                    : "border-white/[0.08] bg-white/[0.03] text-white/60 hover:bg-white/[0.06] hover:text-white",
                )}
              >
                {lang}
              </button>
            );
          })}
        </div>
      </div>

      {/* Debounced Search Bar */}
      <div className="relative flex items-center w-full">
        <Search className="absolute left-3.5 h-4 w-4 text-white/40 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search ${selectedLanguage} podcasts, creators, or topics…`}
          className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] pl-10 pr-10 py-2.5 text-sm text-white placeholder-white/40 focus:border-[#1DB954]/60 focus:bg-white/[0.06] focus:outline-none transition-all"
        />
        <div className="absolute right-2.5 flex items-center gap-1.5">
          {loadingShows && debouncedQuery && (
            <Loader2 className="h-4 w-4 text-white/40 animate-spin" />
          )}
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Topic Filter Chips (shown when no search query) */}
      {!debouncedQuery && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {PODCAST_TOPICS.map((topic) => {
            const isActive = selectedTopic === topic;
            return (
              <button
                key={topic}
                type="button"
                onClick={() => setSelectedTopic(topic)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors",
                  isActive
                    ? "border-white/30 bg-white/10 text-white font-medium"
                    : "border-white/[0.06] bg-white/[0.02] text-white/50 hover:bg-white/[0.05] hover:text-white/80",
                )}
              >
                {topic}
              </button>
            );
          })}
        </div>
      )}

      {/* Continue Listening / Recent Podcasts (when not searching) */}
      {!debouncedQuery && podcastHistory.length > 0 && (
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
              <Headphones className="h-3.5 w-3.5 text-[#1DB954]" />
              Continue Listening
            </h2>
            <button
              type="button"
              onClick={onClearPodcastHistory}
              className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
            >
              Clear
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 snap-x">
            {podcastHistory.slice(0, 10).map((ep, idx) => {
              const isCurrent = currentTrackId === ep.id;
              return (
                <button
                  key={ep.id}
                  type="button"
                  onClick={() => {
                    if (isCurrent) {
                      if (isPlaying) onPause?.();
                      else onResume?.();
                    } else {
                      onPlayHistoryTrack(ep, podcastHistory, idx);
                    }
                  }}
                  className="w-36 shrink-0 snap-start text-left group p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] transition-colors"
                >
                  <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-lg bg-[#181818] border border-white/[0.06]">
                    {ep.thumbnail ? (
                      <img
                        src={ep.thumbnail}
                        alt=""
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Mic className="h-6 w-6 text-white/20" />
                      </div>
                    )}
                    {isCurrent && isPlaying && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="flex items-end gap-0.5 h-4">
                          <span className="w-1 bg-[#1DB954] animate-pulse" />
                          <span className="w-1 bg-[#1DB954] animate-pulse delay-75" />
                          <span className="w-1 bg-[#1DB954] animate-pulse delay-150" />
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="truncate text-xs font-medium text-white group-hover:text-[#1DB954] transition-colors">
                    {ep.title}
                  </p>
                  <p className="truncate text-[11px] text-white/40 mt-0.5">{ep.artist}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Shows Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">
            {debouncedQuery
              ? `Results for “${debouncedQuery}” in ${selectedLanguage}`
              : selectedTopic !== "All"
                ? `${selectedTopic} Shows in ${selectedLanguage}`
                : `Top Shows in ${selectedLanguage}`}
          </h2>
          <span className="text-xs text-white/40 font-medium">{shows.length} shows</span>
        </div>

        {loadingShows && shows.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-2"
              >
                <div className="aspect-square w-full rounded-lg bg-white/[0.05]" />
                <div className="h-3 w-3/4 rounded bg-white/[0.05]" />
                <div className="h-2.5 w-1/2 rounded bg-white/[0.03]" />
              </div>
            ))}
          </div>
        ) : showsError ? (
          <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.08] text-center space-y-3">
            <Mic className="h-10 w-10 text-white/20 mx-auto" />
            <p className="text-sm text-white/60">{showsError}</p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void fetchShows(selectedLanguage, debouncedQuery, selectedTopic)}
              className="text-xs"
            >
              Retry
            </Button>
          </div>
        ) : shows.length === 0 ? (
          <div className="p-10 rounded-2xl bg-white/[0.02] border border-white/[0.08] text-center space-y-2">
            <Mic className="h-10 w-10 text-white/20 mx-auto" />
            <h3 className="text-sm font-medium text-white/80">
              No {selectedLanguage} podcasts found
              {debouncedQuery ? ` for “${debouncedQuery}”` : ""}
            </h3>
            <p className="text-xs text-white/40 max-w-sm mx-auto">
              {debouncedQuery
                ? "Try searching with broader terms or choose another language."
                : `No shows currently discovered under ${selectedLanguage} ${selectedTopic !== "All" ? `for ${selectedTopic}` : ""}. Select another language or topic above.`}
            </p>
            {debouncedQuery && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleClearSearch}
                className="text-xs mt-2"
              >
                Clear Search
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {shows.map((show) => (
              <button
                key={show.id}
                type="button"
                onClick={() => void handleSelectShow(show)}
                className="group text-left p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] hover:border-white/[0.12] transition-all flex flex-col"
              >
                <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-lg bg-[#181818] border border-white/[0.06]">
                  {show.artworkUrl ? (
                    <img
                      src={show.artworkUrl}
                      alt={show.title}
                      loading="lazy"
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/20">
                      <Mic className="h-8 w-8" />
                    </div>
                  )}
                  {show.category && (
                    <span className="absolute bottom-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-sm text-white/75 font-medium line-clamp-1 max-w-[85%]">
                      {show.category}
                    </span>
                  )}
                </div>

                <h3 className="text-xs font-semibold text-white leading-tight line-clamp-1 group-hover:text-[#1DB954] transition-colors">
                  {show.title}
                </h3>
                <p className="text-[11px] text-white/50 line-clamp-1 mt-0.5">{show.publisher}</p>
                {show.episodeCount !== undefined && show.episodeCount > 0 && (
                  <span className="text-[10px] text-white/35 mt-1">
                    {show.episodeCount} episodes
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
