/**
 * MelodyMap Safe Audio Leveling & Peak Protection
 *
 * Provides conservative source-level volume offsets and smooth 50ms micro-ramping
 * directly on native HTMLMediaElement volume.
 *
 * NOTE ON LUFS / EBU R128 & CLIPPING:
 * Upstream streaming CDNs and search providers do not provide integrated LUFS or
 * ReplayGain metadata tags. Per engineering integrity standards, MelodyMap does NOT
 * claim measured LUFS normalization. Clamping the HTMLMediaElement volume multiplier to 1.0
 * enforces an element-level ceiling (preventing the player from injecting digital
 * gain above 0 dBFS), but does not remove digital clipping or distortion already baked
 * into the upstream master.
 */

const LEVELING_STORAGE_KEY = "melodymap.loudness_leveling.v1";

/**
 * Check if Safe Playback Leveling is enabled in user preferences (defaults to true).
 */
export function isVolumeLevelingEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const saved = localStorage.getItem(LEVELING_STORAGE_KEY);
    if (saved !== null) {
      return saved === "true";
    }
    return true; // enabled by default
  } catch {
    return true;
  }
}

/**
 * Toggle Safe Playback Leveling preference.
 */
export function setVolumeLevelingEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LEVELING_STORAGE_KEY, enabled ? "true" : "false");
    window.dispatchEvent(new CustomEvent("melodymap:leveling-change", { detail: { enabled } }));
  } catch {}
}

/**
 * Computes source gain offset.
 * Upstream podcast and music sources lack standardized or verified LUFS/ReplayGain metadata.
 * Blindly applying a +0.5 dB boost to every podcast is not justified by reliable source-level
 * information and risks pushing loud masters into distortion or creating abrupt volume jumps.
 * Therefore, neutral 1.00x gain (0 dB) is applied by default across all unmeasured tracks.
 * If a track carries an explicit, verified targetGain property, that value is respected and
 * bounded within [0.5, 1.0].
 */
export function computeSourceGain(track?: { id?: string | undefined; source?: string | undefined; targetGain?: number | undefined } | null): number {
  if (!track || !track.id) return 1.0;
  if (typeof track.targetGain === "number" && Number.isFinite(track.targetGain)) {
    return Math.max(0.5, Math.min(1.0, track.targetGain));
  }
  return 1.0; // neutral gain across all sources without measured LUFS
}

/**
 * Computes effective volume with strict element ceiling enforcement.
 * Clamps result strictly within [0.0, 1.0] so HTMLMediaElement volume cannot exceed 1.0.
 * Disabling leveling returns safeUserVol directly, preserving user volume preference.
 */
export function computeEffectiveVolume(
  userVolume: number,
  track?: { id?: string | undefined; source?: string | undefined; targetGain?: number | undefined } | null,
  enabled = true,
): number {
  const safeUserVol = Number.isFinite(userVolume) ? Math.max(0.0, Math.min(1.0, userVolume)) : 1.0;
  if (!enabled) return safeUserVol;

  const gain = computeSourceGain(track);
  // Strict ceiling clamp at 1.0 (prevents player-induced digital gain over 0 dBFS)
  return Math.min(1.0, Math.max(0.0, safeUserVol * gain));
}

/**
 * Smoothly transitions an audio element's volume to the target over durationMs (default 50ms)
 * to prevent audible clicks, pops, or abrupt volume jumps between tracks or settings changes.
 * Returns a cancel function.
 */
export function rampAudioVolume(
  audio: HTMLAudioElement,
  targetVolume: number,
  durationMs = 50,
): () => void {
  const clampedTarget = Math.max(0.0, Math.min(1.0, targetVolume));
  if (!audio) return () => {};

  const startVolume = audio.volume;
  if (Math.abs(startVolume - clampedTarget) < 0.005 || durationMs <= 0) {
    audio.volume = clampedTarget;
    return () => {};
  }

  const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();
  let cancelled = false;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const step = () => {
    if (cancelled) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const elapsed = now - startTime;
    const progress = Math.min(1.0, elapsed / durationMs);

    // Linear micro-ramp
    const current = startVolume + (clampedTarget - startVolume) * progress;
    try {
      audio.volume = Math.max(0.0, Math.min(1.0, current));
    } catch {}

    if (progress < 1.0 && !cancelled) {
      timerId = setTimeout(step, 10);
    } else if (!cancelled) {
      audio.volume = clampedTarget;
    }
  };

  step();

  return () => {
    cancelled = true;
    if (timerId) clearTimeout(timerId);
  };
}
