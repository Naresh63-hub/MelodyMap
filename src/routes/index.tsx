import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Disc3,
  Heart,
  History,
  Loader2,
  Pause,
  Play,
  Search,
  SkipBack,
  SkipForward,
  ListMusic,
  ListVideo,
  Settings2,
  Sparkles,
  Volume2,
} from "lucide-react";

import { QueuePanel } from "@/components/music/QueuePanel";
import { PlaylistsPanel } from "@/components/music/PlaylistsPanel";
import { RecSettingsPanel } from "@/components/music/RecSettingsPanel";
import { TrackList } from "@/components/music/TrackList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useLibrary, trackLabel, settingsToBrief, type Track } from "@/lib/library";
import { recommendTracks, searchTracks } from "@/lib/music.functions";
import { formatTime, useYouTubePlayer } from "@/lib/use-youtube-player";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Midnight Vinyl — Free Music Player with AI Picks" },
      {
        name: "description",
        content:
          "Stream any song for free and get AI recommendations that learn your taste. No account, no subscription.",
      },
      { property: "og:title", content: "Midnight Vinyl — Free Music Player with AI Picks" },
      {
        property: "og:description",
        content:
          "Stream any song for free and get AI recommendations that learn your taste. No account, no subscription.",
      },
    ],
  }),
  component: MusicApp,
});

type Tab = "foryou" | "search" | "likes" | "playlists" | "history";

const TABS: Array<{ id: Tab; label: string; icon: typeof Sparkles }> = [
  { id: "foryou", label: "For you", icon: Sparkles },
  { id: "search", label: "Search", icon: Search },
  { id: "likes", label: "Favourites", icon: Heart },
  { id: "playlists", label: "Playlists", icon: ListMusic },
  { id: "history", label: "Recent", icon: History },
];

function MusicApp() {
  const runSearch = useServerFn(searchTracks);
  const runRecommend = useServerFn(recommendTracks);
  const {
    hydrated,
    likes,
    history,
    playlists,
    settings,
    toggleLike,
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
  } = useLibrary();

  const [tab, setTab] = useState<Tab>("foryou");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [recs, setRecs] = useState<Track[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [volume, setVolume] = useState(80);
  const [showVideo, setShowVideo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [continuous, setContinuous] = useState(true);
  const [extending, setExtending] = useState(false);


  const current = queue[index];
  const currentRef = useRef<Track | undefined>(undefined);
  currentRef.current = current;
  const queueRef = useRef<Track[]>([]);
  queueRef.current = queue;


  const player = useYouTubePlayer({
    onEnded: () => {
      if (index + 1 < queue.length) {
        setIndex(index + 1);
        return;
      }
      if (continuous) void extendQueue();
    },
  });


  const { load, setVolume: applyVolume, play } = player;

  useEffect(() => {
    const track = currentRef.current;
    if (!player.ready || !track) return;
    load(track.id);
    play();
    logPlay(track);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, player.ready, load, play, logPlay]);

  useEffect(() => {
    if (player.ready) applyVolume(volume);
  }, [volume, player.ready, applyVolume]);

  const likedIds = useMemo(() => new Set(likes.map((t) => t.id)), [likes]);

  const startQueue = useCallback((tracks: Track[], startAt: number) => {
    setQueue(tracks);
    setIndex(startAt);
  }, []);

  const fetchPicks = useCallback(
    async (mood?: string) => {
      const res = await runRecommend({
        data: {
          liked: likes.slice(0, 20).map(trackLabel),
          recent: history.slice(0, 20).map(trackLabel),
          ...(mood ? { mood } : {}),
          brief: settingsToBrief(settings, mood),
        },
      });
      return res;
    },
    [runRecommend, likes, history, settings],
  );

  const loadRecommendations = useCallback(
    async (mood?: string) => {
      setRecLoading(true);
      setMessage(null);
      const res = await fetchPicks(mood);
      setRecLoading(false);
      if (res.error) setMessage(res.error);
      else setRecs(res.tracks as Track[]);
    },
    [fetchPicks],
  );

  const enqueue = useCallback((tracks: Track[]) => {
    if (tracks.length === 0) return;
    setQueue((prev) => {
      const fresh = tracks.filter((t) => !prev.some((x) => x.id === t.id));
      return [...prev, ...fresh];
    });
    setShowQueue(true);
  }, []);

  /** Continuous mode: fetch a fresh batch of picks and append them to the queue. */
  const extendingRef = useRef(false);
  const extendQueue = useCallback(async () => {
    if (extendingRef.current) return;
    extendingRef.current = true;
    setExtending(true);
    const res = await fetchPicks();
    setExtending(false);
    extendingRef.current = false;
    if (res.error || res.tracks.length === 0) {
      if (res.error) setMessage(res.error);
      return;
    }
    const incoming = res.tracks as Track[];
    setRecs(incoming);
    const prev = queueRef.current;
    const fresh = incoming.filter((t) => !prev.some((x) => x.id === t.id));
    if (fresh.length === 0) return;
    setQueue([...prev, ...fresh]);
    setIndex(prev.length);

  }, [fetchPicks]);


  const bootstrapped = useRef(false);
  useEffect(() => {
    if (!hydrated || bootstrapped.current) return;
    bootstrapped.current = true;
    void loadRecommendations();
  }, [hydrated, loadRecommendations]);

  const onSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    setTab("search");
    setSearching(true);
    setMessage(null);
    const res = await runSearch({ data: { query: query.trim(), limit: 25 } });
    setSearching(false);
    if (res.error) setMessage(res.error);
    setResults(res.tracks as Track[]);
  };

  const listForTab: Record<Tab, Track[]> = {
    foryou: recs,
    search: results,
    likes,
    playlists: [],
    history,
  };
  const visible = listForTab[tab];

  const canPrev = index > 0;
  const canNext = index + 1 < queue.length;

  return (
    <div className="min-h-screen pb-40">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-96 bg-hero-glow" aria-hidden />

      <header className="relative mx-auto flex max-w-5xl flex-col gap-6 px-4 pt-10 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-vinyl shadow-player">
            <Disc3
              className={cn("h-6 w-6 text-primary", player.isPlaying && "animate-spin-slow")}
            />
          </span>
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Midnight Vinyl</h1>
            <p className="text-xs text-muted-foreground">
              Free listening with recommendations that learn your taste
            </p>
          </div>
        </div>

        <form onSubmit={onSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search any song, artist or album…"
              className="h-12 rounded-full border-border bg-card pl-10 text-base"
            />
          </div>
          <Button type="submit" size="lg" className="h-12 rounded-full px-6 font-semibold">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
        </form>

        <nav className="flex flex-wrap gap-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                tab === id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="relative mx-auto mt-8 max-w-5xl px-4 sm:px-6">
        {message && (
          <p className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground">
            {message}
          </p>
        )}

        {tab === "foryou" && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              className="rounded-full"
              onClick={() => void loadRecommendations()}
              disabled={recLoading}
            >
              {recLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Refresh picks
            </Button>
            <Button
              variant="secondary"
              className="rounded-full"
              onClick={() => setShowSettings((v) => !v)}
            >
              <Settings2 className="mr-2 h-4 w-4" />
              {showSettings ? "Hide tuning" : "Tune picks"}
            </Button>
            {["late night", "upbeat workout", "focus", "sad hours", "throwbacks"].map((mood) => (
              <button
                key={mood}
                type="button"
                onClick={() => void loadRecommendations(mood)}
                disabled={recLoading}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
              >
                {mood}
              </button>
            ))}
          </div>
        )}

        {tab === "foryou" && showSettings && (
          <div className="mb-5">
            <RecSettingsPanel
              settings={settings}
              onChange={updateSettings}
              onReset={resetSettings}
              onApply={() => void loadRecommendations()}
              loading={recLoading}
            />
          </div>
        )}

        {tab === "history" && history.length > 0 && (
          <div className="mb-4 flex justify-end">
            <Button variant="ghost" size="sm" onClick={clearHistory}>
              Clear history
            </Button>
          </div>
        )}

        {tab === "playlists" ? (
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
        ) : recLoading && tab === "foryou" ? (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm">Reading your taste and picking songs…</p>
          </div>
        ) : (
          <TrackList
            tracks={visible}
            currentId={current?.id}
            isPlaying={player.isPlaying}
            likedIds={likedIds}
            onPlay={(track, i) => {
              if (current?.id === track.id) {
                player.isPlaying ? player.pause() : player.play();
                return;
              }
              startQueue(visible, i);
            }}
            onToggleLike={toggleLike}
            playlists={playlists}
            onAddToPlaylist={addToPlaylist}
            onAddToQueue={(track) => enqueue([track])}
            onCreatePlaylistWith={(track) => {
              const name = window.prompt("Playlist name", "New playlist");
              if (name?.trim()) createPlaylist(name.trim(), [track]);
            }}
            emptyMessage={
              tab === "likes"
                ? "Tap the heart on a song to build your favourites — they train your picks."
                : tab === "history"
                  ? "Songs you play show up here."
                  : tab === "search"
                    ? "Search for anything to start listening."
                    : "No picks yet. Hit refresh."
            }
          />
        )}
      </main>

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

      {/* Player */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6">
          <div
            className={cn(
              "mx-auto mb-3 aspect-video w-full max-w-md overflow-hidden rounded-xl bg-black",
              !showVideo && "sr-only h-0",
            )}
          >
            <div ref={player.containerRef} />
          </div>

          <div className="flex items-center gap-3">
            <img
              src={current?.thumbnail ?? "https://i.ytimg.com/vi/none/hqdefault.jpg"}
              alt=""
              className={cn(
                "h-12 w-12 shrink-0 rounded-lg object-cover",
                !current && "opacity-30",
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {current?.title ?? "Pick a song to start"}
              </p>
              <p className="truncate text-xs text-muted-foreground">{current?.artist ?? "—"}</p>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                disabled={!canPrev}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                aria-label="Previous track"
              >
                <SkipBack className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                className="h-11 w-11 rounded-full"
                disabled={!current}
                onClick={() => (player.isPlaying ? player.pause() : player.play())}
                aria-label={player.isPlaying ? "Pause" : "Play"}
              >
                {player.isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={!canNext}
                onClick={() => setIndex((i) => i + 1)}
                aria-label="Next track"
              >
                <SkipForward className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Up next queue"
                onClick={() => setShowQueue((v) => !v)}
                className={cn(showQueue && "text-primary")}
              >
                <ListVideo className="h-5 w-5" />
              </Button>
              {current && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleLike(current)}
                  aria-label="Favourite this song"
                >
                  <Heart
                    className={cn(
                      "h-5 w-5",
                      likedIds.has(current.id) && "fill-accent text-accent",
                    )}
                  />
                </Button>
              )}
            </div>
          </div>

          <div className="mt-2 flex items-center gap-3">
            <span className="w-10 text-right text-[11px] tabular-nums text-muted-foreground">
              {formatTime(player.position)}
            </span>
            <Slider
              value={[player.duration ? (player.position / player.duration) * 100 : 0]}
              max={100}
              step={0.5}
              onValueChange={([v]) => player.seek(((v ?? 0) / 100) * player.duration)}
              className="flex-1"
              aria-label="Seek"
            />
            <span className="w-10 text-[11px] tabular-nums text-muted-foreground">
              {formatTime(player.duration)}
            </span>
            <div className="hidden items-center gap-2 sm:flex">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <Slider
                value={[volume]}
                max={100}
                onValueChange={([v]) => setVolume(v ?? 0)}
                className="w-24"
                aria-label="Volume"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowVideo((v) => !v)}
              className="text-[11px] text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
            >
              {showVideo ? "Hide video" : "Show video"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
