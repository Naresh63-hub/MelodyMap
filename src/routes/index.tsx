import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Heart,
  Loader2,
  Maximize2,
  Menu,
  MessageSquare,
  Pause,
  Play,
  Repeat,
  Search,
  Settings2,
  Shuffle,
  SkipBack,
  SkipForward,
  ThumbsDown,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { Equalizer, SpinningArt } from "@/components/music/NowPlayingViz";
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
import { ErrorBoundary } from "@/components/music/ErrorBoundary";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

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
import { QueuePanel } from "@/components/music/QueuePanel";
import { ScrubBar } from "@/components/music/ScrubBar";
import { SleepTimer } from "@/components/music/SleepTimer";
import { TrackList } from "@/components/music/TrackList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

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
  parseDurationSeconds,
  MOODS,
  type Track,
} from "@/lib/library";
import {
  buildMix,
  getRealTrendingTracks,
  getSongRadio,
  newSongs,
  podcastPicks,
  prewarmStreams,
  recommendTracks,
  searchTracks,
  suggestSearch,
  getDailyMix,
} from "@/lib/music.functions";
import { formatTime, useAudioPlayer } from "@/lib/use-audio-player";
import { useMediaSession } from "@/lib/use-media-session";
import { getBlob, listDownloads, removeDownload, saveDownload, type DownloadInfo } from "@/lib/offline";
import { cn } from "@/lib/utils";
import { areSameTrack, trackExistsIn, dedupeTracks } from "@/lib/track-dedup";
import type { TrackLike } from "@/lib/track-dedup";
import { contextEngine, applyDiscoveryDistribution } from "@/lib/context-engine";
import { runStartupMigrations } from "@/lib/startup-migration";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

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

function MusicApp() {
  const navigate = useNavigate();
  const runSearch = useServerFn(searchTracks);
  const runRecommend = useServerFn(recommendTracks);
  const runTrending = useServerFn(getRealTrendingTracks);
  const runMix = useServerFn(buildMix);
  const runNewSongs = useServerFn(newSongs);
  const runPodcastPicks = useServerFn(podcastPicks);
  const runSuggest = useServerFn(suggestSearch);
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
        // OAuth tokens present in URL, let Supabase auth listener process them
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

  // Cached home feed loaded synchronously for instant 0ms startup without flashing
  const [cachedFeed] = useState(() => readHomeCache());

  // --- UI state ---
  const [tab, setTab] = useState<NavTab>("foryou");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [librarySection, setLibrarySection] = useState<null | "liked" | "history" | "playlists" | "downloads">(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchContinuation, setSearchContinuation] = useState<string | undefined>(undefined);
  const searchPageRef = useRef<number>(1);
  const [loadingMoreSearch, setLoadingMoreSearch] = useState(false);
  const [searchFilter, setSearchFilter] = useState<SearchFilter>("all");
  const [recs, setRecs] = useState<Track[]>(() => cachedFeed.recs || []);
  const [trendingList, setTrendingList] = useState<Track[]>(() => cachedFeed.trendingList || []);
  const [recLoading, setRecLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [volume, setVolume] = useState(() => {
    if (typeof window === "undefined") return 80;
    const saved = localStorage.getItem("melodymap.volume.v1");
    return saved ? Math.min(100, Math.max(0, Number(saved) || 80)) : 80;
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [continuous, setContinuous] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("melodymap.continuous.v1");
    return saved !== null ? saved === "true" : true;
  });
  const [extending, setExtending] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [mix, setMix] = useState<MixId>("discover");
  const [mixTracks, setMixTracks] = useState<
    Record<"discover" | "newrelease" | "explore", Track[]>
  >(() => cachedFeed.mixTracks || { discover: [], newrelease: [], explore: [] });
  const [mixLoading, setMixLoading] = useState(false);
  const [dailyMixTracks, setDailyMixTracks] = useState<Track[]>(() => cachedFeed.dailyMixTracks || []);
  const [dailyMixLoading, setDailyMixLoading] = useState(false);
  const [podcastTracks, setPodcastTracks] = useState<Track[]>([]);

  const [podcastLoading, setPodcastLoading] = useState(false);
  const [selectedPodcastTopic, setSelectedPodcastTopic] = useState<string>("All");
  const [podcastQuery, setPodcastQuery] = useState("");
  const [podcastSearching, setPodcastSearching] = useState(false);
  const [podcastSearchResults, setPodcastSearchResults] = useState<Track[] | null>(null);
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
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [showClearHistory, setShowClearHistory] = useState(false);
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
  const mixTracksRef = useRef<Record<"discover" | "newrelease" | "explore", Track[]>>(mixTracks);
  mixTracksRef.current = mixTracks;
  const likedIds = useMemo(() => new Set(likes.map((t) => t.id)), [likes]);
  const dislikedIds = useMemo(() => new Set(dislikes.map((t) => t.id)), [dislikes]);
  const dislikedIdsRef = useRef(dislikedIds);
  dislikedIdsRef.current = dislikedIds;
  const canPrev = queue.length > 0;
  const canNext = queue.length > 0 || recs.length > 0 || trendingList.length > 0;
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

  // --- Player ---
  const player = useAudioPlayer({
    onSponsorBlockSkipped: (category) => {
      const label = category === "sponsor" ? "Sponsor pitch" : category === "intro" ? "Intro" : category === "outro" ? "Outro" : category;
      setMessage(`SponsorBlock: Skipped ${label}`);
      setTimeout(() => setMessage(null), 3000);
    },
    getNextTrack: () => {

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
    onEnded: () => {
      const track = currentRef.current;
      if (track) {
        logComplete(track);
        contextEngine.recordCompletion(track, previousTrackRef.current);
        previousTrackRef.current = track;
      }

      // Repeat One Mode: replay current song
      if (repeatModeRef.current === "one" && track) {
        player.seek(0);
        player.play();
        return;
      }

      const q = queueRef.current;
      const i = indexRef.current;
      const loopMode = repeatModeRef.current === "all" || continuousRef.current;
      const nextIdx = findNextValidTrackIndex(q, i, loopMode);

      if (nextIdx !== -1) {
        indexRef.current = nextIdx;
        setIndex(nextIdx);
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
          } else {
            player.pause();
          }
        });
        return;
      }

      player.pause();
    },
    onError: (msg) => {
      console.warn("[Player] Stream notice:", msg);
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

  const togglePlay = useCallback(() => {
    if (!current) return;
    if (player.isPlaying) {
      pause();
    } else {
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

  const startQueue = useCallback(
    (tracks: Track[], startIndex = 0) => {
      if (tracks.length === 0) return;
      const dq = dedupeTracks(tracks);
      setQueue(dq);
      const targetId = tracks[startIndex]?.id;
      const newIdx = targetId ? dq.findIndex((t) => t.id === targetId) : 0;
      const safeIdx = newIdx !== -1 ? newIdx : 0;
      setIndex(safeIdx);

      const targetTrack = dq[safeIdx] || tracks[startIndex];
      if (targetTrack?.id) {
        // Synchronously initiate audio load inside user click gesture for instant playback (<50ms)
        loadedTrackIdRef.current = targetTrack.id;
        void load(targetTrack.id, targetTrack.previewUrl);
      }
    },
    [load],
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
          const ranked = contextEngine.rankTracks(dedupeTracks(pureMusic), currentRef.current);
          setMixTracks((prev) => ({ ...prev, [kind]: ranked }));
        }
      } finally {
        setMixLoading(false);
      }
    },
    [runMix, likes, history, stats, settings],
  );

  const loadTrending = useCallback(async () => {
    try {
      const res = await runTrending({
        data: {
          languages: settings.languages,
          count: 24,
          refreshNonce: Date.now(),
        },
      });
      if (res.tracks) {
        const pureMusic = res.tracks as Track[];
        const ranked = contextEngine.rankTracks(dedupeTracks(pureMusic), currentRef.current);
        setTrendingList(ranked);
        writeHomeCache({ trendingList: ranked });
      }
    } catch {}
  }, [runTrending, settings.languages]);

  const loadDailyMix = useCallback(
    async (refreshNonce?: number | string) => {
      setDailyMixLoading(true);
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
          const ranked = contextEngine.rankTracks(dedupeTracks(pureMusic), currentRef.current);
          setDailyMixTracks(ranked);
          writeHomeCache({ dailyMixTracks: ranked });
        }
      } catch {}
      finally {
        setDailyMixLoading(false);
      }
    },
    [runDailyMix, settings.languages, stats, likes],
  );

  const loadRecommendations = useCallback(
    async (mood?: string) => {
      setRecLoading(true);
      const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const clientHour = new Date().getHours();
      const affinity = contextEngine.getAffinityWeights(stats);

      try {
        await Promise.allSettled([
          (async () => {
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
                refreshNonce: nonce,
                discovery: settings.discovery ?? 40,
                affinityArtists: affinity.affinityArtists,
                penalizedArtists: affinity.penalizedArtists,
                clientHour,
              },
            });
            if (res.tracks) {
              const pureMusic = res.tracks as Track[];
              const ranked = contextEngine.rankTracks(dedupeTracks(pureMusic), currentRef.current);
              const distributed = applyDiscoveryDistribution(ranked, affinity.affinityArtists, settings.discovery ?? 40);
              setRecs(distributed);
              writeHomeCache({ recs: distributed });
            }
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
              const ranked = contextEngine.rankTracks(dedupeTracks(pureMusic), currentRef.current);
              setTrendingList(ranked);
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
              const ranked = contextEngine.rankTracks(dedupeTracks(pureMusic), currentRef.current);
              setMixTracks((prev) => {
                const next = { ...prev, newrelease: ranked };
                writeHomeCache({ mixTracks: next });
                return next;
              });
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
    [runRecommend, runTrending, runMix, loadDailyMix, likes, history, dislikes, stats, settings],
  );

  const loadMoreRecommendations = useCallback(
    async (mood?: string) => {
      if (loadingMoreRecs) return;
      setLoadingMoreRecs(true);
      try {
        const clientHour = new Date().getHours();
        const affinity = contextEngine.getAffinityWeights(stats);
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
            refreshNonce: Date.now(),
            discovery: settings.discovery ?? 40,
            affinityArtists: affinity.affinityArtists,
            penalizedArtists: affinity.penalizedArtists,
            clientHour,
          },
        });
        if (res.tracks && res.tracks.length > 0) {
          const pureMusic = res.tracks as Track[];
          const ranked = contextEngine.rankTracks(pureMusic, currentRef.current);
          setRecs((prev) => dedupeTracks([...prev, ...ranked]));
        }
      } finally {
        setLoadingMoreRecs(false);
      }
    },
    [loadingMoreRecs, runRecommend, likes, history, dislikes, stats, settings],
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
            const pureMusic = radioRes.tracks as Track[];
            const ranked = contextEngine.rankTracks(dedupeTracks(pureMusic), currentTrack);
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
        const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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
          const pureMusic = res.tracks as Track[];
          const ranked = contextEngine.rankTracks(dedupeTracks(pureMusic), currentTrack);
          candidateTracks = ranked.filter(
            (t) => !trackExistsIn(currentQueue, t as TrackLike) && !dislikedIdsRef.current.has(t.id),
          );
        }
      }

      // 3. Fallback to cached pool if still empty
      if (candidateTracks.length === 0) {
        const pool = dedupeTracks([
          ...recsRef.current,
          ...trendingRef.current,
          ...(mixTracksRef.current?.discover || []),
          ...(mixTracksRef.current?.newrelease || []),
        ]);
        const rankedPool = contextEngine.rankTracks(pool, currentTrack);
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
  }, [extending, runRecommend, likes, history, dislikes, stats, settings]);

  const searchFor = useCallback(
    async (term: string, searchType?: "songs" | "podcasts", filter?: SearchFilter) => {
      if (!term.trim()) return;
      const t = searchType ?? "songs";
      const f = filter ?? "all";
      setTab("search");
      setShowSuggestions(false);
      setSearching(true);
      setSearchContinuation(undefined);
      searchPageRef.current = 1;
      setQuery(term);
      setMessage(null);
      try {
        const res = await runSearch({
          data: {
            query: term.trim(),
            limit: 50,
            type: t,
            filter: f,
            page: 1,
            offset: 0,
          },
        });
        if (res.error) setMessage(res.error);
        if (res.tracks) {
          const raw = res.tracks as Track[];
          const filtered = t === "songs" ? raw : raw.filter(isPodcastTrack);
          setResults(dedupeTracks(filtered));
          setSearchContinuation(res.continuation);
        }
      } finally {
        setSearching(false);
      }
    },
    [runSearch],
  );

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
        setResults((prev) => dedupeTracks([...prev, ...raw]));
      }
      setSearchContinuation(res.continuation);
    } catch {
      setMessage("Could not load more results");
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setLoadingMoreSearch(false);
    }
  }, [searchContinuation, loadingMoreSearch, query, searchFilter, runSearch, results.length]);

  const openArtist = useCallback(
    (artist: string) => {
      setQuery(artist);
      void searchFor(`${artist} songs`);
    },
    [searchFor],
  );

  const goNext = useCallback(() => {
    const currentTrack = currentRef.current;
    if (currentTrack) {
      if (player.position > 0 && player.position < 25) {
        logSkip(currentTrack);
        contextEngine.recordSkip(currentTrack);
      }
      previousTrackRef.current = currentTrack;
    }

    const q = queueRef.current;
    const i = indexRef.current;
    const nextIdx = findNextValidTrackIndex(q, i, false);

    // 1. If next non-disliked track already exists in queue, advance immediately
    if (nextIdx !== -1) {
      indexRef.current = nextIdx;
      setIndex(nextIdx);
      if (nextIdx + 3 >= q.length) {
        void extendQueue();
      }
      return;
    }

    // 2. Queue reached the end: find unplayed tracks from recs, trending, or mixTracks
    const pool = dedupeTracks([
      ...recsRef.current,
      ...trendingRef.current,
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
      }
    });
  }, [extendQueue, findNextValidTrackIndex, logSkip, player.position]);

  const goPrev = useCallback(() => {
    const q = queueRef.current;
    const i = indexRef.current;
    if (i > 0) {
      setIndex(i - 1);
    } else if (q.length > 0) {
      setIndex(q.length - 1); // Loop to last track
    }
  }, []);

  const dislikeCurrent = useCallback(() => {
    const track = currentRef.current;
    if (!track) return;
    logSkip(track);
    contextEngine.recordSkip(track);
    toggleDislike(track);
    setRecs((prev) => prev.filter((t) => t.id !== track.id));
    goNext();
  }, [toggleDislike, logSkip, goNext]);

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

  const onSearch = (event: React.FormEvent) => {
    event.preventDefault();
    void searchFor(query);
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

  const loadPodcasts = useCallback(
    async (topic?: string) => {
      setPodcastLoading(true);
      setPodcastSearchResults(null);
      setPodcastQuery("");
      const chosenTopic = topic !== undefined ? topic : selectedPodcastTopic;
      if (topic !== undefined) setSelectedPodcastTopic(topic);
      try {
        const topicsList =
          chosenTopic === "All"
            ? (settings.podcastTopics.length > 0 ? settings.podcastTopics : ["Tech", "Motivation", "Science", "Comedy"])
            : [chosenTopic];
        const res = await runPodcastPicks({
          data: {
            topics: topicsList,
            languages: settings.languages,
            artists: topArtists(stats, likes),
            count: 16,
          },
        });
        if (res.tracks) setPodcastTracks(res.tracks as Track[]);
      } finally {
        setPodcastLoading(false);
      }
    },
    [runPodcastPicks, selectedPodcastTopic, settings, stats, likes],
  );

  const handlePodcastSearch = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const term = podcastQuery.trim();
      if (!term) return;
      setPodcastSearching(true);
      try {
        const q = term.toLowerCase().includes("podcast") ? term : `${term} podcast`;
        const res = await runSearch({
          data: {
            query: q,
            limit: 30,
            type: "podcasts",
            filter: "all",
          },
        });
        if (res.tracks) {
          setPodcastSearchResults(res.tracks as Track[]);
        }
      } catch {
        // ignore
      } finally {
        setPodcastSearching(false);
      }
    },
    [podcastQuery, runSearch],
  );

  const clearPodcastSearch = useCallback(() => {
    setPodcastQuery("");
    setPodcastSearchResults(null);
  }, []);

  useEffect(() => {
    if (tab !== "podcasts") return;
    if (podcastTracks.length > 0) return; // already loaded
    void loadPodcasts();
  }, [tab, podcastTracks.length, loadPodcasts]);

  const restored = useRef(false);
  const resumeRef = useRef<number | null>(null);

  // Restore last playing track, queue, and seek position on mount / page refresh
  useEffect(() => {
    if (restored.current || !player.ready) return;
    restored.current = true;
    try {
      const saved = readPlayback();
      if (saved && Array.isArray(saved.queue) && saved.queue.length > 0) {
        setQueue(saved.queue);
        const safeIndex = Math.min(Math.max(0, saved.index || 0), saved.queue.length - 1);
        setIndex(safeIndex);
        const savedPos = typeof saved.position === "number" && !isNaN(saved.position) ? saved.position : 0;
        resumeRef.current = savedPos;
        setResumed(true);
        const targetTrack = saved.queue[safeIndex];
        if (targetTrack) {
          loadedTrackIdRef.current = targetTrack.id;
          if (saved.isPlaying) {
            void load(targetTrack.id, targetTrack.previewUrl, savedPos);
          } else {
            cue(targetTrack.id, savedPos, targetTrack.previewUrl);
          }
        }
      } else {
        setResumed(true);
      }
    } catch {
      setResumed(true);
    }
  }, [player.ready, load, cue]);

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
  }, [current?.id, player.ready, load, cue]);

  const isPlayingRef = useRef(player.isPlaying);
  isPlayingRef.current = player.isPlaying;
  const playerPositionRef = useRef(player.position);
  playerPositionRef.current = player.position;

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

    // Auto-refresh recommendations on startup ONLY if the local feed cache is empty.
    // If the user already has cached picks, show them instantly without network delay or flashing.
    const hasCachedFeed =
      (cachedFeed.recs && cachedFeed.recs.length > 0) ||
      (cachedFeed.trendingList && cachedFeed.trendingList.length > 0);
    if (!hasCachedFeed) {
      void loadRecommendations();
    }
  }, [hydrated, cachedFeed, loadRecommendations]);

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
      void loadRecommendations();
    }
  }, [hydrated, settings.languages, loadRecommendations]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void runSuggest({ data: { query: term } }).then((res) => {
        if (!cancelled) setSuggestions(res.suggestions);
      });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, runSuggest]);

  useMediaSession(current, player.isPlaying, player.position, player.duration, {
    onPlay: () => player.play(),
    onPause: () => player.pause(),
    onNext: goNext,
    onPrev: goPrev,
    onSeek: (s: number) => player.seek(s),
  });


  // --- Track list for each tab ---
  const listForTab: Record<string, Track[]> = useMemo(
    () => ({
      likes,
      history,
      search: results,
      foryou: recs,
    }),
    [likes, history, results, recs],
  );
  const visible = listForTab[tab] ?? [];

  // Mobile library sub-view navigation
  const handleMobileLibraryNav = useCallback((section: null | "liked" | "history" | "playlists" | "downloads") => {
    setLibrarySection(section);
    if (section === "liked") setTab("likes");
    else if (section === "history") setTab("history");
    else if (section === "playlists") setTab("playlists");
  }, []);

  return (
    <div className="flex flex-col h-dvh bg-[#0a0a10] text-foreground selection:bg-pink-500/30 overflow-hidden w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl mx-auto shadow-2xl relative border-x border-white/[0.04]">
      {/* Slide-out Mobile Sidebar Drawer */}
      <MobileDrawer
        open={drawerOpen}
        activeTab={tab}
        onClose={() => setDrawerOpen(false)}
        onNavigate={(t) => {
          setTab(t);
          setLibrarySection(null);
        }}
        onOpenSettings={() => {
          setDrawerOpen(false);
          setShowSettings(true);
        }}
        isSynced={!!auth.userId}
        userName={auth.profile?.display_name ?? auth.email?.split("@")[0] ?? "Listener"}
        userInitial={auth.email?.[0]?.toUpperCase() ?? "L"}
        userAvatar={auth.profile?.avatar_url ?? null}
        onSignIn={() => {
          setDrawerOpen(false);
          void navigate({ to: "/auth" });
        }}
        onSignOut={async () => {
          await auth.signOut();
          setMessage("Signed out successfully");
          setTimeout(() => setMessage(null), 3000);
        }}
      />

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#0a0a10]">
        {/* Mobile header — on all non-search tabs */}
        {tab !== "search" && (
          <MobileHeader
            onOpenMenu={() => setDrawerOpen(true)}
            onOpenSettings={() => setShowSettings((v) => !v)}
          />
        )}

        {/* Mobile search bar — on search tab */}
        {tab === "search" && (
          <div className="sticky top-0 z-20 bg-[#0a0a10]/95 backdrop-blur-lg border-b border-white/[0.04]">
            <div className="flex items-center gap-2 px-4 py-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open menu"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] border border-white/10 text-white/70 active:scale-95 transition-all"
              >
                <Menu className="h-5 w-5" />
              </button>
              <form onSubmit={onSearch} className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  id="main-search-input"
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  placeholder="Search songs, artists, podcasts..."
                  className="h-10 w-full rounded-full border border-white/10 bg-white/[0.04] pl-10 pr-9 text-sm text-white placeholder:text-white/30 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 focus:outline-none"
                  autoComplete="off"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setResults([]);
                      setSuggestions([]);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 active:text-white/60"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </form>
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                aria-label="Settings"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] border border-white/10 text-white/50 active:scale-95 transition-all hover:text-white"
              >
                <Settings2 className="h-4 w-4" />
              </button>
            </div>
            {/* Quick filter chips */}
            <div className="flex gap-1.5 overflow-x-auto px-4 pb-2.5 scrollbar-hide">
              {["foryou", "mixes", "podcasts", "languages", "likes", "history"].map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id as NavTab)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                    tab === id
                      ? "border-purple-500/50 bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-cyan-500/10 text-white font-medium"
                      : "border-white/10 bg-white/[0.03] text-white/40 hover:text-white/70",
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
                  <div className="flex items-center gap-3 rounded-full border border-white/10 bg-[#1a1a2e]/95 px-5 py-2.5 shadow-2xl backdrop-blur-md">
                    <p className="text-xs font-medium text-white/80">
                      {message}
                    </p>
                    {undoLabel && (
                      <button
                        type="button"
                        onClick={handleUndo}
                        className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors"
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
                      <h1 className="text-2xl font-bold tracking-tight text-white">
                        Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {auth.profile?.display_name?.split(" ")[0] || "Listener"} 👋
                      </h1>
                      <p className="text-xs text-white/40 mt-0.5">Your personalized feed based on your mood & tastes</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="rounded-full bg-white/[0.06] text-white/70 hover:bg-white/10 hover:text-white border-white/10"
                        onClick={() => void loadRecommendations()}
                        disabled={recLoading}
                      >
                        {recLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                        Refresh picks
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
                        className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs text-white/50 transition-all hover:border-purple-500/30 hover:bg-purple-500/10 hover:text-white/80"
                      >
                        {mood}
                      </button>
                    ))}
                  </div>

                  {/* Home Sections — mobile horizontal scroll */}
                  <MobileHomeSections
                    recentlyPlayed={history.filter(isMusicTrack).slice(0, 12)}
                    dailyMix={dailyMixTracks}
                    trending={trendingList.length > 0 ? trendingList : recs.slice(0, 12)}
                    newReleases={mixTracks.newrelease.slice(0, 12)}
                    recommended={recs}
                    onPlayTrack={(track, sectionTracks, i) => {
                      if (current?.id === track.id && player.isPlaying) {
                        pause();
                        return;
                      }
                      startQueue(sectionTracks, i);
                    }}
                    onToggleLike={toggleLike}
                    onOpenOptions={(t) => setOptionsTrack(t)}
                    likedIds={likedIds}
                    currentId={current?.id ?? null}
                    isPlaying={player.isPlaying}
                    loading={recLoading && recs.length === 0}
                  />


                {/* Explore More Songs for low-bandwidth incremental discovery */}
                {recs.length > 0 && (
                  <div className="flex justify-center pt-2 pb-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void loadMoreRecommendations()}
                      disabled={loadingMoreRecs}
                      className="rounded-full border-white/15 bg-white/[0.04] px-5 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-all shadow-md"
                    >
                      {loadingMoreRecs ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin text-purple-400" /> : null}
                      Explore more songs
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* SEARCH TAB */}
            {tab === "search" && (
              <SearchResults
                results={results}
                loading={searching}
                query={query}
                selectedFilter={searchFilter}
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
                onToggleLike={toggleLike}
                onOpenOptions={(t) => setOptionsTrack(t)}
                likedIds={likedIds}
                currentId={current?.id ?? null}
                isPlaying={player.isPlaying}
                onClear={() => {
                  setQuery("");
                  setResults([]);
                  setSuggestions([]);
                  setSearchContinuation(undefined);
                }}
                onSearch={(q, type) => {
                  setQuery(q);
                  setSearchFilter("all");
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
                onToggleLike={toggleLike}
                onToggleDislike={toggleDislike}
                onArtistClick={openArtist}
                onAddToPlaylist={addToPlaylist}
                onAddToQueue={(track) => enqueue([track])}
                onCreatePlaylistWith={(track) => {
                  setCreatePlaylistTrack(track);
                }}
              />
            )}

            {/* PODCASTS TAB */}
            {tab === "podcasts" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">Podcasts</h2>
                    <p className="text-xs text-white/40 mt-0.5">Discover shows based on your interests</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-full bg-white/[0.06] text-white/70 hover:bg-white/10 hover:text-white border-white/10"
                    onClick={() => void loadPodcasts()}
                    disabled={podcastLoading || podcastSearching}
                  >
                    {podcastLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                    Refresh
                  </Button>
                </div>

                {/* Podcast In-Tab Search */}
                <form onSubmit={handlePodcastSearch} className="relative flex items-center w-full">
                  <Search className="absolute left-3.5 h-4 w-4 text-white/40 pointer-events-none" />
                  <input
                    type="text"
                    value={podcastQuery}
                    onChange={(e) => {
                      setPodcastQuery(e.target.value);
                      if (!e.target.value.trim() && podcastSearchResults !== null) {
                        setPodcastSearchResults(null);
                      }
                    }}
                    placeholder="Search podcast shows, episodes, creators..."
                    className="w-full rounded-xl bg-white/[0.06] border border-white/10 pl-10 pr-24 py-2 text-sm text-white placeholder-white/40 focus:border-purple-500/60 focus:bg-white/[0.08] focus:outline-none transition-all"
                  />
                  <div className="absolute right-1.5 flex items-center gap-1">
                    {podcastQuery && (
                      <button
                        type="button"
                        onClick={clearPodcastSearch}
                        className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                        title="Clear search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <Button
                      type="submit"
                      size="sm"
                      disabled={podcastSearching || !podcastQuery.trim()}
                      className="h-7 px-3 text-xs font-medium rounded-lg bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40"
                    >
                      {podcastSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Search"}
                    </Button>
                  </div>
                </form>

                {podcastSearchResults !== null ? (
                  /* Podcast Search Results View */
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">Results for &ldquo;{podcastQuery}&rdquo;</h3>
                        <span className="text-xs text-purple-300/60 font-medium">({podcastSearchResults.length} episodes)</span>
                      </div>
                      <button
                        type="button"
                        onClick={clearPodcastSearch}
                        className="text-xs text-purple-400 hover:text-purple-300 underline font-medium"
                      >
                        Show Recommended
                      </button>
                    </div>
                    {podcastSearchResults.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-12 text-center">
                        <MessageSquare className="h-10 w-10 text-white/20" />
                        <p className="text-sm text-white/60">No podcast episodes found for &ldquo;{podcastQuery}&rdquo;</p>
                        <Button variant="secondary" size="sm" onClick={clearPodcastSearch} className="mt-2">
                          Clear Search
                        </Button>
                      </div>
                    ) : (
                      <TrackList
                        tracks={podcastSearchResults}
                        currentId={current?.id}
                        isPlaying={player.isPlaying}
                        likedIds={likedIds}
                        dislikedIds={dislikedIds}
                        onPlay={(track, i) => {
                          if (current?.id === track.id) {
                            if (player.isPlaying) {
                              pause();
                            } else {
                              play();
                            }
                            return;
                          }
                          startQueue(podcastSearchResults, i);
                        }}
                        onToggleLike={toggleLike}
                        onToggleDislike={(track) => {
                          toggleDislike(track);
                          setRecs((prev) => prev.filter((t) => t.id !== track.id));
                        }}
                        onArtistClick={openArtist}
                        playlists={playlists}
                        onAddToPlaylist={addToPlaylist}
                        onAddToQueue={(track) => enqueue([track])}
                        onCreatePlaylistWith={(track) => setCreatePlaylistTrack(track)}
                        emptyMessage="No podcasts found."
                      />
                    )}
                  </div>
                ) : (
                  /* Default Recommendations & Topics View */
                  <>
                    {/* Podcast Topic Filter Chips */}
                    <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
                      {["All", "Tech", "Motivation", "Science", "Comedy", "Business", "True Crime", "News", "History", "Health", "Finance"].map((topic) => {
                        const active = selectedPodcastTopic === topic;
                        return (
                          <button
                            key={topic}
                            type="button"
                            onClick={() => void loadPodcasts(topic)}
                            disabled={podcastLoading}
                            className={cn(
                              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs transition-all",
                              active
                                ? "border-purple-500/50 bg-purple-500/20 text-white font-medium shadow-sm shadow-purple-500/20"
                                : "border-white/10 bg-white/[0.03] text-white/50 hover:border-purple-500/30 hover:bg-purple-500/10 hover:text-white/80"
                            )}
                          >
                            {topic}
                          </button>
                        );
                      })}
                    </div>

                    {/* Recently Listened Podcasts */}
                    {podcastHistory.length > 0 && (
                      <div className="space-y-2 pt-1 pb-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-purple-300/70">
                            Continue Listening
                          </h3>
                          <button
                            type="button"
                            onClick={clearPodcastHistory}
                            className="text-[11px] text-white/40 hover:text-white/70"
                          >
                            Clear
                          </button>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 snap-x">
                          {podcastHistory.slice(0, 10).map((ep, i) => (
                            <button
                              key={ep.id}
                              type="button"
                              onClick={() => {
                                if (current?.id === ep.id) {
                                  if (player.isPlaying) {
                                    pause();
                                  } else {
                                    play();
                                  }
                                  return;
                                }
                                startQueue(podcastHistory, i);
                              }}
                              className="w-[140px] shrink-0 snap-start text-left group"
                            >
                              <div className="relative mb-1.5 aspect-video w-full overflow-hidden rounded-xl bg-purple-950/40 border border-purple-500/20">
                                {ep.thumbnail ? (
                                  <img src={ep.thumbnail} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                                ) : (
                                  <div className="flex h-full items-center justify-center">
                                    <MessageSquare className="h-6 w-6 text-purple-400/40" />
                                  </div>
                                )}
                                {current?.id === ep.id && player.isPlaying && (
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                    <div className="flex items-end gap-0.5 h-4">
                                      <div className="w-1 bg-purple-400 animate-bar" />
                                      <div className="w-1 bg-purple-400 animate-bar" style={{ animationDelay: "0.2s" }} />
                                      <div className="w-1 bg-purple-400 animate-bar" style={{ animationDelay: "0.4s" }} />
                                    </div>
                                  </div>
                                )}
                              </div>
                              <p className="truncate text-xs font-semibold text-white/90 leading-tight">{ep.title}</p>
                              <p className="truncate text-[11px] text-purple-300/50 mt-0.5">{ep.artist}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {podcastLoading && podcastTracks.length === 0 ? (
                      <div className="flex flex-col items-center gap-3 py-16 text-white/30">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <p className="text-sm">Finding podcast picks…</p>
                      </div>
                    ) : podcastTracks.length === 0 ? (
                      <div className="flex flex-col items-center gap-3 py-16 text-center">
                        <MessageSquare className="h-12 w-12 text-white/20" />
                        <h3 className="text-lg font-semibold text-white/60">No podcasts yet</h3>
                        <p className="text-sm text-white/40 max-w-xs">
                          Configure your podcast topics in Settings to get personalized picks.
                        </p>
                        <Button variant="secondary" size="sm" className="mt-2" onClick={() => setShowSettings(true)}>
                          Open Settings
                        </Button>
                      </div>
                    ) : (
                      <TrackList
                        tracks={podcastTracks}
                        currentId={current?.id}
                        isPlaying={player.isPlaying}
                        likedIds={likedIds}
                        dislikedIds={dislikedIds}
                        onPlay={(track, i) => {
                          if (current?.id === track.id) {
                            if (player.isPlaying) {
                              pause();
                            } else {
                              play();
                            }
                            return;
                          }
                          startQueue(podcastTracks, i);
                        }}
                        onToggleLike={toggleLike}
                        onToggleDislike={(track) => {
                          toggleDislike(track);
                          setRecs((prev) => prev.filter((t) => t.id !== track.id));
                        }}
                        onArtistClick={openArtist}
                        playlists={playlists}
                        onAddToPlaylist={addToPlaylist}
                        onAddToQueue={(track) => enqueue([track])}
                        onCreatePlaylistWith={(track) => setCreatePlaylistTrack(track)}
                        emptyMessage="Pick topics in Settings to get podcast recommendations."
                      />
                    )}
                  </>
                )}
              </div>
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
                onToggleLike={toggleLike}
                onToggleDislike={toggleDislike}
                onArtistClick={openArtist}
                onAddToPlaylist={addToPlaylist}
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
                  <h2 className="text-xl font-bold text-white">
                    {tab === "likes" ? "Your Favourites" : "Recently Played"}
                  </h2>
                  {tab === "history" && history.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setShowClearHistory(true)} className="text-xs text-white/50 hover:text-white">
                      Clear history
                    </Button>
                  )}
                </div>

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
                  onToggleLike={toggleLike}
                  onToggleDislike={(track) => {
                    toggleDislike(track);
                    setRecs((prev) => prev.filter((t) => t.id !== track.id));
                  }}
                  onArtistClick={openArtist}
                  playlists={playlists}
                  onAddToPlaylist={addToPlaylist}
                  onAddToQueue={(track) => enqueue([track])}
                  onCreatePlaylistWith={(track) => setCreatePlaylistTrack(track)}
                  emptyMessage={
                    tab === "likes"
                      ? "Tap the heart on any song to save your favourites."
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
          onToggleLike={() => current && toggleLike(current)}
          onNext={goNext}
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
          onToggleLike={() => current && toggleLike(current)}
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
        onNavigate={(t) => {
          setTab(t);
          setLibrarySection(null);
        }}
        hasTrack={!!current}
      />

      {/* MOBILE QUEUE BOTTOM SHEET */}
      {showQueue && (
        <MobileQueue
          tracks={queue}
          index={index}
          isPlaying={player.isPlaying}
          onJump={(i) => setIndex(i)}
          onReorder={handleReorderQueue}
          onRemove={(i) => {
            setQueue((prev) => prev.filter((_, x) => x !== i));
            if (i < index) setIndex((x) => Math.max(0, x - 1));
          }}
          onClear={() => {
            setQueue([]);
            setIndex(0);
          }}
          onClose={() => setShowQueue(false)}
        />
      )}

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
            onToggleLike={() => current && toggleLike(current)}
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
            onOpenQueue={() => setShowQueue(true)}
            onOpenLyrics={() => setShowLyrics(true)}
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
          onToggleLike={(t) => toggleLike(t)}
          onAddToPlaylist={(t) => setCreatePlaylistTrack(t)}
          onDownload={(t) =>
            downloadedIds.has(t.id) ? void handleRemoveDownload(t) : void handleDownload(t)
          }
          onAddToQueue={(t) => enqueue([t])}
          onGoToArtist={(artist) => openArtist(artist)}
          onShare={(t) => setShareTrack(t)}
          onDeleteFromLibrary={(t) => {
            if (likedIds.has(t.id)) toggleLike(t);
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
          onSleep={() => pause()}
        />

        {/* SHARE SONG MODAL */}
        <ShareModal
          open={!!shareTrack}
          track={shareTrack}
          onClose={() => setShareTrack(null)}
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
          userId={auth.userId}
          userEmail={auth.email}
          userProfile={auth.profile}
          onUpdateProfile={auth.updateProfile}
          onUpdatePassword={auth.updatePassword}
          onSignOut={auth.signOut}
          onLibraryRestored={() => window.location.reload()}
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
    </div>
  );
}
