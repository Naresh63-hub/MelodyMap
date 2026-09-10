/**
 * Reusable track identity & deduplication helpers.
 *
 * Use these everywhere tracks are collected — queue, playlists, likes,
 * history, recommendations, search, downloads — so duplicate-detection
 * logic lives in exactly one place.
 *
 * This module is intentionally free of circular dependencies: it defines
 * a minimal compatible Track interface rather than importing from library.ts.
 */

/** Minimal track shape used for identity and comparison. */
export interface TrackLike {
  id: string;
  title: string;
  artist: string;
  duration?: string | number;
  thumbnail?: string;
  reason?: string;
  previewUrl?: string;
  source?: string;
  [key: string]: unknown;
}

// ─── Normalization ─────────────────────────────────────────────────

/** Lowercase, collapse whitespace, strip common noise words/punctuation. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[''`]/g, "'") // normalize smart quotes
    .replace(/[()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .replace(
      /\b(official|music|video|audio|lyric|lyrics|lyrical|hd|4k|8k|mv|vevo|topic|full song|full video|full audio)\b/gi,
      "",
    )
    .replace(/[^\p{L}\p{N}' ]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Duration tolerance: two tracks are "the same length" if within ±10 seconds. */
const DURATION_TOLERANCE = 10;

function durationSec(d: string | number | undefined): number {
  if (typeof d === "number") return d;
  if (!d) return 0;
  const parts = String(d)
    .split(":")
    .map(Number);
  if (parts.some(isNaN)) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

// ─── Identity ──────────────────────────────────────────────────────

/**
 * Stable identity string for a track.
 *
 * Uses provider + provider ID when available, otherwise falls back to
 * normalized title + artist.
 */
export function getTrackIdentity(track: TrackLike): string {
  if (track.source && track.id) {
    return `${track.source}:${track.id}`;
  }
  // Fallback: normalized composite key
  return `meta:${norm(track.title)}|${norm(track.artist)}`;
}

// ─── Comparison ────────────────────────────────────────────────────

/**
 * Check if two tracks represent the same logical song.
 *
 * Conservative matching — only returns true when:
 *  1. They share the same provider ID (exact match), OR
 *  2. Normalized title AND artist both match AND durations are within tolerance
 */
export function areSameTrack(a: TrackLike, b: TrackLike): boolean {
  // Fast path: same provider + ID
  if (a.source && b.source && a.source === b.source && a.id === b.id) {
    return true;
  }

  // Same bare ID (both YouTube, no explicit source)
  if (!a.source && !b.source && a.id === b.id) {
    return true;
  }

  // Cross-provider or title-based match: require title + artist + duration
  const normTitleA = norm(a.title);
  const normTitleB = norm(b.title);
  if (!normTitleA || !normTitleB) return false;

  const normArtistA = norm(a.artist);
  const normArtistB = norm(b.artist);
  if (!normArtistA || !normArtistB) return false;

  if (normTitleA !== normTitleB) return false;
  if (normArtistA !== normArtistB) return false;

  const durA = durationSec(a.duration);
  const durB = durationSec(b.duration);
  if (durA > 0 && durB > 0 && Math.abs(durA - durB) > DURATION_TOLERANCE) {
    return false;
  }

  return true;
}

// ─── Deduplication ─────────────────────────────────────────────────

/**
 * Remove duplicate tracks from an array, keeping the FIRST occurrence.
 * Order is preserved with O(N) complexity using identity & semantic lookups.
 */
export function dedupeTracks<T extends TrackLike>(tracks: T[]): T[] {
  const seenIdentities = new Set<string>();
  const seenMeta = new Map<string, number>();
  const out: T[] = [];

  for (const t of tracks) {
    const identityKey = getTrackIdentity(t);
    if (seenIdentities.has(identityKey)) continue;

    const normTitle = norm(t.title);
    const normArtist = norm(t.artist);

    if (normTitle && normArtist) {
      const metaKey = `${normTitle}::${normArtist}`;
      const existingDur = seenMeta.get(metaKey);
      if (existingDur !== undefined) {
        const curDur = durationSec(t.duration);
        // If both have durations and they are close, or if either lacks duration, consider dupe
        if (
          existingDur === 0 ||
          curDur === 0 ||
          Math.abs(existingDur - curDur) <= DURATION_TOLERANCE
        ) {
          continue;
        }
      }
      seenMeta.set(metaKey, durationSec(t.duration));
    }

    seenIdentities.add(identityKey);
    out.push(t);
  }
  return out;
}

/**
 * Check if a track already exists in a collection.
 */
export function trackExistsIn<T extends TrackLike>(collection: T[], track: T): boolean {
  return collection.some((t) => areSameTrack(t, track));
}

/**
 * Append a track to a collection only if it's not already present.
 * Returns the new array (or the original if not added).
 */
export function appendIfNew<T extends TrackLike>(collection: T[], track: T): T[] {
  if (trackExistsIn(collection, track)) return collection;
  return [...collection, track];
}
