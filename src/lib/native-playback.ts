/**
 * Native Android playback bridge glue (Spotify-style background playback).
 *
 * The Android app exposes a `window.AndroidPlayback` JavascriptInterface
 * (PlaybackBridge.java). This module is the ONLY place that talks to it:
 *
 *  - notifyPlaybackState()  → start/stop the foreground media service and
 *    update its notification + MediaSession (track title, artist, position).
 *  - notifyPlaybackPosition() → lightweight periodic position sync.
 *  - installMediaCommandHandler() → receives play/pause/next/prev/seek
 *    commands from the lockscreen, notification buttons, and headset.
 *  - requestBatteryOptimizationExemption() → once-per-install system prompt
 *    so aggressive OEM battery savers (Xiaomi/Oppo/Realme...) don't kill the
 *    app after a few minutes of background play.
 *
 * Everything is a safe no-op outside the native app (plain web browsers),
 * and every bridge call is guarded against a missing or throwing bridge.
 */

import { Capacitor } from "@capacitor/core";

export type NativePlaybackState = "playing" | "paused" | "stopped";

export interface NativeTrackMeta {
  id?: string | undefined;
  title?: string | undefined;
  artist?: string | undefined;
  /** Duration in seconds, if known. */
  duration?: number | undefined;
  /** Current position in seconds. */
  position?: number | undefined;
}

interface AndroidPlaybackBridge {
  onPlay?: (payloadJson: string) => void;
  onPause?: (payloadJson: string) => void;
  onStop?: () => void;
  onPosition?: (positionSeconds: number) => void;
  requestIgnoreBatteryOptimizations?: () => void;
}

declare global {
  interface Window {
    AndroidPlayback?: AndroidPlaybackBridge | undefined;
    __melodymap_media_command?: ((command: string) => void) | undefined;
  }
}

const BATTERY_PROMPT_KEY = "melodymap.battery_prompt.v1";

/**
 * True when the player is running inside the native Android app (or any
 * embedded runtime that behaves like it). Detection order:
 *  1. The playback bridge itself (definitive for this feature).
 *  2. Capacitor's native-platform flag (injected into the WebView).
 *  3. The custom UA suffix MainActivity appends ("MelodyMapApp").
 */
export function isNativePlaybackEnv(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    AndroidPlayback?: unknown;
    Capacitor?: { isNativePlatform?: () => boolean };
  };
  if (w.AndroidPlayback) return true;
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch {
    // fall through to the remaining heuristics
  }
  if (typeof w.Capacitor?.isNativePlatform === "function") {
    try {
      if (w.Capacitor.isNativePlatform()) return true;
    } catch {
      // ignore malformed bridges
    }
  }
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.userAgent === "string" &&
    navigator.userAgent.includes("MelodyMapApp")
  );
}

export type PlaybackEngine = "html5" | "youtube";

/**
 * Which audio engine should own playback for this environment.
 *
 * Native app: ALWAYS the HTML5 proxy engine. The YouTube IFrame player pauses
 * itself whenever the WebView becomes invisible (screen off / app switch) and
 * its cross-origin document cannot be patched from the parent page — it can
 * never deliver Spotify-like background playback inside the APK. The HTML5
 * `<audio>` element streams through our own /api/stream proxy and keeps
 * playing behind the foreground media service.
 *
 * Plain web browsers keep the existing behavior: proxy engine on localhost,
 * client-side YouTube engine on deployed hosts (fast start, no proxy latency).
 */
export function resolvePlaybackEngine(opts: {
  isNative: boolean;
  hostname: string;
}): PlaybackEngine {
  if (opts.isNative) return "html5";
  const host = (opts.hostname || "").toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") return "html5";
  return "youtube";
}

function sanitizeSeconds(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return value;
}

function buildPayload(meta: NativeTrackMeta | undefined): string {
  return JSON.stringify({
    id: meta?.id ?? "",
    title: meta?.title ?? "",
    artist: meta?.artist ?? "",
    duration: sanitizeSeconds(meta?.duration),
    position: sanitizeSeconds(meta?.position),
  });
}

/**
 * Tell the native service what the player is doing. "playing" starts (or
 * updates) the foreground media notification; "paused" updates it to a paused
 * state (the service stops itself after a grace period); "stopped" removes it.
 */
export function notifyPlaybackState(
  state: NativePlaybackState,
  meta?: NativeTrackMeta,
): void {
  if (typeof window === "undefined") return;
  const bridge = window.AndroidPlayback;
  if (!bridge) return;
  const payload = buildPayload(meta);
  try {
    if (state === "playing") {
      bridge.onPlay?.(payload);
    } else if (state === "paused") {
      bridge.onPause?.(payload);
    } else {
      bridge.onStop?.();
    }
  } catch (err) {
    console.warn("[NativePlayback] bridge call failed:", err);
  }
}

/** Lightweight periodic position sync for the lockscreen progress bar. */
export function notifyPlaybackPosition(positionSeconds: number): void {
  if (typeof window === "undefined") return;
  const bridge = window.AndroidPlayback;
  if (!bridge?.onPosition) return;
  try {
    bridge.onPosition(sanitizeSeconds(positionSeconds));
  } catch {
    // position updates are best-effort; never let them break playback
  }
}

export interface NativeMediaCommandHandlers {
  play?: () => void;
  pause?: () => void;
  next?: () => void;
  prev?: () => void;
  stop?: () => void;
  /** Receives the seek target in seconds (native sends "seek:<seconds>"). */
  seek?: (seconds: number) => void;
}

/**
 * Install the global dispatcher the native side calls for lockscreen /
 * notification / headset media buttons. Returns a cleanup function.
 */
export function installMediaCommandHandler(
  handlers: NativeMediaCommandHandlers,
): () => void {
  if (typeof window === "undefined") return () => {};

  const dispatcher = (command: string) => {
    try {
      if (typeof command === "string" && command.startsWith("seek:")) {
        const seconds = Number(command.slice(5));
        if (Number.isFinite(seconds)) handlers.seek?.(seconds);
        return;
      }
      switch (command) {
        case "play":
          handlers.play?.();
          break;
        case "pause":
          handlers.pause?.();
          break;
        case "next":
          handlers.next?.();
          break;
        case "prev":
          handlers.prev?.();
          break;
        case "stop":
          handlers.stop?.();
          break;
        default:
          break;
      }
    } catch (err) {
      console.warn("[NativePlayback] media command failed:", command, err);
    }
  };

  window.__melodymap_media_command = dispatcher;

  return () => {
    try {
      if (window.__melodymap_media_command === dispatcher) {
        delete window.__melodymap_media_command;
      }
    } catch {
      // window may be torn down during unmount
    }
  };
}

/**
 * Ask Android to exempt the app from battery optimization so aggressive OEM
 * savers don't kill background playback after a few minutes. Prompted at most
 * once per install (flag persisted in localStorage).
 */
export function requestBatteryOptimizationExemption(): void {
  if (typeof window === "undefined") return;
  if (!Capacitor.isNativePlatform()) return;
  const bridge = window.AndroidPlayback;
  if (!bridge?.requestIgnoreBatteryOptimizations) return;
  try {
    if (window.localStorage.getItem(BATTERY_PROMPT_KEY) === "1") return;
    window.localStorage.setItem(BATTERY_PROMPT_KEY, "1");
  } catch {
    // If localStorage is unavailable, still allow the single prompt below.
  }
  try {
    bridge.requestIgnoreBatteryOptimizations();
  } catch (err) {
    console.warn("[NativePlayback] battery exemption request failed:", err);
  }
}
