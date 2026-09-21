/**
 * Hybrid music search — YouTube primary, Deezer fallback.
 *
 * YouTube gives full songs but many are restricted from streaming.
 * Deezer gives free 30-second previews that always work.
 *
 * Strategy:
 * 1. Search YouTube first (full songs)
 * 2. If YouTube returns results, use them
 * 3. If YouTube fails or returns nothing, search Deezer
 * 4. Deezer tracks get a special `_deezerPreview` field for the stream proxy
 */

import type { Track, SearchFilter } from "./music.server";

export type HybridTrack = Track & { _deezerPreview?: string };

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

  // If continuation was empty or pagination requested with offset / page > 1:
  if (page && page > 1) {
    try {
      const { searchYouTubePaginated } = await import("./music.server");
      const pageVariations = ["all songs", "popular hits", "music tracks", "best songs"];
      const variation = pageVariations[(page - 1) % pageVariations.length];
      const res = await searchYouTubePaginated(`${query} ${variation}`, filter, undefined, limit);
      if (res.tracks.length > 0) {
        return res;
      }
    } catch (err) {
      console.warn("[MelodyMap] Page search variation failed:", err);
    }

    try {
      const { searchDeezer } = await import("./deezer.server");
      const dzTracks = await searchDeezer(query, limit);
      if (dzTracks.length > 0) {
        return { tracks: dzTracks };
      }
    } catch {}
  }

  // Try YouTube first
  try {
    const { searchYouTubePaginated } = await import("./music.server");
    const ytRes = await searchYouTubePaginated(query, filter, undefined, limit);
    if (ytRes.tracks.length >= Math.min(limit, 5)) {
      return ytRes;
    }
  } catch (err) {
    console.warn("[MelodyMap] YouTube search failed, falling back to Deezer:", err);
  }

  // Fallback to Deezer (only when applicable)
  if (filter === "all" || filter === "songs" || filter === "albums") {
    try {
      const { searchDeezer } = await import("./deezer.server");
      const dzTracks = await searchDeezer(query, limit);
      if (dzTracks.length > 0) {
        return { tracks: dzTracks };
      }
    } catch (err) {
      console.warn("[MelodyMap] Deezer search also failed:", err);
    }
  }

  return { tracks: [] };
}

/**
 * Get radio/recommendation tracks — YouTube radio first, Deezer trending fallback.
 */
export async function getRadioHybrid(
  videoId: string,
  count = 15,
): Promise<HybridTrack[]> {
  // Try YouTube radio first
  try {
    const { getRadioTracks } = await import("./radio.server");
    const res = await getRadioTracks(videoId, count);
    if (res.tracks.length >= 3) {
      return res.tracks;
    }
  } catch (err) {
    console.warn("[MelodyMap] YouTube radio failed:", err);
  }

  // Fallback: search Deezer for similar content
  try {
    const { searchDeezer } = await import("./deezer.server");
    const dzTracks = await searchDeezer("popular songs", count);
    return dzTracks;
  } catch (err) {
    console.warn("[MelodyMap] Deezer radio fallback also failed:", err);
    return [];
  }
}

/**
 * Check if a track has a Deezer preview URL.
 */
export function isDeezerTrack(track: Track): track is HybridTrack {
  return !!(track as HybridTrack)._deezerPreview;
}

/**
 * Get the playable URL for a track.
 * - YouTube tracks: use the /api/stream/:videoId endpoint
 * - Deezer tracks: use the preview URL directly
 */
export function getTrackStreamUrl(track: Track): string {
  if (isDeezerTrack(track)) {
    return track._deezerPreview!;
  }
  return `/api/stream/${track.id}`;
}
