import { useCallback, useEffect, useRef, useState } from "react";
import {
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
import { hasFullLengthDirectSource } from "@/lib/track-stream-policy";
import { getBlob } from "@/lib/offline";
import { audioPrefetchManager } from "@/lib/audio-prefetch";
import {
  isVolumeLevelingEnabled,
  setVolumeLevelingEnabled,
  computeEffectiveVolume,
  rampAudioVolume,
} from "@/lib/audio-leveling";

export type NextTrackInfo = {
  id: string;
  previewUrl?: string | undefined;
  title?: string | undefined;
  artist?: string | undefined;
};

/**
 * Seek step sizes for the forward/backward scrub buttons.
 * NOTE: the Next/Skip-Track control is separate (queue advance in routes/index.tsx)
 * and must NEVER seek — these constants are only for within-track seeking.
 */
export const SKIP_FORWARD_SECONDS = 5;
export const SKIP_BACKWARD_SECONDS = 5;

/**
 * HTML5-Audio + Web Audio API backed player with Spotify-like background playback,
 * screen-off & lockscreen continuous playback, 10-band hardware equalizer, sound presets,
 * gapless pre-buffering, speed adjustment, and offline caching.
 */
export function useAudioPlayer(options: {
  onEnded: (autoAdvanced?: boolean) => void;
  onError?: (message: string) => void;
  getNextTrack?: () => NextTrackInfo | undefined;
  onSponsorBlockSkipped?: (category: string) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sponsorSegmentsRef = useRef<SponsorBlockSegment[]>([]);
  const qualityFallbackStepRef = useRef<number>(0); // 0 = original, 1 = standard, 2 = saver

  const audioCtxRef = useRef<AudioContext | null>(null);
  const filterNodesRef = useRef<BiquadFilterNode[]>([]);

  const isSeekingRef = useRef<boolean>(false);
  const seekCooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skippedSegmentsRef = useRef<Set<string>>(new Set());

  // Equalizer & sound profile state
  const [equalizerSettings, setEqualizerSettingsState] = useState<EqualizerSettings>(loadEqualizerSettings);
  const equalizerSettingsRef = useRef(equalizerSettings);
  equalizerSettingsRef.current = equalizerSettings;

  const currentTrackMetaRef = useRef<{ title?: string | undefined; artist?: string | undefined } | null>(null);

  const streamUrl = useCallback(
    (id: string, quality?: string, title?: string, artist?: string) => {
      const isLowNet = isLowNetworkModeEnabled();
      const q = isLowNet ? "saver" : (quality || equalizerSettingsRef.current.quality || "high");
      const t = title ?? currentTrackMetaRef.current?.title;
      const a = artist ?? currentTrackMetaRef.current?.artist;
      let url = `/api/stream/${encodeURIComponent(id)}?quality=${encodeURIComponent(q)}`;
      if (t) url += `&title=${encodeURIComponent(t)}`;
      if (a) url += `&artist=${encodeURIComponent(a)}`;
      return url;
    },
    [],
  );

  /** Probe the X-MelodyMap-Source header via a lightweight HEAD request. */
  const sourceProbeAbortRef = useRef<AbortController | null>(null);
  const detectStreamSource = useCallback((url: string) => {
    // Only probe same-origin proxy URLs (not direct CDN/offline blob URLs)
    if (!url.includes("/api/stream/")) {
      setStreamSource(null);
      return;
    }
    sourceProbeAbortRef.current?.abort();
    const controller = new AbortController();
    sourceProbeAbortRef.current = controller;

    fetch(url, { method: "HEAD", signal: controller.signal })
      .then((res) => {
        const src = res.headers.get("X-MelodyMap-Source") as "saavn" | "audius" | "jamendo" | null;
        if (src) setStreamSource(src);
      })
      .catch(() => {/* probe failed; no indicator shown */});
  }, []);

  // Initialize and attach core audio element as strict singleton in DOM
  useEffect(() => {
    if (typeof document === "undefined") return;

    // Purge any rogue prebuffer or duplicate audio elements
    const pEl = document.getElementById("melodymap-prebuffer-audio");
    if (pEl) {
      try {
        (pEl as HTMLAudioElement).pause();
        pEl.removeAttribute("src");
        (pEl as HTMLAudioElement).load();
        pEl.remove();
      } catch {}
    }

    let el = document.getElementById("melodymap-core-audio") as HTMLAudioElement | null;
    if (!el) {
      el = document.createElement("audio");
      el.id = "melodymap-core-audio";
      el.setAttribute("playsinline", "true");
      el.setAttribute("webkit-playsinline", "true");
      el.setAttribute("x-webkit-airplay", "allow");
      el.preload = "auto";
      el.volume = 1;
      el.muted = false;
      // 1x1 geometry and 0.01 opacity ensures Chromium layout engines and mobile OSes
      // treat the audio element as actively visible rendered media rather than
      // suspended background/hidden elements when the phone locks or tab unfocuses.
      el.style.position = "fixed";
      el.style.bottom = "0";
      el.style.left = "0";
      el.style.width = "1px";
      el.style.height = "1px";
      el.style.opacity = "0.01";
      el.style.zIndex = "-1";
      el.style.pointerEvents = "none";
      try {
        document.body.appendChild(el);
      } catch {}
    } else {
      el.muted = false;
    }

    // Purge any stale/duplicate audio elements in the document
    const allAudios = Array.from(document.querySelectorAll("audio"));
    for (const a of allAudios) {
      if (a !== el) {
        try {
          a.pause();
          a.removeAttribute("src");
          a.load();
          a.remove();
        } catch {}
      }
    }

    audioRef.current = el;
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
  const [streamSource, setStreamSource] = useState<
    "saavn" | "audius" | "jamendo" | "offline" | null
  >(null);
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
  /** Mirror of isPlaying so stable-identity callbacks (e.g. play()) read the current value instead of a stale closure. */
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const lastValidPositionRef = useRef(0);
  const seekRef = useRef<(seconds: number) => void>(() => {});

  const currentTrackIdRef = useRef<string | null>(null);
  const mainGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const isFadingOutRef = useRef<boolean>(false);

  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const stalledTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackSessionRef = useRef<number>(0);
  const currentDirectUrlRef = useRef<string | null>(null);
  const isRetryingRef = useRef<boolean>(false);
  const sourceProbeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeLockRef = useRef<any>(null);
  const userVolumeRef = useRef<number>(1.0);
  const volumeRampCleanupRef = useRef<(() => void) | null>(null);

  const applySafeVolumeLeveling = useCallback(
    (track?: { id?: string | undefined; source?: string | undefined } | null, smooth = true) => {
      const audio = audioRef.current;
      if (!audio) return;
      const enabled = isVolumeLevelingEnabled();
      const effectiveVol = computeEffectiveVolume(userVolumeRef.current, track, enabled);
      if (volumeRampCleanupRef.current) {
        volumeRampCleanupRef.current();
        volumeRampCleanupRef.current = null;
      }
      if (smooth && !audio.paused) {
        volumeRampCleanupRef.current = rampAudioVolume(audio, effectiveVol, 50);
      } else {
        audio.volume = effectiveVol;
      }
    },
    [],
  );

  const clearPendingTimers = useCallback(() => {
    audioPrefetchManager.abort();
    if (volumeRampCleanupRef.current) {
      volumeRampCleanupRef.current();
      volumeRampCleanupRef.current = null;
    }
    if (sourceProbeTimerRef.current) {
      clearTimeout(sourceProbeTimerRef.current);
      sourceProbeTimerRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (stalledTimerRef.current) {
      clearTimeout(stalledTimerRef.current);
      stalledTimerRef.current = null;
    }
    isRetryingRef.current = false;
  }, []);

  const acquireWakeLock = useCallback(async () => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    try {
      if (!wakeLockRef.current) {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        wakeLockRef.current.addEventListener("release", () => {
          wakeLockRef.current = null;
        });
      }
    } catch {
      // Non-fatal if wakeLock fails (e.g. low battery, background tab, or lack of permissions)
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch {}
  }, []);

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
    // Direct hardware audio output is used for all media playback.
    // We intentionally avoid calling createMediaElementSource(audio) on the main
    // <audio> element because:
    // 1. External streaming CDNs (e.g. JioSaavn aac.saavncdn.com) do not return
    //    CORS headers. Routing a cross-origin media element into createMediaElementSource
    //    forces Chromium / WebKit to output PURE SILENCE under W3C security rules.
    // 2. Direct HTML5 <audio> plays natively to the OS audio subsystem (speakers,
    //    headphones, bluetooth) with zero CORS restrictions, full hardware volume,
    //    no autoplay suspension, and reliable continuous background playback.
    if (typeof window === "undefined") return;
    const audio = audioRef.current;
    if (audio) {
      audio.muted = false;
      if (audio.volume === 0) audio.volume = 1;
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
      clearPendingTimers();
      isRetryingRef.current = false;
      setIsReconnecting(false);

      if (startAt > 0) {
        pendingSeekRef.current = startAt;
        setPosition(startAt);
      } else {
        pendingSeekRef.current = null;
        setPosition(0);
        setDuration(0);
      }

      // Detect stream source from proxy header (replacement recording indicator)
      // Defer probe slightly so it never races or contends with initial audio GET
      if (sourceProbeTimerRef.current) {
        clearTimeout(sourceProbeTimerRef.current);
      }
      sourceProbeTimerRef.current = setTimeout(() => {
        detectStreamSource(url);
      }, 1500);

      try {
        audio.pause();
      } catch {}

      // Stop and remove any other audio elements in the DOM to prevent dual-playback
      if (typeof document !== "undefined") {
        const allAudios = Array.from(document.querySelectorAll("audio"));
        for (const a of allAudios) {
          if (a !== audio) {
            try {
              a.pause();
              a.removeAttribute("src");
              a.load();
              a.remove();
            } catch {}
          }
        }
      }

      // Direct HTML5 <audio> plays natively to OS audio subsystem with full volume
      // and zero CORS restrictions. Omit crossorigin so streams never fail CORS.
      audio.removeAttribute("crossorigin");

      audio.loop = false;
      audio.muted = false;
      audio.src = url;
      const validSpeed = Number.isFinite(playbackSpeedRef.current) && playbackSpeedRef.current > 0 ? playbackSpeedRef.current : 1;
      audio.playbackRate = validSpeed;
      applySafeVolumeLeveling({ id: currentTrackIdRef.current ?? undefined }, false);
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
    [
      initWebAudio,
      detectStreamSource,
      clearPendingTimers,
      applySafeVolumeLeveling,
    ],
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
      if (audio && activeId) {
        const cur = audio.currentTime || 0;
        if (audio.src && audio.src.includes("/api/stream/")) {
          const newUrl = streamUrl(activeId, quality);
          setStream(newUrl, cur);
        } else if (audio.src && audio.src.includes("saavncdn.com")) {
          const targetSuffix =
            quality === "saver" ? "_96.mp4" : quality === "standard" ? "_160.mp4" : "_320.mp4";
          const newUrl = audio.src.replace(/_(?:96|160|320)\.mp4/, targetSuffix);
          if (newUrl !== audio.src) {
            setStream(newUrl, cur);
          }
        }
      }
    },
    [equalizerSettings, applyEqualizerGains, streamUrl, setStream],
  );

  const triggerReconnect = useCallback(() => {
    if (isRetryingRef.current) return;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    const trackId = currentTrackIdRef.current;
    if (!trackId || !wantPlayRef.current) return;

    const attempts = reconnectAttemptsRef.current;
    if (attempts >= 5) {
      setIsReconnecting(false);
      isRetryingRef.current = false;
      onErrorRef.current?.("Audio connection interrupted. Tap play to retry.");
      return;
    }

    const session = playbackSessionRef.current;
    reconnectAttemptsRef.current = attempts + 1;
    isRetryingRef.current = true;
    setIsReconnecting(true);
    setIsLoading(true);

    // Exponential backoff with random jitter: ~600ms, ~1400ms, ~2500ms...
    const baseDelay = Math.min(600 * Math.pow(1.6, attempts), 5000);
    const jitter = Math.random() * 250;
    const delay = Math.round(baseDelay + jitter);

    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      isRetryingRef.current = false;
      if (
        playbackSessionRef.current !== session ||
        !wantPlayRef.current ||
        currentTrackIdRef.current !== trackId
      ) {
        setIsReconnecting(false);
        return;
      }

      const audio = audioRef.current;
      if (!audio) {
        setIsReconnecting(false);
        return;
      }

      // If the audio element has not errored and already has buffered media,
      // attempt resuming playback directly without tearing down the buffered data
      if (!audio.error && audio.readyState >= 2 && audio.src) {
        const p = audio.play();
        if (p !== undefined) {
          p.then(() => {
            if (playbackSessionRef.current === session) {
              reconnectAttemptsRef.current = 0;
              setIsReconnecting(false);
              setIsPlaying(true);
              setIsLoading(false);
            }
          }).catch(() => {
            reloadAndResume();
          });
          return;
        }
      }

      reloadAndResume();

      function reloadAndResume() {
        if (
          playbackSessionRef.current !== session ||
          currentTrackIdRef.current !== trackId ||
          !wantPlayRef.current
        ) {
          setIsReconnecting(false);
          return;
        }
        const a = audioRef.current;
        const tid = currentTrackIdRef.current;
        if (!a || !tid) {
          setIsReconnecting(false);
          return;
        }
        const resumePos = lastValidPositionRef.current || 0;
        pendingSeekRef.current = resumePos > 0 ? resumePos : null;

        let freshUrl: string;
        if (currentDirectUrlRef.current && hasFullLengthDirectSource(tid)) {
          const direct = currentDirectUrlRef.current;
          freshUrl = direct.includes("?")
            ? `${direct}&_reconnect=${Date.now()}`
            : `${direct}?_reconnect=${Date.now()}`;
        } else {
          freshUrl = `${streamUrl(tid)}&_reconnect=${Date.now()}`;
        }

        a.src = freshUrl;
        a.load();
        const playPromise = a.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              if (playbackSessionRef.current === session) {
                reconnectAttemptsRef.current = 0;
                setIsReconnecting(false);
                setIsPlaying(true);
                setIsLoading(false);
              }
            })
            .catch((err) => {
              console.warn("[MelodyMap] Mid-song reconnection attempt failed:", err);
              if (err?.name === "NotAllowedError") {
                setIsReconnecting(false);
                setIsLoading(false);
              }
            });
        }
      }
    }, delay);
  }, [streamUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const applyPendingSeek = () => {
      if (pendingSeekRef.current !== null) {
        if (audio.readyState < 1) {
          // Media timeline not yet available (HAVE_NOTHING).
          // Retain pendingSeekRef.current until loadedmetadata or canplay fires.
          return;
        }
        const target = pendingSeekRef.current;
        pendingSeekRef.current = null;
        const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : target;
        const clamped = Math.max(0, Math.min(target, dur));
        try {
          audio.currentTime = clamped;
          setPosition(clamped);
        } catch (e) {
          console.warn("[MelodyMap] Failed to seek to pending position:", e);
        }
      }
    };

    const onPlay = () => {
      audio.muted = false;
      if (audio.volume === 0 && userVolumeRef.current > 0) {
        applySafeVolumeLeveling({ id: currentTrackIdRef.current ?? undefined }, false);
      }
      initWebAudio();
      // 'play' fires the instant play() is called, BEFORE any audio bytes have
      // arrived. Do NOT clear isLoading here: a cold stream can buffer for many
      // seconds, and clearing it made the dock show a "playing" pause glyph with
      // no sound. Keep the honest loading state until 'canplay'/'playing'/a real
      // timeupdate clears it.
      setIsPlaying(true);
      applyPendingSeek();
    };
    const onPlaying = () => {
      audio.muted = false;
      if (audio.volume === 0 && userVolumeRef.current > 0) {
        applySafeVolumeLeveling({ id: currentTrackIdRef.current ?? undefined }, false);
      }
      clearPendingTimers();
      reconnectAttemptsRef.current = 0;
      isRetryingRef.current = false;
      setIsReconnecting(false);
      setIsPlaying(true);
      setIsLoading(false);
      applyPendingSeek();
    };
    const onWaiting = () => {
      const session = playbackSessionRef.current;
      const tid = currentTrackIdRef.current;
      if (wantPlayRef.current) {
        setIsLoading(true);
        if (!stalledTimerRef.current) {
          stalledTimerRef.current = setTimeout(() => {
            stalledTimerRef.current = null;
            if (
              playbackSessionRef.current === session &&
              currentTrackIdRef.current === tid &&
              wantPlayRef.current &&
              (!audio.currentTime || audio.paused)
            ) {
              console.warn("[MelodyMap] Stream waiting timeout. Attempting reconnect.");
              triggerReconnect();
            }
          }, 12000);
        }
      }
    };
    const onStalled = () => {
      const session = playbackSessionRef.current;
      const tid = currentTrackIdRef.current;
      if (wantPlayRef.current && tid) {
        if (!stalledTimerRef.current) {
          stalledTimerRef.current = setTimeout(() => {
            stalledTimerRef.current = null;
            if (
              playbackSessionRef.current === session &&
              currentTrackIdRef.current === tid &&
              wantPlayRef.current &&
              audio.paused
            ) {
              console.warn("[MelodyMap] Audio stream stalled. Triggering mid-song reconnect.");
              triggerReconnect();
            }
          }, 12000);
        }
      }
    };
    const onCanPlay = () => {
      setIsLoading(false);
      clearPendingTimers();
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
      lastValidPositionRef.current = cur;
      setPosition(cur);
      setDuration(dur);
      if (cur > 0) {
        setIsLoading(false);
        if (stalledTimerRef.current) {
          clearTimeout(stalledTimerRef.current);
          stalledTimerRef.current = null;
        }
      }

      // Proactive Prefetch for next track in queue when <= 20s remaining
      if (audioPrefetchManager.shouldTriggerPrefetch(cur, dur)) {
        const nextTrack = getNextTrackRef.current?.();
        if (nextTrack?.id) {
          audioPrefetchManager.prefetchNextTrack({
            nextTrack,
            quality: equalizerSettingsRef.current.quality,
            sessionId: playbackSessionRef.current,
            streamUrlResolver: streamUrl,
          }).catch(() => {});
        }
      }

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
      // Guard against spurious ended events from browser audio bugs during buffering:
      // In real playback with media loaded, an audio track cannot legitimately finish
      // at currentTime === 0 if duration is known and > 3 seconds.
      const dur = audio.duration;
      const cur = audio.currentTime;
      if (Number.isFinite(dur) && dur > 10 && cur > 0 && cur < 2) {
        console.warn("[MelodyMap] Spurious onEnded ignored (cur:", cur, "dur:", dur, ")");
        return;
      }

      setIsPlaying(false);
      setIsLoading(false);

      // Synchronously grab next track BEFORE index is mutated in endedRef callback
      const nextTrack = getNextTrackRef.current?.();
      let didAutoAdvance = false;

      // Synchronous background advance for continuous playback with screen locked
      if (nextTrack && wantPlayRef.current) {
        clearPendingTimers();
        reconnectAttemptsRef.current = 0;
        isRetryingRef.current = false;
        setIsReconnecting(false);
        playbackSessionRef.current += 1;
        currentTrackIdRef.current = nextTrack.id;
        currentDirectUrlRef.current =
          nextTrack.previewUrl && hasFullLengthDirectSource(nextTrack.id)
            ? nextTrack.previewUrl
            : null;
        currentTrackMetaRef.current = { title: nextTrack.title, artist: nextTrack.artist };
        lastValidPositionRef.current = 0;
        setPosition(0);
        setDuration(0);
        const prewarmed = audioPrefetchManager.getPrewarmedUrl(nextTrack.id);
        const nextUrl =
          prewarmed ||
          currentDirectUrlRef.current ||
          streamUrl(nextTrack.id, equalizerSettingsRef.current.quality, nextTrack.title, nextTrack.artist);
        audio.src = nextUrl;
        const validSpeed = Number.isFinite(playbackSpeedRef.current) && playbackSpeedRef.current > 0 ? playbackSpeedRef.current : 1;
        audio.playbackRate = validSpeed;
        applySafeVolumeLeveling(nextTrack, true);
        audio.load();
        const p = audio.play();
        if (p !== undefined) {
          p.catch((err) => {
            console.warn("[BackgroundPlayback] Synchronous next auto-play notice:", err);
          });
        }
        // Restore WebAudio gain for the new track. The crossfade fade-out ramped
        // mainGain toward 0 over the tail of the previous song, and this
        // synchronous auto-advance path bypasses setStream (the only other place
        // that resets gain), so without this the next track plays silently at
        // gain ~0. Mirrors the fade-in logic in setStream.
        if (audioCtxRef.current && mainGainRef.current) {
          const ctx = audioCtxRef.current;
          const mainGain = mainGainRef.current;
          const fadeDur = equalizerSettingsRef.current.crossfade || 0;
          try {
            mainGain.gain.cancelScheduledValues(ctx.currentTime);
            if (fadeDur > 0) {
              const curve = createEqualPowerCurve("in", 32);
              mainGain.gain.setValueCurveAtTime(curve, ctx.currentTime, Math.min(fadeDur, 4));
            } else {
              mainGain.gain.setValueAtTime(1, ctx.currentTime);
            }
          } catch {}
        }
        didAutoAdvance = true;
      }

      // Notify parent component with autoAdvance status so it doesn't trigger a duplicate load race
      endedRef.current(didAutoAdvance);
    };

    const onError = () => {
      const activeId = currentTrackIdRef.current;
      if (!activeId) return;

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

        // Case 1: Recoverable network error mid-stream (code 2 = MEDIA_ERR_NETWORK)
        if (wantPlayRef.current && audio.error.code === 2) {
          console.warn("[MelodyMap] Audio network error (MEDIA_ERR_NETWORK), attempting mid-song reconnect.");
          triggerReconnect();
          return;
        }

        // Case 2: Source not supported (code 4 = MEDIA_ERR_SRC_NOT_SUPPORTED)
        // If a direct CDN URL failed, attempt falling back to server stream proxy ONCE
        if (
          wantPlayRef.current &&
          audio.error.code === 4 &&
          currentDirectUrlRef.current &&
          audio.src.includes(currentDirectUrlRef.current)
        ) {
          console.warn("[MelodyMap] Direct CDN source failed, falling back to stream proxy for", activeId);
          currentDirectUrlRef.current = null;
          const fallbackProxyUrl = streamUrl(
            activeId,
            undefined,
            currentTrackMetaRef.current?.title,
            currentTrackMetaRef.current?.artist,
          );
          setStream(fallbackProxyUrl, lastValidPositionRef.current || 0);
          return;
        }

        // Case 3: Permanent failure (code 4 / code 3 / invalid source)
        // Stop retrying the dead source. Clear retry state and report unplayable stream.
        clearPendingTimers();
        reconnectAttemptsRef.current = 0;
        setIsReconnecting(false);

        const message = activeId.startsWith("podcast:")
          ? "Couldn't play this episode. The podcast host may be temporarily unavailable."
          : "Audio stream unavailable, skipping to next track...";
        onErrorRef.current?.(message);
      }
    };

    const handleOnline = () => {
      console.info("[MelodyMap] Device reconnected to internet. Resuming active audio session.");
      if (wantPlayRef.current && currentTrackIdRef.current) {
        clearPendingTimers();
        reconnectAttemptsRef.current = 0;
        triggerReconnect();
      }
    };

    const handleOffline = () => {
      console.warn("[MelodyMap] Device disconnected from internet.");
      clearPendingTimers();
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

      if (sourceProbeTimerRef.current) {
        clearTimeout(sourceProbeTimerRef.current);
        sourceProbeTimerRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (stalledTimerRef.current) {
        clearTimeout(stalledTimerRef.current);
        stalledTimerRef.current = null;
      }
    };
  }, [initWebAudio, streamUrl, triggerReconnect, applySafeVolumeLeveling]);

  // Maintain uninterrupted playback across tab switches and app foreground/background
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibilityChange = () => {
      if (!document.hidden && wantPlayRef.current) {
        if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
          audioCtxRef.current.resume().catch(() => {});
        }
        acquireWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [acquireWakeLock]);

  // Acquire wake lock while playing to prevent mobile OS screen timeouts during active listening
  useEffect(() => {
    if (isPlaying) {
      acquireWakeLock();
    } else {
      releaseWakeLock();
    }
  }, [isPlaying, acquireWakeLock, releaseWakeLock]);

  // Dynamically update audio volume if loudness leveling is toggled in user preferences
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleLevelingChange = () => {
      applySafeVolumeLeveling({ id: currentTrackIdRef.current ?? undefined }, true);
    };
    window.addEventListener("melodymap:leveling-change", handleLevelingChange);
    return () => {
      window.removeEventListener("melodymap:leveling-change", handleLevelingChange);
    };
  }, [applySafeVolumeLeveling]);

  /** Cleanup on unmount */
  useEffect(() => {
    return () => {
      releaseWakeLock();
      audioPrefetchManager.clear();
      if (volumeRampCleanupRef.current) {
        volumeRampCleanupRef.current();
        volumeRampCleanupRef.current = null;
      }
      if (sourceProbeTimerRef.current) {
        clearTimeout(sourceProbeTimerRef.current);
        sourceProbeTimerRef.current = null;
      }
      sourceProbeAbortRef.current?.abort();
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
  }, [releaseWakeLock]);

  /** Use downloaded blob when available in IndexedDB offline storage */
  const playOffline = useCallback(
    async (id: string, startAt = 0): Promise<boolean> => {
      try {
        const blob = await getBlob(id);
        if (blob && blob.size > 10000) {
          if (objectUrlRef.current) {
            try {
              URL.revokeObjectURL(objectUrlRef.current);
            } catch {}
          }
          const blobUrl = URL.createObjectURL(blob);
          objectUrlRef.current = blobUrl;
          setStream(blobUrl, startAt);
          setStreamSource("offline");
          return true;
        }
      } catch (err) {
        console.warn("[MelodyMap] playOffline failed for", id, err);
      }
      return false;
    },
    [setStream],
  );

  /**
   * Direct URLs are only honored for providers whose streams are full-length
   * (saavn/audius/jamendo/archive/podcast).
   * For JioSaavn, automatically adapts bitrate suffix to match user's quality preference.
   */
  const sanitizeDirectUrl = (trackId: string, directUrl?: string): string | undefined => {
    if (!directUrl || !hasFullLengthDirectSource(trackId)) return undefined;
    if (directUrl.includes("saavncdn.com")) {
      const isLowNet = isLowNetworkModeEnabled();
      const q = isLowNet ? "saver" : (equalizerSettingsRef.current.quality || "high");
      const targetSuffix = q === "saver" ? "_96.mp4" : q === "standard" ? "_160.mp4" : "_320.mp4";
      return directUrl.replace(/_(?:96|160|320)\.mp4/, targetSuffix);
    }
    return directUrl;
  };

  /** Load a track and auto-play */
  const load = useCallback(
    async (id: string, directUrl?: string, startAt = 0, title?: string, artist?: string) => {
      clearPendingTimers();
      isRetryingRef.current = false;
      reconnectAttemptsRef.current = 0;
      setIsReconnecting(false);
      const session = ++playbackSessionRef.current;

      const sanitized = sanitizeDirectUrl(id, directUrl);
      currentDirectUrlRef.current = sanitized || null;
      if (title || artist) {
        currentTrackMetaRef.current = { title, artist };
      } else {
        currentTrackMetaRef.current = null;
      }
      wantPlayRef.current = true;
      // Create/resume the AudioContext synchronously while still inside the user
      // gesture that started playback, so the WebAudio EQ graph can be wired up and
      // render audio immediately (a context created after an await would start
      // suspended and play silent on web).
      initWebAudio();

      // Stop the double-load race: if synchronous gapless advance already started
      // playing this exact track at 0:00, avoid resetting position or restarting audio
      const audio = audioRef.current;
      const expectedUrl = sanitized || streamUrl(id, undefined, title, artist);
      if (
        currentTrackIdRef.current === id &&
        startAt === 0 &&
        audio &&
        (audio.src === expectedUrl || audio.src.includes(encodeURIComponent(id))) &&
        (!audio.paused || audio.readyState >= 1)
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
      setStreamSource(null);

      if (!sanitized && id) {
        void fetchSponsorBlockSegments(id).then((segs) => {
          if (playbackSessionRef.current === session && currentTrackIdRef.current === id) {
            sponsorSegmentsRef.current = segs;
          }
        });
      }

      const playedOffline = await playOffline(id, startAt);
      if (playbackSessionRef.current !== session) return;
      if (playedOffline) return;

      if (sanitized) {
        setStream(sanitized, startAt);
        return;
      }

      setStream(streamUrl(id, undefined, title, artist), startAt);
    },
    [clearPendingTimers, setStream, streamUrl, initWebAudio, playOffline],
  );

  /** Cue a track at specific second without autoplay */
  const cue = useCallback(
    async (id: string, startSeconds = 0, directUrl?: string, title?: string, artist?: string) => {
      clearPendingTimers();
      isRetryingRef.current = false;
      reconnectAttemptsRef.current = 0;
      setIsReconnecting(false);
      const session = ++playbackSessionRef.current;

      const sanitized = sanitizeDirectUrl(id, directUrl);
      currentDirectUrlRef.current = sanitized || null;
      if (title || artist) {
        currentTrackMetaRef.current = { title, artist };
      } else {
        currentTrackMetaRef.current = null;
      }
      wantPlayRef.current = false;
      currentTrackIdRef.current = id;
      lastValidPositionRef.current = startSeconds;
      setPosition(startSeconds);
      setDuration(0);
      qualityFallbackStepRef.current = 0;
      sponsorSegmentsRef.current = [];
      skippedSegmentsRef.current.clear();
      setStreamSource(null);

      if (!sanitized && id) {
        void fetchSponsorBlockSegments(id).then((segs) => {
          if (playbackSessionRef.current === session && currentTrackIdRef.current === id) {
            sponsorSegmentsRef.current = segs;
          }
        });
      }

      const playedOffline = await playOffline(id, startSeconds);
      if (playbackSessionRef.current !== session) return;
      if (playedOffline) return;

      if (sanitized) {
        setStream(sanitized, startSeconds);
        return;
      }

      setStream(streamUrl(id, undefined, title, artist), startSeconds);
    },
    [clearPendingTimers, setStream, streamUrl, playOffline],
  );

  const play = useCallback(() => {
    wantPlayRef.current = true;
    initWebAudio();
    const audio = audioRef.current;
    if (!audio) return;

    // If audio element is in an error state or has no valid source, recover it
    if (
      audio.error ||
      audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE ||
      !audio.src ||
      audio.src.endsWith("/")
    ) {
      clearPendingTimers();
      reconnectAttemptsRef.current = 0;
      isRetryingRef.current = false;
      setIsReconnecting(false);

      const resumePos = lastValidPositionRef.current || 0;
      const targetUrl =
        currentDirectUrlRef.current ||
        (audio.src && !audio.src.endsWith("/") && !audio.src.includes("/api/stream/undefined") ? audio.src : null) ||
        (currentTrackIdRef.current
          ? streamUrl(
              currentTrackIdRef.current,
              undefined,
              currentTrackMetaRef.current?.title,
              currentTrackMetaRef.current?.artist,
            )
          : null);

      if (targetUrl) {
        setIsLoading(true);
        audio.src = targetUrl;
        if (resumePos > 0) {
          pendingSeekRef.current = resumePos;
        }
        audio.load();
        const p = audio.play();
        if (p !== undefined) {
          p.catch((err) => {
            if (err.name !== "AbortError" && err.name !== "NotAllowedError") {
              console.warn("[MelodyMap] play() retry error:", err);
            }
          });
        }
        return;
      }
    }

    if (audio.src && audio.src.length > 0 && !audio.src.endsWith("/")) {
      audio.muted = false;
      if (audio.volume === 0) audio.volume = 1;
      const p = audio.play();
      if (p !== undefined) {
        p.catch((err) => {
          if (err.name !== "AbortError" && err.name !== "NotAllowedError") {
            console.warn("[MelodyMap] play() error:", err);
          }
        });
      }
    }
  }, [clearPendingTimers, initWebAudio, streamUrl]);

  const pause = useCallback(() => {
    wantPlayRef.current = false;
    isSeekingRef.current = false;
    if (seekCooldownTimerRef.current) {
      clearTimeout(seekCooldownTimerRef.current);
      seekCooldownTimerRef.current = null;
    }
    try {
      audioRef.current?.pause();
    } catch {}
    setIsPlaying(false);
  }, []);

  const seek = useCallback((seconds: number) => {
    audioPrefetchManager.abort();
    const target = Math.max(0, seconds);
    lastValidPositionRef.current = target;
    setPosition(target);

    const audio = audioRef.current;
    if (!audio) return;
    if (audio.readyState < 1 || !Number.isFinite(audio.duration) || audio.duration === 0) {
      pendingSeekRef.current = target;
      return;
    }
    const max = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : target;
    const clamped = Math.max(0, Math.min(target, max));
    audio.currentTime = clamped;
    audio.muted = false;
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
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = clamped;
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(100, v));
    userVolumeRef.current = clamped / 100;
    const audio = audioRef.current;
    if (audio) {
      applySafeVolumeLeveling({ id: currentTrackIdRef.current ?? undefined }, false);
      audio.muted = clamped === 0;
    }
  }, [applySafeVolumeLeveling]);

  const isReplacementSource = false;

  return {
    ready,
    isPlaying,
    isLoading,
    isReconnecting,
    position,
    duration,
    playbackSpeed,
    streamSource,
    isReplacementSource,
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
    getAnalyser: () => analyserRef.current,
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

