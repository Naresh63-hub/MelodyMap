import { useCallback, useEffect, useRef, useState } from "react";

import { getBlob } from "@/lib/offline";

/**
 * HTML5-Audio-backed player. Mirrors the surface of the old YouTube
 * iframe player so the rest of the app is untouched, but streams a
 * direct audio URL instead — no ads, and playback keeps running when the
 * app is backgrounded or the screen is locked.
 *
 * Network playback goes through our same-origin /api/stream proxy, which
 * resolves the stream server-side and serves bounded ranges — throttled
 * YouTube URLs that would silently fail (or 403 on open-ended ranges) in
 * the browser just work here, and seeking still functions.
 */
export function useAudioPlayer(options: {
  onEnded: () => void;
  onError?: (message: string) => void;
}) {
  const streamUrl = (id: string) => `/api/stream/${encodeURIComponent(id)}`;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (typeof document !== "undefined" && !audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.preload = "auto";
  }

  const endedRef = useRef(options.onEnded);
  endedRef.current = options.onEnded;
  const onErrorRef = useRef(options.onError);
  onErrorRef.current = options.onError;
  /** True when playback should auto-start as soon as a stream is ready. */
  const wantPlayRef = useRef(false);
  /** Object URLs we created for offline blobs — revoked when replaced or on unmount. */
  const objectUrlRef = useRef<string | null>(null);

  const [ready] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTime = () => {
      setPosition(audio.currentTime || 0);
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const onEnded = () => {
      setIsPlaying(false);
      endedRef.current();
    };
    const onError = () => {
      setIsPlaying(false);
      const message = "This song is unavailable. Skipping...";
      onErrorRef.current?.(message);
      
      // Disabled auto-advance for now - let user manually skip restricted songs
      // if (onAutoAdvanceRef.current) {
      //   setTimeout(() => {
      //     onAutoAdvanceRef.current?.();
      //   }, 3000);
      // }
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onTime);
    audio.addEventListener("loadedmetadata", onTime);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onTime);
      audio.removeEventListener("loadedmetadata", onTime);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, []);

  /** Cleanup: pause audio, revoke blob URLs on unmount. */
  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  /** Point the audio element at a resolved stream URL. */
  const setStream = useCallback((url: string, startAt = 0) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (startAt > 0) {
      const seekToStart = () => {
        audio.currentTime = startAt;
        audio.removeEventListener("loadedmetadata", seekToStart);
      };
      audio.addEventListener("loadedmetadata", seekToStart);
    }
    audio.src = url;
    if (wantPlayRef.current) {
      void audio.play().catch((err) => {
        console.warn("[MelodyMap] play() failed:", err);
        onErrorRef.current?.("Playback blocked. Tap play to resume.");
      });
    }
  }, []);

  /** Use a downloaded blob when available — plays with no connection. */
  const playOffline = useCallback(
    async (id: string, startAt = 0): Promise<boolean> => {
      try {
        const blob = await getBlob(id);
        if (!blob) return false;
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        setStream(url, startAt);
        return true;
      } catch (err) {
        console.warn("[MelodyMap] Offline playback failed:", err);
        return false;
      }
    },
    [setStream],
  );

  /** Load a track and start playing (used when the user picks a song). */
  const load = useCallback(
    async (id: string, directUrl?: string) => {
      wantPlayRef.current = true;
      if (await playOffline(id)) return; // downloaded copy wins
      
      if (directUrl) {
        setStream(directUrl);
        return;
      }

      setStream(streamUrl(id));
    },
    [setStream, playOffline],
  );

  /** Load a track at a position without autoplay (used to resume a session). */
  const cue = useCallback(
    async (id: string, startSeconds = 0, directUrl?: string) => {
      wantPlayRef.current = false;
      if (await playOffline(id, startSeconds)) return; // downloaded copy wins
      
      if (directUrl) {
        setStream(directUrl, startSeconds);
        return;
      }

      setStream(streamUrl(id), startSeconds);
    },
    [setStream, playOffline],
  );

  const play = useCallback(() => {
    wantPlayRef.current = true;
    const audio = audioRef.current;
    if (audio?.src) {
      void audio.play().catch((err) => {
        console.warn("[MelodyMap] play() failed:", err);
      });
    }
  }, []);

  const pause = useCallback(() => {
    wantPlayRef.current = false;
    audioRef.current?.pause();
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    const max = audio.duration > 0 ? audio.duration : seconds;
    audio.currentTime = Math.max(0, Math.min(seconds, max));
  }, []);

  const setVolume = useCallback((v: number) => {
    const audio = audioRef.current;
    if (audio) audio.volume = Math.max(0, Math.min(1, v / 100));
  }, []);

  return {
    ready,
    isPlaying,
    position,
    duration,
    load,
    cue,
    play,
    pause,
    seek,
    setVolume,
  };
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
