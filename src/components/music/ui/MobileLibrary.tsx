import {
  Heart,
  ListMusic,
  Download,
  ChevronRight,
  MoreVertical,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Track, Playlist } from "@/lib/library";
import { Equalizer } from "@/components/music/NowPlayingViz";
import { getTrackDisplayDuration } from "@/lib/track-metadata";
import { triggerHaptic } from "@/lib/haptics";

export type LibrarySection = "liked" | "history" | "playlists" | "downloads" | null;

export type Props = {
  likes: Track[];
  history: Track[];
  playlists: Playlist[];
  downloads: Array<{ track: Track; size: number; savedAt: number }>;
  currentId?: string | null;
  isPlaying: boolean;
  onNavigateSection: (section: LibrarySection) => void;
  onPlayTrack: (tracks: Track[], index: number) => void;
  onOpenOptions?: (track: Track) => void;
  onCreatePlaylist?: () => void;
};

export function MobileLibrary({
  likes,
  history,
  playlists,
  downloads,
  currentId,
  isPlaying,
  onNavigateSection,
  onPlayTrack,
  onOpenOptions,
  onCreatePlaylist,
}: Props) {
  const likedCount = likes.length;
  const playlistCount = playlists.length;
  const totalPlaylistSongs = playlists.reduce(
    (acc, p) => acc + (p.tracks?.length || 0),
    0
  );
  const downloadCount = downloads.length;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* 3 Main Simplified Library Categories: Liked Songs, Playlists, Downloads */}
      <div className="space-y-3">
        {/* Liked Songs Card */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            onNavigateSection("liked");
          }}
          className="group flex w-full items-center justify-between rounded-2xl bg-white dark:bg-card border border-[#EBE6F5] dark:border-border p-4 shadow-[0_2px_12px_rgba(124,58,237,0.06)] hover:shadow-[0_4px_16px_rgba(124,58,237,0.12)] hover:border-[#7C3AED]/40 active:scale-[0.99] transition-all cursor-pointer text-left"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#8B5CF6] via-[#A855F7] to-[#EC4899] text-white shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform">
              <Heart className="h-6 w-6 fill-white text-white" />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm sm:text-base font-bold text-[#17112B] dark:text-foreground truncate">
                Liked Songs
              </p>
              <p className="text-xs font-medium text-[#51476B] dark:text-muted-foreground mt-0.5">
                {likedCount} {likedCount === 1 ? "song" : "songs"}
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-[#8E86A3] dark:text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
        </button>

        {/* Playlists Card */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            onNavigateSection("playlists");
          }}
          className="group flex w-full items-center justify-between rounded-2xl bg-white dark:bg-card border border-[#EBE6F5] dark:border-border p-4 shadow-[0_2px_12px_rgba(124,58,237,0.06)] hover:shadow-[0_4px_16px_rgba(124,58,237,0.12)] hover:border-[#7C3AED]/40 active:scale-[0.99] transition-all cursor-pointer text-left"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#6366F1] via-[#7C3AED] to-[#A855F7] text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <ListMusic className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm sm:text-base font-bold text-[#17112B] dark:text-foreground truncate">
                Playlists
              </p>
              <p className="text-xs font-medium text-[#51476B] dark:text-muted-foreground mt-0.5">
                {playlistCount === 0
                  ? "0 playlists"
                  : `${playlistCount} ${playlistCount === 1 ? "playlist" : "playlists"} • ${totalPlaylistSongs} ${totalPlaylistSongs === 1 ? "song" : "songs"}`}
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-[#8E86A3] dark:text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
        </button>

        {/* Downloads Card */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            onNavigateSection("downloads");
          }}
          className="group flex w-full items-center justify-between rounded-2xl bg-white dark:bg-card border border-[#EBE6F5] dark:border-border p-4 shadow-[0_2px_12px_rgba(124,58,237,0.06)] hover:shadow-[0_4px_16px_rgba(124,58,237,0.12)] hover:border-[#7C3AED]/40 active:scale-[0.99] transition-all cursor-pointer text-left"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#0284C7] via-[#06B6D4] to-[#0D9488] text-white shadow-md shadow-teal-500/20 group-hover:scale-105 transition-transform">
              <Download className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm sm:text-base font-bold text-[#17112B] dark:text-foreground truncate">
                Downloads
              </p>
              <p className="text-xs font-medium text-[#51476B] dark:text-muted-foreground mt-0.5">
                {downloadCount} {downloadCount === 1 ? "song" : "songs"}
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-[#8E86A3] dark:text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
        </button>
      </div>

      {/* Prominent "Create Playlist +" Gradient Button */}
      <button
        type="button"
        onClick={() => {
          triggerHaptic("selection");
          if (onCreatePlaylist) {
            onCreatePlaylist();
          } else {
            onNavigateSection("playlists");
          }
        }}
        className="mm-btn-gradient flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 px-4 text-sm font-semibold shadow-md active:scale-95 transition-all cursor-pointer"
      >
        <Plus className="h-4 w-4 stroke-[2.5]" />
        <span>Create Playlist +</span>
      </button>

      {/* Recently Played List */}
      {history.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-bold text-[#17112B] dark:text-foreground">
              Recently Played
            </h3>
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                onNavigateSection("history");
              }}
              className="text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              See all
            </button>
          </div>

          <div className="space-y-1.5">
            {history.slice(0, 8).map((track, i) => {
              const active = currentId === track.id;
              return (
                <div
                  key={`${track.id}-${i}`}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl p-2.5 transition-all",
                    active
                      ? "bg-[#F4F0FB] dark:bg-secondary text-primary shadow-xs"
                      : "hover:bg-[#F8F6FE] dark:hover:bg-chip bg-white dark:bg-card border border-[#EBE6F5]/80 dark:border-border/40 shadow-[0_1px_6px_rgba(124,58,237,0.03)]"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onPlayTrack(history, i)}
                    className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-card cursor-pointer"
                    aria-label={`Play ${track.title}`}
                  >
                    <img
                      src={track.thumbnail}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    {active && isPlaying && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Equalizer active className="h-3.5 w-3.5 text-primary" />
                      </div>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onPlayTrack(history, i)}
                    className="min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <p
                      className={cn(
                        "truncate text-sm font-semibold leading-tight",
                        active ? "text-primary font-bold" : "text-[#17112B] dark:text-foreground"
                      )}
                    >
                      {track.title}
                    </p>
                    <p className="truncate text-xs text-[#51476B] dark:text-muted-foreground leading-tight mt-0.5">
                      {track.artist}
                    </p>
                  </button>

                  <span className="text-xs sm:text-sm tabular-nums text-[#8E86A3] dark:text-muted-foreground font-medium shrink-0 px-1">
                    {getTrackDisplayDuration(track)}
                  </span>

                  {onOpenOptions && (
                    <button
                      type="button"
                      onClick={() => onOpenOptions(track)}
                      aria-label="Options"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[#8E86A3] hover:text-[#17112B] dark:text-muted-foreground dark:hover:text-foreground hover:bg-[#F3EFFC] dark:hover:bg-chip-strong active:scale-90 transition-all cursor-pointer"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
