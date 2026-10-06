import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Menu,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { type NavTab, NAV_ITEMS } from "@/components/music/layout/Sidebar";
import { MobileNav } from "@/components/music/layout/MobileNav";
import { MobileDrawer } from "@/components/music/layout/MobileDrawer";
import { MiniPlayer } from "@/components/music/layout/MiniPlayer";
import { MobileHeader } from "@/components/music/layout/MobileHeader";
import { MobileHomeSections } from "@/components/music/ui/MobileHomeSections";
import { MobileLibrary } from "@/components/music/ui/MobileLibrary";
import { MobileQueue } from "@/components/music/ui/MobileQueue";
import { LanguagesPanel } from "@/components/music/ui/LanguagesPanel";
import { SearchResults, type SearchFilter } from "@/components/music/ui/SearchResults";
import { VoiceSearchButton } from "@/components/music/ui/VoiceSearchButton";
import { RecentSearchesSection } from "@/components/music/ui/RecentSearchesSection";
import { saveRecentSearch } from "@/lib/search-history";
import { ErrorBoundary } from "@/components/music/ErrorBoundary";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { sleepTimerService } from "@/lib/sleep-timer";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

// Code-split heavy modals and overlays for optimal initial load performance
const FullScreenPlayer = lazy(() =>
  import("@/components/music/ui/FullScreenPlayer").then((m) => ({ default: m.FullScreenPlayer }))
);
const SongOptionsModal = lazy(() =>
  import("@/components/music/ui/SongOptionsModal").then((m) => ({ default: m.SongOptionsModal }))
);
const SleepTimerModal = lazy(() =>
  import("@/components/music/ui/SleepTimerModal").then((m) => ({ default: m.SleepTimerModal }))
);
const ShareModal = lazy(() =>
  import("@/components/music/ui/ShareModal").then((m) => ({ default: m.ShareModal }))
);
const LyricsPanel = lazy(() =>
  import("@/components/music/ui/LyricsPanel").then((m) => ({ default: m.LyricsPanel }))
);
const EqualizerModal = lazy(() =>
  import("@/components/music/ui/EqualizerModal").then((m) => ({ default: m.EqualizerModal }))
);
const KeyboardShortcutsModal = lazy(() =>
  import("@/components/music/ui/KeyboardShortcutsModal").then((m) => ({ default: m.KeyboardShortcutsModal }))
);
const SettingsModal = lazy(() =>
  import("@/components/music/ui/SettingsModal").then((m) => ({ default: m.SettingsModal }))
);
const OnboardingModal = lazy(() =>
  import("@/components/music/ui/OnboardingModal").then((m) => ({ default: m.OnboardingModal }))
);
const FloatingMiniPlayer = lazy(() =>
  import("@/components/music/ui/FloatingMiniPlayer").then((m) => ({ default: m.FloatingMiniPlayer }))
);
import { MixesPanel, type MixId } from "@/components/music/MixesPanel";
import { PlaylistsPanel } from "@/components/music/PlaylistsPanel";
import { PodcastsPanel } from "@/components/music/ui/PodcastsPanel";
import { AddToPlaylistModal } from "@/components/music/ui/AddToPlaylistModal";
import { ExploreSections } from "@/components/music/ui/ExploreSections";
import { episodeToTrack, type PodcastEpisode } from "@/lib/podcast.types";
import { TrackList } from "@/components/music/TrackList";
import { Button } from "@/components/ui/button";
import { AuthModal } from "@/components/common/AuthModal";

import { useAuth } from "@/lib/auth";
import {
  useLibrary,
  trackLabel,
  settingsToBrief,
  readPlayback,
  writePlayback,
  replayMix,
  topArtists,
  skippedLabels,
  sequenceBrief,
  isMusicTrack,
  isPodcastTrack,
  isOldEraTrack,
  isLanguageConsistent,
  parseDurationSeconds,
  MOODS,
  LANGUAGES,
  type Track,
} from "@/lib/library";
import {
  buildMix,
  getRealTrendingTracks,
  getOldSongsTracks,
  getSongRadio,
  prewarmStreams,
  recommendTracks,
  searchTracks,
  getDailyMix,
} from "@/lib/music.functions";
import { useAudioPlayer } from "@/lib/use-audio-player";
import { useMediaSession } from "@/lib/use-media-session";
import { listDownloads, removeDownload, saveDownload, type DownloadInfo } from "@/lib/offline";
import { cn } from "@/lib/utils";
import { trackExistsIn, dedupeTracks, type TrackLike } from "@/lib/track-dedup";
import { resolveRestorablePlayback } from "@/lib/playback-restore";
import {
  installMediaCommandHandler,
  isNativePlaybackEnv,
  notifyPlaybackPosition,
  notifyPlaybackState,
  requestBatteryOptimizationExemption,
} from "@/lib/native-playback";
import {
  filterFeedCandidates,
  hasPlayableDuration,
  sameSong,
} from "@/lib/feed-freshness";
import {
  contextEngine,
  applyDiscoveryDistribution,
  thompsonSamplingPolicy,
  type SessionContext,
} from "@/lib/context-engine";
import { telemetry, TrackProgressTracker } from "@/lib/telemetry";
import { runStartupMigrations } from "@/lib/startup-migration";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MelodyMap — Your Music. Your Mood. Your Map." },
      {
        name: "description",
        content: "Stream any song for free with AI-powered recommendations that learn your taste.",
      },
    ],
  }),
  component: MusicApp,
});

interface HomeCacheData {
  recs: Track[];
  trendingList: Track[];
  oldSongsList?: Track[] | undefined;
  dailyMixTracks: Track[];
  mixTracks: Record<"discover" | "newrelease" | "explore", Track[]>;
  timestamp: number;
}

const HOME_CACHE_KEY = "melodymap.home_cache.v2";

function readHomeCache(): Partial<HomeCacheData> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(HOME_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeHomeCache(patch: Partial<HomeCacheData>) {
  if (typeof window === "undefined") return;
  try {
    const current = readHomeCache();
    const updated = { ...current, ...patch, timestamp: Date.now() };
    localStorage.setItem(HOME_CACHE_KEY, JSON.stringify(updated));
  } catch {
    // quota exceeded — ignore
  }
}

function safeUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function MusicApp() {
  const navigate = useNavigate();
  const runSearch = useServerFn(searchTracks);
  const runRecommend = useServerFn(recommendTracks);
  const runTrending = useServerFn(getRealTrendingTracks);
  const runOldSongs = useServerFn(getOldSongsTracks);
  const runMix = useServerFn(buildMix);
  const runPrewarm = useServerFn(prewarmStreams);
  const runDailyMix = useServerFn(getDailyMix);


  const auth = useAuth();

  // Require login first: redirect to /auth if not signed in and not explicitly in guest mode
  useEffect(() => {
    if (!auth.ready) return;
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      const search = window.location.search;
      if (hash.includes("access_token") || search.includes("code=")) {
        // OAuth tokens present in URL, let auth listener process them
        return;
      }
      const isGuest = localStorage.getItem("melodymap.guest_mode") === "true";
      if (!auth.userId && !isGuest) {
        void navigate({ to: "/auth", replace: true });
      }
    }
  }, [auth.ready, auth.userId, navigate]);
  const {
    hydrated,
    likes,
    dislikes,
    history,
    podcastHistory,
    playlists,
    settings,
    stats,
    logSkip,
    logComplete,
    toggleLike,
    toggleDislike,
    logPlay,
    clearHistory,
    clearPodcastHistory,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    addToPlaylist,
    removeFromPlaylist,
    removeManyFromPlaylist,
    moveTracksToPlaylist,
    reorderPlaylist,
    updateSettings,
    resetSettings,
  } = useLibrary(auth.userId);

  // Initial feed & settings states — always empty/default on SSR to prevent hydration mismatches
  const [tab, setTab] = useState<NavTab>("foryou");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchContinuation, setSearchContinuation] = useState<string | undefined>(undefined);
  const searchPageRef = useRef<number>(1);
  const activeSearchIdRef = useRef<number>(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loadingMoreSearch, setLoadingMoreSearch] = useState(false);
  const [searchFilter, setSearchFilter] = useState<SearchFilter>("all");
  const [recs, setRecs] = useState<Track[]>([]);
  const [trendingList, setTrendingList] = useState<Track[]>([]);
  const [oldSongsList, setOldSongsList] = useState<Track[]>([]);
  const [historyQuery, setHistoryQuery] = useState("");
  const [recLoading, setRecLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [volume, setVolume] = useState(80);
  const [showSettings, setShowSettings] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [continuous, setContinuous] = useState(true);
  const [extending, setExtending] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [mix, setMix] = useState<MixId>("discover");
  const [mixTracks, setMixTracks] = useState<
    Record<"discover" | "newrelease" | "explore", Track[]>
  >({ discover: [], newrelease: [], explore: [] });
  const [mixLoading, setMixLoading] = useState(false);
  const [dailyMixTracks, setDailyMixTracks] = useState<Track[]>([]);

  const [loadingMoreRecs, setLoadingMoreRecs] = useState(false);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showEqualizer, setShowEqualizer] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showFloatingMini, setShowFloatingMini] = useState(false);
  const [optionsTrack, setOptionsTrack] = useState<Track | null>(null);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [shareTrack, setShareTrack] = useState<Track | null>(null);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(80);
  // Playlist creation dialog state
  const [createPlaylistTrack, setCreatePlaylistTrack] = useState<Track | null>(null);
  // Undo support for playlist track removal
  const undoRef = useRef<{ timeout: ReturnType<typeof setTimeout>; restore: () => void } | null>(null);
  const [undoLabel, setUndoLabel] = useState<string | null>(null);
  const radioContinuationRef = useRef<string | undefined>(undefined);

  // Refresh downloads on mount & hydrate context engine
  useEffect(() => {
    contextEngine.loadFromStorage();
    void listDownloads().then((items: DownloadInfo[]) => {
      setDownloadedIds(new Set(items.map((t: DownloadInfo) => t.track.id)));
    });
  }, []);

  // Show language & artist onboarding for new users / accounts without song language preferences
  useEffect(() => {
    if (!hydrated) return;
    const onboarded = typeof window !== "undefined" ? localStorage.getItem("melodymap.onboarded.v1") : null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!onboarded && settings.languages.length === 0) {
      timer = setTimeout(() => {
        setShowOnboarding(true);
      }, 600);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [hydrated, settings.languages.length]);

function getPodcastResumePosition(trackId: string): number {
  if (typeof window === "undefined" || !trackId) return 0;
  try {
    const raw = localStorage.getItem("melodymap.podcast_positions.v1");
    if (!raw) return 0;
    const map = JSON.parse(raw);
    return typeof map[trackId] === "number" ? map[trackId] : 0;
  } catch {
    return 0;
  }
}

function savePodcastResumePosition(trackId: string, pos: number) {
  if (typeof window === "undefined" || !trackId || pos < 5) return;
  try {
    const raw = localStorage.getItem("melodymap.podcast_positions.v1");
    const map = raw ? JSON.parse(raw) : {};
    map[trackId] = Math.floor(pos);
    localStorage.setItem("melodymap.podcast_positions.v1", JSON.stringify(map));
  } catch {}
}

  const handleDownload = async (track: Track) => {
    const dur = parseDurationSeconds(track.duration);

    // 1. Refuse tracks > 2 hours
    if (dur > 7200) {
      setMessage("Files over 2 hours cannot be downloaded for offline use");
      setTimeout(() => setMessage(null), 3500);
      return;
    }

    // 2. For episodes between 20 min and 2 hours, stream directly to disk if supported
    if (dur > 1200) {
      if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
        try {
          setDownloadingIds((prev) => new Set([...prev, track.id]));
          setMessage(`Saving "${track.title}" to disk...`);
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: `${track.title.replace(/[/\\?%*:|"<>]/g, "_")}.m4a`,
            types: [
              {
                description: "Audio File",
                accept: { "audio/mp4": [".m4a", ".mp4", ".aac"] },
              },
            ],
          });
          const writable = await handle.createWritable();
          const res = await fetch(`/api/stream/${encodeURIComponent(track.id)}`);
          if (!res.ok || !res.body) throw new Error("Download stream failed");
          await res.body.pipeTo(writable);
          setMessage(`Saved "${track.title}" to disk`);
        } catch (err: any) {
          if (err?.name !== "AbortError") {
            setMessage("Failed to save audio file to disk");
          }
        } finally {
          setDownloadingIds((prev) => {
            const next = new Set(prev);
            next.delete(track.id);
            return next;
          });
          setTimeout(() => setMessage(null), 3500);
        }
        return;
      } else {
        setMessage("Episodes over 20 minutes cannot be saved to browser storage");
        setTimeout(() => setMessage(null), 3500);
        return;
      }
    }

    // Standard download (< 20 min) -> saved to IndexedDB
    setDownloadingIds((prev) => new Set([...prev, track.id]));
    try {
      const res = await fetch(`/api/stream/${encodeURIComponent(track.id)}`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();

      let imgBlob: Blob | undefined;
      if (track.thumbnail && track.thumbnail.startsWith("http")) {
        try {
          const imgRes = await fetch(track.thumbnail);
          if (imgRes.ok) imgBlob = await imgRes.blob();
        } catch {}
      }

      await saveDownload(track, blob, imgBlob);
      setDownloadedIds((prev) => new Set([...prev, track.id]));
      setMessage(`Downloaded "${track.title}" for offline listening`);
    } catch {
      setMessage("Failed to download song");
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleRemoveDownload = async (track: Track) => {
    await removeDownload(track.id);
    setDownloadedIds((prev) => {
      const next = new Set(prev);
      next.delete(track.id);
      return next;
    });
    setMessage(`Removed offline copy of "${track.title}"`);
    setTimeout(() => setMessage(null), 3000);
  };

  // --- Derived ---
  const replayTracks = useMemo(() => replayMix(stats), [stats]);
  const visibleMix = useMemo(
    () => (mix === "replay" ? replayTracks : mixTracks[mix] ?? []),
    [mix, replayTracks, mixTracks],
  );
  const current = queue[index];
  const currentRef = useRef<Track | undefined>(undefined);
  currentRef.current = current;
  const previousTrackRef = useRef<Track | null>(null);
  const queueRef = useRef<Track[]>([]);
  queueRef.current = queue;
  const recsRef = useRef<Track[]>([]);
  recsRef.current = recs;
  const trendingRef = useRef<Track[]>([]);
  trendingRef.current = trendingList;
  const oldSongsRef = useRef<Track[]>([]);
  oldSongsRef.current = oldSongsList;
  const mixTracksRef = useRef<Record<"discover" | "newrelease" | "explore", Track[]>>(mixTracks);
  mixTracksRef.current = mixTracks;
  const dailyMixTracksRef = useRef<Track[]>(dailyMixTracks);
  dailyMixTracksRef.current = dailyMixTracks;
  const likedIds = useMemo(() => new Set(likes.map((t) => t.id)), [likes]);
  const dislikedIds = useMemo(() => new Set(dislikes.map((t) => t.id)), [dislikes]);
  // Session-scoped feed freshness (never persisted across browser reloads):
  // tracks shown in feeds this session, plus recently-played and liked tracks.
  // Guarantees songs already displayed earlier in the SAME session never appear again on refresh.
  const previouslyDisplayedIdsRef = useRef<Set<string>>(new Set());
  // Real logical Track objects for fuzzy same-song matching across different upload IDs
  const displayedTracksRef = useRef<Track[]>([]);

  /** Mark tracks as displayed for this session so subsequent refreshes never repeat them. */
  const markFeedDisplayed = useCallback((tracks: readonly Track[]) => {
    if (!tracks || tracks.length === 0) return;
    const displayed = displayedTracksRef.current;
    const ids = previouslyDisplayedIdsRef.current;
    for (const t of tracks) {
      if (!t?.id) continue;
      ids.add(t.id);
      if (!displayed.some((d) => sameSong(d, t as TrackLike))) {
        displayed.push(t);
      }
    }
    // High session bound to prevent memory leaks while guaranteeing session-long freshness
    if (displayed.length > 1000) {
      displayedTracksRef.current = displayed.slice(-1000);
    }
  }, []);

  const applyFeedFilters = useCallback(
    (pool: Track[]) => {
      const recentIds = new Set<string>();
      for (const h of history) {
        if (h?.id) recentIds.add(h.id);
      }
      const filtered = filterFeedCandidates(pool, {
        previouslyDisplayedIds: previouslyDisplayedIdsRef.current,
        likedIds,
        recentlyPlayedIds: recentIds,
        currentTrackId: currentRef.current?.id ?? null,
        previouslyDisplayed: displayedTracksRef.current,
        liked: likes,
        recentlyPlayed: history,
        current: currentRef.current ?? null,
      });
      if (settings.languages && settings.languages.length > 0) {
        return filtered.filter((t) => isLanguageConsistent(t, settings.languages));
      }
      return filtered;
    },
    [likedIds, likes, history, settings.languages],
  );

  // Record initially visible tracks into session displayed-tracks tracking on mount
  const initialRecordedRef = useRef(false);
  useEffect(() => {
    if (initialRecordedRef.current) return;
    initialRecordedRef.current = true;
    const initial = [
      ...recsRef.current,
      ...trendingRef.current,
      ...dailyMixTracksRef.current,
      ...Object.values(mixTracksRef.current).flat(),
    ];
    if (initial.length > 0) {
      markFeedDisplayed(initial);
    }
  }, [markFeedDisplayed]);

  const dislikedIdsRef = useRef(dislikedIds);
  dislikedIdsRef.current = dislikedIds;
  const canPrev = queue.length > 0;
  const canNext = queue.length > 0 || recs.length > 0 || trendingList.length > 0 || oldSongsList.length > 0;
  const indexRef = useRef(index);
  indexRef.current = index;
  const continuousRef = useRef(continuous);
  continuousRef.current = continuous;

  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const repeatModeRef = useRef(repeatMode);
  repeatModeRef.current = repeatMode;
  const unshuffledQueueRef = useRef<Track[]>([]);

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => {
      const nextShuffle = !prev;
      const currentTrack = currentRef.current;
      if (nextShuffle) {
        unshuffledQueueRef.current = [...queueRef.current];
        if (queueRef.current.length > 1) {
          const otherTracks = queueRef.current.filter((t) => t.id !== currentTrack?.id);
          const shuffledOthers = [...otherTracks].sort(() => Math.random() - 0.5);
          const newQueue = currentTrack ? [currentTrack, ...shuffledOthers] : shuffledOthers;
          setQueue(newQueue);
          setIndex(0);
        }
      } else {
        if (unshuffledQueueRef.current.length > 0) {
          const restored = unshuffledQueueRef.current;
          setQueue(restored);
          const restoredIdx = currentTrack ? restored.findIndex((t) => t.id === currentTrack.id) : 0;
          setIndex(restoredIdx !== -1 ? restoredIdx : 0);
        }
      }
      return nextShuffle;
    });
  }, []);

  const toggleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      if (prev === "off") return "all";
      if (prev === "all") return "one";
      return "off";
    });
  }, []);

  /** Find the next playable track index in queue, skipping any disliked tracks */
  const findNextValidTrackIndex = useCallback(
    (q: Track[], currentIndex: number, continuousMode: boolean): number => {
      if (q.length === 0) return -1;
      // 1. Search forward from currentIndex + 1
      for (let idx = currentIndex + 1; idx < q.length; idx++) {
        const candidate = q[idx];
        if (candidate && !dislikedIdsRef.current.has(candidate.id)) {
          return idx;
        }
      }
      // 2. Loop around from beginning if continuous mode or repeat all is active
      if (continuousMode) {
        for (let idx = 0; idx <= currentIndex && idx < q.length; idx++) {
          const candidate = q[idx];
          if (candidate && !dislikedIdsRef.current.has(candidate.id)) {
            return idx;
          }
        }
      }
      return -1;
    },
    [],
  );

  const consecutiveErrorsRef = useRef<number>(0);
  const lastErrorTimeRef = useRef<number>(0);
  const triedAlternativesRef = useRef<Map<string, number>>(new Map());

  const progressTrackerRef = useRef(new TrackProgressTracker());
  const sessionCompletionsRef = useRef<number>(0);
  const sessionSkipsRef = useRef<number>(0);

  const getSessionContext = useCallback((): SessionContext => {
    return {
      currentTrack: currentRef.current,
      hourOfDay: new Date().getHours(),
      discoveryPercent: settings.discovery ?? 40,
      recentHistory: history.slice(0, 15),
      stats,
      sessionCompletions: sessionCompletionsRef.current,
      sessionSkips: sessionSkipsRef.current,
      familiarArtists: new Set(likes.map((t) => (t.artist || "").toLowerCase().trim()).filter(Boolean)),
    };
  }, [settings.discovery, history, stats, likes]);

  const sleepTimerHaltedRef = useRef<boolean>(false);
  const extendQueueRef = useRef<(() => Promise<Track[]>) | null>(null);

  // --- Player ---
  const player = useAudioPlayer({
    onSponsorBlockSkipped: (category) => {
      const label = category === "sponsor" ? "Sponsor pitch" : category === "intro" ? "Intro" : category === "outro" ? "Outro" : category;
      setMessage(`SponsorBlock: Skipped ${label}`);
      setTimeout(() => setMessage(null), 3000);
    },
    getNextTrack: () => {
      if (sleepTimerService.isExpired() || sleepTimerHaltedRef.current) {
        return undefined;
      }

      if (repeatModeRef.current === "one") {
        const cur = currentRef.current;
        if (cur) return { id: cur.id, previewUrl: cur.previewUrl };
      }
      const q = queueRef.current;
      const i = indexRef.current;
      const loopMode = repeatModeRef.current === "all" || continuousRef.current;
      const nextIdx = findNextValidTrackIndex(q, i, loopMode);
      if (nextIdx !== -1) {
        const next = q[nextIdx];
        if (next) {
          return { id: next.id, previewUrl: next.previewUrl };
        }
      }
      return undefined;
    },
    onEnded: (autoAdvanced = false) => {
      if (sleepTimerService.isExpired() || sleepTimerHaltedRef.current) {
        player.pause();
        return;
      }

      const track = currentRef.current;
      if (track) {
        logComplete(track);
        if (!isPodcastTrack(track)) {
          contextEngine.recordCompletion(track, previousTrackRef.current);
          previousTrackRef.current = track;
          sessionCompletionsRef.current += 1;
          const ctx = getSessionContext();
          const event = telemetry.logEvent({
            trackId: track.id,
            artist: track.artist,
            title: track.title,
            eventType: "COMPLETED",
            positionSeconds: player.duration || player.position,
            durationSeconds: player.duration || player.position,
            fractionPlayed: 1.0,
            timestamp: Date.now(),
            context: { hourOfDay: ctx.hourOfDay, discoverySetting: ctx.discoveryPercent },
          });
          thompsonSamplingPolicy.recordFeedback(event, ctx);
        }
      }

      // Repeat One Mode: replay current song
      if (repeatModeRef.current === "one" && track) {
        if (!isPodcastTrack(track)) {
          const ctx = getSessionContext();
          const replayEv = telemetry.logEvent({
            trackId: track.id,
            artist: track.artist,
            title: track.title,
            eventType: "REPLAYED",
            positionSeconds: 0,
            durationSeconds: player.duration,
            fractionPlayed: 0,
            timestamp: Date.now(),
            context: { hourOfDay: ctx.hourOfDay, discoverySetting: ctx.discoveryPercent },
          });
          thompsonSamplingPolicy.recordFeedback(replayEv, ctx);
        }
        if (!autoAdvanced) {
          player.seek(0);
          player.play();
        }
        return;
      }

      const q = queueRef.current;
      const i = indexRef.current;
      const loopMode = repeatModeRef.current === "all" || continuousRef.current;
      const nextIdx = findNextValidTrackIndex(q, i, loopMode);

      if (nextIdx !== -1) {
        indexRef.current = nextIdx;
        setIndex(nextIdx);
        const nextTrack = q[nextIdx];
        if (nextTrack) {
          progressTrackerRef.current.reset(nextTrack.id);
          loadedTrackIdRef.current = nextTrack.id;
          if (!autoAdvanced) {
            player.seek(0);
            void load(nextTrack.id, nextTrack.previewUrl, 0);
          }
        }
        // Proactively extend upcoming songs before reaching the end
        if (continuousRef.current && nextIdx + 3 >= q.length) {
          void extendQueue();
        }
        return;
      }

      if (continuousRef.current) {
        void extendQueue().then((added) => {
          if (added && added.length > 0) {
            const firstTrack = added[0];
            if (firstTrack) {
              setQueue((prev) => {
                const targetIdx = prev.findIndex((t) => t.id === firstTrack.id);
                if (targetIdx !== -1) {
                  indexRef.current = targetIdx;
                  setIndex(targetIdx);
                  progressTrackerRef.current.reset(firstTrack.id);
                  loadedTrackIdRef.current = firstTrack.id;
                  void load(firstTrack.id, firstTrack.previewUrl, 0);
                }
                return prev;
              });
              return;
            }
          }
          const updated = queueRef.current;
          const loopIdx = findNextValidTrackIndex(updated, -1, false);
          if (loopIdx !== -1) {
            indexRef.current = loopIdx;
            setIndex(loopIdx);
            const loopTrack = updated[loopIdx];
            if (loopTrack) {
              player.seek(0);
              progressTrackerRef.current.reset(loopTrack.id);
              loadedTrackIdRef.current = loopTrack.id;
              void load(loopTrack.id, loopTrack.previewUrl, 0);
            }
          } else {
            player.pause();
          }
        });
        return;
      }

      player.pause();
    },
    onError: (msg) => {
      if (sleepTimerService.isExpired() || sleepTimerHaltedRef.current) {
        player.pause();
        return;
      }

      console.warn("[Player] Stream notice:", msg);
      const track = currentRef.current;

      // Multi-Provider Fallback:
      // If the current provider audio source fails, try an available alternative source
      // for the SAME logical song before skipping to a different track.
      if (track && track.availableAlternatives && track.availableAlternatives.length > 0) {
        const triedCount = triedAlternativesRef.current.get(track.id) || 0;
        if (triedCount < track.availableAlternatives.length) {
          const altSource = track.availableAlternatives[triedCount];
          triedAlternativesRef.current.set(track.id, triedCount + 1);
          if (altSource && altSource.url) {
            setMessage(`Switching source (${altSource.provider})...`);
            setTimeout(() => setMessage(null), 2500);
            void load(track.id, altSource.url, player.position || 0);
            return;
          }
        }
      }

      const now = Date.now();
      if (now - lastErrorTimeRef.current < 60_000) {
        consecutiveErrorsRef.current += 1;
      } else {
        consecutiveErrorsRef.current = 1;
      }
      lastErrorTimeRef.current = now;

      // Protection for screen-off error loops: stop if 4 consecutive tracks fail
      if (consecutiveErrorsRef.current >= 4) {
        player.pause();
        setMessage("Playback stopped — several tracks failed to load");
        setTimeout(() => setMessage(null), 5000);
        return;
      }

      setMessage(msg || "Audio stream unavailable, skipping to next track...");
      setTimeout(() => setMessage(null), 3500);
      setTimeout(() => {
        goNext();
      }, 1500);
    },
  });

  const { load, cue, setVolume: applyVolume, play, pause } = player;

  // Granular playback telemetry milestones (PLAY_START, PLAY_10S, PLAY_25S, PLAY_50_PERCENT, PLAY_85_PERCENT)
  useEffect(() => {
    const track = current;
    if (!track || !player.isPlaying) return;

    const milestones = progressTrackerRef.current.checkProgress(track, player.position, player.duration);
    if (milestones.length > 0 && !isPodcastTrack(track)) {
      const ctx = getSessionContext();
      for (const milestone of milestones) {
        const frac = player.duration > 0 ? player.position / player.duration : 0;
        const event = telemetry.logEvent({
          trackId: track.id,
          artist: track.artist,
          title: track.title,
          eventType: milestone,
          positionSeconds: player.position,
          durationSeconds: player.duration,
          fractionPlayed: frac,
          timestamp: Date.now(),
          context: {
            hourOfDay: ctx.hourOfDay,
            discoverySetting: ctx.discoveryPercent,
          },
        });
        thompsonSamplingPolicy.recordFeedback(event, ctx);
      }
    }
  }, [current, player.isPlaying, player.position, player.duration, getSessionContext]);

  // Listen to sleep timer expiry to stop playback and display toast message
  useEffect(() => {
    const unsub = sleepTimerService.onExpire(() => {
      sleepTimerHaltedRef.current = true;
      player.pause();
      setMessage("Sleep timer ended — playback stopped.");
      setTimeout(() => setMessage(null), 5000);
    });
    return unsub;
  }, [player]);

  const togglePlay = useCallback(() => {
    if (!current) return;
    if (player.isPlaying) {
      pause();
    } else {
      sleepTimerHaltedRef.current = false;
      sleepTimerService.resetExpired();
      play();
    }
  }, [current, player.isPlaying, pause, play]);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      setVolume(prevVolume);
      applyVolume(prevVolume);
      setIsMuted(false);
    } else {
      setPrevVolume(volume);
      setVolume(0);
      applyVolume(0);
      setIsMuted(true);
    }
  }, [isMuted, volume, prevVolume, applyVolume]);

  const loadedTrackIdRef = useRef<string | null>(null);

  /**
   * Explicit Single-Track Playback:
   * Sets the given track as the strictly active current song, updates the queue of
   * individual tracks, resets seek/progress to 0, resets telemetry progress tracking,
   * and loads & plays only that track.
   */
  const playSong = useCallback(
    (track: Track, surroundingQueue?: Track[]) => {
      if (!track?.id) return;
      sleepTimerHaltedRef.current = false;
      sleepTimerService.resetExpired();
      // Hard rule: music tracks need a known duration <= 600s to enter playback.
      if (!isPodcastTrack(track) && !hasPlayableDuration(track)) {
        setMessage("Track duration exceeds 10 minutes or is unplayable");
        setTimeout(() => setMessage(null), 3000);
        return;
      }

      // 1. Reset progress and seek position for clean single-track start
      player.seek(0);
      progressTrackerRef.current.reset(track.id);

      // 2. Set up queue of independent tracks
      if (surroundingQueue && surroundingQueue.length > 0) {
        const dq = dedupeTracks(surroundingQueue);
        const targetIdx = dq.findIndex((t) => t.id === track.id);
        if (targetIdx !== -1) {
          setQueue(dq);
          setIndex(targetIdx);
          indexRef.current = targetIdx;
        } else {
          const newQueue = [track, ...dq.filter((t) => t.id !== track.id)];
          setQueue(newQueue);
          setIndex(0);
          indexRef.current = 0;
        }
      } else {
        const curQ = queueRef.current;
        const existingIdx = curQ.findIndex((t) => t.id === track.id);
        if (existingIdx !== -1) {
          setIndex(existingIdx);
          indexRef.current = existingIdx;
        } else {
          setQueue([track, ...curQ.filter((t) => t.id !== track.id)]);
          setIndex(0);
          indexRef.current = 0;
        }
      }

      // 3. Mark active track and synchronously load & play ONLY this track
      loadedTrackIdRef.current = track.id;
      void load(track.id, track.previewUrl, 0);

      // 4. Auto-populate upcoming queue with similar songs for continuous screen-off playback
      if (continuousRef.current) {
        setTimeout(() => {
          if (queueRef.current.length <= 2) {
            void extendQueueRef.current?.();
          }
        }, 400);
      }
    },
    [load, player],
  );

  const startQueue = useCallback(
    (tracks: Track[], startIndex = 0) => {
      if (tracks.length === 0) return;
      const target = tracks[startIndex] || tracks[0];
      if (target) {
        playSong(target, tracks);
      }
    },
    [playSong],
  );

  const handleReorderQueue = useCallback((from: number, to: number) => {
    if (from === to) return;
    setQueue((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      if (!moved) return prev;
      next.splice(to, 0, moved);
      return next;
    });
    setIndex((prevIndex) => {
      if (prevIndex === from) return to;
      if (from < prevIndex && to >= prevIndex) return prevIndex - 1;
      if (from > prevIndex && to <= prevIndex) return prevIndex + 1;
      return prevIndex;
    });
  }, []);

  const enqueue = useCallback((tracks: Track[]) => {
    setQueue((prev) => {
      const batch = dedupeTracks(tracks);
      const newTracks = batch.filter((t) => !trackExistsIn(prev, t as TrackLike));
      if (newTracks.length === 0 && tracks.length > 0) {
        setMessage("Already in queue");
        setTimeout(() => setMessage(null), 2000);
        return prev;
      }
      if (newTracks.length < tracks.length) {
        setMessage(`Added ${newTracks.length} track${newTracks.length === 1 ? "" : "s"} to queue`);
        setTimeout(() => setMessage(null), 2000);
      }
      return [...prev, ...newTracks];
    });
  }, []);

  const loadMix = useCallback(
    async (kind: "discover" | "newrelease" | "explore") => {
      setMixLoading(true);
      try {
        const res = await runMix({
          data: {
            kind,
            liked: likes.slice(0, 15).map(trackLabel),
            recent: history.slice(0, 15).map(trackLabel),
            sequence: sequenceBrief(history, stats),
            skipped: skippedLabels(stats),
            artists: topArtists(stats, likes),
            languages: settings.languages,
            brief: settingsToBrief(settings),
            count: 14,
          },
        });
        if (res.tracks) {
          const pureMusic = res.tracks as Track[];
          // Freshness: exclude displayed/liked/recent/overlong tracks; fetch MORE rather than reuse.
          let fresh = applyFeedFilters(pureMusic);
          if (fresh.length < 6) {
            const res2 = await runMix({
              data: {
                kind,
                liked: likes.slice(0, 15).map(trackLabel),
                recent: history.slice(0, 15).map(trackLabel),
                sequence: sequenceBrief(history, stats),
                skipped: skippedLabels(stats),
                artists: topArtists(stats, likes),
                languages: settings.languages,
                brief: settingsToBrief(settings),
                count: 14,
                refreshNonce: `${Date.now()}-2`,
              },
            });
            if (res2.tracks) {
              for (const t of res2.tracks as Track[]) {
                if (!pureMusic.some((existing) => sameSong(existing, t))) {
                  pureMusic.push(t);
                }
              }
              fresh = applyFeedFilters(pureMusic);
            }
          }
          const ranked = thompsonSamplingPolicy.rankCandidates(fresh, getSessionContext());
          setMixTracks((prev) => ({ ...prev, [kind]: ranked }));
          markFeedDisplayed(ranked);
        }
      } finally {
        setMixLoading(false);
      }
    },
    [runMix, likes, history, stats, settings, getSessionContext, applyFeedFilters, markFeedDisplayed],
  );

  const loadDailyMix = useCallback(
    async (refreshNonce?: number | string) => {
      const nonce = refreshNonce ?? Date.now();
      try {
        const res = await runDailyMix({
          data: {
            languages: settings.languages,
            artists: topArtists(stats, likes),
            liked: likes.slice(0, 15).map(trackLabel),
            count: 24,
            refreshNonce: nonce,
          },
        });
        if (res.tracks) {
          const pureMusic = res.tracks as Track[];
          // Freshness: fetch MORE candidates instead of re-serving displayed songs.
          let fresh = applyFeedFilters(pureMusic);
          if (fresh.length < 8) {
            const res2 = await runDailyMix({
              data: {
                languages: settings.languages,
                artists: topArtists(stats, likes),
                liked: likes.slice(0, 15).map(trackLabel),
                count: 24,
                refreshNonce: `${nonce}-2`,
              },
            });
            if (res2.tracks) {
              for (const t of res2.tracks as Track[]) {
                if (!pureMusic.some((existing) => sameSong(existing, t))) {
                  pureMusic.push(t);
                }
              }
              fresh = applyFeedFilters(pureMusic);
            }
          }
          const ranked = thompsonSamplingPolicy.rankCandidates(fresh, getSessionContext());
          setDailyMixTracks(ranked);
          markFeedDisplayed(ranked);
          writeHomeCache({ dailyMixTracks: ranked });
        }
      } catch {}
    },
    [runDailyMix, settings.languages, stats, likes, getSessionContext, applyFeedFilters, markFeedDisplayed],
  );

  const loadRecommendations = useCallback(
    async (mood?: string) => {
      setRecLoading(true);
      const nonce = `${Date.now()}-${safeUUID()}`;
      const clientHour = new Date().getHours();
      const affinity = contextEngine.getAffinityWeights(stats);

      try {
        await Promise.allSettled([
          (async () => {
            const pureMusic: Track[] = [];
            let fresh: Track[] = [];
            const maxDepth = 4;
            for (let depth = 1; depth <= maxDepth; depth++) {
              const res = await runRecommend({
                data: {
                  liked: likes.slice(0, 15).map(trackLabel),
                  recent: history.slice(0, 15).map(trackLabel),
                  disliked: dislikes.slice(0, 15).map(trackLabel),
                  sequence: sequenceBrief(history, stats),
                  skipped: skippedLabels(stats),
                  count: 24,
                  ...(mood ? { mood } : {}),
                  languages: settings.languages,
                  brief: settingsToBrief(settings),
                  artists: topArtists(stats, likes),
                  refreshNonce: depth === 1 ? nonce : `${nonce}-depth-${depth}`,
                  discovery: settings.discovery ?? 40,
                  affinityArtists: affinity.affinityArtists,
                  penalizedArtists: affinity.penalizedArtists,
                  clientHour,
                },
              });
              if (res.tracks) {
                for (const t of res.tracks as Track[]) {
                  if (!pureMusic.some((existing) => sameSong(existing, t))) {
                    pureMusic.push(t);
                  }
                }
                fresh = applyFeedFilters(pureMusic);
                if (fresh.length >= 12) break;
              }
            }

            // Fallback to trending catalog if deep search is still sparse
            if (fresh.length < 8) {
              const fallbackRes = await runTrending({
                data: {
                  languages: settings.languages,
                  count: 24,
                  refreshNonce: `${nonce}-fallback`,
                  clientHour,
                },
              });
              if (fallbackRes.tracks) {
                for (const t of fallbackRes.tracks as Track[]) {
                  if (!pureMusic.some((existing) => sameSong(existing, t))) {
                    pureMusic.push(t);
                  }
                }
                fresh = applyFeedFilters(pureMusic);
              }
            }

            const ranked = thompsonSamplingPolicy.rankCandidates(fresh, getSessionContext());
            const distributed = applyDiscoveryDistribution(ranked, affinity.affinityArtists, settings.discovery ?? 40);
            setRecs(distributed);
            markFeedDisplayed(distributed);
            writeHomeCache({ recs: distributed });
          })(),
          (async () => {
            const res = await runTrending({
              data: {
                languages: settings.languages,
                count: 24,
                refreshNonce: nonce,
                clientHour,
              },
            });
            if (res.tracks) {
              const pureMusic = res.tracks as Track[];
              const fresh = applyFeedFilters(pureMusic);
              const ranked = thompsonSamplingPolicy.rankCandidates(fresh, getSessionContext());
              setTrendingList(ranked);
              markFeedDisplayed(ranked);
              writeHomeCache({ trendingList: ranked });
            }
          })(),
          (async () => {
            const res = await runMix({
              data: {
                kind: "newrelease",
                liked: likes.slice(0, 15).map(trackLabel),
                recent: history.slice(0, 15).map(trackLabel),
                sequence: sequenceBrief(history, stats),
                skipped: skippedLabels(stats),
                artists: topArtists(stats, likes),
                languages: settings.languages,
                brief: settingsToBrief(settings),
                count: 18,
                refreshNonce: nonce,
              },
            });
            if (res.tracks) {
              const pureMusic = res.tracks as Track[];
              const fresh = applyFeedFilters(pureMusic);
              const ranked = thompsonSamplingPolicy.rankCandidates(fresh, getSessionContext());
              setMixTracks((prev) => {
                const next = { ...prev, newrelease: ranked };
                writeHomeCache({ mixTracks: next });
                return next;
              });
              markFeedDisplayed(ranked);
            }
          })(),
          (async () => {
            const res = await runOldSongs({
              data: {
                languages: settings.languages,
                count: 24,
                refreshNonce: nonce,
                artists: topArtists(stats, likes),
              },
            });
            if (res.tracks) {
              const pureMusic = (res.tracks as Track[]).filter(isOldEraTrack);
              const fresh = applyFeedFilters(pureMusic);
              const ranked = thompsonSamplingPolicy.rankCandidates(fresh, getSessionContext());
              setOldSongsList(ranked);
              markFeedDisplayed(ranked);
              writeHomeCache({ oldSongsList: ranked });
            }
          })(),
          (async () => {
            await loadDailyMix(nonce);
          })(),
        ]);
      } finally {
        setRecLoading(false);
      }
    },
    [runRecommend, runTrending, runOldSongs, runMix, loadDailyMix, likes, history, dislikes, stats, settings, getSessionContext, applyFeedFilters, markFeedDisplayed],
  );

  const loadMoreRecommendations = useCallback(
    async (mood?: string) => {
      if (loadingMoreRecs) return;
      setLoadingMoreRecs(true);
      try {
        const clientHour = new Date().getHours();
        const affinity = contextEngine.getAffinityWeights(stats);
        const moreCandidates: Track[] = [];
        let fresh: Track[] = [];
        const baseNonce = Date.now();
        for (let depth = 1; depth <= 3; depth++) {
          const res = await runRecommend({
            data: {
              liked: likes.slice(0, 15).map(trackLabel),
              recent: history.slice(0, 15).map(trackLabel),
              disliked: dislikes.slice(0, 15).map(trackLabel),
              sequence: sequenceBrief(history, stats),
              skipped: skippedLabels(stats),
              count: 16,
              ...(mood ? { mood } : {}),
              languages: settings.languages,
              brief: settingsToBrief(settings),
              artists: topArtists(stats, likes),
              refreshNonce: `${baseNonce}-more-${depth}`,
              discovery: settings.discovery ?? 40,
              affinityArtists: affinity.affinityArtists,
              penalizedArtists: affinity.penalizedArtists,
              clientHour,
            },
          });
          if (res.tracks && res.tracks.length > 0) {
            for (const t of res.tracks as Track[]) {
              if (!moreCandidates.some((existing) => sameSong(existing, t))) {
                moreCandidates.push(t);
              }
            }
            fresh = applyFeedFilters(moreCandidates);
            if (fresh.length >= 8) break;
          }
        }
        if (fresh.length > 0) {
          const ranked = thompsonSamplingPolicy.rankCandidates(fresh, getSessionContext());
          setRecs((prev) => dedupeTracks([...prev, ...ranked]));
          markFeedDisplayed(ranked);
        }
      } finally {
        setLoadingMoreRecs(false);
      }
    },
    [loadingMoreRecs, runRecommend, likes, history, dislikes, stats, settings, getSessionContext, applyFeedFilters, markFeedDisplayed],
  );

  const extendQueue = useCallback(async (): Promise<Track[]> => {
    if (extending) return [];
    setExtending(true);
    try {
      const currentTrack = currentRef.current;
      const currentQueue = queueRef.current;
      let candidateTracks: Track[] = [];

      // AutoDJ 1–3 recent seed tracks from current track and recent queue/history
      const seedTracks: Track[] = [];
      if (currentTrack?.id) seedTracks.push(currentTrack);
      for (const t of [...currentQueue].reverse()) {
        if (t.id && !seedTracks.some((s) => s.id === t.id)) {
          seedTracks.push(t);
        }
        if (seedTracks.length >= 3) break;
      }

      // 1. Try YouTube RD Song Radio across recent seeds for continuous similar vibe
      for (const seed of seedTracks) {
        if (!seed.id) continue;
        try {
          const radioRes = await getSongRadio({
            data: {
              videoId: seed.id,
              limit: 15,
              continuation: radioContinuationRef.current,
            },
          });
          if (radioRes.continuation) {
            radioContinuationRef.current = radioRes.continuation;
          }
          if (radioRes.tracks && radioRes.tracks.length > 0) {
            const ranked = thompsonSamplingPolicy.rankCandidates(applyFeedFilters(radioRes.tracks as Track[]), getSessionContext());
            const fresh = ranked.filter(
              (t) => !trackExistsIn(currentQueue, t as TrackLike) && !dislikedIdsRef.current.has(t.id),
            );
            candidateTracks.push(...fresh);
            if (candidateTracks.length >= 10) break;
          }
        } catch {
          // fall through to next seed or AI recommendation
        }
      }

      // 2. Fallback to recommendation engine with circadian, affinity, and discovery context
      if (candidateTracks.length === 0) {
        const nonce = `${Date.now()}-${safeUUID()}`;
        const clientHour = new Date().getHours();
        const affinity = contextEngine.getAffinityWeights(stats);
        const res = await runRecommend({
          data: {
            liked: likes.slice(0, 20).map(trackLabel),
            recent: history.slice(0, 20).map(trackLabel),
            disliked: dislikes.slice(0, 20).map(trackLabel),
            sequence: sequenceBrief(history, stats),
            skipped: skippedLabels(stats),
            count: 16,
            languages: settings.languages,
            brief: settingsToBrief(settings),
            artists: topArtists(stats, likes),
            refreshNonce: nonce,
            discovery: settings.discovery ?? 40,
            affinityArtists: affinity.affinityArtists,
            penalizedArtists: affinity.penalizedArtists,
            clientHour,
          },
        });
        if (res.tracks && res.tracks.length > 0) {
          const ranked = thompsonSamplingPolicy.rankCandidates(applyFeedFilters(res.tracks as Track[]), getSessionContext());
          candidateTracks = ranked.filter(
            (t) => !trackExistsIn(currentQueue, t as TrackLike) && !dislikedIdsRef.current.has(t.id),
          );
        }
      }

      // 3. Last resort: cached pool passed through the same freshness filter
      // (displayed songs are excluded — we never refill AutoDJ with already-shown tracks).
      if (candidateTracks.length === 0) {
        const pool = applyFeedFilters([
          ...recsRef.current,
          ...trendingRef.current,
          ...oldSongsRef.current,
          ...(mixTracksRef.current?.discover || []),
          ...(mixTracksRef.current?.newrelease || []),
        ]);
        const rankedPool = thompsonSamplingPolicy.rankCandidates(pool, getSessionContext());
        candidateTracks = rankedPool.filter(
          (t) => !trackExistsIn(currentQueue, t as TrackLike) && !dislikedIdsRef.current.has(t.id),
        );
      }

      if (candidateTracks.length > 0) {
        const deduplicatedBatch = dedupeTracks(candidateTracks).slice(0, 15);
        setQueue((prev) => [...prev, ...deduplicatedBatch]);
        return deduplicatedBatch;
      }
      return [];
    } finally {
      setExtending(false);
    }
  }, [extending, runRecommend, likes, history, dislikes, stats, settings, getSessionContext, applyFeedFilters, markFeedDisplayed]);
  extendQueueRef.current = extendQueue;

  const searchFor = useCallback(
    async (term: string, searchType?: "songs" | "podcasts", filter?: SearchFilter) => {
      // Clear any pending debounce timer on explicit search trigger
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      const q = term.trim();
      if (!q) {
        activeSearchIdRef.current++;
        setSearching(false);
        setResults([]);
        setSearchContinuation(undefined);
        return;
      }

      const t = searchType ?? "songs";
      const f = filter ?? searchFilter;
      setTab("search");
      setSearching(true);
      setSearchContinuation(undefined);
      searchPageRef.current = 1;
      setQuery(term);
      setMessage(null);

      const requestId = ++activeSearchIdRef.current;

      try {
        const res = await runSearch({
          data: {
            query: q,
            limit: 50,
            type: t,
            filter: f,
            page: 1,
            offset: 0,
          },
        });

        // Cancel / ignore stale responses
        if (requestId !== activeSearchIdRef.current) return;

        if (res.error) setMessage(res.error);
        if (res.tracks) {
          const raw = res.tracks as Track[];
          let filtered = t === "songs" ? raw : raw.filter(isPodcastTrack);
          if (t === "songs" && settings.languages && settings.languages.length > 0) {
            const queryLower = q.toLowerCase();
            const queryHasExplicitLang = LANGUAGES.some((l) => queryLower.includes(l.toLowerCase()));
            if (!queryHasExplicitLang) {
              const consistent = filtered.filter((track) => isLanguageConsistent(track, settings.languages));
              if (consistent.length > 0) {
                filtered = consistent;
              }
            }
          }
          setResults(dedupeTracks(filtered));
          setSearchContinuation(res.continuation);
          if (q.length >= 2) {
            saveRecentSearch(q);
          }
        }
      } catch {
        if (requestId !== activeSearchIdRef.current) return;
        setMessage("Search failed. Please try again.");
      } finally {
        if (requestId === activeSearchIdRef.current) {
          setSearching(false);
        }
      }
    },
    [runSearch, searchFilter, settings.languages],
  );

  // Automatic debounced search as user types (~450ms debounce)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const trimmed = query.trim();
    if (!trimmed) {
      // Empty input: do not search, clear results to show trending/empty state
      activeSearchIdRef.current++;
      setSearching(false);
      setResults([]);
      setSearchContinuation(undefined);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void searchFor(trimmed, "songs", searchFilter);
    }, 450);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [query, searchFilter, searchFor]);

  const loadMoreResults = useCallback(async () => {
    if (loadingMoreSearch || !query.trim()) return;
    setLoadingMoreSearch(true);
    const nextPage = searchPageRef.current + 1;
    try {
      const res = await runSearch({
        data: {
          query: query.trim(),
          filter: searchFilter,
          continuation: searchContinuation,
          page: nextPage,
          offset: results.length,
        },
      });
      if (res.tracks && res.tracks.length > 0) {
        searchPageRef.current = nextPage;
        const raw = res.tracks as Track[];
        let incoming = raw;
        if (settings.languages && settings.languages.length > 0) {
          const queryLower = query.toLowerCase();
          const queryHasExplicitLang = LANGUAGES.some((l) => queryLower.includes(l.toLowerCase()));
          if (!queryHasExplicitLang) {
            const consistent = incoming.filter((track) => isLanguageConsistent(track, settings.languages));
            if (consistent.length > 0) {
              incoming = consistent;
            }
          }
        }
        setResults((prev) => dedupeTracks([...prev, ...incoming]));
      }
      setSearchContinuation(res.continuation);
    } catch {
      setMessage("Could not load more results");
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setLoadingMoreSearch(false);
    }
  }, [searchContinuation, loadingMoreSearch, query, searchFilter, runSearch, results.length, settings.languages]);

  const openArtist = useCallback(
    (artist: string) => {
      setQuery(artist);
      saveRecentSearch(artist);
      void searchFor(`${artist} songs`);
    },
    [searchFor],
  );

  const goNext = useCallback(() => {
    const currentTrack = currentRef.current;
    if (currentTrack && !isPodcastTrack(currentTrack)) {
      if (player.position > 0 && player.position < 25) {
        logSkip(currentTrack);
        contextEngine.recordSkip(currentTrack);
      }
      sessionSkipsRef.current += 1;
      const frac = player.duration > 0 ? player.position / player.duration : 0;
      const ctx = getSessionContext();
      const event = telemetry.logEvent({
        trackId: currentTrack.id,
        artist: currentTrack.artist,
        title: currentTrack.title,
        eventType: "SKIPPED",
        positionSeconds: player.position,
        durationSeconds: player.duration,
        fractionPlayed: frac,
        timestamp: Date.now(),
        context: { hourOfDay: ctx.hourOfDay, discoverySetting: ctx.discoveryPercent },
      });
      thompsonSamplingPolicy.recordFeedback(event, ctx);
      previousTrackRef.current = currentTrack;
    }

    const q = queueRef.current;
    const i = indexRef.current;
    const nextIdx = findNextValidTrackIndex(q, i, false);

    // 1. If next non-disliked track already exists in queue, advance immediately
    if (nextIdx !== -1) {
      indexRef.current = nextIdx;
      setIndex(nextIdx);
      const nextTrack = q[nextIdx];
      if (nextTrack) {
        player.seek(0);
        progressTrackerRef.current.reset(nextTrack.id);
        loadedTrackIdRef.current = nextTrack.id;
        void load(nextTrack.id, nextTrack.previewUrl, 0);
      }
      if (nextIdx + 3 >= q.length) {
        void extendQueue();
      }
      return;
    }

    // 2. Queue reached the end: find unplayed tracks from recs, trending, or mixTracks
    const pool = applyFeedFilters([
      ...recsRef.current,
      ...trendingRef.current,
      ...oldSongsRef.current,
      ...(mixTracksRef.current?.discover || []),
      ...(mixTracksRef.current?.newrelease || []),
    ]);
    const candidateTracks = pool.filter(
      (t) => !trackExistsIn(q, t as TrackLike) && !dislikedIdsRef.current.has(t.id),
    );

    if (candidateTracks.length > 0) {
      const added = candidateTracks.slice(0, 10);
      const targetIdx = q.length;
      setQueue((prev) => [...prev, ...added]);
      indexRef.current = targetIdx;
      setIndex(targetIdx);
      const nextTrack = added[0];
      if (nextTrack) {
        player.seek(0);
        progressTrackerRef.current.reset(nextTrack.id);
        loadedTrackIdRef.current = nextTrack.id;
        void load(nextTrack.id, nextTrack.previewUrl, 0);
      }
      void extendQueue();
      return;
    }

    // 3. If no local candidates, fetch fresh tracks or loop back
    void extendQueue().then((added) => {
      if (added && added.length > 0) {
        const firstTrack = added[0];
        if (firstTrack) {
          setQueue((prev) => {
            const targetIdx = prev.findIndex((t) => t.id === firstTrack.id);
            if (targetIdx !== -1) {
              indexRef.current = targetIdx;
              setIndex(targetIdx);
              player.seek(0);
              progressTrackerRef.current.reset(firstTrack.id);
              loadedTrackIdRef.current = firstTrack.id;
              void load(firstTrack.id, firstTrack.previewUrl, 0);
            }
            return prev;
          });
          return;
        }
      }
      const updated = queueRef.current;
      const fallbackIdx = findNextValidTrackIndex(updated, i, true);
      if (fallbackIdx !== -1) {
        indexRef.current = fallbackIdx;
        setIndex(fallbackIdx);
        const fbTrack = updated[fallbackIdx];
        if (fbTrack) {
          player.seek(0);
          progressTrackerRef.current.reset(fbTrack.id);
          loadedTrackIdRef.current = fbTrack.id;
          void load(fbTrack.id, fbTrack.previewUrl, 0);
        }
      }
    });
  }, [extendQueue, findNextValidTrackIndex, logSkip, player, load, getSessionContext, applyFeedFilters]);

  const goPrev = useCallback(() => {
    // Spotify-style previous behavior:
    // If current track has played beyond restart threshold (3 seconds), restart it to 00:00
    if (player.position > 3) {
      player.seek(0);
      return;
    }

    const q = queueRef.current;
    const i = indexRef.current;
    let targetIdx = -1;
    if (i > 0) {
      targetIdx = i - 1;
    } else if (q.length > 0) {
      targetIdx = q.length - 1; // Loop to last track
    }
    if (targetIdx !== -1) {
      const prevTrack = q[targetIdx];
      indexRef.current = targetIdx;
      setIndex(targetIdx);
      if (prevTrack) {
        player.seek(0);
        progressTrackerRef.current.reset(prevTrack.id);
        loadedTrackIdRef.current = prevTrack.id;
        void load(prevTrack.id, prevTrack.previewUrl, 0);
      }
    }
  }, [load, player]);

  const handleToggleLike = useCallback(
    (track: Track) => {
      const wasLiked = likedIds.has(track.id);
      toggleLike(track);
      if (!wasLiked && !isPodcastTrack(track)) {
        const ctx = getSessionContext();
        const event = telemetry.logEvent({
          trackId: track.id,
          artist: track.artist,
          title: track.title,
          eventType: "LIKED",
          positionSeconds: track.id === currentRef.current?.id ? player.position : 0,
          durationSeconds: track.id === currentRef.current?.id ? player.duration : 0,
          fractionPlayed:
            track.id === currentRef.current?.id && player.duration > 0 ? player.position / player.duration : 0,
          timestamp: Date.now(),
          context: { hourOfDay: ctx.hourOfDay, discoverySetting: ctx.discoveryPercent },
        });
        thompsonSamplingPolicy.recordFeedback(event, ctx);
      }
    },
    [likedIds, toggleLike, getSessionContext, player.position, player.duration],
  );

  const handleAddToPlaylist = useCallback(
    (playlistId: string, track: Track) => {
      addToPlaylist(playlistId, track);
      if (!isPodcastTrack(track)) {
        const ctx = getSessionContext();
        const event = telemetry.logEvent({
          trackId: track.id,
          artist: track.artist,
          title: track.title,
          eventType: "ADDED_TO_LIBRARY",
          positionSeconds: 0,
          durationSeconds: 0,
          fractionPlayed: 0,
          timestamp: Date.now(),
          context: { hourOfDay: ctx.hourOfDay, discoverySetting: ctx.discoveryPercent },
        });
        thompsonSamplingPolicy.recordFeedback(event, ctx);
      }
    },
    [addToPlaylist, getSessionContext],
  );

  // --- Global Keyboard Shortcuts ---
  useKeyboardShortcuts({
    onTogglePlay: togglePlay,
    onSeekForward: () => player.skipForward(5),
    onSeekBackward: () => player.skipBackward(5),
    onVolumeUp: () => {
      setVolume((v) => {
        const next = Math.min(100, v + 5);
        applyVolume(next);
        return next;
      });
    },
    onVolumeDown: () => {
      setVolume((v) => {
        const next = Math.max(0, v - 5);
        applyVolume(next);
        return next;
      });
    },
    onNext: goNext,
    onPrev: goPrev,
    onToggleMute: toggleMute,
    onToggleFullScreen: () => setShowFullScreen((v) => !v),
    onToggleEqualizer: () => setShowEqualizer((v) => !v),
    onToggleShortcutsModal: () => setShowShortcuts((v) => !v),
    onFocusSearch: () => {
      const el = document.getElementById("main-search-input");
      if (el) {
        el.focus();
      }
    },
  });

  // Android hardware back button & in-app back navigation
  useEffect(() => {
    if (typeof window === "undefined") return;

    let backListenerHandle: { remove: () => void } | null = null;
    let isDisposed = false;

    if (Capacitor.isNativePlatform()) {
      App.addListener("backButton", ({ canGoBack }) => {
        if (showAuthModal) {
          setShowAuthModal(false);
          return;
        }
        if (showFullScreen) {
          setShowFullScreen(false);
          return;
        }
        if (showSettings) {
          setShowSettings(false);
          return;
        }
        if (showQueue) {
          setShowQueue(false);
          return;
        }
        if (showLyrics) {
          setShowLyrics(false);
          return;
        }
        if (showEqualizer) {
          setShowEqualizer(false);
          return;
        }
        if (showSleepTimer) {
          setShowSleepTimer(false);
          return;
        }
        if (showShortcuts) {
          setShowShortcuts(false);
          return;
        }
        if (showOnboarding) {
          setShowOnboarding(false);
          return;
        }
        if (optionsTrack) {
          setOptionsTrack(null);
          return;
        }
        if (shareTrack) {
          setShareTrack(null);
          return;
        }
        if (createPlaylistTrack) {
          setCreatePlaylistTrack(null);
          return;
        }
        if (drawerOpen) {
          setDrawerOpen(false);
          return;
        }
        if (tab !== "foryou") {
          setTab("foryou");
          return;
        }
        if (canGoBack) {
          window.history.back();
        } else {
          void App.exitApp();
        }
      })
        .then((handle) => {
          if (isDisposed) {
            handle.remove();
          } else {
            backListenerHandle = handle;
          }
        })
        .catch(() => {});
    }

    return () => {
      isDisposed = true;
      backListenerHandle?.remove();
    };
  }, [
    showAuthModal,
    showFullScreen,
    showSettings,
    showQueue,
    showLyrics,
    showEqualizer,
    showSleepTimer,
    showShortcuts,
    showOnboarding,
    optionsTrack,
    shareTrack,
    createPlaylistTrack,
    drawerOpen,
    tab,
  ]);

  const onSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const trimmed = query.trim();
    if (!trimmed) return;
    saveRecentSearch(trimmed);
    void searchFor(trimmed, "songs", searchFilter);
  };

  /** Remove a track from a playlist with undo support (5-second window). */
  const removeTrackWithUndo = useCallback(
    (playlistId: string, trackId: string) => {
      // Find the track before removing so we can restore it
      const playlist = playlists.find((p) => p.id === playlistId);
      const track = playlist?.tracks.find((t) => t.id === trackId);
      const playlistName = playlist?.name ?? "playlist";
      const trackTitle = track?.title ?? "track";

      removeFromPlaylist(playlistId, trackId);

      // Clear any existing undo
      if (undoRef.current) {
        clearTimeout(undoRef.current.timeout);
        setUndoLabel(null);
        setMessage(null);
      }

      if (track) {
        setMessage(`Removed "${trackTitle}" from ${playlistName}`);
        setUndoLabel("Undo");
        undoRef.current = {
          timeout: setTimeout(() => {
            setUndoLabel(null);
            setMessage(null);
            undoRef.current = null;
          }, 5000),
          restore: () => {
            addToPlaylist(playlistId, track);
            setMessage(`Restored "${trackTitle}"`);
            setTimeout(() => setMessage(null), 2000);
          },
        };
      }
    },
    [playlists, removeFromPlaylist, addToPlaylist],
  );

  const handleUndo = useCallback(() => {
    if (undoRef.current) {
      clearTimeout(undoRef.current.timeout);
      undoRef.current.restore();
      undoRef.current = null;
      setUndoLabel(null);
    }
  }, []);

  // --- Effects ---
  useEffect(() => {
    if (tab !== "mixes" || mix === "replay") return;
    void loadMix(mix);
  }, [tab, mix, loadMix]);



  const handlePlayPodcastEpisode = useCallback(
    (ep: PodcastEpisode, allEpisodes: PodcastEpisode[], idx: number) => {
      const tracks = allEpisodes.map(episodeToTrack);
      const target = tracks[idx] || episodeToTrack(ep);
      playSong(target, tracks);
    },
    [playSong],
  );

  const handlePlayPodcastHistory = useCallback(
    (track: Track, allHistory: Track[]) => {
      playSong(track, allHistory);
    },
    [playSong],
  );

  const restored = useRef(false);
  const resumeRef = useRef<number | null>(null);

  // Restore last playing track, queue, and seek position on mount / page refresh
  useEffect(() => {
    if (restored.current || !player.ready) return;
    restored.current = true;
    try {
      const saved = readPlayback();
      if (saved && Array.isArray(saved.queue) && saved.queue.length > 0) {
        // Resolve BEFORE filtering: relocate the interrupted song by ID in the cleaned
        // queue so a refresh restores the SAME track (naive index clamping points at
        // the wrong song when unplayable tracks precede it). Music restarts at 0:00;
        // podcasts keep their saved resume position.
        const resolved = resolveRestorablePlayback(saved);
        if (resolved.empty) {
          setResumed(true);
          return;
        }
        setQueue(resolved.queue);
        markFeedDisplayed(resolved.queue);
        setIndex(resolved.index);
        setResumed(true);
        const targetTrack = resolved.queue[resolved.index];
        if (targetTrack) {
          const savedPos = isPodcastTrack(targetTrack) ? resolved.position : 0;
          resumeRef.current = savedPos;
          loadedTrackIdRef.current = targetTrack.id;
          // Always cue on initial restore to avoid NotAllowedError on mobile and audio clashes across devices
          cue(targetTrack.id, savedPos, targetTrack.previewUrl);
        }
      } else {
        setResumed(true);
      }
    } catch {
      setResumed(true);
    }
  }, [player.ready, cue]);

  // Listen for cloud playback synchronization (e.g. queue restored upon sign in from another device/browser)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPlaybackSynced = () => {
      try {
        const saved = readPlayback();
        if (saved && Array.isArray(saved.queue) && saved.queue.length > 0) {
          const resolved = resolveRestorablePlayback(saved);
          if (!resolved.empty) {
            setQueue(resolved.queue);
            setIndex(resolved.index);
            indexRef.current = resolved.index;
            setResumed(true);
            const targetTrack = resolved.queue[resolved.index];
            if (targetTrack) {
              const savedPos = isPodcastTrack(targetTrack) ? resolved.position : 0;
              loadedTrackIdRef.current = targetTrack.id;
              cue(targetTrack.id, savedPos, targetTrack.previewUrl);
            }
          }
        }
      } catch {}
    };
    window.addEventListener("melodymap:playback-synced", onPlaybackSynced);
    return () => window.removeEventListener("melodymap:playback-synced", onPlaybackSynced);
  }, [cue]);

  useEffect(() => {
    const track = current;
    if (!player.ready || !track) return;
    if (loadedTrackIdRef.current === track.id) return;
    loadedTrackIdRef.current = track.id;

    const isPodcast = isPodcastTrack(track) || parseDurationSeconds(track.duration) > 900;
    const podcastSavedPos = isPodcast ? getPodcastResumePosition(track.id) : 0;
    const resumeAt = resumeRef.current !== null ? resumeRef.current : (podcastSavedPos > 0 ? podcastSavedPos : null);

    if (resumeAt !== null) {
      resumeRef.current = null;
      cue(track.id, resumeAt, track.previewUrl);
      setResumed(true);
      return;
    }

    // Tab navigation safety: If audio is actively playing, never reload, re-cue, or interrupt
    if (player.isPlaying) {
      return;
    }

    const audioEl =
      typeof document !== "undefined"
        ? (document.getElementById("melodymap-core-audio") as HTMLAudioElement | null)
        : null;
    const isAlreadyLoaded =
      audioEl &&
      ((track.previewUrl && audioEl.src.includes(track.previewUrl)) ||
        audioEl.src.includes(encodeURIComponent(track.id)));

    if (isAlreadyLoaded && !audioEl.paused) {
      return;
    }

    void load(track.id, track.previewUrl);
  }, [current?.id, player.ready, player.isPlaying, load, cue]);

  const isPlayingRef = useRef(player.isPlaying);
  isPlayingRef.current = player.isPlaying;
  const playerPositionRef = useRef(player.position);
  playerPositionRef.current = player.position;

  // ─── Native Android background playback (Spotify-style) ───
  // Keeps the foreground media service, lockscreen notification, and headset
  // buttons in sync with the player. Every call no-ops outside the APK.
  const nativeHandlersRef = useRef({ togglePlay, goNext, goPrev, seek: player.seek });
  nativeHandlersRef.current = { togglePlay, goNext, goPrev, seek: player.seek };

  // Media commands arriving from the lockscreen, notification action buttons,
  // and headset/hardware media keys (installed once, dispatches via refs).
  useEffect(() => {
    if (!isNativePlaybackEnv()) return;
    return installMediaCommandHandler({
      play: () => {
        if (!isPlayingRef.current) nativeHandlersRef.current.togglePlay();
      },
      pause: () => {
        if (isPlayingRef.current) nativeHandlersRef.current.togglePlay();
      },
      next: () => nativeHandlersRef.current.goNext(),
      prev: () => nativeHandlersRef.current.goPrev(),
      seek: (seconds) => nativeHandlersRef.current.seek(seconds),
    });
  }, []);

  // Playback state → foreground notification + MediaSession. Also fires the
  // one-per-install battery-optimization prompt on the first real play.
  useEffect(() => {
    if (!isNativePlaybackEnv() || !current) return;
    notifyPlaybackState(player.isPlaying ? "playing" : "paused", {
      id: current.id,
      title: current.title,
      artist: current.artist,
      duration: player.duration || parseDurationSeconds(current.duration),
      // Position is intentionally read from a ref: the periodic interval below
      // keeps the lockscreen progress bar fresh without spamming the bridge.
      position: playerPositionRef.current,
    });
    if (player.isPlaying) {
      requestBatteryOptimizationExemption();
    }
  }, [current, player.isPlaying, player.duration]);

  // Lightweight periodic position sync for the lockscreen progress bar.
  useEffect(() => {
    if (!isNativePlaybackEnv()) return;
    const iv = window.setInterval(() => {
      if (isPlayingRef.current) {
        notifyPlaybackPosition(playerPositionRef.current);
      }
    }, 5000);
    return () => window.clearInterval(iv);
  }, []);

  // Track play count after 5 cumulative seconds of active playback without misfiring on pause or seeks
  const logPlayRef = useRef(logPlay);
  logPlayRef.current = logPlay;
  const loggedPlayTrackIdRef = useRef<string | null>(null);

  useEffect(() => {
    const track = current;
    if (!track) return;
    let listened = 0;
    let last = playerPositionRef.current;
    const iv = window.setInterval(() => {
      const pos = playerPositionRef.current;
      if (isPlayingRef.current && typeof pos === "number" && typeof last === "number") {
        const delta = pos - last;
        if (delta > 0 && delta <= 2) listened += delta; // cap 2s/tick => seeks don't count
      }
      last = pos;
      if (listened >= 5 && loggedPlayTrackIdRef.current !== track.id) {
        loggedPlayTrackIdRef.current = track.id;
        logPlayRef.current(track);
        window.clearInterval(iv);
      }
    }, 1000);

    return () => window.clearInterval(iv);
  }, [current?.id]);

  // Reset consecutive playback errors once audio successfully plays
  useEffect(() => {
    if (player.isPlaying) {
      consecutiveErrorsRef.current = 0;
    }
  }, [player.isPlaying]);

  // Cross-tab playback coordination: pause if another tab begins playback
  const channelRef = useRef<BroadcastChannel | null>(null);
  const tabInstanceIdRef = useRef<string>(safeUUID());

  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    try {
      const channel = new BroadcastChannel("melodymap_playback_sync");
      channelRef.current = channel;
      channel.onmessage = (event) => {
        // Only pause if the message came from a different tab instance, never self
        if (
          event?.data?.type === "PLAYING" &&
          event.data.instanceId &&
          event.data.instanceId !== tabInstanceIdRef.current
        ) {
          if (isPlayingRef.current) {
            pause();
          }
        }
      };
      return () => {
        try {
          channel.close();
        } catch {}
      };
    } catch {
      return;
    }
  }, [pause]);

  // Broadcast when this tab starts playing
  useEffect(() => {
    if (player.isPlaying && channelRef.current) {
      try {
        channelRef.current.postMessage({
          type: "PLAYING",
          trackId: current?.id,
          instanceId: tabInstanceIdRef.current,
        });
      } catch {}
    }
  }, [player.isPlaying, current?.id]);

  // Pre-warm the next upcoming 3 tracks' audio streams in background for zero-gap screen-off playback
  useEffect(() => {
    const upcoming = queue
      .slice(index + 1, index + 4)
      .filter((t) => !t.previewUrl)
      .map((t) => t.id);
    if (upcoming.length > 0) {
      void runPrewarm({ data: { ids: upcoming } });
    }
  }, [index, queue, runPrewarm]);

  const saveCurrentPlayback = useCallback(() => {
    const q = queueRef.current;
    if (q.length === 0) return;
    const pos = playerPositionRef.current;
    const safePos = typeof pos === "number" && !isNaN(pos) ? pos : 0;
    writePlayback({
      queue: q,
      index: indexRef.current,
      position: safePos,
      isPlaying: isPlayingRef.current,
    });
    const cur = currentRef.current;
    if (cur && (isPodcastTrack(cur) || parseDurationSeconds(cur.duration) > 900)) {
      savePodcastResumePosition(cur.id, safePos);
    }
  }, []);

  useEffect(() => {
    if (!resumed || queue.length === 0) return;
    saveCurrentPlayback();
    const timer = window.setInterval(saveCurrentPlayback, 2500);
    const handleUnload = () => saveCurrentPlayback();
    window.addEventListener("beforeunload", handleUnload);
    document.addEventListener("visibilitychange", handleUnload);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("beforeunload", handleUnload);
      document.removeEventListener("visibilitychange", handleUnload);
    };
  }, [resumed, queue, index, saveCurrentPlayback]);

  useEffect(() => {
    if (player.ready) applyVolume(volume);
  }, [volume, player.ready, applyVolume]);

  // Persist volume to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("melodymap.volume.v1", String(volume));
    } catch { /* quota exceeded — ignore */ }
  }, [volume]);

  // Persist continuous mode to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("melodymap.continuous.v1", String(continuous));
    } catch { /* quota exceeded — ignore */ }
  }, [continuous]);

  // Cleanup undo timer on unmount
  useEffect(() => {
    return () => {
      if (undoRef.current) clearTimeout(undoRef.current.timeout);
    };
  }, []);

  const bootstrapped = useRef(false);
  useEffect(() => {
    if (!hydrated || bootstrapped.current) return;
    bootstrapped.current = true;
    runStartupMigrations();

    const cachedFeed = readHomeCache();
    if (cachedFeed.recs?.length) setRecs(cachedFeed.recs);
    if (cachedFeed.trendingList?.length) setTrendingList(cachedFeed.trendingList);
    if (cachedFeed.oldSongsList?.length) setOldSongsList(cachedFeed.oldSongsList.filter(isOldEraTrack));
    if (cachedFeed.mixTracks) setMixTracks(cachedFeed.mixTracks);
    if (cachedFeed.dailyMixTracks?.length) setDailyMixTracks(cachedFeed.dailyMixTracks);

    // Auto-refresh recommendations on startup ONLY if the local feed cache is empty.
    // If the user already has cached picks, show them instantly without network delay or flashing.
    const hasCachedFeed =
      (cachedFeed.recs && cachedFeed.recs.length > 0) ||
      (cachedFeed.trendingList && cachedFeed.trendingList.length > 0) ||
      (cachedFeed.oldSongsList && cachedFeed.oldSongsList.length > 0);
    // Cached feeds restored for instant paint count as "previously displayed" for
    // this session, so a refresh never re-serves them.
    markFeedDisplayed([
      ...(cachedFeed.recs || []),
      ...(cachedFeed.trendingList || []),
      ...((cachedFeed.oldSongsList || []).filter(isOldEraTrack)),
      ...(cachedFeed.dailyMixTracks || []),
      ...Object.values(cachedFeed.mixTracks || {}).flat(),
    ]);
    if (!hasCachedFeed) {
      void loadRecommendations();
    }
  }, [hydrated, loadRecommendations, markFeedDisplayed]);

  // Reload recommendations ONLY when language preferences actually change in settings
  const prevLanguagesRef = useRef<string | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    const currentLangs = settings.languages.join(",");
    if (prevLanguagesRef.current === null) {
      // First hydration — record current languages without firing re-fetch
      prevLanguagesRef.current = currentLangs;
      return;
    }
    if (prevLanguagesRef.current !== currentLangs) {
      prevLanguagesRef.current = currentLangs;
      // Invalidate in-memory feed pools and history trackers
      recsRef.current = [];
      trendingRef.current = [];
      oldSongsRef.current = [];
      mixTracksRef.current = { explore: [], discover: [], newrelease: [] };
      setRecs([]);
      setTrendingList([]);
      setOldSongsList([]);
      setMixTracks({ explore: [], discover: [], newrelease: [] });
      displayedTracksRef.current = [];
      previouslyDisplayedIdsRef.current.clear();

      // Filter upcoming unplayed tracks in queue to eliminate cross-language contamination
      if (settings.languages.length > 0) {
        setQueue((prev) => {
          const currentIndex = indexRef.current;
          const played = prev.slice(0, currentIndex + 1);
          const upcoming = prev.slice(currentIndex + 1);
          const filteredUpcoming = upcoming.filter((t) => isLanguageConsistent(t, settings.languages));
          return [...played, ...filteredUpcoming];
        });
      }

      void loadRecommendations();
    }
  }, [hydrated, settings.languages, loadRecommendations]);

  // Auto-populate explore feeds (new releases, old songs, trending) when switching to Explore tab if empty
  useEffect(() => {
    if (!hydrated || tab !== "explore") return;
    const hasEmptyExploreFeeds =
      oldSongsList.length === 0 ||
      trendingList.length === 0 ||
      !mixTracks.newrelease ||
      mixTracks.newrelease.length === 0;
    if (hasEmptyExploreFeeds && !recLoading) {
      void loadRecommendations();
    }
  }, [hydrated, tab, oldSongsList.length, trendingList.length, mixTracks.newrelease, recLoading, loadRecommendations]);

  useMediaSession(current, player.isPlaying, player.position, player.duration, {
    onPlay: () => {
      if (sleepTimerService.isExpired() || sleepTimerHaltedRef.current) {
        return;
      }
      player.play();
    },
    onPause: () => player.pause(),
    onNext: () => {
      if (sleepTimerService.isExpired() || sleepTimerHaltedRef.current) return;
      goNext();
    },
    onPrev: () => {
      if (sleepTimerService.isExpired() || sleepTimerHaltedRef.current) return;
      goPrev();
    },
    onSeek: (s: number) => player.seek(s),
  });


  // Filter history by search query for instant client-side history searching
  const filteredHistory = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    if (!q) return history;
    return history.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q),
    );
  }, [history, historyQuery]);

  // --- Track list for each tab ---
  const listForTab: Record<string, Track[]> = useMemo(
    () => ({
      likes,
      history: filteredHistory,
      search: results,
      foryou: recs,
    }),
    [likes, filteredHistory, results, recs],
  );
  const visible = listForTab[tab] ?? [];

  // Mobile library sub-view navigation
  const handleMobileLibraryNav = useCallback((section: null | "liked" | "history" | "playlists" | "downloads") => {
    if (section === "liked") setTab("likes");
    else if (section === "history") setTab("history");
    else if (section === "playlists") setTab("playlists");
  }, []);

  return (
    <div className="flex flex-col h-dvh bg-[#080808] text-foreground selection:bg-[#1DB954]/20 overflow-hidden w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl mx-auto shadow-2xl relative border-x border-white/[0.04]">
      {/* Slide-out Mobile Sidebar Drawer */}
      <MobileDrawer
        open={drawerOpen}
        activeTab={tab}
        onClose={() => setDrawerOpen(false)}
        onNavigate={setTab}
        onOpenSettings={() => {
          setDrawerOpen(false);
          setShowSettings(true);
        }}
        isSynced={!!auth.userId}
        userName={
          auth.profile?.display_name && auth.profile.display_name !== "Google Listener"
            ? auth.profile.display_name
            : auth.email && auth.email !== "listener@google.com"
              ? auth.email.split("@")[0]
              : "My Account"
        }
        userInitial={
          (auth.profile?.display_name && auth.profile.display_name !== "Google Listener"
            ? auth.profile.display_name[0]
            : auth.email && auth.email !== "listener@google.com"
              ? auth.email[0]
              : "M"
          )?.toUpperCase() ?? "M"
        }
        userAvatar={auth.profile?.avatar_url ?? null}
        onSignIn={() => {
          setDrawerOpen(false);
          setShowAuthModal(true);
        }}
        onSignOut={async () => {
          await auth.signOut();
          setMessage("Signed out successfully");
          setTimeout(() => setMessage(null), 3000);
        }}
      />

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#080808]">
        {/* Mobile header — on all non-search tabs */}
        {tab !== "search" && (
          <MobileHeader
            tab={tab}
            onOpenMenu={() => setDrawerOpen(true)}
            onOpenSettings={() => setShowSettings((v) => !v)}
            userInitial={
              (auth.profile?.display_name && auth.profile.display_name !== "Google Listener"
                ? auth.profile.display_name[0]
                : auth.email && auth.email !== "listener@google.com"
                  ? auth.email[0]
                  : "U"
              )?.toUpperCase() ?? "U"
            }
            userAvatar={auth.profile?.avatar_url ?? null}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        )}

        {/* Mobile search bar — on search tab */}
        {tab === "search" && (
          <div className="sticky top-0 z-20 bg-[#0f0f0f]/90 backdrop-blur-xl border-b border-white/[0.05]">
            <div className="flex items-center gap-2 px-4 py-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open menu"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/70 active:scale-95 transition-all"
              >
                <Menu className="h-4 w-4" />
              </button>
              <form onSubmit={onSearch} className="relative flex-1 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input
                    id="main-search-input"
                    type="search"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                    }}
                    placeholder="Search songs, artists, podcasts..."
                    className="h-10 w-full rounded-full border border-white/[0.08] bg-white/[0.04] pl-10 pr-16 text-sm text-white placeholder:text-white/30 focus:border-white/20 focus:ring-1 focus:ring-white/10 focus:outline-none"
                    autoComplete="off"
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {searching ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[#1DB954]" />
                    ) : query ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (debounceTimerRef.current) {
                            clearTimeout(debounceTimerRef.current);
                            debounceTimerRef.current = null;
                          }
                          activeSearchIdRef.current++;
                          setQuery("");
                          setResults([]);
                          setSearching(false);
                        }}
                        className="text-white/30 hover:text-white/70 active:text-white p-1"
                        aria-label="Clear search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    {/* Hands-free Voice Search Button */}
                    <VoiceSearchButton
                      onTranscript={(dictatedText) => {
                        setQuery(dictatedText);
                        setSearchFilter("all");
                        saveRecentSearch(dictatedText);
                        void searchFor(dictatedText, "songs", "all");
                      }}
                    />
                  </div>
                </div>
                {/* Manual Search trigger button */}
                <button
                  type="submit"
                  aria-label="Search"
                  title="Search"
                  className="flex h-10 px-3.5 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-medium text-white/90 active:scale-95 transition-all"
                >
                  {searching ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1DB954]" />
                  ) : (
                    <Search className="h-3.5 w-3.5 text-white/70" />
                  )}
                  <span className="hidden sm:inline">Search</span>
                </button>
              </form>
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                aria-label="Settings"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/50 active:scale-95 transition-all hover:text-white"
              >
                <Settings2 className="h-4 w-4" />
              </button>

              {/* Circle user mark on only top of app (Search view) */}
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                aria-label="Account profile"
                title="Account profile"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-white overflow-hidden active:scale-95 transition-all ring-1 ring-white/[0.04]"
              >
                {auth.profile?.avatar_url ? (
                  <img src={auth.profile.avatar_url} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs font-medium text-white/90">
                    {(auth.profile?.display_name?.[0] || auth.email?.[0] || "U").toUpperCase()}
                  </span>
                )}
              </button>
            </div>
            {/* Quick filter chips */}
            <div className="flex gap-1.5 overflow-x-auto px-4 pb-2.5 scrollbar-hide">
              {["foryou", "explore", "mixes", "podcasts", "languages", "likes", "history"].map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id as NavTab)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-all",
                    tab === id
                      ? "bg-[#F5F5F5] text-black font-medium border-transparent shadow-sm"
                      : "border-white/[0.06] bg-transparent text-[#A1A1A1] hover:text-[#F5F5F5] hover:bg-white/[0.04]",
                  )}
                >
                  {NAV_ITEMS.find((n) => n.id === id)?.label ?? id}
                </button>
              ))}
            </div>
          </div>
        )}

        <main className="relative flex-1 overflow-y-auto overflow-x-hidden scroll-smooth pb-36">
          <ErrorBoundary>
            <div className="relative w-full px-4 py-5 sm:px-6 pb-32">
              {message && (
                <div className="pointer-events-auto fixed bottom-28 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-3 rounded-full border border-white/10 bg-[#181818]/95 px-5 py-2.5 shadow-2xl backdrop-blur-md">
                    <p className="text-xs font-medium text-white/90">
                      {message}
                    </p>
                    {undoLabel && (
                      <button
                        type="button"
                        onClick={handleUndo}
                        className="text-xs font-semibold text-[#1DB954] hover:underline transition-colors"
                      >
                        {undoLabel}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* FOR YOU TAB */}
              {tab === "foryou" && (
                <div className="space-y-6">
                  {/* Greeting & Moods */}
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h1 suppressHydrationWarning className="text-xl sm:text-2xl font-semibold tracking-tight text-white/95">
                        Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {auth.profile?.display_name?.split(" ")[0] || "Listener"}
                      </h1>
                      <p className="text-xs text-neutral-400 font-normal mt-0.5">Recommended based on your recent listening</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="rounded-full bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08] hover:text-white border-white/[0.08] text-xs font-normal"
                        onClick={() => void loadRecommendations()}
                        disabled={recLoading}
                      >
                        {recLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin text-white/60" /> : null}
                        Refresh
                      </Button>
                    </div>
                  </div>

                  {/* Mood chips */}
                  <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
                    {MOODS.map((mood) => (
                      <button
                        key={mood}
                        type="button"
                        onClick={() => void loadRecommendations(mood)}
                        disabled={recLoading}
                        className="shrink-0 rounded-full border border-white/[0.06] bg-white/[0.03] px-3.5 py-1 text-xs font-normal text-neutral-300 transition-all hover:bg-white/[0.08] hover:text-white active:scale-95"
                      >
                        {mood}
                      </button>
                    ))}
                  </div>

                  {/* Recent Searches section in the main view (stores last 5 searched artist or song terms locally) */}
                  <RecentSearchesSection
                    onSelectQuery={(q) => {
                      setTab("search");
                      setQuery(q);
                      setSearchFilter("all");
                      saveRecentSearch(q);
                      void searchFor(q, "songs", "all");
                    }}
                    maxItems={5}
                    className="pt-1"
                  />

                  {/* Home Sections — mobile horizontal scroll */}
                  <MobileHomeSections
                    dailyMix={dailyMixTracks}
                    trending={[]}
                    oldSongs={[]}
                    newReleases={[]}
                    recommended={recs}
                    onPlayTrack={(track, sectionTracks, i) => {
                      if (current?.id === track.id && player.isPlaying) {
                        pause();
                        return;
                      }
                      startQueue(sectionTracks, i);
                    }}
                    onToggleLike={handleToggleLike}
                    onOpenOptions={(t) => setOptionsTrack(t)}
                    likedIds={likedIds}
                    currentId={current?.id ?? null}
                    isPlaying={player.isPlaying}
                    loading={!hydrated || (recLoading && recs.length === 0)}
                  />

                {/* Explore More Songs for low-bandwidth incremental discovery */}
                {recs.length > 0 && (
                  <div className="flex justify-center pt-2 pb-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void loadMoreRecommendations()}
                      disabled={loadingMoreRecs}
                      className="rounded-full border-white/10 bg-white/[0.04] px-5 py-2 text-xs font-normal text-neutral-300 hover:bg-white/[0.08] hover:text-white transition-all shadow-md"
                    >
                      {loadingMoreRecs ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin text-[#1DB954]" /> : null}
                      Explore more songs
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* EXPLORE TAB */}
            {tab === "explore" && (
              <div className="space-y-5 pt-1 animate-fade-in">
                <div className="flex items-center justify-between pb-1">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white/95">
                      Explore & Discover
                    </h1>
                    <p className="text-xs text-neutral-400 font-normal mt-0.5">
                      Top charts, fresh releases & golden classics
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="rounded-full bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08] hover:text-white border-white/[0.08] text-xs font-normal"
                      onClick={() => void loadRecommendations()}
                      disabled={recLoading}
                    >
                      {recLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin text-white/60" /> : null}
                      Refresh
                    </Button>
                  </div>
                </div>

                <ExploreSections
                  trending={trendingList}
                  oldSongs={oldSongsList.filter(isOldEraTrack)}
                  newReleases={mixTracks.newrelease.slice(0, 12)}
                  onPlayTrack={(track, sectionTracks, i) => {
                    if (current?.id === track.id && player.isPlaying) {
                      pause();
                      return;
                    }
                    startQueue(sectionTracks, i);
                  }}
                  onOpenOptions={(t) => setOptionsTrack(t)}
                  onToggleLike={handleToggleLike}
                  likedIds={likedIds}
                  currentId={current?.id ?? null}
                  isPlaying={player.isPlaying}
                  loading={!hydrated || (recLoading && trendingList.length === 0 && oldSongsList.length === 0)}
                />
              </div>
            )}

            {/* SEARCH TAB */}
            {tab === "search" && (
              <SearchResults
                results={results}
                loading={searching}
                query={query}
                selectedFilter={searchFilter}
                userHistory={history}
                userLikes={likes}
                onFilterChange={(newFilter) => {
                  setSearchFilter(newFilter);
                  if (query.trim()) {
                    void searchFor(query, "songs", newFilter);
                  }
                }}
                onPlayTrack={(track, i) => {
                  if (current?.id === track.id) {
                    if (player.isPlaying) {
                      pause();
                    } else {
                      play();
                    }
                    return;
                  }
                  startQueue(results, i);
                }}
                onToggleLike={handleToggleLike}
                onOpenOptions={(t) => setOptionsTrack(t)}
                likedIds={likedIds}
                currentId={current?.id ?? null}
                isPlaying={player.isPlaying}
                onClear={() => {
                  setQuery("");
                  setResults([]);
                  setSearchContinuation(undefined);
                }}
                onSearch={(q, type) => {
                  setQuery(q);
                  setSearchFilter("all");
                  saveRecentSearch(q);
                  void searchFor(q, type, "all");
                }}
                hasMore={Boolean(searchContinuation) || results.length >= 10}
                loadingMore={loadingMoreSearch}
                onLoadMore={() => void loadMoreResults()}
              />
            )}

            {/* MIXES TAB */}
            {tab === "mixes" && (
              <MixesPanel
                active={mix}
                tracks={visibleMix}
                loading={mixLoading}
                currentId={current?.id}
                isPlaying={player.isPlaying}
                likedIds={likedIds}
                dislikedIds={dislikedIds}
                playlists={playlists}
                onSelect={(id) => {
                  setMix(id);
                  if (id !== "replay" && mixTracks[id].length === 0) void loadMix(id);
                }}
                onRefresh={() => {
                  if (mix !== "replay") void loadMix(mix);
                }}
                onPlayAll={() => startQueue(visibleMix, 0)}
                onPlay={(track, i) => {
                  if (current?.id === track.id) {
                    if (player.isPlaying) {
                      pause();
                    } else {
                      play();
                    }
                    return;
                  }
                  startQueue(visibleMix, i);
                }}
                onToggleLike={handleToggleLike}
                onToggleDislike={toggleDislike}
                onArtistClick={openArtist}
                onAddToPlaylist={handleAddToPlaylist}
                onAddToQueue={(track) => enqueue([track])}
                onCreatePlaylistWith={(track) => {
                  setCreatePlaylistTrack(track);
                }}
              />
            )}

            {/* PODCASTS TAB */}
            {tab === "podcasts" && (
              <PodcastsPanel
                currentTrackId={current?.id}
                isPlaying={player.isPlaying}
                onPlayEpisode={handlePlayPodcastEpisode}
                onPause={pause}
                onResume={play}
                podcastHistory={podcastHistory}
                onClearPodcastHistory={clearPodcastHistory}
                onPlayHistoryTrack={handlePlayPodcastHistory}
                userLanguages={settings.languages}
                onOpenSettings={() => setShowSettings(true)}
              />
            )}

            {/* PLAYLISTS TAB */}
            {tab === "playlists" && (
              <PlaylistsPanel
                playlists={playlists}
                currentId={current?.id}
                isPlaying={player.isPlaying}
                onCreate={(name) => createPlaylist(name)}
                onRename={renamePlaylist}
                onDelete={deletePlaylist}
                onRemoveTrack={removeTrackWithUndo}
                onRemoveMany={removeManyFromPlaylist}
                onMoveMany={moveTracksToPlaylist}
                onAddToQueue={enqueue}
                onReorder={reorderPlaylist}
                onPlay={(tracks, i) => startQueue(tracks, i)}
              />
            )}

            {/* LANGUAGES TAB */}
            {tab === "languages" && (
              <LanguagesPanel
                settings={settings}
                onChangeSettings={updateSettings}
                onPlay={(tracks, i) => startQueue(tracks, i)}
                currentId={current?.id}
                isPlaying={player.isPlaying}
                likedIds={likedIds}
                dislikedIds={dislikedIds}
                playlists={playlists}
                onToggleLike={handleToggleLike}
                onToggleDislike={toggleDislike}
                onArtistClick={openArtist}
                onAddToPlaylist={handleAddToPlaylist}
                onAddToQueue={(track) => enqueue([track])}
                onCreatePlaylistWith={(track) => {
                  setCreatePlaylistTrack(track);
                }}
                downloadedIds={downloadedIds}
                downloadingIds={downloadingIds}
                onDownload={(track) => void handleDownload(track)}
                onRemoveDownload={(track) => void handleRemoveDownload(track)}
              />
            )}

            {/* MOBILE LIBRARY TAB */}
            {tab === "library" && (
              <MobileLibrary
                likes={likes}
                history={history}
                playlists={playlists}
                downloads={[]}
                currentId={current?.id ?? null}
                isPlaying={player.isPlaying}
                onNavigateSection={handleMobileLibraryNav}
                onOpenOptions={(t) => setOptionsTrack(t)}
                onPlayTrack={(tracks, i) => {
                  if (current?.id === tracks[i]?.id) {
                    if (player.isPlaying) {
                      pause();
                    } else {
                      play();
                    }
                    return;
                  }
                  startQueue(tracks, i);
                }}
              />
            )}

            {/* FAVOURITES / HISTORY TABS (TrackList) */}
            {(tab === "likes" || tab === "history") && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">
                      {tab === "likes" ? "Your Favourites" : "Recently Played"}
                    </h2>
                    {tab === "history" && history.length > 0 && (
                      <span className="text-xs text-white/40 font-medium">
                        ({historyQuery ? `${filteredHistory.length} of ${history.length}` : `${history.length}`})
                      </span>
                    )}
                  </div>
                  {tab === "history" && history.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (typeof window !== "undefined" && window.confirm("Clear playback history?")) {
                          clearHistory();
                        }
                      }}
                      className="text-xs text-white/50 hover:text-white"
                    >
                      Clear history
                    </Button>
                  )}
                </div>

                {/* History in-tab real-time search bar */}
                {tab === "history" && history.length > 0 && (
                  <div className="relative flex items-center w-full">
                    <Search className="absolute left-3.5 h-4 w-4 text-white/40 pointer-events-none" />
                    <input
                      type="text"
                      value={historyQuery}
                      onChange={(e) => setHistoryQuery(e.target.value)}
                      placeholder="Search listening history..."
                      className="w-full rounded-xl bg-white/[0.06] border border-white/10 pl-10 pr-9 py-2 text-sm text-white placeholder-white/40 focus:border-white/20 focus:ring-1 focus:ring-white/10 focus:bg-white/[0.08] focus:outline-none transition-all"
                    />
                    {historyQuery && (
                      <button
                        type="button"
                        onClick={() => setHistoryQuery("")}
                        className="absolute right-2.5 p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                        title="Clear history search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}

                <TrackList
                  tracks={visible}
                  currentId={current?.id}
                  isPlaying={player.isPlaying}
                  likedIds={likedIds}
                  dislikedIds={dislikedIds}
                  downloadedIds={downloadedIds}
                  downloadingIds={downloadingIds}
                  onDownload={(track) => void handleDownload(track)}
                  onRemoveDownload={(track) => void handleRemoveDownload(track)}
                  onPlay={(track, i) => {
                    if (current?.id === track.id) {
                      if (player.isPlaying) {
                        pause();
                      } else {
                        play();
                      }
                      return;
                    }
                    startQueue(visible, i);
                  }}
                  onToggleLike={handleToggleLike}
                  onToggleDislike={(track) => {
                    toggleDislike(track);
                    setRecs((prev) => prev.filter((t) => t.id !== track.id));
                  }}
                  onArtistClick={openArtist}
                  playlists={playlists}
                  onAddToPlaylist={handleAddToPlaylist}
                  onAddToQueue={(track) => enqueue([track])}
                  onCreatePlaylistWith={(track) => setCreatePlaylistTrack(track)}
                  emptyMessage={
                    tab === "likes"
                      ? "Tap the heart on any song to save your favourites."
                      : historyQuery
                        ? `No songs found matching "${historyQuery}" in your history.`
                        : "Songs you listen to will appear here."
                  }
                />
              </div>
            )}
          </div>
        </ErrorBoundary>
      </main>
      </div>

      {/* Mini Player — docked above bottom nav when a track is loaded */}
      {current && (
        <MiniPlayer
          track={current}
          isPlaying={player.isPlaying}
          isLoading={player.isLoading}
          liked={likedIds.has(current?.id ?? "")}
          position={player.position}
          duration={player.duration}
          onTogglePlay={togglePlay}
          onToggleLike={() => current && handleToggleLike(current)}
          onNext={goNext}
          onPrevious={goPrev}
          onOpenPlayer={() => setShowFullScreen(true)}
          onOpenEqualizer={() => setShowEqualizer(true)}
          onSeek={(s) => player.seek(s)}
        />
      )}

      {/* Floating Picture-in-Picture Mini Player */}
      {showFloatingMini && !showFullScreen && current && (
        <FloatingMiniPlayer
          track={current}
          isPlaying={player.isPlaying}
          isLoading={player.isLoading}
          liked={likedIds.has(current?.id ?? "")}
          position={player.position}
          duration={player.duration}
          volume={volume}
          onTogglePlay={togglePlay}
          onToggleLike={() => current && handleToggleLike(current)}
          onNext={goNext}
          onPrevious={goPrev}
          onSeek={(s) => player.seek(s)}
          onVolumeChange={(v) => {
            setVolume(v);
            applyVolume(v);
          }}
          onOpenFullScreen={() => {
            setShowFloatingMini(false);
            setShowFullScreen(true);
          }}
          onClose={() => setShowFloatingMini(false)}
        />
      )}

      {/* 5-Tab Bottom Navigation */}
      <MobileNav
        activeTab={tab}
        onNavigate={setTab}
        hasTrack={!!current}
      />

      {/* SUSPENSE-WRAPPED CODE-SPLIT MODALS & PANELS */}
      <Suspense fallback={null}>
        {/* FULL SCREEN PLAYER MODAL */}
        {showFullScreen && (
          <FullScreenPlayer
            track={current ?? null}
            isPlaying={player.isPlaying}
            isLoading={player.isLoading}
            liked={likedIds.has(current?.id ?? "")}
            position={player.position}
            duration={player.duration}
            volume={volume}
            playbackSpeed={player.playbackSpeed}
            playlistName={tab === "podcasts" ? "Podcasts" : tab === "languages" ? "Languages" : "My Favourites"}
            shuffle={shuffle}
            repeatMode={repeatMode}
            onToggleShuffle={toggleShuffle}
            onToggleRepeat={toggleRepeat}
            onTogglePlay={togglePlay}
            onToggleLike={() => current && handleToggleLike(current)}
            onNext={goNext}
            onPrevious={goPrev}
            onSeek={(s) => player.seek(s)}
            onSkipForward={player.skipForward}
            onSkipBackward={player.skipBackward}
            onSpeedChange={player.setSpeed}
            onVolumeChange={(v) => {
              setVolume(v);
              applyVolume(v);
            }}
            onClose={() => setShowFullScreen(false)}
            onOpenQueue={() => setShowQueue((v) => !v)}
            isQueueOpen={showQueue}
            onOpenLyrics={() => setShowLyrics(true)}
            onOpenSleepTimer={() => setShowSleepTimer(true)}
            onOpenEqualizer={() => setShowEqualizer(true)}
            onOpenPip={() => {
              setShowFullScreen(false);
              setShowFloatingMini(true);
            }}
            onOpenShortcuts={() => setShowShortcuts(true)}
            onOpenOptions={(t) => setOptionsTrack(t)}
            onAddToPlaylist={(t) => setCreatePlaylistTrack(t)}
            canNext={canNext}
            canPrevious={canPrev}
          />
        )}

        {/* SONG OPTIONS BOTTOM SHEET */}
        <SongOptionsModal
          open={!!optionsTrack}
          track={optionsTrack}
          isLiked={likedIds.has(optionsTrack?.id ?? "")}
          isDownloaded={downloadedIds.has(optionsTrack?.id ?? "")}
          onClose={() => setOptionsTrack(null)}
          onToggleLike={(t) => handleToggleLike(t)}
          onAddToPlaylist={(t) => setCreatePlaylistTrack(t)}
          onDownload={(t) =>
            downloadedIds.has(t.id) ? void handleRemoveDownload(t) : void handleDownload(t)
          }
          onAddToQueue={(t) => enqueue([t])}
          onOpenSleepTimer={() => setShowSleepTimer(true)}
          onGoToArtist={(artist) => openArtist(artist)}
          onShare={(t) => setShareTrack(t)}
          onDeleteFromLibrary={(t) => {
            if (likedIds.has(t.id)) handleToggleLike(t);
          }}
        />

        {/* SLEEP TIMER MODAL */}
        <SleepTimerModal
          open={showSleepTimer}
          volume={volume}
          onVolumeChange={(v) => {
            setVolume(v);
            applyVolume(v);
          }}
          onClose={() => setShowSleepTimer(false)}
          onSleep={() => {
            sleepTimerHaltedRef.current = true;
            pause();
            setMessage("Sleep timer ended — playback stopped.");
            setTimeout(() => setMessage(null), 5000);
          }}
        />

        {/* SHARE SONG MODAL */}
        <ShareModal
          open={!!shareTrack}
          track={shareTrack}
          onClose={() => setShareTrack(null)}
        />

        {/* ADD TO PLAYLIST MODAL */}
        <AddToPlaylistModal
          open={!!createPlaylistTrack}
          track={createPlaylistTrack}
          playlists={playlists}
          onClose={() => setCreatePlaylistTrack(null)}
          onCreatePlaylist={(name, tracks) => {
            createPlaylist(name, tracks ?? (createPlaylistTrack ? [createPlaylistTrack] : []));
            setMessage(`Created playlist "${name}"`);
            setTimeout(() => setMessage(null), 3000);
          }}
          onAddToPlaylist={(playlistId, track) => {
            handleAddToPlaylist(playlistId, track);
            const pl = playlists.find((p) => p.id === playlistId);
            setMessage(`Added to "${pl?.name ?? "playlist"}"`);
            setTimeout(() => setMessage(null), 3000);
          }}
        />

        {/* LYRICS PANEL */}
        {showLyrics && current && (
          <LyricsPanel
            trackId={current.id}
            trackTitle={current.title}
            trackArtist={current.artist}
            currentTime={player.position}
            isPlaying={player.isPlaying}
            onSeek={(s) => player.seek(s)}
            onClose={() => setShowLyrics(false)}
          />
        )}

        {/* 10-BAND AUDIO EQUALIZER & FX MODAL */}
        <EqualizerModal
          open={showEqualizer}
          onOpenChange={setShowEqualizer}
          settings={player.equalizerSettings}
          onPresetChange={player.setEqualizerPreset}
          onBandGainChange={player.setBandGain}
          onToggleEnabled={player.toggleEqualizer}
          onCrossfadeChange={player.setCrossfadeDuration}
          onQualityChange={player.setAudioQuality}
        />

        {/* SETTINGS & AI RECOMMENDATION TUNING MODAL */}
        <SettingsModal
          open={showSettings}
          onOpenChange={setShowSettings}
          settings={settings}
          onUpdateSettings={updateSettings}
          onResetSettings={resetSettings}
          onApplyRecs={() => void loadRecommendations()}
          recLoading={recLoading}
          onOpenLanguages={() => setTab("languages")}
          continuous={continuous}
          onContinuousChange={(v) => {
            setContinuous(v);
            localStorage.setItem("melodymap.continuous.v1", String(v));
          }}
          onOpenEqualizer={() => setShowEqualizer(true)}
          onOpenSleepTimer={() => setShowSleepTimer(true)}
          onOpenShortcuts={() => setShowShortcuts(true)}
          crossfade={player.equalizerSettings.crossfade}
          onCrossfadeChange={player.setCrossfadeDuration}
          userId={auth.userId}
          userEmail={auth.email}
          userProfile={auth.profile}
          onUpdateProfile={auth.updateProfile}
          onUpdatePassword={auth.updatePassword}
          onSignOut={auth.signOut}
          onLibraryRestored={() => {
            setShowSettings(false);
            void loadRecommendations();
          }}
        />

        {/* IN-APP MODAL AUTH (LOGIN, SIGN UP & ACCOUNT PROFILE) */}
        <AuthModal
          open={showAuthModal}
          onOpenChange={setShowAuthModal}
          defaultMode={auth.userId ? "profile" : "signin"}
        />


        {/* NEW USER ONBOARDING MODAL (SONG LANGUAGES & FAVOURITE ARTISTS) */}
        <OnboardingModal
          open={showOnboarding}
          onOpenChange={setShowOnboarding}
          currentLanguages={settings.languages}
          currentArtists={settings.artists}
          onSave={(data) => {
            updateSettings({ languages: data.languages, artists: data.artists });
            if (typeof window !== "undefined") {
              localStorage.setItem("melodymap.onboarded.v1", "true");
            }
            setShowOnboarding(false);
            setMessage("Preferences saved! Loading your personalized music...");
            setTimeout(() => setMessage(null), 3500);
            void loadRecommendations();
          }}
          onOpenSettings={() => {
            setShowOnboarding(false);
            setShowSettings(true);
          }}
        />

        {/* KEYBOARD SHORTCUTS MODAL */}
        <KeyboardShortcutsModal
          open={showShortcuts}
          onOpenChange={setShowShortcuts}
        />
      </Suspense>

      {/* MOBILE QUEUE BOTTOM SHEET (Top stacking order z-[70] over full-screen player and modals) */}
      {showQueue && (
        <MobileQueue
          tracks={queue}
          index={index}
          isPlaying={player.isPlaying}
          onJump={(i) => {
            const target = queue[i];
            if (target) {
              setIndex(i);
              indexRef.current = i;
              loadedTrackIdRef.current = target.id;
              player.seek(0);
              progressTrackerRef.current.reset(target.id);
              void load(target.id, target.previewUrl, 0);
            }
          }}
          onReorder={handleReorderQueue}
          onRemove={(i) => {
            setQueue((prev) => prev.filter((_, x) => x !== i));
            if (i < index) {
              setIndex((x) => Math.max(0, x - 1));
              indexRef.current = Math.max(0, indexRef.current - 1);
            }
          }}
          onClear={() => {
            const cur = currentRef.current;
            if (cur) {
              setQueue([cur]);
              setIndex(0);
              indexRef.current = 0;
            } else {
              setQueue([]);
              setIndex(0);
              indexRef.current = 0;
            }
          }}
          onClose={() => setShowQueue(false)}
        />
      )}
    </div>
  );
}
