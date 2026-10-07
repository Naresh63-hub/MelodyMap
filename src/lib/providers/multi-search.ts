/**
 * Multi-Provider Unified Search & Discovery Engine
 *
 * Orchestrates concurrent searches across:
 * - Audius (Decentralized Catalog, full streams)
 * - Jamendo (Creative Commons Licensed, full streams)
 * - Deezer (ISRC, commercial metadata — no sample playback)
 * - Internet Archive (Live & historical music recordings)
 * - YouTube (Graceful secondary fallback)
 *
 * Enforces:
 * - Strict music duration cap: 0 < durationSeconds <= 600
 * - Language-aware filtering
 * - Cross-provider duplicate elimination
 * - Prioritization of full-length authorized audio sources
 */

import type { UnifiedTrack, ProviderSearchOptions } from "./types";
import { searchSaavn } from "./saavn";
import { searchAudius } from "./audius";
import { searchJamendo } from "./jamendo";
import { searchDeezerTracks } from "./deezer";
import { searchInternetArchive } from "./archive";
import { searchYouTubeFallback } from "./youtube";
import { deduplicateMultiProviderTracks } from "./dedup";

export interface MultiProviderSearchResponse {
  tracks: UnifiedTrack[];
  sourcesConsulted: string[];
  totalRawCandidates: number;
}

/**
 * Searches multiple music providers concurrently and returns unified, deduplicated tracks.
 */
export async function searchMultiProvider(
  query: string,
  options: ProviderSearchOptions = {},
): Promise<MultiProviderSearchResponse> {
  const clean = query.trim();
  if (!clean) {
    return { tracks: [], sourcesConsulted: [], totalRawCandidates: 0 };
  }

  const limit = options.limit ?? 20;
  const sourcesConsulted: string[] = [];

  // Stage 1: Search authorized open and independent streaming catalogs concurrently
  // (JioSaavn 320kbps full streams, Audius, Jamendo, Deezer, Internet Archive)
  const primaryPromises: Promise<UnifiedTrack[]>[] = [
    searchSaavn(clean, { ...options, limit: Math.min(limit, 20) })
      .then((res) => {
        sourcesConsulted.push("saavn");
        return res;
      })
      .catch(() => []),

    searchAudius(clean, { ...options, limit: Math.min(limit, 15) })
      .then((res) => {
        sourcesConsulted.push("audius");
        return res;
      })
      .catch(() => []),

    searchJamendo(clean, { ...options, limit: Math.min(limit, 15) })
      .then((res) => {
        sourcesConsulted.push("jamendo");
        return res;
      })
      .catch(() => []),

    searchDeezerTracks(clean, { ...options, limit: Math.min(limit, 15) })
      .then((res) => {
        sourcesConsulted.push("deezer");
        return res;
      })
      .catch(() => []),

    searchInternetArchive(clean, { ...options, limit: 5 })
      .then((res) => {
        sourcesConsulted.push("archive");
        return res;
      })
      .catch(() => []),
  ];

  const primaryResults = await Promise.all(primaryPromises);
  let allRawTracks: UnifiedTrack[] = primaryResults.flat();

  // Stage 2: If primary open providers yielded fewer than 5 tracks,
  // query YouTube fallback adapter to ensure rich coverage
  if (allRawTracks.length < 5) {
    try {
      const ytTracks = await searchYouTubeFallback(clean, { limit });
      sourcesConsulted.push("youtube");
      allRawTracks = [...allRawTracks, ...ytTracks];
    } catch {
      // YouTube fallback failed gracefully, continue with whatever was gathered
    }
  }

  // Stage 3: Enforce strict duration filter (0 < durationSeconds <= 600)
  const durationFiltered = allRawTracks.filter(
    (t) => t.durationSeconds > 0 && t.durationSeconds <= 600,
  );

  // Stage 4: Cross-provider duplicate elimination
  // Collapses redundant recordings across providers into ONE unified track,
  // retaining other sources in availableAlternatives
  const deduplicated = deduplicateMultiProviderTracks(durationFiltered);

  // Return limited result set
  return {
    tracks: deduplicated.slice(0, limit),
    sourcesConsulted,
    totalRawCandidates: allRawTracks.length,
  };
}
