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
    if (duration > 0 && "setPositionState" in ms) {
      try {
        ms.setPositionState({
          duration,
          position: Math.min(position, duration),
          playbackRate: 1,
        });
      } catch {
        /* position state unsupported */
      }
    }
    const set = (action: MediaSessionAction, fn: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(action, fn);
      } catch {
        /* unsupported action */
      }
    };
    set("play", handlers.onPlay);
    set("pause", handlers.onPause);
    set("stop", handlers.onPause);
    set("nexttrack", handlers.onNext);
    set("previoustrack", handlers.onPrev);
    set("seekbackward", (details) =>
      handlers.onSeek(Math.max(0, position - (details?.seekOffset ?? 10))),
    );
    set("seekforward", (details) => handlers.onSeek(position + (details?.seekOffset ?? 10)));
    set("seekto", (details) => {
      if (typeof details?.seekTime === "number") handlers.onSeek(details.seekTime);
    });
    return () => {
      for (const action of [
        "play",
        "pause",
        "stop",
        "nexttrack",
        "previoustrack",
        "seekbackward",
        "seekforward",
        "seekto",
      ] as MediaSessionAction[]) {
        set(action, null);
      }
    };
  }, [track, isPlaying, position, duration, handlers]);
}

