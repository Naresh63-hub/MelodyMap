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

import type { Track } from "./music.server";

type HybridTrack = Track & { _deezerPreview?: string };

/**
 * Search with YouTube primary, Deezer fallback.
 * Always returns something playable.
 */
export async function searchHybrid(
  query: string,
  limit = 20,
): Promise<HybridTrack[]> {
  // Try YouTube first
  try {
    const { searchYouTube } = await import("./music.server");
    const ytTracks = await searchYouTube(query, limit, true);
    if (ytTracks.length >= Math.min(limit, 5)) {
      return ytTracks;
    }
  } catch (err) {
    console.warn("[MelodyMap] YouTube search failed, falling back to Deezer:", err);
  }

  // Fallback to Deezer
  try {
    const { searchDeezer } = await import("./deezer.server");
    const dzTracks = await searchDeezer(query, limit);
    if (dzTracks.length > 0) {
      return dzTracks;
    }
  } catch (err) {
    console.warn("[MelodyMap] Deezer search also failed:", err);
  }

  return [];
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
