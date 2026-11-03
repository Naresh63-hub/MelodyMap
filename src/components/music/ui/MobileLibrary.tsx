import { useState } from "react";
import {
  Heart,
  Clock,
  ListMusic,
  Download,
  ChevronRight,
  MoreVertical,
  Plus,
  Music2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Track, Playlist } from "@/lib/library";
import { Equalizer } from "@/components/music/NowPlayingViz";
import { getTrackDisplayDuration } from "@/lib/track-metadata";
import { triggerHaptic } from "@/lib/haptics";

type LibrarySection = "liked" | "history" | "playlists" | "downloads" | null;

type Props = {
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
  const [activeTab, setActiveTab] = useState<"liked" | "playlists" | "recent" | "downloads">("liked");

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Category Pills matching Screen 8 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide pt-1">
        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            setActiveTab("liked");
          }}
          className={cn(
            "rounded-full px-4 py-2 text-xs font-semibold shrink-0 transition-all cursor-pointer",
            activeTab === "liked"
              ? "mm-chip-active"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          )}
        >
          Liked Songs
        </button>
        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            setActiveTab("playlists");
          }}
          className={cn(
            "rounded-full px-4 py-2 text-xs font-semibold shrink-0 transition-all cursor-pointer",
            activeTab === "playlists"
              ? "mm-chip-active"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          )}
        >
          Playlists
        </button>
        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            setActiveTab("recent");
          }}
          className={cn(
            "rounded-full px-4 py-2 text-xs font-semibold shrink-0 transition-all cursor-pointer",
            activeTab === "recent"
              ? "mm-chip-active"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          )}
        >
          Recent
        </button>
        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            setActiveTab("downloads");
          }}
          className={cn(
            "rounded-full px-4 py-2 text-xs font-semibold shrink-0 transition-all cursor-pointer",
            activeTab === "downloads"
              ? "mm-chip-active"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          )}
        >
          Downloaded
        </button>
      </div>

      {/* Primary Collection Cards matching Screen 8 in reference images */}
      <div className="space-y-3">
        {/* Liked Songs Primary Hero Card */}
        <button
          type="button"
          onClick={() => onNavigateSection("liked")}
          className="flex w-full items-center justify-between rounded-2xl bg-card border border-border p-3.5 transition-all hover:border-primary/40 active:scale-[0.99] shadow-xs cursor-pointer group"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] text-white shadow-md shadow-purple-900/20 group-hover:scale-105 transition-transform">
              <Heart className="h-6 w-6 fill-white" />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm font-semibold text-foreground truncate">Liked Songs</p>
              <p className="text-xs text-muted-foreground mt-0.5">{likes.length} songs</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* My Playlists Card */}
        <button
          type="button"
          onClick={() => onNavigateSection("playlists")}
          className="flex w-full items-center justify-between rounded-2xl bg-card border border-border p-3.5 transition-all hover:border-primary/40 active:scale-[0.99] shadow-xs cursor-pointer group"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#7C3AED] text-white shadow-md shadow-blue-900/20 group-hover:scale-105 transition-transform">
              <ListMusic className="h-6 w-6" />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm font-semibold text-foreground truncate">
                {playlists[0]?.name || "My Playlist"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {playlists[0]?.tracks?.length || 87} songs
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Chill Vibes Mix / Playlist Card */}
        <button
          type="button"
          onClick={() => onNavigateSection("history")}
          className="flex w-full items-center justify-between rounded-2xl bg-card border border-border p-3.5 transition-all hover:border-primary/40 active:scale-[0.99] shadow-xs cursor-pointer group"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF8A35] to-[#E040FB] text-white shadow-md shadow-orange-900/20 group-hover:scale-105 transition-transform">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm font-semibold text-foreground truncate">Chill Vibes</p>
              <p className="text-xs text-muted-foreground mt-0.5">92 songs</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Downloads / Workout Mix Card */}
        <button
          type="button"
          onClick={() => onNavigateSection("downloads")}
          className="flex w-full items-center justify-between rounded-2xl bg-card border border-border p-3.5 transition-all hover:border-primary/40 active:scale-[0.99] shadow-xs cursor-pointer group"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0284C7] to-[#0D9488] text-white shadow-md shadow-teal-900/20 group-hover:scale-105 transition-transform">
              <Download className="h-6 w-6" />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm font-semibold text-foreground truncate">Workout Mix & Downloads</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {downloads.length > 0 ? `${downloads.length} downloaded` : "104 songs"}
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Prominent "Create Playlist +" Gradient Button matching Screen 8 */}
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
            <h3 className="text-sm sm:text-base font-bold text-foreground">Recently Played</h3>
            <button
              type="button"
              onClick={() => onNavigateSection("history")}
              className="text-xs font-semibold text-primary hover:underline"
            >
              See all
            </button>
          </div>

          <div className="space-y-1">
            {history.slice(0, 8).map((track, i) => {
              const active = currentId === track.id;
              return (
                <div
                  key={`${track.id}-${i}`}
                  className={cn(
                    "flex items-center gap-3 rounded-xl p-2.5 transition-all",
                    active
                      ? "bg-secondary text-primary shadow-xs"
                      : "hover:bg-chip"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onPlayTrack(history, i)}
                    className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-card"
                  >
                    <img
                      src={track.thumbnail}
                      alt=""
                      className="h-full w-full object-cover"
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
                    <p className="truncate text-xs text-foreground/50 leading-tight mt-0.5">
                      {track.artist}
                    </p>
                  </button>

                  <span className="text-xs sm:text-sm tabular-nums text-muted-foreground font-medium shrink-0 px-1">
                    {getTrackDisplayDuration(track)}
                  </span>

                  {onOpenOptions && (
                    <button
                      type="button"
                      onClick={() => onOpenOptions(track)}
                      aria-label="Options"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/40 hover:text-foreground hover:bg-chip-strong active:scale-90 transition-all"
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
