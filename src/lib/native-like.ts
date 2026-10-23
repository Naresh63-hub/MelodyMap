/**
 * Guard around the Android lock-screen / notification Like/Unlike button.
 *
 * The native media service forwards a `like:<trackId>` command into the WebView.
 * That tap is a *request* to toggle the currently playing track, and it arrives
 * outside the normal React event flow: the screen may be locked, the app may be in
 * the background, and OEM SystemUI is known to re-fire notification actions. So the
 * same tap can reach us twice, or for a track that has already moved on.
 *
 * This module decides, purely and testably, whether a request should actually write
 * to the library. It never touches playback: a rejected or failed like must leave
 * audio running exactly as it was.
 */

export type NativeLikeOutcome =
  /** The library was asked to toggle the active track. */
  | "toggled"
  /** No track is loaded, or native sent an empty id — nothing to identify. */
  | "ignored-no-track"
  /** The tapped track is no longer the active one (auto-advance raced the tap). */
  | "ignored-stale-track"
  /** Same track as the previous accepted tap, inside the debounce window. */
  | "ignored-debounce"
  /** The toggle itself threw (offline, storage full, auth failure) — playback unaffected. */
  | "failed";

export interface NativeLikeGuard {
  /**
   * @param requestedTrackId track id supplied by the native side, if any.
   * @param activeTrackId    the track the web player currently has loaded.
   * @param toggle           performs the real like/unlike write.
   */
  request(
    requestedTrackId: string | null | undefined,
    activeTrackId: string | null | undefined,
    toggle: () => void,
  ): NativeLikeOutcome;
  /** Forget debounce history (e.g. the active track changed by other means). */
  reset(): void;
}

const DEFAULT_DEBOUNCE_MS = 600;

export function createNativeLikeGuard(
  opts: { debounceMs?: number; now?: () => number } = {},
): NativeLikeGuard {
  const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const now = opts.now ?? (() => Date.now());

  let lastAcceptedTrackId: string | null = null;
  let lastAcceptedAt = 0;

  return {
    request(requestedTrackId, activeTrackId, toggle) {
      // Identity comes from the player first; the native id is a cross-check.
      const trackId = (activeTrackId ?? requestedTrackId ?? "").trim();
      if (!trackId) return "ignored-no-track";

      // If native named a track, it must still be the one on screen. Tapping the
      // heart while the queue has already advanced would otherwise like the wrong song.
      if (requestedTrackId && requestedTrackId !== trackId) return "ignored-stale-track";

      // Repeated taps on the same track collapse; a different track is immediate.
      if (trackId === lastAcceptedTrackId && now() - lastAcceptedAt < debounceMs) {
        return "ignored-debounce";
      }

      lastAcceptedTrackId = trackId;
      lastAcceptedAt = now();
      try {
        toggle();
      } catch {
        // Roll the guard back so the user can retry, and swallow: a failed like must
        // never interrupt playback or surface as a crash on the lock screen.
        lastAcceptedTrackId = null;
        lastAcceptedAt = 0;
        return "failed";
      }
      return "toggled";
    },
    reset() {
      lastAcceptedTrackId = null;
      lastAcceptedAt = 0;
    },
  };
}
