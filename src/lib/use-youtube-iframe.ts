import { useCallback, useEffect, useRef, useState } from "react";

/**
 * YouTube IFrame Player API hook.
 *
 * Creates exactly ONE hidden YT.Player instance that persists for the
 * lifetime of the component. Songs are loaded via `loadVideoById()`
 * so YouTube handles all streaming, buffering, ads, etc.
 */

/* ------------------------------------------------------------------ */
/*  YouTube IFrame API bootstrap                                       */
/* ------------------------------------------------------------------ */

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement | string,
        opts: YTPlayerOptions,
      ) => YTPlayerInstance;
      PlayerState: {
        UNSTARTED: -1;
        ENDED: 0;
        PLAYING: 1;
        PAUSED: 2;
        BUFFERING: 3;
        CUED: 5;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type YTPlayerInstance = {
  loadVideoById: (id: string) => void;
  cueVideoById: (id: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (vol: number) => void;
  getVolume: () => number;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
};

type YTPlayerOptions = {
  height?: string;
  width?: string;
  playerVars?: Record<string, number | string>;
  events?: {
    onReady?: (e: { target: YTPlayerInstance }) => void;
    onStateChange?: (e: { data: number }) => void;
    onError?: (e: { data: number }) => void;
  };
};

let apiPromise: Promise<void> | null = null;

function loadYTApi(): Promise<void> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => resolve();
    // Fallback: if the callback never fires (e.g. blocked), resolve after 5 s
    setTimeout(resolve, 5000);
  });
  return apiPromise;
}

/* ------------------------------------------------------------------ */
/*  React hook                                                         */
/* ------------------------------------------------------------------ */

const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

export function useYouTubePlayer(options: {
  onEnded: () => void;
  onError?: (msg: string) => void;
}) {
  const endedRef = useRef(options.onEnded);
  endedRef.current = options.onEnded;
  const onErrorRef = useRef(options.onError);
  onErrorRef.current = options.onError;

  const playerRef = useRef<YTPlayerInstance | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentIdRef = useRef<string>("");
  const wantPlayRef = useRef(false);
  const restoringRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(false);

  /* ---- Create the hidden container + YT.Player once ---- */
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (playerRef.current) return;

    // Create a tiny hidden container
    const container = document.createElement("div");
    container.id = "yt-player-container";
    container.style.cssText =
      "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;pointer-events:none;";
    document.body.appendChild(container);
    containerRef.current = container;

    let destroyed = false;

    void loadYTApi().then(() => {
      if (destroyed || !window.YT?.Player || !container.parentNode) return;

      const ytPlayer = new window.YT.Player(container, {
        height: "1",
        width: "1",
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            if (!destroyed) {
              playerRef.current = ytPlayer;
              setReady(true);
            }
          },
          onStateChange: (e) => {
            if (destroyed) return;
            const state = e.data;

            if (state === YT_STATE.PLAYING) {
              setIsPlaying(true);
              setBuffering(false);
            } else if (state === YT_STATE.PAUSED) {
              setIsPlaying(false);
              setBuffering(false);
            } else if (state === YT_STATE.BUFFERING) {
              setBuffering(true);
            } else if (state === YT_STATE.ENDED) {
              setIsPlaying(false);
              setBuffering(false);
              endedRef.current();
            }
          },
          onError: (e) => {
            if (destroyed) return;
            console.warn("[MelodyMap] YT Player error:", e.data);
            setIsPlaying(false);
            // Errors 2 (invalid param), 100 (video not found), 150 (embed forbidden)
            // Usually means the video is unavailable — skip it.
            onErrorRef.current?.("This song is unavailable. Skipping...");
          },
        },
      });
    });

    // Poll position/duration while playing
    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      try {
        const t = player.getCurrentTime();
        const d = player.getDuration();
        if (Number.isFinite(t)) setPosition(t);
        if (Number.isFinite(d) && d > 0) setDuration(d);
      } catch {
        // Player may not be ready yet
      }
    }, 250);

    return () => {
      destroyed = true;
      clearInterval(interval);
      try {
        playerRef.current?.destroy();
      } catch {
        // Ignore
      }
      playerRef.current = null;
      if (container.parentNode) container.parentNode.removeChild(container);
    };
  }, []);

  /* ---- Public API ---- */

  const load = useCallback(
    async (id: string) => {
      currentIdRef.current = id;
      wantPlayRef.current = true;
      restoringRef.current = false;
      const player = playerRef.current;
      if (!player) return;
      try {
        player.loadVideoById(id);
      } catch (err) {
        console.warn("[MelodyMap] loadVideoById failed:", err);
      }
    },
    [],
  );

  const cue = useCallback(
    async (id: string, startAt = 0) => {
      currentIdRef.current = id;
      wantPlayRef.current = false;
      restoringRef.current = true;
      const player = playerRef.current;
      if (!player) return;
      try {
        player.cueVideoById(id);
        // Seek to position once cued
        if (startAt > 0) {
          const seekWhenReady = () => {
            try {
              const state = player.getPlayerState();
              if (state === YT_STATE.CUED || state === YT_STATE.PAUSED) {
                player.seekTo(startAt, true);
              }
            } catch {
              // Ignore
            }
          };
          setTimeout(seekWhenReady, 500);
          setTimeout(seekWhenReady, 1500);
        }
      } catch (err) {
        console.warn("[MelodyMap] cueVideoById failed:", err);
      }
    },
    [],
  );

  const play = useCallback(() => {
    wantPlayRef.current = true;
    restoringRef.current = false;
    try {
      playerRef.current?.playVideo();
    } catch (err) {
      console.warn("[MelodyMap] play() failed:", err);
    }
  }, []);

  const pause = useCallback(() => {
    wantPlayRef.current = false;
    try {
      playerRef.current?.pauseVideo();
    } catch {
      // Ignore
    }
  }, []);

  const seek = useCallback((seconds: number) => {
    try {
      const p = playerRef.current;
      if (!p) return;
      const d = p.getDuration();
      const max = d > 0 ? d : seconds;
      p.seekTo(Math.max(0, Math.min(seconds, max)), true);
    } catch {
      // Ignore
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    try {
      playerRef.current?.setVolume(Math.max(0, Math.min(100, v)));
    } catch {
      // Ignore
    }
  }, []);

  return {
    ready,
    isPlaying,
    buffering,
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
