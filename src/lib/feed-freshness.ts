/**
 * Session-level feed freshness for recommendation candidates.
 *
 * Guarantees for every Home refresh / feed build:
 *  - Previously displayed track IDs are excluded (session-scoped, NOT permanent).
 *  - Liked track IDs are excluded from fresh candidates (they stay in the Library).
 *  - Recently played track IDs are excluded where available.
 *  - The currently playing track is excluded.
 *  - ONE ENTRY PER ACTUAL SONG, not per upload ID: the same song re-uploaded by
 *    another user/channel (different track ID) is collapsed via fuzzy matching —
 *    areSameTrack() (title similarity + duration tolerance) PLUS an artist
 *    similarity gate. Artist/movie names alone NEVER merge two songs ("Love" by
 *    Artist A and "Love" by Artist B stay distinct).
 *  - Only tracks with a KNOWN duration in (0, 600] seconds pass the duration gate.
 *    Unknown / null / invalid durations are NEVER assumed short — they are excluded.
 *
 * Ordering contract: these hard filters run BEFORE Thompson Sampling ranking,
 * queue creation, AutoDJ extension, recommendation display, playSong(), and
 * next-track selection.
 */

import { areSameTrack, norm, stringSimilarity, type TrackLike } from "./track-dedup";
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
  /** Real track objects already displayed — enables fuzzy same-song matching across upload IDs. */
  previouslyDisplayed?: readonly TrackLike[] | undefined;
  /** Real liked track objects — a re-upload of a liked song is also excluded. */
  liked?: readonly TrackLike[] | undefined;
  /** Real recently-played track objects — fuzzy exclusion across upload IDs. */
  recentlyPlayed?: readonly TrackLike[] | undefined;
  /** The currently loaded track object — fuzzy exclusion across upload IDs. */
  current?: TrackLike | null | undefined;
}

/**
 * Same LOGICAL song check: areSameTrack() (title similarity + duration tolerance)
 * as the core signal, with artist similarity as ADDITIONAL evidence when both
 * artists are known. Artist name alone never merges two songs, and a missing
 * artist field falls back to title + duration only.
 */
function sameSong(a: TrackLike, b: TrackLike): boolean {
  if (!areSameTrack(a, b)) return false;
  const artistA = norm(a.artist || "");
  const artistB = norm(b.artist || "");
  if (!artistA || !artistB) return true; // metadata missing: title + duration decide
  // 0.9 gate: "Arijit Singh" vs "Arijit Singh - Topic" merges (norm strips "topic"),
  // but "Love" by Artist A vs "Love" by Artist B stays distinct.
  return stringSimilarity(artistA, artistB) >= 0.9;
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
export function hasPlayableDuration(
  track: { duration?: string | number | null | undefined } | null | undefined,
): boolean {
  if (!track) return false;
  const d = track.duration;
  if (typeof d === "number") {
    return Number.isFinite(d) && d > 0 && d <= MAX_TRACK_DURATION_SECONDS;
  }
  const secs = parseDurationSeconds(d ?? undefined);
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
export function filterFeedCandidates<T extends TrackLike>(
  tracks: readonly T[],
  exclusions: FeedExclusions,
): T[] {
  const displayedIds = exclusions.previouslyDisplayedIds;
  const likedIds = exclusions.likedIds;
  const playedIds = exclusions.recentlyPlayedIds;
  const currentId = exclusions.currentTrackId ?? null;

  const displayedTracks = exclusions.previouslyDisplayed ?? [];
  const likedTracks = exclusions.liked ?? [];
  const playedTracks = exclusions.recentlyPlayed ?? [];
  const currentTrack = exclusions.current ?? null;

  const out: T[] = [];
  for (const t of tracks) {
    const id = trackIdOf(t);
    if (!id) continue;
    // Fast exact-ID pass (O(1))
    if (displayedIds?.has(id)) continue; // previously displayed this session
    if (likedIds?.has(id)) continue; // liked — remains in Library, not fresh picks
    if (playedIds?.has(id)) continue; // recently played
    if (currentId && id === currentId) continue; // currently playing
    // Fuzzy same-song pass: a re-upload with a DIFFERENT ID is still the same song.
    if (displayedTracks.some((r) => sameSong(r, t))) continue;
    if (likedTracks.some((r) => sameSong(r, t))) continue;
    if (playedTracks.some((r) => sameSong(r, t))) continue;
    if (currentTrack && sameSong(currentTrack, t)) continue;
    // In-pool duplicate uploads: same song from multiple users keeps first occurrence.
    if (out.some((existing) => sameSong(existing, t))) continue;
    if (!hasPlayableDuration(t)) continue; // 0 < secs <= 600, known duration
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

export interface SessionFeedState {
  /** Live view of displayed IDs for this session. */
  readonly previouslyDisplayedIds: ReadonlySet<string>;
  /** Mark tracks as displayed for the remainder of this session. */
  record(tracks: readonly unknown[]): void;
  /** Build exclusions for a feed build, merging the given recently-played IDs. */
  snapshot(
    recentlyPlayed?: readonly unknown[],
    likedIds?: ReadonlySet<string>,
    currentTrackId?: string | null,
  ): FeedExclusions;
}

/** Create a session-scoped feed freshness state (lives only for this page session). */
export function createSessionFeedState(): SessionFeedState {
  const displayed = new Set<string>();
  const recent = new Set<string>();
  return {
    previouslyDisplayedIds: displayed,
    record(tracks) {
      recordDisplayedTracks(displayed, tracks);
    },
    snapshot(recentlyPlayed, likedIds, currentTrackId) {
      if (recentlyPlayed) recordDisplayedTracks(recent, recentlyPlayed);
      return {
        previouslyDisplayedIds: displayed,
        recentlyPlayedIds: recent,
        likedIds,
        currentTrackId: currentTrackId ?? null,
      };
    },
  };
}
