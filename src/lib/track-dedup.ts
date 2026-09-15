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

// ─── Normalization & Fuzzy Distance ─────────────────────────────────

/** Lowercase, collapse whitespace, strip noise words/punctuation. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[''`]/g, "'") // normalize smart quotes
    .replace(/[()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .replace(
      /\b(official|music|video|audio|lyric|lyrics|lyrical|hd|4k|8k|mv|vevo|topic|full song|full video|full audio|remastered|remaster|live version|live|acoustic version|acoustic)\b/gi,
      "",
    )
    .replace(/[^\p{L}\p{N}' ]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokenize and return sorted unique word set for order-independent comparison */
export function tokenizeSorted(s: string): string[] {
  return Array.from(new Set(norm(s).split(/\s+/).filter(Boolean))).sort();
}

/** Levenshtein distance calculation between two normalized strings */
export function levenshteinDistance(s1: string, s2: string): number {
  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;

  const v0 = new Int32Array(s2.length + 1);
  const v1 = new Int32Array(s2.length + 1);

  for (let i = 0; i <= s2.length; i++) v0[i] = i;

  for (let i = 0; i < s1.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < s2.length; j++) {
      const cost = s1[i] === s2[j] ? 0 : 1;
      const val1 = (v1[j] ?? 0) + 1;
      const val2 = (v0[j + 1] ?? 0) + 1;
      const val3 = (v0[j] ?? 0) + cost;
      v1[j + 1] = Math.min(val1, val2, val3);
    }
    for (let j = 0; j <= s2.length; j++) v0[j] = v1[j] ?? 0;
  }
  return v0[s2.length] ?? s2.length;
}

/** Fuzzy string similarity score between 0.0 (completely different) and 1.0 (identical) */
export function stringSimilarity(s1: string, s2: string): number {
  const n1 = norm(s1);
  const n2 = norm(s2);
  if (!n1 && !n2) return 1.0;
  if (!n1 || !n2) return 0.0;
  if (n1 === n2) return 1.0;

  // Token-sorted comparison (handles "Artist - Song" vs "Song - Artist")
  const tokens1 = tokenizeSorted(n1).join(" ");
  const tokens2 = tokenizeSorted(n2).join(" ");
  if (tokens1 === tokens2) return 0.98;

  const maxLen = Math.max(tokens1.length, tokens2.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(tokens1, tokens2);
  return Math.max(0, 1.0 - dist / maxLen);
}

/** Duration tolerance: two tracks are "the same length" if within ±8 seconds. */
const DURATION_TOLERANCE = 8;

function durationSec(d: string | number | undefined): number {
  if (typeof d === "number") return d;
  if (!d) return 0;
  const parts = String(d)
    .split(":")
    .map(Number);
  if (parts.some(isNaN)) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

// ─── Identity & Multi-Factor Similarity ──────────────────────────

/**
 * Stable identity string for a track.
 */
export function getTrackIdentity(track: TrackLike): string {
  if (track.source && track.id) {
    return `${track.source}:${track.id}`;
  }
  return `meta:${norm(track.title)}|${norm(track.artist)}`;
}

/**
 * Multi-factor similarity score between two tracks (0.0 to 1.0).
 * Weighted across Title (40%), Artist (40%), and Duration (20%).
 */
export function calculateTrackSimilarity(a: TrackLike, b: TrackLike): number {
  if (a.id === b.id) return 1.0;

  const titleScore = stringSimilarity(a.title, b.title);
  const artistScore = stringSimilarity(a.artist, b.artist);

  const durA = durationSec(a.duration);
  const durB = durationSec(b.duration);
  let durationScore = 0.85; // neutral when duration is unknown

  if (durA > 0 && durB > 0) {
    const diff = Math.abs(durA - durB);
    if (diff <= 3) durationScore = 1.0;
    else if (diff <= DURATION_TOLERANCE) durationScore = 0.8;
    else if (diff > 45) return 0.2; // Likely radio vs extended or completely different
    else durationScore = Math.max(0.1, 1.0 - diff / 30);
  }

  return titleScore * 0.45 + artistScore * 0.4 + durationScore * 0.15;
}

/**
 * Check if two tracks represent the same logical song using multi-factor matching.
 */
export function areSameTrack(a: TrackLike, b: TrackLike): boolean {
  if (a.id && b.id && a.id === b.id) return true;
  return calculateTrackSimilarity(a, b) >= 0.88;
}

// ─── Deduplication ─────────────────────────────────────────────────

/**
 * Remove duplicate tracks from an array using multi-factor fuzzy clustering.
 * Preserves first occurrence and retains highest-fidelity metadata.
 */
export function dedupeTracks<T extends TrackLike>(tracks: T[]): T[] {
  const out: T[] = [];

  for (const candidate of tracks) {
    const isDuplicate = out.some((existing) => areSameTrack(existing, candidate));
    if (!isDuplicate) {
      out.push(candidate);
    }
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
 */
export function appendIfNew<T extends TrackLike>(collection: T[], track: T): T[] {
  if (trackExistsIn(collection, track)) return collection;
  return [...collection, track];
}
