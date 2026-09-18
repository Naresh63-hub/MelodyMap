import { useCallback, useEffect, useRef, useState } from "react";
import { getBlob } from "@/lib/offline";
import {
  EQUALIZER_FREQUENCIES,
  EQUALIZER_PRESETS,
  loadEqualizerSettings,
  saveEqualizerSettings,
  type EqualizerPreset,
  type EqualizerSettings,
} from "@/lib/equalizer";
import {
  fetchSponsorBlockSegments,
  findSkipTarget,
  getSponsorBlockEnabled,
  type SponsorBlockSegment,
} from "@/lib/sponsorblock";

export type NextTrackInfo = {
  id: string;
  previewUrl?: string | undefined;
};

/**
 * HTML5-Audio + Web Audio API backed player with Spotify-like background playback,
 * screen-off & lockscreen continuous playback, 10-band hardware equalizer, sound presets,
 * gapless pre-buffering, speed adjustment, offline caching, and robust stream resolution.
 */
export function useAudioPlayer(options: {
  onEnded: () => void;
  onError?: (message: string) => void;
  getNextTrack?: () => NextTrackInfo | undefined;
  onSponsorBlockSkipped?: (category: string) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prebufferAudioRef = useRef<HTMLAudioElement | null>(null);
  const prebufferedTrackIdRef = useRef<string | null>(null);
  const sponsorSegmentsRef = useRef<SponsorBlockSegment[]>([]);
  const qualityFallbackStepRef = useRef<number>(0); // 0 = original, 1 = standard, 2 = saver

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filterNodesRef = useRef<BiquadFilterNode[]>([]);


  // Equalizer & sound profile state
  const [equalizerSettings, setEqualizerSettingsState] = useState<EqualizerSettings>(loadEqualizerSettings);
  const equalizerSettingsRef = useRef(equalizerSettings);
  equalizerSettingsRef.current = equalizerSettings;

  const streamUrl = useCallback((id: string, quality?: string) => {
    const q = quality || equalizerSettingsRef.current.quality || "high";
    return `/api/stream/${encodeURIComponent(id)}?quality=${encodeURIComponent(q)}`;
  }, []);

  // Initialize and attach core audio + prebuffer elements to DOM
  if (typeof document !== "undefined") {
    if (!audioRef.current) {
      let el = document.getElementById("melodymap-core-audio") as HTMLAudioElement | null;
      if (!el) {
        el = document.createElement("audio");
        el.id = "melodymap-core-audio";
        el.setAttribute("playsinline", "true");
        el.setAttribute("webkit-playsinline", "true");
        el.setAttribute("x-webkit-airplay", "allow");
        el.crossOrigin = "anonymous";
        el.preload = "auto";
        el.volume = 1;
        el.muted = false;
        el.style.position = "fixed";
        el.style.bottom = "0";
        el.style.left = "0";
        el.style.width = "0";
        el.style.height = "0";
        el.style.opacity = "0";
        el.style.pointerEvents = "none";
        try {
          document.body.appendChild(el);
        } catch {}
      } else {
        el.crossOrigin = "anonymous";
        el.muted = false;
      }
      audioRef.current = el;
    }

    if (!prebufferAudioRef.current) {
      let pEl = document.getElementById("melodymap-prebuffer-audio") as HTMLAudioElement | null;
      if (!pEl) {
        pEl = document.createElement("audio");
        pEl.id = "melodymap-prebuffer-audio";
        pEl.crossOrigin = "anonymous";
        pEl.preload = "auto";
        pEl.muted = true;
        pEl.volume = 0;
        pEl.style.display = "none";
        try {
          document.body.appendChild(pEl);
        } catch {}
      }
      prebufferAudioRef.current = pEl;
    }
  }

  const endedRef = useRef(options.onEnded);
  endedRef.current = options.onEnded;
  const onErrorRef = useRef(options.onError);
  onErrorRef.current = options.onError;
  const getNextTrackRef = useRef(options.getNextTrack);
  getNextTrackRef.current = options.getNextTrack;
  const onSponsorBlockSkippedRef = useRef(options.onSponsorBlockSkipped);
  onSponsorBlockSkippedRef.current = options.onSponsorBlockSkipped;

  /** True when playback should auto-start as soon as a stream is ready. */
  const wantPlayRef = useRef(false);
  /** Object URLs created for offline blobs. */
  const objectUrlRef = useRef<string | null>(null);
  /** Pending seek target queued while audio metadata is loading */
  const pendingSeekRef = useRef<number | null>(null);

  const [ready] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const saved = localStorage.getItem("melodymap.playback_speed.v1");
    return saved ? Math.min(3, Math.max(0.25, Number(saved) || 1)) : 1;
  });

  const currentTrackIdRef = useRef<string | null>(null);
  const mainGainRef = useRef<GainNode | null>(null);
  const prebufferGainRef = useRef<GainNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);

  /** Calculate equal-power trigonometric curve for smooth crossfading without volume drop */
  const createEqualPowerCurve = (type: "in" | "out", length = 32): Float32Array => {
    const curve = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const t = i / (length - 1);
      curve[i] = type === "in" ? Math.sin((t * Math.PI) / 2) : Math.cos((t * Math.PI) / 2);
    }
    return curve;
  };

  // Initialize Web Audio API 10-band equalizer + Dynamics Compressor graph on user interaction
  const initWebAudio = useCallback(() => {
    if (typeof window === "undefined") return;
    const audio = audioRef.current;
    if (!audio) return;

    if (!audioCtxRef.current) {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;

        const source = ctx.createMediaElementSource(audio);
        sourceNodeRef.current = source;

        const mainGain = ctx.createGain();
        mainGain.gain.value = 1;
        mainGainRef.current = mainGain;
        source.connect(mainGain);

        // Build 10-band biquad filter chain
        const currentSettings = equalizerSettingsRef.current;
        const filters = EQUALIZER_FREQUENCIES.map((band, idx) => {
          const filter = ctx.createBiquadFilter();
          filter.frequency.value = band.frequency;
          if (idx === 0) {
            filter.type = "lowshelf";
          } else if (idx === EQUALIZER_FREQUENCIES.length - 1) {
            filter.type = "highshelf";
          } else {
            filter.type = "peaking";
            filter.Q.value = 1.4;
          }
          filter.gain.value = currentSettings.enabled ? (currentSettings.gains[idx] ?? 0) : 0;
          return filter;
        });

        filterNodesRef.current = filters;

        // Broadcast standard Dynamic Range Compressor (-14 LUFS leveling)
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-24, ctx.currentTime);
        compressor.knee.setValueAtTime(30, ctx.currentTime);
        compressor.ratio.setValueAtTime(3, ctx.currentTime);
        compressor.attack.setValueAtTime(0.003, ctx.currentTime);
        compressor.release.setValueAtTime(0.25, ctx.currentTime);
        compressorRef.current = compressor;

        // Connect main gain -> filter[0] -> ... -> compressor -> destination
        if (filters.length > 0 && filters[0]) {
          mainGain.connect(filters[0]);
          let prevNode: AudioNode = filters[0];
          for (let i = 1; i < filters.length; i++) {
            const f = filters[i];
            if (f) {
              prevNode.connect(f);
              prevNode = f;
            }
          }
          prevNode.connect(compressor);
          compressor.connect(ctx.destination);
        } else {
          mainGain.connect(compressor);
          compressor.connect(ctx.destination);
        }
      } catch (err) {
        console.warn("[WebAudio] Equalizer init notice:", err);
      }
    }

    if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }
  }, []);

  // Update physical filter gains when equalizer settings change
  useEffect(() => {
    const filters = filterNodesRef.current;
    if (!filters || filters.length === 0) return;
    filters.forEach((filter, idx) => {
      const targetGain = equalizerSettings.enabled ? (equalizerSettings.gains[idx] ?? 0) : 0;
      try {
        filter.gain.value = targetGain;
      } catch {}
    });
  }, [equalizerSettings]);

  const applyEqualizerGains = useCallback(
    (settings: EqualizerSettings) => {
      saveEqualizerSettings(settings);
      setEqualizerSettingsState(settings);
      initWebAudio();
      const filters = filterNodesRef.current;
      if (filters && filters.length > 0) {
        filters.forEach((filter, idx) => {
          const targetGain = settings.enabled ? (settings.gains[idx] ?? 0) : 0;
          try {
            filter.gain.value = targetGain;
          } catch {}
        });
      }
    },
    [initWebAudio],
  );

  const setEqualizerPreset = useCallback(
    (preset: EqualizerPreset) => {
      const gains = EQUALIZER_PRESETS[preset]?.gains || EQUALIZER_PRESETS.flat.gains;
      const next: EqualizerSettings = {
        ...equalizerSettings,
        enabled: true,
        preset,
        gains: [...gains],
      };
      applyEqualizerGains(next);
    },
    [equalizerSettings, applyEqualizerGains],
  );

  const setBandGain = useCallback(
    (bandIndex: number, gain: number) => {
      const nextGains = [...equalizerSettings.gains];
      nextGains[bandIndex] = Math.max(-12, Math.min(12, gain));
      const next: EqualizerSettings = {
        ...equalizerSettings,
        enabled: true,
        preset: "custom",
        gains: nextGains,
      };
      applyEqualizerGains(next);
    },
    [equalizerSettings, applyEqualizerGains],
  );

  const toggleEqualizer = useCallback(
    (enabled?: boolean) => {
      const nextEnabled = enabled !== undefined ? enabled : !equalizerSettings.enabled;
      const next: EqualizerSettings = {
        ...equalizerSettings,
        enabled: nextEnabled,
      };
      applyEqualizerGains(next);
    },
    [equalizerSettings, applyEqualizerGains],
  );

  const setCrossfadeDuration = useCallback(
    (seconds: number) => {
      const next: EqualizerSettings = {
        ...equalizerSettings,
        crossfade: Math.max(0, Math.min(8, seconds)),
      };
      applyEqualizerGains(next);
    },
    [equalizerSettings, applyEqualizerGains],
  );

  /** Point the audio element at a resolved stream URL with smooth playback */
  const setStream = useCallback(
    (url: string, startAt = 0) => {
      const audio = audioRef.current;
      if (!audio || !url || url.includes("/api/stream/undefined") || url.endsWith("/api/stream/")) return;

      initWebAudio();
      setIsLoading(true);

      if (startAt > 0) {
        pendingSeekRef.current = startAt;
        setPosition(startAt);
      } else {
        pendingSeekRef.current = null;
      }

      try {
        audio.pause();
      } catch {}

      audio.muted = false;
      audio.src = url;
      audio.playbackRate = playbackSpeed;
      audio.load();

      if (wantPlayRef.current) {
        const fadeDur = equalizerSettingsRef.current.crossfade || 0;
        if (fadeDur > 0 && audioCtxRef.current && mainGainRef.current) {
          const ctx = audioCtxRef.current;
          const mainGain = mainGainRef.current;
          const curve = createEqualPowerCurve("in", 32);
          try {
            mainGain.gain.cancelScheduledValues(ctx.currentTime);
            mainGain.gain.setValueCurveAtTime(curve, ctx.currentTime, Math.min(fadeDur, 4));
          } catch {}
        }

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            if (
              err.name === "NotAllowedError" ||
              err.name === "AbortError" ||
              err.name === "NotSupportedError"
            ) {
              return;
            }
            console.warn("[MelodyMap] play() error:", err);
            onErrorRef.current?.("Tap play to start playback.");
          });
        }
      }
    },
    [playbackSpeed, initWebAudio],
  );

  const setAudioQuality = useCallback(
    (quality: "saver" | "standard" | "high") => {
      const next: EqualizerSettings = {
        ...equalizerSettings,
        quality,
      };
      applyEqualizerGains(next);

      // Seamlessly hot-swap active stream at current position
      const audio = audioRef.current;
      const activeId = currentTrackIdRef.current;
      if (audio && activeId && audio.src && audio.src.includes("/api/stream/")) {
        const cur = audio.currentTime || 0;
        const newUrl = streamUrl(activeId, quality);
        setStream(newUrl, cur);
      }
    },
    [equalizerSettings, applyEqualizerGains, streamUrl, setStream],
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const applyPendingSeek = () => {
      if (pendingSeekRef.current !== null) {
        const target = pendingSeekRef.current;
        pendingSeekRef.current = null;
        const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : target;
        const clamped = Math.max(0, Math.min(target, dur));
        audio.currentTime = clamped;
        setPosition(clamped);
      }
    };

    const onPlay = () => {
      audio.muted = false;
      initWebAudio();
      setIsPlaying(true);
      setIsLoading(false);
      applyPendingSeek();
    };
    const onPlaying = () => {
      setIsPlaying(true);
      setIsLoading(false);
      applyPendingSeek();
    };
    const onWaiting = () => {
      if (wantPlayRef.current) setIsLoading(true);
    };
    const onCanPlay = () => {
      setIsLoading(false);
      applyPendingSeek();
    };
    const onLoadedMetadata = () => {
      applyPendingSeek();
      onTime();
    };
    const onPause = () => {
      setIsPlaying(false);
      setIsLoading(false);
    };
    const onTime = () => {
      const cur = audio.currentTime || 0;
      const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
      setPosition(cur);
      setDuration(dur);
      if (cur > 0) setIsLoading(false);

      // SponsorBlock Auto-Skip: Check if currentTime falls within an intro/sponsor/outro range
      if (getSponsorBlockEnabled() && sponsorSegmentsRef.current.length > 0) {
        const skip = findSkipTarget(cur, sponsorSegmentsRef.current);
        if (skip) {
          audio.currentTime = skip.target;
          onSponsorBlockSkippedRef.current?.(skip.category);
        }
      }

      // Gapless Pre-buffering: when current song has <= 25s left, pre-buffer upcoming track
      if (dur > 0 && dur - cur <= 25 && prebufferAudioRef.current) {
        const nextTrack = getNextTrackRef.current?.();
        if (nextTrack && nextTrack.id && prebufferedTrackIdRef.current !== nextTrack.id) {
          prebufferedTrackIdRef.current = nextTrack.id;
          const nextUrl = nextTrack.previewUrl || streamUrl(nextTrack.id, equalizerSettingsRef.current.quality);
          prebufferAudioRef.current.src = nextUrl;
          prebufferAudioRef.current.load();
        }
      }
    };

    // CRITICAL FOR SPOTIFY-LIKE SCREEN-OFF CONTINUOUS PLAYBACK:
    // When song ends with screen locked, synchronously switch .src & call .play()
    // inside the same event loop frame so mobile OS grants immediate autoplay permission!
    const onEnded = () => {
      setIsPlaying(false);
      setIsLoading(false);

      // Notify parent component
      endedRef.current();

      // Synchronous background advance
      const nextTrack = getNextTrackRef.current?.();
      if (nextTrack && wantPlayRef.current) {
        const nextUrl = nextTrack.previewUrl || streamUrl(nextTrack.id, equalizerSettingsRef.current.quality);
        audio.src = nextUrl;
        audio.playbackRate = playbackSpeed;
        audio.load();
        const p = audio.play();
        if (p !== undefined) {
          p.catch((err) => {
            console.warn("[BackgroundPlayback] Synchronous next auto-play notice:", err);
          });
        }
      }
    };

    const onError = () => {
      setIsPlaying(false);
      setIsLoading(false);
      if (
        audio.error &&
        audio.error.code !== 1 &&
        audio.error.code !== 20 &&
        audio.src &&
        !audio.src.includes("/api/stream/undefined") &&
        !audio.src.endsWith("/api/stream/")
      ) {
        console.warn("[MelodyMap] Audio element error:", audio.error.code, audio.error.message);

        // Quality Auto-Fallback: Try lower qualities if the stream failed
        const activeId = currentTrackIdRef.current;
        if (
          activeId &&
          audio.src &&
          audio.src.includes("/api/stream/") &&
          qualityFallbackStepRef.current < 2
        ) {
          qualityFallbackStepRef.current += 1;
          const fallbackQuality = qualityFallbackStepRef.current === 1 ? "standard" : "saver";
          console.info(`[MelodyMap] Retrying track ${activeId} with fallback quality: ${fallbackQuality}`);
          const retryUrl = streamUrl(activeId, fallbackQuality);
          const resumePos = audio.currentTime || 0;
          setStream(retryUrl, resumePos);
          return;
        }

        const message = "Could not load audio stream. Tap play to retry.";
        onErrorRef.current?.(message);
      }
    };


    audio.addEventListener("play", onPlay);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onTime);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onTime);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [playbackSpeed, initWebAudio, streamUrl]);

  /** Cleanup on unmount */
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
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  /** Use downloaded blob when available */
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

  /** Load a track and auto-play */
  const load = useCallback(
    async (id: string, directUrl?: string) => {
      wantPlayRef.current = true;
      currentTrackIdRef.current = id;
      qualityFallbackStepRef.current = 0;
      sponsorSegmentsRef.current = [];

      if (!directUrl && id) {
        void fetchSponsorBlockSegments(id).then((segs) => {
          if (currentTrackIdRef.current === id) {
            sponsorSegmentsRef.current = segs;
          }
        });
      }

      if (await playOffline(id)) return;
      if (directUrl) {
        setStream(directUrl);
        return;
      }
      setStream(streamUrl(id));
    },
    [setStream, playOffline, streamUrl],
  );

  /** Cue a track at specific second without autoplay */
  const cue = useCallback(
    async (id: string, startSeconds = 0, directUrl?: string) => {
      wantPlayRef.current = false;
      currentTrackIdRef.current = id;
      qualityFallbackStepRef.current = 0;
      sponsorSegmentsRef.current = [];

      if (!directUrl && id) {
        void fetchSponsorBlockSegments(id).then((segs) => {
          if (currentTrackIdRef.current === id) {
            sponsorSegmentsRef.current = segs;
          }
        });
      }

      if (await playOffline(id, startSeconds)) return;
      if (directUrl) {
        setStream(directUrl, startSeconds);
        return;
      }
      setStream(streamUrl(id), startSeconds);
    },
    [setStream, playOffline, streamUrl],
  );


  const play = useCallback(() => {
    wantPlayRef.current = true;
    initWebAudio();
    const audio = audioRef.current;
    if (audio && audio.src && audio.src.length > 0 && !audio.src.endsWith("/")) {
      audio.muted = false;
      const p = audio.play();
      if (p !== undefined) {
        p.catch((err) => {
          if (err.name !== "AbortError" && err.name !== "NotAllowedError") {
            console.warn("[MelodyMap] play() error:", err);
          }
        });
      }
    }
  }, [initWebAudio]);

  const pause = useCallback(() => {
    wantPlayRef.current = false;
    audioRef.current?.pause();
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const target = Math.max(0, seconds);
    if (audio.readyState < 1 || !Number.isFinite(audio.duration) || audio.duration === 0) {
      pendingSeekRef.current = target;
      setPosition(target);
      return;
    }
    const max = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : target;
    const clamped = Math.max(0, Math.min(target, max));
    audio.currentTime = clamped;
    setPosition(clamped);
  }, []);

  const skipForward = useCallback((seconds = 30) => {
    const audio = audioRef.current;
    if (!audio) return;
    const current = audio.currentTime || position;
    seek(current + seconds);
  }, [position, seek]);

  const skipBackward = useCallback((seconds = 15) => {
    const audio = audioRef.current;
    if (!audio) return;
    const current = audio.currentTime || position;
    seek(Math.max(0, current - seconds));
  }, [position, seek]);

  const setSpeed = useCallback((speed: number) => {
    const clamped = Math.min(3, Math.max(0.25, speed));
    setPlaybackSpeed(clamped);
    if (typeof window !== "undefined") {
      localStorage.setItem("melodymap.playback_speed.v1", String(clamped));
    }
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = clamped;
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    const audio = audioRef.current;
    if (audio) audio.volume = Math.max(0, Math.min(1, v / 100));
  }, []);

  return {
    ready,
    isPlaying,
    isLoading,
    position,
    duration,
    playbackSpeed,
    equalizerSettings,
    setEqualizerPreset,
    setBandGain,
    toggleEqualizer,
    setCrossfadeDuration,
    setAudioQuality,
    load,
    cue,
    play,
    pause,
    seek,
    skipForward,
    skipBackward,
    setSpeed,
    setVolume,
  };
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
