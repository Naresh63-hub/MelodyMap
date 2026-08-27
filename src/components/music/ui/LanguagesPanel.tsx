import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Globe2, Loader2, Play, RefreshCw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LanguageArtistPicker } from "@/components/music/ui/LanguageArtistPicker";
import { TrackList } from "@/components/music/TrackList";
import { languageCharts, languagePicks } from "@/lib/music.functions";
import type { Playlist, RecSettings, Track } from "@/lib/library";
import { cn } from "@/lib/utils";

type Props = {
  settings: RecSettings;
  onChangeSettings: (patch: Partial<RecSettings>) => void;
  /** Start playback from the panel's language-based queue. */
  onPlay: (tracks: Track[], index: number) => void;
  currentId?: string | undefined;
  isPlaying: boolean;
  likedIds: Set<string>;
  dislikedIds: Set<string>;
  playlists: Playlist[];
  onToggleLike: (track: Track) => void;
  onToggleDislike: (track: Track) => void;
  onArtistClick?: ((artist: string) => void) | undefined;
  onAddToPlaylist: (playlistId: string, track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onCreatePlaylistWith: (track: Track) => void;
  downloadedIds?: Set<string> | undefined;
  downloadingIds?: Set<string> | undefined;
  onDownload?: ((track: Track) => void) | undefined;
  onRemoveDownload?: ((track: Track) => void) | undefined;
};

/** Dedicated Languages tab — pick languages & artists, then play the songs they unlock. */
export function LanguagesPanel({
  settings,
  onChangeSettings,
  onPlay,
  currentId,
  isPlaying,
  likedIds,
  dislikedIds,
  playlists,
  onToggleLike,
  onToggleDislike,
  onArtistClick,
  onAddToPlaylist,
  onAddToQueue,
  onCreatePlaylistWith,
  downloadedIds,
  downloadingIds,
  onDownload,
  onRemoveDownload,
}: Props) {
  const runLanguagePicks = useServerFn(languagePicks);
  const runLanguageCharts = useServerFn(languageCharts);
  const [view, setView] = useState<"picks" | "charts">("picks");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (view === "charts") {
      const res = await runLanguageCharts({
        data: { languages: settings.languages, count: 30 },
      });
      setLoading(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      setTracks(res.tracks as Track[]);
      return;
    }
    const res = await runLanguagePicks({
      data: {
        languages: settings.languages,
        artists: settings.artists,
        count: 30,
      },
    });
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setTracks(res.tracks as Track[]);
  }, [runLanguagePicks, runLanguageCharts, settings.languages, settings.artists, view]);

  /** Live preview: reload songs as the languages/artists/view change (debounced). */
  useEffect(() => {
    const t = window.setTimeout(() => void load(), 400);
    return () => window.clearTimeout(t);
  }, [load]);

  return (
    <div className="animate-page-in">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-cyan-500/20 ring-1 ring-white/10">
          <Globe2 className="h-5 w-5 text-pink-400 icon-glow" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-white">Languages</h2>
          <p className="truncate text-xs text-white/40">
            Songs in your languages, from your favourite artists &amp; singers.
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="flex rounded-full border border-white/10 bg-white/[0.04] p-0.5">
            <button
              type="button"
              onClick={() => setView("picks")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors button-press",
                view === "picks"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-white/50 hover:text-white",
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Picks
            </button>
            <button
              type="button"
              onClick={() => setView("charts")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors button-press",
                view === "charts"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-white/50 hover:text-white",
              )}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Charts
            </button>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full bg-white/[0.06] text-white/70 hover:bg-white/10 hover:text-white border-white/10 button-press"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 button-press"
            disabled={tracks.length === 0}
            onClick={() => onPlay(tracks, 0)}
          >
            <Play className="mr-1.5 h-3.5 w-3.5" fill="currentColor" />
            Play all
          </Button>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <LanguageArtistPicker
          languages={settings.languages}
          artists={settings.artists}
          onChange={(patch) => onChangeSettings(patch)}
        />
      </div>

      {loading && tracks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-white/30">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm">Finding songs in your languages…</p>
        </div>
      ) : error && tracks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-white/40">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : (
        <TrackList
          tracks={tracks}
          currentId={currentId}
          isPlaying={isPlaying}
          likedIds={likedIds}
          dislikedIds={dislikedIds}
          onPlay={(_, i) => onPlay(tracks, i)}
          onToggleLike={onToggleLike}
          onToggleDislike={onToggleDislike}
          {...(onArtistClick ? { onArtistClick } : {})}
          playlists={playlists}
          onAddToPlaylist={onAddToPlaylist}
          onAddToQueue={onAddToQueue}
          onCreatePlaylistWith={onCreatePlaylistWith}
          downloadedIds={downloadedIds}
          downloadingIds={downloadingIds}
          onDownload={onDownload}
          onRemoveDownload={onRemoveDownload}
          emptyMessage={
            view === "charts"
              ? "Pick a language above — this week's top songs will show up here."
              : "Pick a language or add an artist above — songs will show up here."
          }
        />
      )}
    </div>
  );
}