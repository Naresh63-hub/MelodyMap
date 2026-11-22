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
 * Measured CORS results for provider CDN hosts.
 * Date Checked: 2026-11-22T22:33:00+05:30 (re-measured via scripts/check-cdn-cors.mjs)
 *
 * Headers measured with Origin: https://melodymap-pi.vercel.app:
 * - JioSaavn (aac.saavncdn.com): Access-Control-Allow-Origin: none (NO) -> false
 * - JioSaavn (c.saavncdn.com): Access-Control-Allow-Origin: * (YES, static assets; audio disabled) -> false
 * - Jamendo (prod-1.storage.jamendo.com, mp3d.jamendo.com): Access-Control-Allow-Origin: none (NO) -> false
 * - Internet Archive (archive.org, *.us.archive.org): Access-Control-Allow-Origin: none (NO) -> false
 * - Audius (audius.co, creatornode.audius.co): Access-Control-Allow-Origin: * (YES) -> true
 */
export const CDN_CORS_ELIGIBILITY_MAP: Readonly<Record<string, boolean>> = {
  // JioSaavn CDNs
  "saavncdn.com": false,
  "aac.saavncdn.com": false,
  "c.saavncdn.com": false,
  "preview.saavncdn.com": false,

  // Jamendo CDNs
  "storage.jamendo.com": false,
  "prod-1.storage.jamendo.com": false,
  "mp3d.jamendo.com": false,
  "jamendo.com": false,

  // Internet Archive CDNs
  "archive.org": false,
  "us.archive.org": false,

  // Audius CDNs (Verified Access-Control-Allow-Origin: *)
  "audius.co": true,
  "creatornode.audius.co": true,
  "discoveryprovider.audius.co": true,
} as const;

/**
 * Checks whether an audio stream URL can safely be routed through Web Audio
 * without encountering the Chromium/WebKit CORS pure-silence restriction.
 * Depends on the measured CDN_CORS_ELIGIBILITY_MAP table (checked 2026-11-22).
 * Same-origin stream proxies (e.g. /api/stream/...) and offline blob: URLs
 * are always fully eligible.
 */
export function isSourceWebAudioEligible(url: string, origin?: string): boolean {
  if (!url) return false;
  const clean = url.trim();

  // Blob URLs from IndexedDB offline storage are local and always eligible
  if (clean.startsWith("blob:")) return true;

  // Relative URLs (stream proxy) are same-origin and always eligible
  if (clean.startsWith("/") && !clean.startsWith("//")) return true;

  // Same-origin check
  const currentOrigin =
    origin || (typeof window !== "undefined" && window.location ? window.location.origin : "");
  if (currentOrigin && clean.startsWith(currentOrigin)) return true;

  // Extract hostname for map lookup
  let hostname = "";
  try {
    const parsed = new URL(clean, "http://localhost");
    hostname = parsed.hostname.toLowerCase();
  } catch {
    return false;
  }

  // Exact host match in measured CORS table
  if (hostname in CDN_CORS_ELIGIBILITY_MAP) {
    return CDN_CORS_ELIGIBILITY_MAP[hostname]!;
  }

  // Domain suffix match (e.g. *.saavncdn.com, *.audius.co, *.archive.org)
  for (const [domain, isEligible] of Object.entries(CDN_CORS_ELIGIBILITY_MAP)) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) {
      return isEligible;
    }
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

/**
 * Sets the audio source on an HTMLAudioElement while guaranteeing that
 * audio.crossOrigin = "anonymous" is configured BEFORE audio.src is assigned
 * whenever the Web Audio graph is used with a CORS-eligible audio source.
 *
 * In Chromium / WebKit, assigning audio.src before audio.crossOrigin = "anonymous"
 * begins the network request in tainted mode without sending the Origin header,
 * which causes MediaElementAudioSourceNode to output pure silence.
 */
export function setAudioElementSource(
  audio: HTMLAudioElement,
  url: string,
  isGraphUsed: boolean = false,
): void {
  if (isGraphUsed && isSourceWebAudioEligible(url)) {
    audio.crossOrigin = "anonymous";
  } else {
    audio.removeAttribute("crossorigin");
  }
  audio.src = url;
}

