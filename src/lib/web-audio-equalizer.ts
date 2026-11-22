import type { EqualizerSettings } from "./equalizer";

export interface BiquadFilterSpec {
  frequency: number;
  type: BiquadFilterType;
  label: string;
}

export const EQUALIZER_SPECS: readonly BiquadFilterSpec[] = [
  { frequency: 31, type: "lowshelf", label: "31Hz" },
  { frequency: 62, type: "peaking", label: "62Hz" },
  { frequency: 125, type: "peaking", label: "125Hz" },
  { frequency: 250, type: "peaking", label: "250Hz" },
  { frequency: 500, type: "peaking", label: "500Hz" },
  { frequency: 1000, type: "peaking", label: "1kHz" },
  { frequency: 2000, type: "peaking", label: "2kHz" },
  { frequency: 4000, type: "peaking", label: "4kHz" },
  { frequency: 8000, type: "peaking", label: "8kHz" },
  { frequency: 16000, type: "highshelf", label: "16kHz" },
] as const;

/**
 * Checks whether an audio stream URL can safely be routed through Web Audio
 * without encountering the Chromium/WebKit CORS pure-silence restriction.
 * Same-origin stream proxies (e.g. /api/stream/...) and offline blob: URLs
 * are always fully eligible. Cross-origin CDNs without CORS are not.
 */
export function isSourceWebAudioEligible(url: string, origin?: string): boolean {
  if (!url) return false;
  const clean = url.trim();

  // Blob URLs from IndexedDB offline storage
  if (clean.startsWith("blob:")) return true;

  // Relative URLs (stream proxy)
  if (clean.startsWith("/") && !clean.startsWith("//")) return true;

  // Same-origin check
  const currentOrigin =
    origin || (typeof window !== "undefined" && window.location ? window.location.origin : "");
  if (currentOrigin && clean.startsWith(currentOrigin)) return true;

  // Known cross-origin CDNs that do NOT supply CORS headers:
  if (
    clean.includes("saavncdn.com") ||
    clean.includes("c.saavncdn.com") ||
    clean.includes("aac.saavncdn.com")
  ) {
    return false;
  }

  // Cross-origin providers with verified CORS support (Audius, Archive.org):
  if (clean.includes("audius.co") || clean.includes("archive.org")) {
    return true;
  }

  return false;
}

/**
 * Computes effective biquad filter gains for the 10-band equalizer.
 * When the equalizer is disabled or bypassed, all gains MUST be 0 dB.
 * This guarantees completely neutral pass-through without disconnecting nodes.
 */
export function getEffectiveBiquadGains(
  settings?: EqualizerSettings | null,
  isBypassed: boolean = false,
): number[] {
  const zeroGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  if (!settings || !settings.enabled || isBypassed) {
    return zeroGains;
  }

  const rawGains = settings.gains || zeroGains;
  return Array.from({ length: 10 }, (_, i) => {
    const g = rawGains[i] ?? 0;
    return Math.max(-12, Math.min(12, g));
  });
}

/**
 * Generates an equal-power trigonometric curve for smooth crossfading without
 * sudden volume drops or perceptual dips at transition points.
 */
export function computeFadeCurve(type: "in" | "out", length = 32): Float32Array {
  const len = Math.max(2, length);
  const curve = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / (len - 1);
    curve[i] = type === "in" ? Math.sin((t * Math.PI) / 2) : Math.cos((t * Math.PI) / 2);
  }
  return curve;
}

export interface WebAudioGraphNodes {
  audioContext: AudioContext;
  sourceNode: MediaElementAudioSourceNode;
  preampNode: GainNode;
  filterNodes: BiquadFilterNode[];
  fadeNode: GainNode;
}

/**
 * Constructs the Web Audio chain for an HTML5 audio element:
 * MediaElementSource -> Preamp (Gain) -> 10 BiquadFilters -> Fade (Gain) -> Destination
 * Reusable and permanent per audio element.
 */
export function createWebAudioChain(
  audioElement: HTMLAudioElement,
  audioCtx?: AudioContext,
): WebAudioGraphNodes {
  const ctx = audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
  const sourceNode = ctx.createMediaElementSource(audioElement);
  const preampNode = ctx.createGain();
  preampNode.gain.value = 1.0;

  let prevNode: AudioNode = sourceNode;
  prevNode.connect(preampNode);
  prevNode = preampNode;

  const filterNodes: BiquadFilterNode[] = [];
  for (const spec of EQUALIZER_SPECS) {
    const filter = ctx.createBiquadFilter();
    filter.type = spec.type;
    filter.frequency.value = spec.frequency;
    filter.gain.value = 0;
    filter.Q.value = 1.0;
    prevNode.connect(filter);
    prevNode = filter;
    filterNodes.push(filter);
  }

  const fadeNode = ctx.createGain();
  fadeNode.gain.value = 1.0;
  prevNode.connect(fadeNode);
  fadeNode.connect(ctx.destination);

  return {
    audioContext: ctx,
    sourceNode,
    preampNode,
    filterNodes,
    fadeNode,
  };
}
