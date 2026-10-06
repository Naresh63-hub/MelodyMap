import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
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
  getSponsorBlockEnabled,
  type SponsorBlockSegment,
} from "@/lib/sponsorblock";
import { isLowNetworkModeEnabled } from "@/lib/network-mode";
import { isNativePlaybackEnv, resolvePlaybackEngine } from "@/lib/native-playback";

export type NextTrackInfo = {
  id: string;
  previewUrl?: string | undefined;
};

/**
 * Seek step sizes for the forward/backward scrub buttons.
 * NOTE: the Next/Skip-Track control is separate (queue advance in routes/index.tsx)
 * and must NEVER seek — these constants are only for within-track seeking.
 */
export const SKIP_FORWARD_SECONDS = 5;
export const SKIP_BACKWARD_SECONDS = 5;

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** 1-second silent WAV loop to maintain native mobile OS audio focus & lockscreen session */
const SILENT_AUDIO_URI =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAP8A/w==";

/**
 * HTML5-Audio + Web Audio API backed player with Spotify-like background playback,
 * screen-off & lockscreen continuous playback, 10-band hardware equalizer, sound presets,
 * gapless pre-buffering, speed adjustment, offline caching, and robust dual-engine streaming
 * with client-side YouTube IFrame fallback for zero-failure playback across all hosts (including Vercel).
 */
export function useAudioPlayer(options: {
  onEnded: (autoAdvanced?: boolean) => void;
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

  // Dual-engine playback state ("html5" or "youtube").
  // NATIVE APP (APK): ALWAYS the HTML5 proxy engine. The YouTube IFrame player
  // pauses itself whenever the WebView becomes invisible (screen off / app
  // switch) and its cross-origin document cannot be patched from the parent
  // page, so it can never deliver Spotify-like background playback inside the
  // APK. The HTML5 <audio> element streams through our own /api/stream proxy
  // and keeps playing behind the foreground media service.
  // Deployed web keeps the YouTube engine for fast start; localhost keeps proxy.
  const activeEngineRef = useRef<"html5" | "youtube">(
    resolvePlaybackEngine({
      isNative: isNativePlaybackEnv(),
      hostname: typeof window !== "undefined" ? window.location.hostname : "localhost",
    }),
  );
  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef<boolean>(false);
  const ytTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingYtActionRef = useRef<{ id: string; startAt: number; autoPlay: boolean } | null>(null);
  const isSeekingRef = useRef<boolean>(false);
  const seekCooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skippedSegmentsRef = useRef<Set<string>>(new Set());

  // Equalizer & sound profile state
  const [equalizerSettings, setEqualizerSettingsState] = useState<EqualizerSettings>(loadEqualizerSettings);
  const equalizerSettingsRef = useRef(equalizerSettings);
  equalizerSettingsRef.current = equalizerSettings;

  const streamUrl = useCallback((id: string, quality?: string) => {
    const isLowNet = isLowNetworkModeEnabled();
    const q = isLowNet ? "saver" : (quality || equalizerSettingsRef.current.quality || "high");
    return `/api/stream/${encodeURIComponent(id)}?quality=${encodeURIComponent(q)}`;
  }, []);

  // Initialize and attach core audio + prebuffer + YouTube iframe container to DOM.
  // Must run in an effect, not during render: creating/appending DOM nodes is a
  // side effect and violates render purity (breaks under StrictMode re-renders
  // and can double-append during hydration).
  useEffect(() => {
    if (typeof document === "undefined") return;

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

    if (!document.getElementById("melodymap-yt-wrapper")) {
      const holder = document.createElement("div");
      holder.id = "melodymap-yt-wrapper";
      holder.style.position = "fixed";
      holder.style.bottom = "0px";
      holder.style.right = "0px";
      holder.style.width = "1px";
      holder.style.height = "1px";
      holder.style.opacity = "0.01";
      holder.style.pointerEvents = "none";
      holder.style.zIndex = "1";
      holder.style.overflow = "hidden";
      const iframeDiv = document.createElement("div");
      iframeDiv.id = "melodymap-yt-iframe";
      holder.appendChild(iframeDiv);
      try {
        document.body.appendChild(holder);
      } catch {}
    }
  }, []);

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
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    try {
      const saved = localStorage.getItem("melodymap.playback_speed.v1");
      if (!saved) return 1;
      const parsed = Number(saved);
      return Number.isFinite(parsed) && parsed >= 0.25 && parsed <= 3 ? parsed : 1;
    } catch {
      return 1;
    }
  });

  const playbackSpeedRef = useRef(playbackSpeed);
  playbackSpeedRef.current = playbackSpeed;
  const lastValidPositionRef = useRef(0);
  const seekRef = useRef<(seconds: number) => void>(() => {});

  const currentTrackIdRef = useRef<string | null>(null);
  const mainGainRef = useRef<GainNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const isFadingOutRef = useRef<boolean>(false);

  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const stalledTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playViaYouTubeRef = useRef<(id: string, startAt?: number, autoPlay?: boolean) => void>(() => {});

  /** Calculate equal-power trigonometric curve for smooth crossfading without volume drop */
  const createEqualPowerCurve = (type: "in" | "out", length = 32): Float32Array => {
    const curve = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const t = i / (length - 1);
      curve[i] = type === "in" ? Math.sin((t * Math.PI) / 2) : Math.cos((t * Math.PI) / 2);
    }
    return curve;
  };

  const initWebAudio = useCallback(() => {
    if (typeof window === "undefined") return;
    // Native app (APK): Direct hardware audio playback.
    // In Android WebView, connecting an <audio> element to an AudioContext
    // routes its sound through the Chromium WebAudio render graph, which
    // Chromium suspends after a few seconds when the screen locks or app is minimized.
    // Playing directly to the native <audio> element avoids suspension and keeps
    // background audio streaming continuously via MediaPlaybackService.
    if (isNativePlaybackEnv()) return;

    const audio = audioRef.current;
    if (!audio) return;

    if (!audioCtxRef.current) {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        // latencyHint: "playback" provides an adequate jitter buffer (2048-4096 samples)
        // preventing buffer underruns, stuttering, and slow-pitch clock drift over Bluetooth A2DP
        const ctx = new AudioCtx({ latencyHint: "playback" });
        audioCtxRef.current = ctx;

        // Auto-resume if AudioContext is suspended by the browser on Bluetooth device switch
        ctx.onstatechange = () => {
          if (ctx.state === "suspended" && wantPlayRef.current) {
            ctx.resume().catch(() => {});
          }
        };

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

  // Auto-resume AudioContext when Bluetooth or other audio output devices change
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.addEventListener) return;
    const onDeviceChange = () => {
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === "suspended" && wantPlayRef.current) {
        ctx.resume().catch(() => {});
      }
    };
    navigator.mediaDevices.addEventListener("devicechange", onDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", onDeviceChange);
    };
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

      // If the engine already synchronously transitioned to this exact URL, avoid tearing it down
      if (
        audio.src === url &&
        activeEngineRef.current === "html5" &&
        (!audio.paused || wantPlayRef.current) &&
        Math.abs((audio.currentTime || 0) - startAt) < 2
      ) {
        setIsLoading(false);
        setIsPlaying(true);
        if (audio.paused && wantPlayRef.current) {
          audio.play().catch(() => {});
        }
        return;
      }

      initWebAudio();
      setIsLoading(true);

      if (startAt > 0) {
        pendingSeekRef.current = startAt;
        setPosition(startAt);
      } else {
        pendingSeekRef.current = null;
        setPosition(0);
        setDuration(0);
      }

      activeEngineRef.current = "html5";
      try {
        ytPlayerRef.current?.pauseVideo?.();
        ytPlayerRef.current?.stopVideo?.();
      } catch {}

      try {
        audio.pause();
      } catch {}

      // For external direct audio (e.g. podcast MP3 CDNs), remove crossorigin so the browser
      // does not block cross-origin audio streaming without CORS headers.
      if (typeof window !== "undefined" && url.startsWith("http") && !url.includes(window.location.host) && !url.includes("/api/stream/")) {
        audio.removeAttribute("crossorigin");
      } else {
        audio.crossOrigin = "anonymous";
      }

      audio.loop = false;
      audio.volume = 1;
      audio.muted = false;
      audio.src = url;
      const validSpeed = Number.isFinite(playbackSpeedRef.current) && playbackSpeedRef.current > 0 ? playbackSpeedRef.current : 1;
      audio.playbackRate = validSpeed;
      audio.load();

      isFadingOutRef.current = false;

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
        } else if (audioCtxRef.current && mainGainRef.current) {
          try {
            mainGainRef.current.gain.cancelScheduledValues(audioCtxRef.current.currentTime);
            mainGainRef.current.gain.setValueAtTime(1, audioCtxRef.current.currentTime);
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
    [initWebAudio],
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

  const triggerReconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    const trackId = currentTrackIdRef.current;
    if (!trackId || !wantPlayRef.current) return;

    const attempts = reconnectAttemptsRef.current;
    if (attempts >= 6) {
      setIsReconnecting(false);
      const isExternalNonYt =
        trackId.startsWith("podcast:") ||
        trackId.startsWith("deezer:") ||
        trackId.startsWith("audius:") ||
        trackId.startsWith("jamendo:") ||
        trackId.startsWith("archive:");
      // Fallback to client-side YouTube player if proxy stream ever drops/fails on web
      if (!isExternalNonYt && !isNativePlaybackEnv()) {
        console.info(`[MelodyMap] Reconnection threshold reached. Switching to YouTube playback engine for: ${trackId}`);
        const resumePos = lastValidPositionRef.current || 0;
        playViaYouTubeRef.current(trackId, resumePos, true);
        return;
      }
      onErrorRef.current?.("Audio connection interrupted. Tap play to retry.");
      return;
    }

    reconnectAttemptsRef.current = attempts + 1;
    setIsReconnecting(true);
    setIsLoading(true);

    // Exponential backoff with random jitter: ~500ms, ~1200ms, ~2500ms...
    const baseDelay = Math.min(500 * Math.pow(1.8, attempts), 5000);
    const jitter = Math.random() * 350;
    const delay = Math.round(baseDelay + jitter);

    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      if (!wantPlayRef.current || currentTrackIdRef.current !== trackId) {
        setIsReconnecting(false);
        return;
      }

      const audio = audioRef.current;
      if (!audio) {
        setIsReconnecting(false);
        return;
      }

      const resumePos = lastValidPositionRef.current || 0;
      pendingSeekRef.current = resumePos;

      const freshUrl = `${streamUrl(trackId)}&_reconnect=${Date.now()}`;
      audio.src = freshUrl;
      audio.load();
      audio.currentTime = resumePos;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            reconnectAttemptsRef.current = 0;
            setIsReconnecting(false);
            setIsPlaying(true);
            setIsLoading(false);
          })
          .catch((err) => {
            console.warn("[MelodyMap] Mid-song reconnection attempt failed:", err);
            triggerReconnect();
          });
      }
    }, delay);
  }, [streamUrl]);

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
      if (activeEngineRef.current !== "html5") return;
      audio.muted = false;
      initWebAudio();
      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
      setIsPlaying(true);
      setIsLoading(false);
      applyPendingSeek();
    };
    const onPlaying = () => {
      if (activeEngineRef.current !== "html5") return;
      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
      if (stalledTimerRef.current) {
        clearTimeout(stalledTimerRef.current);
        stalledTimerRef.current = null;
      }
      reconnectAttemptsRef.current = 0;
      setIsReconnecting(false);
      setIsPlaying(true);
      setIsLoading(false);
      applyPendingSeek();
    };
    const onWaiting = () => {
      if (activeEngineRef.current !== "html5") return;
      if (wantPlayRef.current) {
        setIsLoading(true);
        if (!stalledTimerRef.current) {
          stalledTimerRef.current = setTimeout(() => {
            stalledTimerRef.current = null;
            if (wantPlayRef.current && (!audio.currentTime || audio.paused)) {
              console.warn("[MelodyMap] Stream waiting timeout. Attempting reconnect.");
              triggerReconnect();
            }
          }, 12000);
        }
      }
    };
    const onStalled = () => {
      if (activeEngineRef.current !== "html5") return;
      if (wantPlayRef.current && currentTrackIdRef.current) {
        if (!stalledTimerRef.current) {
          stalledTimerRef.current = setTimeout(() => {
            stalledTimerRef.current = null;
            if (wantPlayRef.current && audio.paused) {
              console.warn("[MelodyMap] Audio stream stalled. Triggering mid-song reconnect.");
              triggerReconnect();
            }
          }, 12000);
        }
      }
    };
    const onCanPlay = () => {
      if (activeEngineRef.current !== "html5") return;
      setIsLoading(false);
      applyPendingSeek();
    };
    const onLoadedMetadata = () => {
      if (activeEngineRef.current !== "html5") return;
      applyPendingSeek();
      onTime();
    };
    const onPause = () => {
      if (activeEngineRef.current !== "html5") return;
      setIsPlaying(false);
      setIsLoading(false);
    };
    const onTime = () => {
      if (activeEngineRef.current !== "html5") return;
      const cur = audio.currentTime || 0;
      const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
      lastValidPositionRef.current = cur;
      setPosition(cur);
      setDuration(dur);
      if (cur > 0) setIsLoading(false);

      // SponsorBlock Auto-Skip: Check if currentTime falls within an intro/sponsor/outro range
      if (getSponsorBlockEnabled() && sponsorSegmentsRef.current.length > 0) {
        for (const seg of sponsorSegmentsRef.current) {
          const segKey = `${seg.start.toFixed(1)}-${seg.end.toFixed(1)}`;
          if (skippedSegmentsRef.current.has(segKey)) continue;

          if (cur >= seg.start - 0.05 && cur < seg.end - 0.2) {
            skippedSegmentsRef.current.add(segKey);
            const target = seg.end + 0.2;
            audio.currentTime = target;
            onSponsorBlockSkippedRef.current?.(seg.category);
            break;
          }
        }
      }

      // Gapless Pre-buffering: when current song has <= 25s left, pre-buffer upcoming track
      // Disabled in Low Network Mode to minimize cellular data usage
      if (!isLowNetworkModeEnabled() && dur > 0 && dur - cur <= 25 && prebufferAudioRef.current) {
        const nextTrack = getNextTrackRef.current?.();
        if (nextTrack && nextTrack.id && prebufferedTrackIdRef.current !== nextTrack.id) {
          prebufferedTrackIdRef.current = nextTrack.id;
          const nextUrl = nextTrack.previewUrl || streamUrl(nextTrack.id, equalizerSettingsRef.current.quality);
          prebufferAudioRef.current.src = nextUrl;
          prebufferAudioRef.current.load();
        }
      }

      // Smart Crossfade: smoothly fade out ending track according to crossfade duration
      const fadeDur = equalizerSettingsRef.current.crossfade || 0;
      if (
        fadeDur > 0 &&
        dur > 0 &&
        dur - cur <= fadeDur &&
        dur > fadeDur + 2 &&
        audioCtxRef.current &&
        mainGainRef.current
      ) {
        if (!isFadingOutRef.current) {
          isFadingOutRef.current = true;
          const ctx = audioCtxRef.current;
          const mainGain = mainGainRef.current;
          const remaining = Math.max(0.1, dur - cur);
          const curve = createEqualPowerCurve("out", 32);
          try {
            mainGain.gain.cancelScheduledValues(ctx.currentTime);
            mainGain.gain.setValueCurveAtTime(curve, ctx.currentTime, remaining);
          } catch {}
        }
      }
    };

    // CRITICAL FOR SPOTIFY-LIKE SCREEN-OFF CONTINUOUS PLAYBACK:
    // When song ends with screen locked, synchronously switch .src & call .play()
    // inside the same event loop frame so mobile OS grants immediate autoplay permission!
    const onEnded = () => {
      if (activeEngineRef.current !== "html5") return;
      setIsPlaying(false);
      setIsLoading(false);

      // Synchronously grab next track BEFORE index is mutated in endedRef callback
      const nextTrack = getNextTrackRef.current?.();
      let didAutoAdvance = false;

      // Synchronous background advance for continuous playback with screen locked
      if (nextTrack && wantPlayRef.current) {
        currentTrackIdRef.current = nextTrack.id;
        lastValidPositionRef.current = 0;
        setPosition(0);
        setDuration(0);
        const nextUrl = nextTrack.previewUrl || streamUrl(nextTrack.id, equalizerSettingsRef.current.quality);
        audio.src = nextUrl;
        const validSpeed = Number.isFinite(playbackSpeedRef.current) && playbackSpeedRef.current > 0 ? playbackSpeedRef.current : 1;
        audio.playbackRate = validSpeed;
        audio.load();
        const p = audio.play();
        if (p !== undefined) {
          p.catch((err) => {
            console.warn("[BackgroundPlayback] Synchronous next auto-play notice:", err);
          });
        }
        didAutoAdvance = true;
      }

      // Notify parent component with autoAdvance status so it doesn't trigger a duplicate load race
      endedRef.current(didAutoAdvance);
    };

    const onError = () => {
      if (activeEngineRef.current !== "html5") return;
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
        console.warn("[MelodyMap] Audio stream proxy error:", audio.error.code, audio.error.message);

        // Network error (code 2 = MEDIA_ERR_NETWORK) or decode error mid-stream: trigger prompt reconnection
        if (wantPlayRef.current && (audio.error.code === 2 || audio.error.code === 4)) {
          console.warn("[MelodyMap] Audio network error detected, attempting mid-song stream reconnection.");
          triggerReconnect();
          return;
        }

        // Instant Fallback to Client YouTube Player on Vercel / server proxy block
        const activeId = currentTrackIdRef.current;
        const isExternalNonYt =
          Boolean(activeId) &&
          (activeId!.startsWith("podcast:") ||
            activeId!.startsWith("deezer:") ||
            activeId!.startsWith("audius:") ||
            activeId!.startsWith("jamendo:") ||
            activeId!.startsWith("archive:"));

        // Native app: never fall back to the YouTube IFrame engine — it cannot
        // survive screen-off/app-switch. Keep the proxy engine and surface the error.
        if (activeId && !isExternalNonYt && !isNativePlaybackEnv()) {
          console.info(`[MelodyMap] Falling back to direct client YouTube streaming for track: ${activeId}`);
          const resumePos = audio.currentTime || 0;
          playViaYouTubeRef.current(activeId, resumePos, wantPlayRef.current);
          return;
        }

        const message = activeId?.startsWith("podcast:")
          ? "Couldn't play this episode. The podcast host may be temporarily unavailable."
          : "Could not load audio stream. Tap play to retry.";
        onErrorRef.current?.(message);
      }
    };

    const handleOnline = () => {
      console.info("[MelodyMap] Device reconnected to internet. Resuming active audio session.");
      if (wantPlayRef.current && currentTrackIdRef.current) {
        reconnectAttemptsRef.current = 0;
        triggerReconnect();
      }
    };

    const handleOffline = () => {
      console.warn("[MelodyMap] Device disconnected from internet.");
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      setIsReconnecting(true);
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("stalled", onStalled);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onTime);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("stalled", onStalled);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onTime);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);

      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (stalledTimerRef.current) {
        clearTimeout(stalledTimerRef.current);
        stalledTimerRef.current = null;
      }
    };
  }, [initWebAudio, streamUrl, triggerReconnect]);

  // Initialize YouTube IFrame Player API on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const initYt = () => {
      if (ytPlayerRef.current || !window.YT || !window.YT.Player) return;
      const targetEl = document.getElementById("melodymap-yt-iframe");
      if (!targetEl) return;
      try {
        ytPlayerRef.current = new window.YT.Player("melodymap-yt-iframe", {
          height: "1",
          width: "1",
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            playsinline: 1,
            rel: 0,
            enablejsapi: 1,
            origin: window.location.origin,
            widget_referrer: window.location.href,
            suggestedQuality: "small",
            vq: "small",
          },
          events: {
            onReady: (event: any) => {
              ytReadyRef.current = true;
              try {
                event.target.setVolume(80);
                event.target.setPlaybackQuality?.("small");
              } catch {}
              if (pendingYtActionRef.current) {
                const { id, startAt, autoPlay } = pendingYtActionRef.current;
                pendingYtActionRef.current = null;
                if (autoPlay) {
                  event.target.loadVideoById(id, startAt);
                  try {
                    event.target.playVideo();
                  } catch {}
                } else {
                  event.target.cueVideoById(id, startAt);
                }
              }
            },
            onStateChange: (event: any) => {
              if (event.data === 1) {
                // 1 = Playing
                isSeekingRef.current = false;
                setIsPlaying(true);
                setIsLoading(false);
                try {
                  event.target.setPlaybackQuality?.("small");
                } catch {}
              } else if (event.data === 2) {
                // 2 = Paused
                setIsPlaying(false);
                setIsLoading(false);
              } else if (event.data === 3) {
                // 3 = Buffering
                setIsLoading(true);
              } else if (event.data === 0) {
                // 0 = Ended
                isSeekingRef.current = false;
                setIsPlaying(false);
                setIsLoading(false);
                endedRef.current(false);
              }
            },
            onError: (event: any) => {
              console.warn("[MelodyMap] YouTube player API error:", event.data);
              // If YouTube embed is blocked (101/150) or unavailable, immediately fallback to HTML5 stream proxy
              const curId = currentTrackIdRef.current;
              if (curId && activeEngineRef.current === "youtube") {
                console.info("[MelodyMap] YouTube embed blocked or errored, falling back to HTML5 audio proxy for:", curId);
                activeEngineRef.current = "html5";
                try {
                  ytPlayerRef.current?.stopVideo?.();
                } catch {}
                setStream(streamUrl(curId), lastValidPositionRef.current);
                return;
              }
              // Only fatal unplayable errors should skip to next track
              if (event.data === 101 || event.data === 150 || event.data === 100 || event.data === 2) {
                onErrorRef.current?.("Audio stream unavailable, skipping to next track...");
              } else {
                console.warn("[MelodyMap] Non-fatal YouTube player error, ignoring transient code:", event.data);
              }
            },
          },
        });
      } catch (err) {
        console.warn("[MelodyMap] YouTube player init notice:", err);
      }
    };

    if (window.YT && window.YT.Player) {
      initYt();
    } else {
      const existingTag = document.getElementById("yt-iframe-api-script");
      if (!existingTag) {
        const tag = document.createElement("script");
        tag.id = "yt-iframe-api-script";
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
      const oldCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (oldCallback) oldCallback();
        initYt();
      };
    }
  }, []);

  // Poll position and duration during YouTube player playback
  useEffect(() => {
    if (isPlaying && activeEngineRef.current === "youtube") {
      if (ytTimerRef.current) clearInterval(ytTimerRef.current);
      ytTimerRef.current = setInterval(() => {
        // Do not stomp local seek position with stale YouTube API time while seeking
        if (isSeekingRef.current) return;

        const p = ytPlayerRef.current;
        if (p && typeof p.getCurrentTime === "function" && typeof p.getDuration === "function") {
          try {
            const cur = p.getCurrentTime() || 0;
            const dur = p.getDuration() || 0;
            if (dur > 0) setDuration(dur);

            // Protect against transient backwards jumps from YouTube API buffer jitter during quality/tab adjustments
            if (cur < lastValidPositionRef.current - 1.5 && lastValidPositionRef.current > 3 && cur > 0) {
              // Maintain current stable position
            } else {
              lastValidPositionRef.current = cur;
              setPosition(cur);
            }

            // SponsorBlock Auto-Skip: skip each matching segment exactly once
            if (getSponsorBlockEnabled() && sponsorSegmentsRef.current.length > 0) {
              for (const seg of sponsorSegmentsRef.current) {
                const segKey = `${seg.start.toFixed(1)}-${seg.end.toFixed(1)}`;
                if (skippedSegmentsRef.current.has(segKey)) continue;

                if (cur >= seg.start - 0.05 && cur < seg.end - 0.2) {
                  skippedSegmentsRef.current.add(segKey);
                  const target = seg.end + 0.2;
                  seekRef.current(target);
                  onSponsorBlockSkippedRef.current?.(seg.category);
                  break;
                }
              }
            }

            // Gapless Pre-buffering
            if (dur > 0 && dur - cur <= 25 && prebufferAudioRef.current) {
              const nextTrack = getNextTrackRef.current?.();
              if (nextTrack && nextTrack.id && prebufferedTrackIdRef.current !== nextTrack.id) {
                prebufferedTrackIdRef.current = nextTrack.id;
                const nextUrl = nextTrack.previewUrl || streamUrl(nextTrack.id, equalizerSettingsRef.current.quality);
                prebufferAudioRef.current.src = nextUrl;
                prebufferAudioRef.current.load();
              }
            }
          } catch {}
        }
      }, 300);
    } else {
      if (ytTimerRef.current) {
        clearInterval(ytTimerRef.current);
        ytTimerRef.current = null;
      }
    }
    return () => {
      if (ytTimerRef.current) {
        clearInterval(ytTimerRef.current);
        ytTimerRef.current = null;
      }
    };
  }, [isPlaying, streamUrl]);

  // Maintain uninterrupted playback across tab switches and app foreground/background
  useEffect(() => {
    if (typeof document === "undefined") return;
    // Native APK: the foreground MediaPlaybackService owns background state
    // (audio focus, lockscreen controls, OEM doze handling). A JS-side resume
    // loop here would fight the OS — e.g. re-playing after an audio-focus pause
    // causes the play/pause cycling and a "playing" animation with no sound.
    if (isNativePlaybackEnv()) return;
    const onVisibilityChange = () => {
      // Never pause, swap engines, or re-seek when tabs are switched or app is hidden.
      // Audio must continue playing seamlessly in the background.
      if (!document.hidden && wantPlayRef.current) {
        // App returned to foreground: ensure AudioContext is active if suspended
        if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
          audioCtxRef.current.resume().catch(() => {});
        }
        // If native browser paused playback while in background, resume it
        if (activeEngineRef.current === "youtube") {
          const p = ytPlayerRef.current;
          if (p && ytReadyRef.current && typeof p.getPlayerState === "function" && p.getPlayerState() === 2) {
            try {
              p.playVideo();
            } catch {}
          }
        } else if (activeEngineRef.current === "html5") {
          const audio = audioRef.current;
          if (audio && audio.paused && audio.src && !audio.src.startsWith("data:audio")) {
            audio.play().catch(() => {});
          }
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Background playback watchdog: auto-resume audio if paused by Android/browser lock screen
    const watchdog = setInterval(() => {
      if (wantPlayRef.current && !isSeekingRef.current) {
        if (activeEngineRef.current === "youtube") {
          const p = ytPlayerRef.current;
          if (p && ytReadyRef.current && typeof p.getPlayerState === "function") {
            const s = p.getPlayerState();
            // 2 = paused, 5 = cued
            if (s === 2 || s === 5) {
              try {
                p.playVideo();
              } catch {}
            }
          }
        } else if (activeEngineRef.current === "html5") {
          const audio = audioRef.current;
          if (audio && audio.paused && audio.src && !audio.src.startsWith("data:audio")) {
            audio.play().catch(() => {});
          }
        }
      }
    }, 1000);

    return () => {
      clearInterval(watchdog);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  /** Direct YouTube IFrame API play */
  const playViaYouTube = useCallback(
    (id: string, startAt = 0, autoPlay = true) => {
      activeEngineRef.current = "youtube";
      setIsLoading(true);
      lastValidPositionRef.current = startAt;
      setPosition(startAt);
      setDuration(0);
      // Play silent background audio loop to keep Android system audio focus and lockscreen controls active
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          if (autoPlay) {
            audioRef.current.src = SILENT_AUDIO_URI;
            audioRef.current.loop = true;
            audioRef.current.volume = 0.001;
            const p = audioRef.current.play();
            if (p !== undefined) p.catch(() => {});
          }
        } catch {}
      }

      const p = ytPlayerRef.current;
      if (p && ytReadyRef.current && typeof p.loadVideoById === "function") {
        if (autoPlay) {
          p.loadVideoById(id, startAt);
          try {
            p.playVideo();
          } catch {}
        } else {
          p.cueVideoById(id, startAt);
        }
        try {
          const validSpeed =
            Number.isFinite(playbackSpeedRef.current) && playbackSpeedRef.current > 0
              ? playbackSpeedRef.current
              : 1;
          p.setPlaybackRate(validSpeed);
          p.setPlaybackQuality?.("small");
        } catch {}
      } else {
        pendingYtActionRef.current = { id, startAt, autoPlay };
      }
    },
    [],
  );

  /** Cleanup on unmount */
  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === "function") {
        try {
          ytPlayerRef.current.destroy();
        } catch {}
      }
      if (ytTimerRef.current) {
        clearInterval(ytTimerRef.current);
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
        activeEngineRef.current = "html5";
        try {
          ytPlayerRef.current?.stopVideo();
        } catch {}
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
    async (id: string, directUrl?: string, startAt = 0) => {
      wantPlayRef.current = true;

      // Stop the double-load race: if synchronous gapless advance already started
      // playing this exact track at 0:00, avoid resetting position or restarting audio
      const audio = audioRef.current;
      const expectedUrl = directUrl || streamUrl(id);
      if (
        currentTrackIdRef.current === id &&
        startAt === 0 &&
        ((activeEngineRef.current === "html5" &&
          audio &&
          (audio.src === expectedUrl || audio.src.includes(encodeURIComponent(id))) &&
          (!audio.paused || audio.readyState >= 1)) ||
         (activeEngineRef.current === "youtube" && isPlaying))
      ) {
        return;
      }

      currentTrackIdRef.current = id;
      lastValidPositionRef.current = startAt;
      setPosition(startAt);
      setDuration(0);
      qualityFallbackStepRef.current = 0;
      sponsorSegmentsRef.current = [];
      skippedSegmentsRef.current.clear();

      if (!directUrl && id) {
        void fetchSponsorBlockSegments(id).then((segs) => {
          if (currentTrackIdRef.current === id) {
            sponsorSegmentsRef.current = segs;
          }
        });
      }

      if (await playOffline(id, startAt)) return;
      if (directUrl) {
        activeEngineRef.current = "html5";
        try {
          ytPlayerRef.current?.stopVideo();
        } catch {}
        setStream(directUrl, startAt);
        return;
      }

      if (activeEngineRef.current === "youtube") {
        playViaYouTube(id, startAt, true);
        return;
      }

      setStream(streamUrl(id), startAt);
    },
    [setStream, playOffline, streamUrl, playViaYouTube],
  );

  /** Cue a track at specific second without autoplay */
  const cue = useCallback(
    async (id: string, startSeconds = 0, directUrl?: string) => {
      wantPlayRef.current = false;
      currentTrackIdRef.current = id;
      lastValidPositionRef.current = startSeconds;
      setPosition(startSeconds);
      setDuration(0);
      qualityFallbackStepRef.current = 0;
      sponsorSegmentsRef.current = [];
      skippedSegmentsRef.current.clear();

      if (!directUrl && id) {
        void fetchSponsorBlockSegments(id).then((segs) => {
          if (currentTrackIdRef.current === id) {
            sponsorSegmentsRef.current = segs;
          }
        });
      }

      if (await playOffline(id, startSeconds)) return;
      if (directUrl) {
        activeEngineRef.current = "html5";
        try {
          ytPlayerRef.current?.stopVideo();
        } catch {}
        setStream(directUrl, startSeconds);
        return;
      }

      if (activeEngineRef.current === "youtube") {
        playViaYouTube(id, startSeconds, false);
        return;
      }

      setStream(streamUrl(id), startSeconds);
    },
    [setStream, playOffline, streamUrl, playViaYouTube],
  );

  const play = useCallback(() => {
    wantPlayRef.current = true;
    if (activeEngineRef.current === "youtube") {
      if (audioRef.current) {
        try {
          if (!audioRef.current.src || !audioRef.current.src.startsWith("data:audio")) {
            audioRef.current.src = SILENT_AUDIO_URI;
            audioRef.current.loop = true;
            audioRef.current.volume = 0.001;
          }
          const p = audioRef.current.play();
          if (p !== undefined) p.catch(() => {});
        } catch {}
      }
      const curId = currentTrackIdRef.current;
      const p = ytPlayerRef.current;
      if (p && ytReadyRef.current && typeof p.playVideo === "function") {
        try {
          p.playVideo();
        } catch {}
      } else if (curId) {
        playViaYouTube(curId, lastValidPositionRef.current, true);
      }
      return;
    }
    initWebAudio();
    if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }
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
  }, [initWebAudio, playViaYouTube]);

  const pause = useCallback(() => {
    wantPlayRef.current = false;
    isSeekingRef.current = false;
    if (seekCooldownTimerRef.current) {
      clearTimeout(seekCooldownTimerRef.current);
      seekCooldownTimerRef.current = null;
    }
    try {
      ytPlayerRef.current?.pauseVideo();
    } catch {}
    try {
      audioRef.current?.pause();
    } catch {}
    setIsPlaying(false);
  }, []);

  const seek = useCallback((seconds: number) => {
    const target = Math.max(0, seconds);
    lastValidPositionRef.current = target;
    setPosition(target);

    if (activeEngineRef.current === "youtube") {
      const p = ytPlayerRef.current;
      if (p && typeof p.seekTo === "function") {
        isSeekingRef.current = true;
        if (seekCooldownTimerRef.current) clearTimeout(seekCooldownTimerRef.current);
        // Protect position from stale polling ticks while YouTube buffers at target
        seekCooldownTimerRef.current = setTimeout(() => {
          isSeekingRef.current = false;
        }, 1200);

        p.seekTo(target, true);
        if (wantPlayRef.current) {
          try {
            p.playVideo();
          } catch {}
        }
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;
    if (audio.readyState < 1 || !Number.isFinite(audio.duration) || audio.duration === 0) {
      pendingSeekRef.current = target;
      return;
    }
    const max = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : target;
    const clamped = Math.max(0, Math.min(target, max));
    audio.currentTime = clamped;
    if (wantPlayRef.current && audio.paused) {
      audio.play().catch(() => {});
    }
  }, []);
  seekRef.current = seek;

  const skipForward = useCallback((seconds = SKIP_FORWARD_SECONDS) => {
    const cur = lastValidPositionRef.current;
    seek(cur + seconds);
  }, [seek]);

  const skipBackward = useCallback((seconds = SKIP_BACKWARD_SECONDS) => {
    const cur = lastValidPositionRef.current;
    seek(Math.max(0, cur - seconds));
  }, [seek]);

  const setSpeed = useCallback((speed: number) => {
    const clamped = Number.isFinite(speed) ? Math.min(3, Math.max(0.25, speed)) : 1;
    setPlaybackSpeed(clamped);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("melodymap.playback_speed.v1", String(clamped));
      } catch {}
    }
    if (activeEngineRef.current === "youtube") {
      try {
        ytPlayerRef.current?.setPlaybackRate(clamped);
      } catch {}
    }
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = clamped;
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(100, v));
    const audio = audioRef.current;
    if (audio) audio.volume = clamped / 100;
    try {
      ytPlayerRef.current?.setVolume(clamped);
    } catch {}
  }, []);

  playViaYouTubeRef.current = playViaYouTube;

  return {
    ready,
    isPlaying,
    isLoading,
    isReconnecting,
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
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

