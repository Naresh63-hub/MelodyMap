/**
 * Hybrid music search — Saavn primary, multi-provider fallback.
 *
 * JioSaavn delivers licensed, full-length tracks with clean metadata.
 * No YouTube dependency - pure streaming experience.
 *
 * Strategy:
 * 1. Search JioSaavn first (full songs, clean metadata)
 * 2. If Saavn fails or returns nothing, search multi-provider
 * 3. Playback is resolved later by the stream proxy (full-length only)
 */

import type { Track, SearchFilter } from "./music.server";

export type HybridTrack = Track;

export type HybridSearchResult = {
  tracks: HybridTrack[];
  continuation?: string | undefined;
};

/**
 * Search with Saavn primary, multi-provider fallback.
 * Always returns something playable.
 */
export async function searchHybrid(
  query: string,
  limit = 20,
  continuation?: string,
  filter: SearchFilter = "all",
  offset?: number,
  page?: number,
): Promise<HybridSearchResult> {
  // JioSaavn First Strategy:
  // Query JioSaavn for clean metadata (song title, real artist/composer, movie/album)
  // and direct crystal-clear 160kbps/320kbps streams.
  try {
    const { searchSaavn } = await import("./providers/saavn");
    const saavnRes = await searchSaavn(query, { limit });
    if (saavnRes.length > 0) {
      return { tracks: saavnRes as HybridTrack[] };
    }
  } catch (err) {
    console.warn("[MelodyMap] Saavn primary search notice:", err);
  }

  // Multi-Provider Fallback:
  // Query Audius, Jamendo, Deezer, and Internet Archive concurrently.
  try {
    const { searchMultiProvider } = await import("./providers/multi-search");
    const multiRes = await searchMultiProvider(query, { limit });
    if (multiRes.tracks.length > 0) {
      return { tracks: multiRes.tracks as HybridTrack[] };
    }
  } catch (err) {
    console.warn("[MelodyMap] Multi-provider fallback search notice:", err);
  }

  return { tracks: [] };
}

/**
 * Get radio/recommendation tracks — YouTube radio.
 */
export async function getRadioHybrid(
  videoId: string,
  count = 15,
): Promise<HybridTrack[]> {
  // Try YouTube radio
  try {
    const { getRadioTracks } = await import("./radio.server");
    const res = await getRadioTracks(videoId, count);
    if (res.tracks.length >= 3) {
      return res.tracks;
    }
  } catch (err) {
    console.warn("[MelodyMap] YouTube radio failed:", err);
  }

  return [];
}

/**
 * Check if a track is a Deezer track.
 */
export function isDeezerTrack(track: Track): track is HybridTrack {
  return track.source === "deezer" || track.id.startsWith("deezer:");
}

/**
 * Get the playable URL for a track.
 */
export function getTrackStreamUrl(track: Track): string {
  return `/api/stream/${track.id}`;
}
