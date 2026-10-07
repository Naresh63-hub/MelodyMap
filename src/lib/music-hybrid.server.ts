/**
 * Hybrid music search — multi-provider primary, YouTube fallback.
 *
 * YouTube gives full songs but many are restricted from streaming.
 * Deezer contributes commercial metadata only — never 30-second samples.
 *
 * Strategy:
 * 1. Search YouTube first (full songs)
 * 2. If YouTube returns results, use them
 * 3. If YouTube fails or returns nothing, search Deezer
 * 4. Playback is resolved later by the stream proxy (full-length only)
 */

import type { Track, SearchFilter } from "./music.server";

export type HybridTrack = Track;

export type HybridSearchResult = {
  tracks: HybridTrack[];
  continuation?: string | undefined;
};

/**
 * Search with YouTube primary, Deezer fallback.
 * Always returns something playable and supports InnerTube pagination and category filters.
 */
export async function searchHybrid(
  query: string,
  limit = 20,
  continuation?: string,
  filter: SearchFilter = "all",
  offset?: number,
  page?: number,
): Promise<HybridSearchResult> {
  // If continuation token provided, paginate YouTube directly
  if (continuation) {
    try {
      const { searchYouTubePaginated } = await import("./music.server");
      const res = await searchYouTubePaginated(query, filter, continuation, limit);
      if (res.tracks.length > 0) {
        return res;
      }
    } catch (err) {
      console.warn("[MelodyMap] YouTube continuation search failed:", err);
    }
  }

  // Multi-Provider First Strategy:
  // Query Audius, Jamendo, Deezer, and Internet Archive concurrently,
  // falling back to YouTube only when needed.
  try {
    const { searchMultiProvider } = await import("./providers/multi-search");
    const multiRes = await searchMultiProvider(query, { limit });
    if (multiRes.tracks.length > 0) {
      return { tracks: multiRes.tracks as HybridTrack[] };
    }
  } catch (err) {
    console.warn("[MelodyMap] Multi-provider search notice:", err);
  }

  // Direct YouTube fallback
  try {
    const { searchYouTubePaginated } = await import("./music.server");
    const ytRes = await searchYouTubePaginated(query, filter, undefined, limit);
    if (ytRes.tracks.length > 0) {
      return ytRes;
    }
  } catch (err) {
    console.warn("[MelodyMap] Direct YouTube fallback failed:", err);
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
