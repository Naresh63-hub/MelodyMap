/**
 * Cross-Provider Deduplication & Canonical Recording Resolver
 *
 * Detects identical logical recordings across multiple streaming providers
 * (Audius, Jamendo, Deezer, Internet Archive, YouTube) using:
 * 1. ISRC matching
 * 2. MusicBrainz Recording ID (MBID)
 * 3. Title + Artist fuzzy distance + Duration similarity (within tolerance)
 *
 * Merges duplicates into a single canonical UnifiedTrack while preserving
 * all alternative provider sources in `availableAlternatives` for seamless fallback.
 */

import type { UnifiedTrack, PlaybackSource } from "./types";
import { stringSimilarity, norm } from "../track-dedup";

/**
 * Check if two tracks from potentially different providers represent the exact same recording.
 */
export function areSameMultiProviderTrack(a: UnifiedTrack, b: UnifiedTrack): boolean {
  if (a.id === b.id) return true;

  // 1. Direct ISRC Match: definitive proof of identical sound recording
  if (a.isrc && b.isrc && a.isrc.trim().toUpperCase() === b.isrc.trim().toUpperCase()) {
    return true;
  }

  // 2. Direct MusicBrainz Recording ID (MBID) match
  if (a.recordingId && b.recordingId && a.recordingId === b.recordingId) {
    return true;
  }

  // 3. Multi-factor Title + Artist + Duration matching
  const titleSim = stringSimilarity(a.title, b.title);
  const artistSim = stringSimilarity(a.artist, b.artist);

  // If different artists with distinct titles, never merge
  if (artistSim < 0.65) {
    // Check if one is a guest / featured appearance on the other
    const normAArtist = norm(a.artist);
    const normBArtist = norm(b.artist);
    const hasArtistOverlap =
      (normAArtist && normBArtist.includes(normAArtist)) ||
      (normBArtist && normAArtist.includes(normBArtist));

    if (!hasArtistOverlap) return false;
  }

  // Duration tolerance (within ±10 seconds for standard radio edits)
  const durA = a.durationSeconds;
  const durB = b.durationSeconds;
  const durDiff = Math.abs(durA - durB);

  // High title similarity and artist match
  if (titleSim >= 0.88 && artistSim >= 0.8) {
    if (durA > 0 && durB > 0) {
      return durDiff <= 12; // Duration matches within 12 seconds
    }
    return true;
  }

  // Very high title similarity with identical duration (e.g., re-upload or label mirror)
  if (titleSim >= 0.94 && durA > 0 && durB > 0 && durDiff <= 4) {
    return true;
  }

  return false;
}

/**
 * Priority scoring for choosing the primary playback source:
 * 1. Authorized Full Playback (Audius / Jamendo / Archive full stream) -> Highest
 * 2. YouTube streaming proxy -> Middle
 * Sample/preview sources are given 0 priority and never chosen for playback.
 */
function getSourcePriority(track: UnifiedTrack): number {
  if (!track.playable) return 0;
  if (track.playbackSource?.type === "full") {
    if (track.provider === "saavn") return 110;
    if (track.provider === "audius" || track.provider === "jamendo") return 100;
    return 90;
  }
  if (track.playbackSource?.type === "stream_proxy") return 70;
  return 0;
}

/**
 * Merge an array of tracks from multiple providers:
 * - Collapses copies of the same song from different providers into ONE entry.
 * - Selects the highest-quality authorized full playback source as primary.
 * - Attaches the other provider sources to `availableAlternatives`.
 */
export function deduplicateMultiProviderTracks(tracks: UnifiedTrack[]): UnifiedTrack[] {
  const clusters: UnifiedTrack[][] = [];

  for (const track of tracks) {
    const matchedCluster = clusters.find((cluster) =>
      cluster.some((existing) => areSameMultiProviderTrack(existing, track)),
    );

    if (matchedCluster) {
      matchedCluster.push(track);
    } else {
      clusters.push([track]);
    }
  }

  return clusters.map((cluster): UnifiedTrack => {
    if (cluster.length === 1) {
      return cluster[0]!;
    }

    // Sort cluster by playback priority
    cluster.sort((a, b) => getSourcePriority(b) - getSourcePriority(a));

    const primary = cluster[0]!;
    const alternatives: PlaybackSource[] = [];

    for (let i = 1; i < cluster.length; i++) {
      const alt = cluster[i]!;
      // Only keep full-length alternative playback sources
      if (alt.playbackSource && alt.playbackSource.type !== "preview") {
        // Only add if distinct URL / provider
        const alreadyExists =
          alternatives.some((s) => s.url === alt.playbackSource!.url) ||
          (primary.playbackSource && primary.playbackSource.url === alt.playbackSource.url);

        if (!alreadyExists) {
          alternatives.push(alt.playbackSource);
        }
      }
    }

    // Merge metadata richness: retain ISRC, recordingId, higher-res artwork if available
    const isrc = cluster.find((t) => t.isrc)?.isrc || primary.isrc;
    const recordingId = cluster.find((t) => t.recordingId)?.recordingId || primary.recordingId;
    const album = cluster.find((t) => t.album && t.album.length > 2)?.album || primary.album;

    const merged: UnifiedTrack = {
      ...primary,
      isrc,
      recordingId,
      album,
      availableAlternatives: alternatives,
    };
    return merged;
  });
}
