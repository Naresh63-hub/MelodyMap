import { useEffect } from "react";
import type { Track } from "@/lib/library";

type Handlers = {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (seconds: number) => void;
};

/** Keeps OS/lock-screen media controls in sync so playback behaves like a music app. */
export function useMediaSession(
  track: Track | undefined,
  isPlaying: boolean,
  position: number,
  duration: number,
  handlers: Handlers,
) {
  useEffect(() => {
    const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
    if (!ms) return;
    if (track) {
      ms.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: "Midnight Vinyl",
        artwork: [{ src: track.thumbnail, sizes: "480x360", type: "image/jpeg" }],
      });
    }
    ms.playbackState = isPlaying ? "playing" : "paused";
    const set = (action: MediaSessionAction, fn: (() => void) | null) => {
      try {
        ms.setActionHandler(action, fn);
      } catch {
        /* unsupported action */
      }
    };
    set("play", handlers.onPlay);
    set("pause", handlers.onPause);
    set("nexttrack", handlers.onNext);
    set("previoustrack", handlers.onPrev);
    set("seekbackward", () => handlers.onSeek(Math.max(0, position - 10)));
    set("seekforward", () => handlers.onSeek(position + 10));
    return () => {
      set("play", null);
      set("pause", null);
      set("nexttrack", null);
      set("previoustrack", null);
      set("seekbackward", null);
      set("seekforward", null);
    };
  }, [track, isPlaying, position, duration, handlers]);
}
