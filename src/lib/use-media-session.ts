import { useEffect, useRef } from "react";
import type { Track } from "@/lib/library";

type Handlers = {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (seconds: number) => void;
};

/**
 * Keeps OS, lock-screen, smartwatch, and notification shade media controls in sync.
 * Designed specifically for rock-solid background playback and screen-off controls
 * (Spotify-like lockscreen experience on Android, iOS, Windows, macOS).
 */
export function useMediaSession(
  track: Track | undefined,
  isPlaying: boolean,
  position: number,
  duration: number,
  handlers: Handlers,
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const positionRef = useRef(position);
  positionRef.current = position;

  const durationRef = useRef(duration);
  durationRef.current = duration;

  // 1. Register Action Handlers ONCE using stable delegators (never churn/tear down on position updates)
  useEffect(() => {
    const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
    if (!ms) return;

    const set = (action: MediaSessionAction, fn: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(action, fn);
      } catch (err) {
        // Some browsers don't support all action types
      }
    };

    set("play", () => handlersRef.current.onPlay());
    set("pause", () => handlersRef.current.onPause());
    set("stop", () => handlersRef.current.onPause());
    set("nexttrack", () => handlersRef.current.onNext());
    set("previoustrack", () => handlersRef.current.onPrev());
    set("seekbackward", (details) => {
      const offset = details?.seekOffset ?? 10;
      handlersRef.current.onSeek(Math.max(0, positionRef.current - offset));
    });
    set("seekforward", (details) => {
      const offset = details?.seekOffset ?? 10;
      handlersRef.current.onSeek(positionRef.current + offset);
    });
    set("seekto", (details) => {
      if (typeof details?.seekTime === "number") {
        handlersRef.current.onSeek(details.seekTime);
      }
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
  }, []);

  // 2. Update Track Metadata whenever track changes
  useEffect(() => {
    const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
    if (!ms || !track) return;

    const thumb = track.thumbnail || "/icons/icon-512.png";
    const artworkList: MediaImage[] = [
      { src: thumb, sizes: "96x96", type: "image/jpeg" },
      { src: thumb, sizes: "128x128", type: "image/jpeg" },
      { src: thumb, sizes: "192x192", type: "image/jpeg" },
      { src: thumb, sizes: "256x256", type: "image/jpeg" },
      { src: thumb, sizes: "384x384", type: "image/jpeg" },
      { src: thumb, sizes: "512x512", type: "image/jpeg" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ];

    try {
      ms.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: "MelodyMap",
        artwork: artworkList,
      });
    } catch (err) {
      console.warn("[MediaSession] Could not set metadata:", err);
    }
  }, [track?.id, track?.title, track?.artist, track?.thumbnail]);

  // 3. Update Playback State
  useEffect(() => {
    const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
    if (!ms) return;
    ms.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  // 4. Update Position State safely without tearing down handlers
  useEffect(() => {
    const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
    if (!ms || !("setPositionState" in ms)) return;

    if (duration > 0 && Number.isFinite(duration) && Number.isFinite(position)) {
      try {
        ms.setPositionState({
          duration,
          position: Math.min(Math.max(0, position), duration),
          playbackRate: 1,
        });
      } catch {
        // Ignored if audio is transitioning
      }
    }
  }, [position, duration]);
}
