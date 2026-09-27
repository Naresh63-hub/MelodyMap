/**
 * Session-level feed freshness for recommendation candidates.
 *
 * Guarantees for every Home refresh / feed build:
 *  - Previously displayed track IDs are excluded (session-scoped, NOT permanent).
 *  - Liked track IDs are excluded from fresh candidates (they stay in the Library).
 *  - Recently played track IDs are excluded where available.
 *  - The currently playing track is excluded.
 *  - Duplicate track IDs are removed (first occurrence wins, order preserved).
 *  - Only tracks with a KNOWN duration in (0, 600] seconds pass the duration gate.
 *    Unknown / null / invalid durations are NEVER assumed short — they are excluded.
 *
 * Ordering contract: these hard filters run BEFORE Thompson Sampling ranking,
 * queue creation, AutoDJ extension, recommendation display, playSong(), and
 * next-track selection.
 */

import { MAX_TRACK_DURATION_SECONDS, parseDurationSeconds } from "./track-filters";
import type { Track } from "./types";

export interface FeedExclusions {
  /** Track IDs already shown in this session's recommendation feeds. */
  previouslyDisplayedIds?: ReadonlySet<string> | undefined;
  /** Track IDs the user has liked. Excluded from fresh picks; Library is unaffected. */
  likedIds?: ReadonlySet<string> | undefined;
  /** Track IDs played recently (session history). Excluded where available. */
  recentlyPlayedIds?: ReadonlySet<string> | undefined;
  /** ID of the track currently loaded/playing. Always excluded. */
  currentTrackId?: string | null | undefined;
}

/**
 * Track ID for any candidate shape (defensive against non-object entries).
 * Returns null for entries without a usable ID — callers should drop those.
 */
export function trackIdOf(candidate: unknown): string | null {
  if (!candidate || typeof candidate !== "object") return null;
  const id = (candidate as { id?: unknown }).id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * Duration gate: a track is playable/recommendable only when its duration is
 * known and satisfies 0 < durationSeconds <= 600 (10 minutes).
 * 10:00 exactly is ALLOWED; 10:01 is REJECTED; unknown duration is REJECTED.
 */
export function hasPlayableDuration(track: { duration?: string | null } | null | undefined): boolean {
  if (!track) return false;
  const secs = parseDurationSeconds(track.duration ?? undefined);
  return secs > 0 && secs <= MAX_TRACK_DURATION_SECONDS;
}

/**
 * Remove duplicate track IDs, preserving first-seen order.
 * Entries without a usable ID are dropped entirely.
 */
export function uniqueByTrackId<T>(tracks: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const t of tracks) {
    const id = trackIdOf(t);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(t);
  }
  return out;
}

/**
 * Apply ALL hard freshness + duration filters to a candidate pool.
 * Run this BEFORE Thompson Sampling ranking. Order inside this function:
 *   1. duplicate removal
 *   2. previously-displayed exclusion
 *   3. liked exclusion
 *   4. recently-played exclusion
 *   5. current-track exclusion
 *   6. duration gate (0 < secs <= 600)
 */
export function filterFeedCandidates<T extends { duration?: string }>(
  tracks: readonly T[],
  exclusions: FeedExclusions,
): T[] {
  const displayed = exclusions.previouslyDisplayedIds;
  const liked = exclusions.likedIds;
  const played = exclusions.recentlyPlayedIds;
  const currentId = exclusions.currentTrackId ?? null;

  const seen = new Set<string>();
  const out: T[] = [];
  for (const t of tracks) {
    const id = trackIdOf(t);
    if (!id) continue;
    if (seen.has(id)) continue; // duplicates
    if (displayed?.has(id)) continue; // previously displayed this session
    if (liked?.has(id)) continue; // liked — remains in Library, not fresh picks
    if (played?.has(id)) continue; // recently played
    if (currentId && id === currentId) continue; // currently playing
    if (!hasPlayableDuration(t)) continue; // <=10 min, known duration
    seen.add(id);
    out.push(t);
  }
  return out;
}

/**
 * Record the given tracks as displayed for this session. Mutates the provided
 * session set in place. Session-scoped only: never persisted, never stored in
 * the library or cloud, and never used as a permanent dislike signal.
 */
export function recordDisplayedTracks(targetSet: Set<string>, tracks: readonly unknown[]): void {
  for (const t of tracks) {
    const id = trackIdOf(t);
    if (id) targetSet.add(id);
  }
}
