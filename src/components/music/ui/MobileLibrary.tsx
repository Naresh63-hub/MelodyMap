import {
  Heart,
  Clock,
  ListMusic,
  Download,
  ChevronRight,
  MoreVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Track, Playlist } from "@/lib/library";
import { Equalizer } from "@/components/music/NowPlayingViz";

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
}: Props) {
  const sections = [
    {
      id: "liked" as const,
      label: "Favourites",
      icon: Heart,
      detail: `${likes.length} songs`,
      iconBg: "bg-white/[0.06] text-[#1DB954] border border-white/10",
    },
    {
      id: "history" as const,
      label: "History",
      icon: Clock,
      detail: "Recently played",
      iconBg: "bg-white/[0.06] text-white/70 border border-white/10",
    },
    {
      id: "playlists" as const,
      label: "Playlists",
      icon: ListMusic,
      detail: `${playlists.length} playlists`,
      iconBg: "bg-white/[0.06] text-white/70 border border-white/10",
    },
    {
      id: "downloads" as const,
      label: "Downloads",
      icon: Download,
      detail: `${downloads.length} songs`,
      iconBg: "bg-white/[0.06] text-white/70 border border-white/10",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 4 Main Action Rows */}
      <div className="space-y-2">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onNavigateSection(section.id)}
              className="flex w-full items-center gap-3.5 rounded-lg bg-[#141414] border border-white/[0.04] p-3 text-left transition-colors hover:bg-white/[0.04] active:scale-[0.99]"
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
                  section.iconBg
                )}
              >
                <Icon className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{section.label}</p>
                <p className="text-xs text-white/50 mt-0.5">{section.detail}</p>
              </div>

              <ChevronRight className="h-4 w-4 text-white/30" />
            </button>
          );
        })}
      </div>

      {/* Recently Played Section */}
      {history.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-white">Recently Played</h2>
            <button
              type="button"
              onClick={() => onNavigateSection("history")}
              className="text-xs font-semibold text-[#1DB954] hover:underline"
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
                    "flex items-center gap-3 rounded-lg p-2 transition-colors",
                    active
                      ? "bg-white/[0.08]"
                      : "hover:bg-white/[0.04]"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onPlayTrack(history, i)}
                    className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-[#181818]"
                  >
                    <img
                      src={track.thumbnail}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    {active && isPlaying && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Equalizer active className="h-3.5 w-3.5 text-[#1DB954]" />
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
                        active ? "text-[#1DB954]" : "text-white"
                      )}
                    >
                      {track.title}
                    </p>
                    <p className="truncate text-xs text-white/50 leading-tight mt-0.5">
                      {track.artist}
                    </p>
                  </button>

                  {onOpenOptions && (
                    <button
                      type="button"
                      onClick={() => onOpenOptions(track)}
                      aria-label="Options"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/[0.08] active:scale-90 transition-all"
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
