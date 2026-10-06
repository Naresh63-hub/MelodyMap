import { useState } from "react";
import { Check, ListMusic, Plus, X } from "lucide-react";
import type { Playlist, Track } from "@/lib/library";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  track: Track | null;
  playlists: Playlist[];
  onClose: () => void;
  onCreatePlaylist: (name: string, tracks?: Track[]) => void;
  onAddToPlaylist: (playlistId: string, track: Track) => void;
};

export function AddToPlaylistModal({
  open,
  track,
  playlists,
  onClose,
  onCreatePlaylist,
  onAddToPlaylist,
}: Props) {
  const [newPlaylistName, setNewPlaylistName] = useState("");

  if (!open || !track) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPlaylistName.trim();
    if (!trimmed) return;
    onCreatePlaylist(trimmed, [track]);
    setNewPlaylistName("");
    onClose();
  };

  const handleSelectPlaylist = (playlist: Playlist) => {
    onAddToPlaylist(playlist.id, track);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Sheet / Dialog */}
      <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-surface border border-white/[0.06] p-5 shadow-2xl shadow-black/80 z-10 animate-slide-up space-y-4">
        {/* Grab bar on mobile */}
        <div className="mx-auto h-1 w-12 rounded-full bg-white/20 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <ListMusic className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-[#F5F5F5]">Add to Playlist</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:bg-white/[0.06] hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Track preview */}
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-card border border-white/[0.06]">
          <img
            src={track.thumbnail}
            alt=""
            className="h-11 w-11 rounded-lg object-cover bg-white/[0.04]"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[#F5F5F5]">{track.title}</p>
            <p className="truncate text-xs text-[#A1A1A1] mt-0.5">{track.artist}</p>
          </div>
        </div>

        {/* Create new playlist form */}
        <form onSubmit={handleCreate} className="space-y-2">
          <label
            htmlFor="new-playlist-input"
            className="block text-[11px] font-medium uppercase tracking-[0.12em] text-[#737373] px-1"
          >
            Create New Playlist
          </label>
          <div className="flex items-center gap-2">
            <input
              id="new-playlist-input"
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="Playlist name..."
              className="flex-1 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 text-sm text-[#F5F5F5] placeholder:text-[#737373] focus:border-white/20 focus:ring-1 focus:ring-white/10 focus:outline-none transition-all"
              autoFocus
            />
            <button
              type="submit"
              disabled={!newPlaylistName.trim()}
              className="h-10 px-4 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground font-semibold text-xs transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Create
            </button>
          </div>
        </form>

        {/* Existing playlists list */}
        <div className="space-y-1.5 pt-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#737373] px-1">
            Existing Playlists
          </p>

          {playlists.length === 0 ? (
            <p className="py-4 text-center text-xs text-[#737373]">
              No playlists yet. Type a name above to create your first one!
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1 scrollbar-premium">
              {playlists.map((pl) => {
                const alreadyContains = pl.tracks.some((t) => t.id === track.id);
                return (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => handleSelectPlaylist(pl)}
                    disabled={alreadyContains}
                    className={cn(
                      "flex w-full items-center justify-between p-2.5 rounded-xl border text-left transition-all",
                      alreadyContains
                        ? "bg-white/[0.02] border-transparent opacity-60 cursor-default"
                        : "bg-card hover:bg-popover border-white/[0.04] active:scale-[0.99]"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-[#A1A1A1]">
                        <ListMusic className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#F5F5F5]">{pl.name}</p>
                        <p className="text-xs text-[#737373] mt-0.5">
                          {pl.tracks.length} song{pl.tracks.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>

                    {alreadyContains ? (
                      <span className="flex items-center gap-1 text-xs text-primary shrink-0 font-medium">
                        <Check className="h-3.5 w-3.5" />
                        Added
                      </span>
                    ) : (
                      <Plus className="h-4 w-4 text-[#737373] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
