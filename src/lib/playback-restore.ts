import type { TrackLike } from "./track-dedup";
import { isPodcastTrack } from "./track-filters";
import { hasPlayableDuration } from "./feed-freshness";

/**
 * A snapshot of "what was playing" persisted to localStorage (melodymap.playback.v1)
 * so a page refresh brings back the same song and queue, paused, with one click to resume.
 */
export interface PlaybackSnapshotLike<T extends TrackLike = TrackLike> {
  queue: Array<T | null | undefined>;
  index: number | null | undefined;
  position?: number | null | undefined;
  isPlaying?: boolean | null | undefined;
}

export interface ResolvedPlayback<T extends TrackLike = TrackLike> {
  /** Cleaned, playability-filtered queue ready for setQueue(). */
  queue: T[];
  /** Index in the cleaned queue that points at the SAME song the user was hearing. */
  index: number;
  /** Saved resume position in seconds, sanitized (>= 0). Callers decide how to apply it (e.g. music restarts at 0). */
  position: number;
  /** True when the cleaned queue is empty (caller should skip restore entirely). */
  empty: boolean;
}

/**
 * Pure core of the refresh-restore flow.
 *
 * Persists the "what was playing" intent: given a saved snapshot, produce the queue
 * and index to restore such that the restored track is the SAME song the user was
 * hearing, even after playability filtering drops tracks from the queue.
 *
 * The saved index is relative to the RAW queue; it must never be naively clamped
 * against the cleaned queue — unplayable tracks before the current one shift every
 * subsequent position (e.g. [unplayable, current, B] at index 1 would clamp to B).
 * Instead, the current track is located BY ID in the cleaned queue.
 */
export function resolveRestorablePlayback<T extends TrackLike = TrackLike>(
  snapshot: PlaybackSnapshotLike<T>,
): ResolvedPlayback<T> {
  const rawQueue = Array.isArray(snapshot?.queue) ? snapshot.queue : [];

  // Capture the interrupted song by ID from the RAW queue BEFORE any filtering,
  // then relocate it in the cleaned queue.
  const savedIndex = typeof snapshot.index === "number" && Number.isFinite(snapshot.index)
    ? Math.floor(snapshot.index)
    : 0;
  const rawCurrentId = rawQueue[savedIndex]?.id ?? null;

  // Hard rule (same as playback entry): music tracks need a known duration <= 600s
  // to be restorable; podcasts are exempt (long-form by design).
  const cleaned = rawQueue.filter(
    (t): t is T => !!t && !!t.id && (isPodcastTrack(t) || hasPlayableDuration(t)),
  );

  if (cleaned.length === 0) {
    return { queue: [], index: 0, position: 0, empty: true };
  }

  // Relocate the saved current track by ID; fall back to the first restorable track.
  const relocatedIndex = rawCurrentId
    ? cleaned.findIndex((t) => t.id === rawCurrentId)
    : -1;
  const index = relocatedIndex !== -1 ? relocatedIndex : 0;

  const position =
    typeof snapshot.position === "number" && Number.isFinite(snapshot.position)
      ? Math.max(0, snapshot.position)
      : 0;

  return { queue: cleaned, index, position, empty: false };
}

/**
 * Decide where a restored track should start.
 *
 * The save loop persists position every 2.5s, so the snapshot is fresh enough to
 * resume mid-song — including in the Android app after background process death
 * (a cold reload previously threw the position away and restarted at 0:00).
 *
 * Clamp rules (apply to music AND podcasts):
 *  - a saved position under 5s means the track had (re)started: begin at 0:00
 *  - a position within the last 15s of a known duration means the track was
 *    effectively finished: begin at 0:00 so the listener hears the song
 *  - otherwise resume at the saved position
 *
 * Callers still deliver the start position through cue() so nothing autoplays
 * without a tap.
 */
export function resolveRestoreStartSeconds(savedPosition: number, durationSeconds: number | null | undefined): number {
  if (!Number.isFinite(savedPosition) || savedPosition < 5) return 0;
  if (typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds > 0) {
    if (savedPosition >= durationSeconds - 15) return 0;
  }
  return Math.floor(savedPosition);
}
