import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Heart,
  Loader2,
  Maximize2,
  MessageSquare,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  ThumbsDown,
  Volume2,
  VolumeX,
} from "lucide-react";

import { Equalizer, SpinningArt } from "@/components/music/NowPlayingViz";
import { Sidebar, type NavTab, NAV_ITEMS } from "@/components/music/layout/Sidebar";
import { SearchHeader } from "@/components/music/layout/SearchHeader";
import { HomeSections } from "@/components/music/ui/HomeSections";
import { FullScreenPlayer } from "@/components/music/ui/FullScreenPlayer";
import { LanguagesPanel } from "@/components/music/ui/LanguagesPanel";
import { LyricsPanel } from "@/components/music/ui/LyricsPanel";
import { SearchResults } from "@/components/music/ui/SearchResults";
import { MixesPanel, type MixId } from "@/components/music/MixesPanel";
import { PlaylistsPanel } from "@/components/music/PlaylistsPanel";
import { QueuePanel } from "@/components/music/QueuePanel";
import { RecSettingsPanel } from "@/components/music/RecSettingsPanel";
import { ScrubBar } from "@/components/music/ScrubBar";
import { SleepTimer } from "@/components/music/SleepTimer";
import { TrackList } from "@/components/music/TrackList";
import { Button } from "@/components/ui/button";
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
  MOODS,
  type Track,
} from "@/lib/library";
import {
  buildMix,
  newSongs,
  podcastPicks,
  recommendTracks,
  searchTracks,
  suggestSearch,
} from "@/lib/music.functions";
import { formatTime, useAudioPlayer } from "@/lib/use-audio-player";
import { useMediaSession } from "@/lib/use-media-session";
import { getBlob, listDownloads, removeDownload, saveDownload, type DownloadInfo } from "@/lib/offline";
import { cn } from "@/lib/utils";

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

function MusicApp() {
  const runSearch = useServerFn(searchTracks);
  const runRecommend = useServerFn(recommendTracks);
  const runMix = useServerFn(buildMix);
  const runNewSongs = useServerFn(newSongs);
  const runPodcastPicks = useServerFn(podcastPicks);
  const runSuggest = useServerFn(suggestSearch);

  const auth = useAuth();
  const {
    hydrated,
    likes,
    dislikes,
    history,
    playlists,
    settings,
    stats,
    logSkip,
    logComplete,
    toggleLike,
    toggleDislike,
    logPlay,
    clearHistory,
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

  // --- UI state ---
  const [tab, setTab] = useState<NavTab>("foryou");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [recs, setRecs] = useState<Track[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [volume, setVolume] = useState(80);
  const [showSettings, setShowSettings] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [continuous, setContinuous] = useState(true);
  const [extending, setExtending] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [mix, setMix] = useState<MixId>("discover");
  const [mixTracks, setMixTracks] = useState<
    Record<"discover" | "newrelease" | "explore", Track[]>
  >({ discover: [], newrelease: [], explore: [] });
  const [mixLoading, setMixLoading] = useState(false);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(80);

  // Refresh downloads on mount
  useEffect(() => {
    void listDownloads().then((items: DownloadInfo[]) => {
      setDownloadedIds(new Set(items.map((t: DownloadInfo) => t.track.id)));
    });
  }, []);

  const handleDownload = async (track: Track) => {
    setDownloadingIds((prev) => new Set([...prev, track.id]));
    try {
      const res = await fetch(`/api/stream/${encodeURIComponent(track.id)}`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      await saveDownload(track, blob);
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
  const current = queue[index];
  const currentRef = useRef<Track | undefined>(undefined);
  currentRef.current = current;
  const queueRef = useRef<Track[]>([]);
  queueRef.current = queue;
  const likedIds = useMemo(() => new Set(likes.map((t) => t.id)), [likes]);
  const dislikedIds = useMemo(() => new Set(dislikes.map((t) => t.id)), [dislikes]);
  const canPrev = index > 0;
  const canNext = index + 1 < queue.length;
  const visibleMix = mix === "replay" ? replayTracks : mixTracks[mix];

  // --- Player ---
  const player = useAudioPlayer({
    onEnded: () => {
      const track = currentRef.current;
      if (track) logComplete(track);
      if (index + 1 < queue.length) {
        setIndex(index + 1);
        return;
      }
      if (continuous) void extendQueue();
    },
    onError: (msg) => {
      setMessage(msg);
      setTimeout(() => setMessage(null), 3000);
      if (canNext) goNext();
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

  const startQueue = useCallback(
    (tracks: Track[], startIndex = 0) => {
      if (tracks.length === 0) return;
      setQueue(tracks);
      setIndex(startIndex);
    },
    [],
  );

  const enqueue = useCallback((tracks: Track[]) => {
    setQueue((prev) => [...prev, ...tracks]);
  }, []);

  const loadMix = useCallback(
    async (kind: "discover" | "newrelease" | "explore") => {
      setMixLoading(true);
      try {
        const res = await runMix({
          data: {
            kind,
            liked: likes.slice(0, 20).map(trackLabel),
            recent: history.slice(0, 20).map(trackLabel),
            sequence: sequenceBrief(history, stats),
            skipped: skippedLabels(stats),
            artists: topArtists(stats, likes),
            brief: settingsToBrief(settings),
            count: 20,
          },
        });
        if (res.tracks) {
          setMixTracks((prev) => ({ ...prev, [kind]: res.tracks as Track[] }));
        }
      } finally {
        setMixLoading(false);
      }
    },
    [runMix, likes, history, stats, settings],
  );

  const loadRecommendations = useCallback(
    async (mood?: string) => {
      setRecLoading(true);
      try {
        const res = await runRecommend({
          data: {
            liked: likes.slice(0, 20).map(trackLabel),
            recent: history.slice(0, 20).map(trackLabel),
            disliked: dislikes.slice(0, 20).map(trackLabel),
            sequence: sequenceBrief(history, stats),
            skipped: skippedLabels(stats),
            count: 30,
            ...(mood ? { mood } : {}),
            brief: settingsToBrief(settings),
            artists: topArtists(stats, likes),
          },
        });
        if (res.tracks) {
          setRecs(res.tracks as Track[]);
        }
      } finally {
        setRecLoading(false);
      }
    },
    [runRecommend, likes, history, dislikes, stats, settings],
  );

  const extendQueue = useCallback(async () => {
    if (extending) return;
    setExtending(true);
    try {
      const res = await runRecommend({
        data: {
          liked: likes.slice(0, 20).map(trackLabel),
          recent: history.slice(0, 20).map(trackLabel),
          disliked: dislikes.slice(0, 20).map(trackLabel),
          sequence: sequenceBrief(history, stats),
          skipped: skippedLabels(stats),
          count: 10,
          brief: settingsToBrief(settings),
          artists: topArtists(stats, likes),
        },
      });
      if (res.tracks && res.tracks.length > 0) {
        setQueue((prev) => [...prev, ...(res.tracks as Track[])]);
      }
    } finally {
      setExtending(false);
    }
  }, [extending, runRecommend, likes, history, dislikes, stats, settings]);

  const searchFor = useCallback(
    async (term: string) => {
      if (!term.trim()) return;
      setTab("search");
      setShowSuggestions(false);
      setSearching(true);
      setMessage(null);
      try {
        const res = await runSearch({ data: { query: term.trim(), limit: 50 } });
        if (res.error) setMessage(res.error);
        if (res.tracks) setResults(res.tracks as Track[]);
      } finally {
        setSearching(false);
      }
    },
    [runSearch],
  );

  const openArtist = useCallback(
    (artist: string) => {
      setQuery(artist);
      void searchFor(`${artist} songs`);
    },
    [searchFor],
  );

  const goNext = useCallback(() => {
    const q = queueRef.current;
    if (index + 1 < q.length) {
      setIndex(index + 1);
    } else if (continuous) {
      void extendQueue();
    }
  }, [index, continuous, extendQueue]);

  const goPrev = useCallback(() => {
    if (index > 0) {
      setIndex(index - 1);
    }
  }, [index]);

  const dislikeCurrent = useCallback(() => {
    const track = currentRef.current;
    if (!track) return;
    toggleDislike(track);
    setRecs((prev) => prev.filter((t) => t.id !== track.id));
    goNext();
  }, [toggleDislike, goNext]);

  const onSearch = (event: React.FormEvent) => {
    event.preventDefault();
    void searchFor(query);
  };

  // --- Effects ---
  useEffect(() => {
    if (tab !== "mixes" || mix === "replay") return;
    void loadMix(mix);
  }, [tab, mix, loadMix]);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const saved = readPlayback();
    if (!saved) {
      setResumed(true);
      return;
    }
    resumeRef.current = saved.position;
    setQueue(saved.queue);
    setIndex(Math.min(saved.index, Math.max(0, saved.queue.length - 1)));
  }, []);

  const restored = useRef(false);
  const resumeRef = useRef<number | null>(null);

  useEffect(() => {
    const track = currentRef.current;
    if (!player.ready || !track) return;
    const resumeAt = resumeRef.current;
    if (resumeAt !== null) {
      resumeRef.current = null;
      cue(track.id, resumeAt);
      setResumed(true);
      return;
    }
    load(track.id);
    play();
    logPlay(track);
  }, [current?.id, player.ready, load, cue, play, logPlay]);

  useEffect(() => {
    if (!resumed || queue.length === 0) return;
    const timer = window.setInterval(() => {
      writePlayback({ queue, index, position: player.position });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [resumed, queue, index, player.position]);

  useEffect(() => {
    if (player.ready) applyVolume(volume);
  }, [volume, player.ready, applyVolume]);

  const bootstrapped = useRef(false);
  useEffect(() => {
    if (!hydrated || bootstrapped.current) return;
    bootstrapped.current = true;
    void loadRecommendations();
  }, [hydrated, loadRecommendations]);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const key = e.key.toLowerCase();
      const seekBy = (s: number) => player.seek(Math.max(0, player.position + s));
      if (e.code === "Space" || key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (key === "arrowright") {
        e.preventDefault();
        seekBy(5);
      } else if (key === "arrowleft") {
        e.preventDefault();
        seekBy(-5);
      } else if (key === "l") seekBy(10);
      else if (key === "j") seekBy(-10);
      else if (key === "n") goNext();
      else if (key === "p") goPrev();
      else if (key === "m") toggleMute();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player, togglePlay, goNext, goPrev, toggleMute]);

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

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground selection:bg-pink-500/30">
      {/* Sidebar on desktop */}
      <Sidebar
        activeTab={tab}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        onNavigate={(t: NavTab) => setTab(t)}
        isSynced={!!auth.userId}
        userName={auth.profile?.display_name ?? auth.email?.split("@")[0] ?? "Listener"}
        userInitial={auth.email?.[0]?.toUpperCase() ?? "L"}
        userAvatar={auth.profile?.avatar_url}
        currentTitle={current?.title}
        currentArtist={current?.artist}
        currentThumbnail={current?.thumbnail}
        isPlaying={player.isPlaying}
        onPlayPause={togglePlay}
        onNext={goNext}
      />

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#0a0a10]">
        <SearchHeader
          query={query}
          onQueryChange={setQuery}
          suggestions={suggestions}
          showSuggestions={showSuggestions}
          onShowSuggestions={setShowSuggestions}
          onSearch={onSearch}
          onSuggestionClick={(s) => {
            setQuery(s);
            void searchFor(s);
          }}
          searching={searching}
          activeTab={tab}
          onNavigate={(t: NavTab) => setTab(t)}
          userId={auth.userId}
          email={auth.email}
          profile={auth.profile}
          onUpdateProfile={auth.updateProfile}
          onSignOut={auth.signOut}
          onOpenSettings={() => setShowSettings((v) => !v)}
        />

        <main className="relative flex-1 overflow-y-auto overflow-x-hidden scroll-smooth">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-hero-glow opacity-80" aria-hidden />

          <div className="relative w-full px-4 py-6 sm:px-8 xl:px-12 2xl:px-16 pb-32">
            {message && (
              <div className="pointer-events-none fixed bottom-28 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <p className="rounded-full border border-white/10 bg-[#1a1a2e]/95 px-5 py-2.5 text-xs font-medium text-white/80 shadow-2xl backdrop-blur-md">
                  {message}
                </p>
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
                    <Button
                      variant="secondary"
                      size="sm"
                      className="rounded-full bg-white/[0.06] text-white/70 hover:bg-white/10 hover:text-white border-white/10"
                      onClick={() => setShowSettings((v) => !v)}
                    >
                      Tune picks
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

                {showSettings && (
                  <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-md">
                    <RecSettingsPanel
                      settings={settings}
                      onChange={updateSettings}
                      onReset={resetSettings}
                      onApply={() => void loadRecommendations()}
                      loading={recLoading}
                      onOpenLanguages={() => setTab("languages")}
                    />
                  </div>
                )}

                {/* Home Sections Grid */}
                <HomeSections
                  recentlyPlayed={history.slice(0, 12)}
                  trending={recs.slice(0, 12)}
                  newReleases={mixTracks.newrelease.slice(0, 12)}
                  recommended={recs.slice(12, 24)}
                  onPlayTrack={(track, i) => {
                    if (current?.id === track.id) {
                      player.isPlaying ? pause() : play();
                      return;
                    }
                    startQueue(recs, i);
                  }}
                  onToggleLike={toggleLike}
                  likedIds={likedIds}
                  currentId={current?.id ?? undefined}
                  isPlaying={player.isPlaying}
                  loading={recLoading && recs.length === 0}
                />
              </div>
            )}

            {/* SEARCH TAB */}
            {tab === "search" && (
              <SearchResults
                results={results}
                loading={searching}
                query={query}
                onPlayTrack={(track, i) => {
                  if (current?.id === track.id) {
                    player.isPlaying ? pause() : play();
                    return;
                  }
                  startQueue(results, i);
                }}
                onToggleLike={toggleLike}
                likedIds={likedIds}
                currentId={current?.id ?? undefined}
                isPlaying={player.isPlaying}
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
                    player.isPlaying ? pause() : play();
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
                  const name = window.prompt("Playlist name", "New playlist");
                  if (name?.trim()) createPlaylist(name.trim(), [track]);
                }}
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
                onRemoveTrack={removeFromPlaylist}
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
                  const name = window.prompt("Playlist name", "New playlist");
                  if (name?.trim()) createPlaylist(name.trim(), [track]);
                }}
                downloadedIds={downloadedIds}
                downloadingIds={downloadingIds}
                onDownload={(track) => void handleDownload(track)}
                onRemoveDownload={(track) => void handleRemoveDownload(track)}
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
                    <Button variant="ghost" size="sm" onClick={clearHistory} className="text-xs text-white/50 hover:text-white">
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
                      player.isPlaying ? pause() : play();
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
                  onCreatePlaylistWith={(track) => {
                    const name = window.prompt("Playlist name", "New playlist");
                    if (name?.trim()) createPlaylist(name.trim(), [track]);
                  }}
                  emptyMessage={
                    tab === "likes"
                      ? "Tap the heart on any song to save your favourites."
                      : "Songs you listen to will appear here."
                  }
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* BOTTOM PLAYER BAR */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/5 bg-[#0a0a14]/95 backdrop-blur-2xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.9)]">
        {/* Top ambient glow line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pink-500/40 to-transparent animate-pulse" />

        {/* Mobile bottom tabs */}
        <div className="flex items-center justify-around border-b border-white/5 py-1.5 px-2 lg:hidden">
          {NAV_ITEMS.filter((t) => ["foryou", "mixes", "languages", "likes", "history"].includes(t.id)).map(
            ({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "flex flex-col items-center gap-0.5 p-1.5 rounded-lg text-[10px] font-medium transition-colors",
                  tab === id ? "text-pink-400 font-semibold" : "text-white/40 hover:text-white/70",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ),
          )}
        </div>

        <div className="mx-auto w-full px-4 py-2.5 sm:px-8 xl:px-12 2xl:px-16">
          {showQueue && (
            <QueuePanel
              tracks={queue}
              index={index}
              isPlaying={player.isPlaying}
              continuous={continuous}
              loadingMore={extending}
              onToggleContinuous={() => setContinuous((v) => !v)}
              onJump={(i) => setIndex(i)}
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

          {/* 3-Column Grid Player Layout */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            {/* Left: Track Info */}
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative cursor-pointer shrink-0" onClick={() => setShowFullScreen(true)}>
                <SpinningArt
                  src={current?.thumbnail}
                  playing={player.isPlaying}
                  className="h-12 w-12 rounded-xl shadow-lg shadow-purple-500/20"
                />
              </div>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
                  {player.isPlaying && <Equalizer active className="h-3 w-3 shrink-0 text-pink-400" />}
                  <span className="truncate">{current?.title ?? "Pick a song to start"}</span>
                </p>
                <p className="truncate text-xs text-white/50 hover:text-white/80 cursor-pointer" onClick={() => current && openArtist(current.artist)}>
                  {current?.artist ?? "—"}
                </p>
              </div>
            </div>

            {/* Center: Transport Controls */}
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                disabled={!canPrev}
                onClick={goPrev}
                aria-label="Previous track"
                className="text-white/60 hover:text-white transition-transform hover:scale-110"
              >
                <SkipBack className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                className="h-11 w-11 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-500 text-white shadow-lg shadow-purple-500/30 transition-transform hover:scale-105 active:scale-95"
                disabled={!current}
                onClick={togglePlay}
                aria-label={player.isPlaying ? "Pause" : "Play"}
              >
                {player.isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={!canNext && !continuous}
                onClick={goNext}
                aria-label="Next track"
                className="text-white/60 hover:text-white transition-transform hover:scale-110"
              >
                <SkipForward className="h-5 w-5" />
              </Button>
            </div>

            {/* Right: Actions & Volume */}
            <div className="flex items-center justify-end gap-1 sm:gap-2">
              <SleepTimer onSleep={() => pause()} />

              {current && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      downloadedIds.has(current.id)
                        ? void handleRemoveDownload(current)
                        : void handleDownload(current)
                    }
                    className="text-white/50 hover:text-white"
                    aria-label="Download"
                  >
                    {downloadingIds.has(current.id) ? (
                      <Loader2 className="h-4 w-4 animate-spin text-pink-400" />
                    ) : downloadedIds.has(current.id) ? (
                      <Download className="h-4 w-4 text-pink-400" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleLike(current)}
                    className="text-white/50 hover:text-pink-400"
                    aria-label="Favourite"
                  >
                    <Heart className={cn("h-4 w-4", likedIds.has(current.id) && "fill-pink-400 text-pink-400")} />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={dislikeCurrent}
                    className="text-white/50 hover:text-red-400"
                    aria-label="Dislike"
                  >
                    <ThumbsDown className={cn("h-4 w-4", dislikedIds.has(current.id) && "fill-red-400 text-red-400")} />
                  </Button>
                </>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowLyrics((v) => !v)}
                className={cn("text-white/50 hover:text-white", showLyrics && "text-pink-400")}
                aria-label="Lyrics"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowQueue((v) => !v)}
                className={cn("text-white/50 hover:text-white", showQueue && "text-pink-400")}
                aria-label="Queue"
              >
                <Equalizer active={showQueue} className="h-4 w-4" />
              </Button>

              {/* Volume Slider on desktop */}
              <div className="hidden items-center gap-1.5 md:flex pl-2">
                <button type="button" onClick={toggleMute} className="text-white/50 hover:text-white">
                  {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={100}
                  onValueChange={([v]) => {
                    if (isMuted) setIsMuted(false);
                    setVolume(v ?? 0);
                    applyVolume(v ?? 0);
                  }}
                  className="w-20"
                  aria-label="Volume"
                />
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowFullScreen(true)}
                className="hidden sm:flex text-white/50 hover:text-white"
                aria-label="Full screen player"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Scrubber Bar */}
          <div className="mt-1.5 flex items-center gap-2">
            <span className="w-8 text-right text-[11px] tabular-nums text-white/40">
              {formatTime(player.position)}
            </span>
            <ScrubBar
              position={player.position}
              duration={player.duration}
              thumbnail={current?.thumbnail}
              onSeek={(s) => player.seek(s)}
              className="flex-1"
            />
            <span className="w-8 text-[11px] tabular-nums text-white/40">
              {formatTime(player.duration)}
            </span>
          </div>
        </div>
      </div>

      {/* FULL SCREEN PLAYER MODAL */}
      {showFullScreen && (
        <FullScreenPlayer
          track={current ?? null}
          isPlaying={player.isPlaying}
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
          onClose={() => setShowFullScreen(false)}
          canNext={canNext}
          canPrevious={canPrev}
        />
      )}

      {/* LYRICS PANEL */}
      {showLyrics && current && (
        <LyricsPanel
          trackId={current.id}
          trackTitle={current.title}
          trackArtist={current.artist}
          currentTime={player.position}
          isPlaying={player.isPlaying}
          onClose={() => setShowLyrics(false)}
        />
      )}
    </div>
  );
}
