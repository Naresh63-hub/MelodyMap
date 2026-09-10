import {
  Heart,
  ListMusic,
  Download,
  ListPlus,
  User,
  Share2,
  Trash2,
  X,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Track } from "@/lib/library";

type Props = {
  open: boolean;
  track: Track | null;
  isLiked: boolean;
  isDownloaded: boolean;
  onClose: () => void;
  onToggleLike: (track: Track) => void;
  onAddToPlaylist: (track: Track) => void;
  onDownload: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onGoToArtist?: (artist: string) => void;
  onShare?: (track: Track) => void;
  onDeleteFromLibrary?: (track: Track) => void;
};

export function SongOptionsModal({
  open,
  track,
  isLiked,
  isDownloaded,
  onClose,
  onToggleLike,
  onAddToPlaylist,
  onDownload,
  onAddToQueue,
  onGoToArtist,
  onShare,
  onDeleteFromLibrary,
}: Props) {
  if (!open || !track) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Modal Sheet */}
      <div className="relative w-full max-w-lg rounded-t-3xl bg-[#140f24] border-t border-purple-500/20 p-5 shadow-2xl z-10 animate-slide-up">
        {/* Grab bar */}
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-white/20" />

        {/* Track header */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-white/[0.08]">
          <img
            src={track.thumbnail}
            alt=""
            className="h-14 w-14 rounded-xl object-cover shadow-lg shadow-purple-950/40"
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold text-white">{track.title}</h3>
            <p className="truncate text-xs text-purple-300/60 mt-0.5">{track.artist}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Options list */}
        <div className="py-2 space-y-1">
          {/* Like */}
          <button
            type="button"
            onClick={() => {
              onToggleLike(track);
              onClose();
            }}
            className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm text-white/90 hover:bg-purple-500/10 active:bg-purple-500/20 transition-colors"
          >
            <span className="font-medium">
              {isLiked ? "Remove from Liked Songs" : "Add to Liked Songs"}
            </span>
            <Heart
              className={cn(
                "h-5 w-5",
                isLiked ? "fill-purple-400 text-purple-400" : "text-white/40"
              )}
            />
          </button>

          {/* Add to Playlist */}
          <button
            type="button"
            onClick={() => {
              onAddToPlaylist(track);
              onClose();
            }}
            className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm text-white/90 hover:bg-purple-500/10 active:bg-purple-500/20 transition-colors"
          >
            <span className="font-medium">Add to Playlist</span>
            <ListMusic className="h-5 w-5 text-white/40" />
          </button>

          {/* Download */}
          <button
            type="button"
            onClick={() => {
              onDownload(track);
              onClose();
            }}
            className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm text-white/90 hover:bg-purple-500/10 active:bg-purple-500/20 transition-colors"
          >
            <span className="font-medium">
              {isDownloaded ? "Remove Download" : "Download"}
            </span>
            <Download
              className={cn(
                "h-5 w-5",
                isDownloaded ? "text-purple-400" : "text-white/40"
              )}
            />
          </button>

          {/* Add to Queue */}
          <button
            type="button"
            onClick={() => {
              onAddToQueue(track);
              onClose();
            }}
            className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm text-white/90 hover:bg-purple-500/10 active:bg-purple-500/20 transition-colors"
          >
            <span className="font-medium">Add to Queue</span>
            <ListPlus className="h-5 w-5 text-white/40" />
          </button>

          {/* Go to Artist */}
          {onGoToArtist && (
            <button
              type="button"
              onClick={() => {
                onGoToArtist(track.artist);
                onClose();
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm text-white/90 hover:bg-purple-500/10 active:bg-purple-500/20 transition-colors"
            >
              <span className="font-medium">Go to Artist</span>
              <User className="h-5 w-5 text-white/40" />
            </button>
          )}

          {/* Share */}
          {onShare && (
            <button
              type="button"
              onClick={() => {
                onShare(track);
                onClose();
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm text-white/90 hover:bg-purple-500/10 active:bg-purple-500/20 transition-colors"
            >
              <span className="font-medium">Share</span>
              <Share2 className="h-5 w-5 text-white/40" />
            </button>
          )}

          {/* Delete from library */}
          {onDeleteFromLibrary && (
            <button
              type="button"
              onClick={() => {
                onDeleteFromLibrary(track);
                onClose();
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors pt-3 border-t border-white/[0.06]"
            >
              <span className="font-medium">Delete from Library</span>
              <Trash2 className="h-5 w-5 text-red-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
