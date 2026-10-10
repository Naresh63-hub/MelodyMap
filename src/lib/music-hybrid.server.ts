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
import { isOriginalSong } from "./track-filters";

export type HybridTrack = Track;

export type HybridSearchResult = {
  tracks: HybridTrack[];
  continuation?: string | undefined;
};

/**
 * Search with Saavn primary, multi-provider fallback.
 * Strictly guarantees only original songs (no remixes, covers, or mixes).
 */
export async function searchHybrid(
  query: string,
  limit = 20,
  continuation?: string,
  filter: SearchFilter = "all",
  offset?: number,
  page?: number,
): Promise<HybridSearchResult> {
  const cleanQ = query.trim();
  if (!cleanQ) return { tracks: [] };

  // JioSaavn Pure Original Music Strategy:
  try {
    const { searchSaavn } = await import("./providers/saavn");
    let saavnRes = await searchSaavn(cleanQ, { limit });
    let originalTracks = saavnRes.filter(isOriginalSong);
    if (originalTracks.length > 0) {
      return { tracks: originalTracks as HybridTrack[] };
    }

    // Smart query simplification retry: e.g. "Song (From Movie)" -> "Song Movie"
    const simplified = cleanQ
      .replace(/[([][^()\[\]]*[)\]]/g, " ")
      .replace(/["']/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (simplified && simplified.toLowerCase() !== cleanQ.toLowerCase()) {
      saavnRes = await searchSaavn(simplified, { limit });
      originalTracks = saavnRes.filter(isOriginalSong);
      if (originalTracks.length > 0) {
        return { tracks: originalTracks as HybridTrack[] };
      }
    }
  } catch (err) {
    console.warn("[MelodyMap] Saavn primary search notice:", err);
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
