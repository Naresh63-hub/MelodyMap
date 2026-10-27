import { ArrowLeft, Loader2, Play, Pause, RefreshCw, Shuffle, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { TrackList } from "@/components/music/TrackList";
import type { MoodItem } from "./MoodCardsSection";
import type { Playlist, Track } from "@/lib/library";
import { cn } from "@/lib/utils";

type Props = {
  mood: MoodItem;
  tracks: Track[];
  loading: boolean;
  error?: string | null | undefined;
  currentId?: string | null | undefined;
  isPlaying?: boolean | undefined;
  likedIds: Set<string>;
  dislikedIds?: Set<string> | undefined;
  playlists: Playlist[];
  downloadedIds?: Set<string> | undefined;
  downloadingIds?: Set<string> | undefined;
  downloadProgress?: Record<string, number> | undefined;
  userLanguage?: string | undefined;
  onBack: () => void;
  onPlayAll: () => void;
  onShuffle: () => void;
  onPlayTrack: (track: Track, index: number) => void;
  onToggleLike: (track: Track) => void;
  onToggleDislike?: ((track: Track) => void) | undefined;
  onArtistClick: (artist: string) => void;
  onAddToPlaylist: (playlistId: string, track: Track) => void;
  onCreatePlaylistWith: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onDownload?: ((track: Track) => void) | undefined;
  onRemoveDownload?: ((track: Track) => void) | undefined;
  onRetry?: (() => void) | undefined;
};

/**
 * Dedicated Mood & Vibe Page.
 * Displays only related songs for the selected mood (e.g. Romantic, Chill, Workout)
 * with dedicated Play All, Shuffle, and full playback controls.
 */
export function MoodDetailView({
  mood,
  tracks,
  loading,
  error,
  currentId,
  isPlaying = false,
  likedIds,
  dislikedIds,
  playlists,
  downloadedIds,
  downloadingIds,
  downloadProgress,
  userLanguage,
  onBack,
  onPlayAll,
  onShuffle,
  onPlayTrack,
  onToggleLike,
  onToggleDislike,
  onArtistClick,
  onAddToPlaylist,
  onCreatePlaylistWith,
  onAddToQueue,
  onDownload,
  onRemoveDownload,
  onRetry,
}: Props) {
  const Icon = mood.icon;

  const isCurrentMoodPlaying = useMemo(() => {
    if (!isPlaying || !currentId) return false;
    return tracks.some((t) => t.id === currentId);
  }, [isPlaying, currentId, tracks]);

  return (
    <div className="space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="group inline-flex items-center gap-2 rounded-full bg-card/80 px-3.5 py-1.5 text-xs font-medium text-muted-foreground border border-border/50 hover:bg-card hover:text-foreground transition-all duration-150 active:scale-95 shadow-xs"
          aria-label="Back to home"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Home</span>
        </button>

        {tracks.length > 0 && !loading && (
          <button
            type="button"
            onClick={onRetry}
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-card/80 transition-colors"
            title="Refresh vibe songs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Mood Hero Card */}
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border p-5 sm:p-7 text-white shadow-lg",
          "bg-gradient-to-br",
          mood.gradient,
        )}
      >
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full shadow-inner",
                  mood.accentColor,
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 backdrop-blur-md px-2.5 py-0.5 text-[11px] font-medium text-white/90">
                <Sparkles className="h-3 w-3 text-white/70" />
                {userLanguage ? `${userLanguage} Vibe` : "Curated Vibe"}
              </span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-xs">
                {mood.label}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-white/80 max-w-md leading-relaxed font-normal">
                {mood.subtitle} • Only related music handpicked for this mood.
              </p>
            </div>

            <div className="text-xs text-white/60 font-medium pt-1">
              {loading ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-white/80" />
                  Curating {mood.label} songs...
                </span>
              ) : (
                <span>{tracks.length} songs</span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          {tracks.length > 0 && !loading && (
            <div className="flex items-center gap-2.5 pt-2 sm:pt-0">
              <Button
                type="button"
                onClick={onPlayAll}
                size="default"
                className="rounded-full bg-white text-zinc-950 hover:bg-white/90 font-semibold shadow-md gap-2 px-5 transition-transform active:scale-95"
              >
                {isCurrentMoodPlaying ? (
                  <>
                    <Pause className="h-4 w-4 fill-current" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current ml-0.5" />
                    <span>Play All</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onShuffle}
                className="h-10 w-10 rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20 backdrop-blur-xs transition-transform active:scale-95"
                title="Shuffle mood songs"
                aria-label="Shuffle mood songs"
              >
                <Shuffle className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Ambient radial lighting */}
        <div
          className="pointer-events-none absolute -right-10 -bottom-10 h-44 w-44 rounded-full bg-white/10 blur-3xl"
          aria-hidden="true"
        />
      </div>

      {/* Song List Content */}
      {loading && tracks.length === 0 ? (
        <div className="space-y-3 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3.5 rounded-2xl bg-card/40 border border-border/40 p-3 animate-pulse"
            >
              <div className="h-12 w-12 rounded-xl bg-muted/60 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-1/3 rounded-md bg-muted/60" />
                <div className="h-3 w-1/4 rounded-md bg-muted/40" />
              </div>
            </div>
          ))}
        </div>
      ) : error && tracks.length === 0 ? (
        <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-8 text-center space-y-3">
          <p className="text-sm font-medium text-foreground">{error}</p>
          <p className="text-xs text-muted-foreground">
            Please check your connection or try again.
          </p>
          {onRetry && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onRetry}
              className="rounded-full mt-2"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Retry
            </Button>
          )}
        </div>
      ) : tracks.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1 text-xs font-medium text-muted-foreground">
            <span>Songs ({tracks.length})</span>
            <span>Plays only {mood.label} music</span>
          </div>

          <TrackList
            tracks={tracks}
            currentId={currentId ?? undefined}
            isPlaying={isPlaying}
            likedIds={likedIds}
            dislikedIds={dislikedIds ?? new Set()}
            downloadedIds={downloadedIds ?? new Set()}
            downloadingIds={downloadingIds ?? new Set()}
            downloadProgress={downloadProgress}
            onDownload={onDownload}
            onRemoveDownload={onRemoveDownload}
            onPlay={onPlayTrack}
            onToggleLike={onToggleLike}
            onToggleDislike={onToggleDislike}
            onArtistClick={onArtistClick}
            playlists={playlists}
            onAddToPlaylist={onAddToPlaylist}
            onAddToQueue={onAddToQueue}
            onCreatePlaylistWith={onCreatePlaylistWith}
            emptyMessage={`No ${mood.label} songs found.`}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
          No songs found for this vibe. Try refreshing or picking another mood.
        </div>
      )}
    </div>
  );
}
