import type { TrackLike } from "./track-dedup";
import { normalizeArtistName } from "./artist-recent";

/**
 * Calculates the target number of taste-artist tracks in a batch of size `batchSize`,
 * based on the user's discovery slider setting (0 to 100).
 * share = 0.4 - 0.2 * (discovery / 100)
 * discovery 0   => share 0.40 => round(15 * 0.40) = 6
 * discovery 40  => share 0.32 => round(15 * 0.32) = 5
 * discovery 100 => share 0.20 => round(15 * 0.20) = 3
 */
export function computeTasteShare(discovery = 40, batchSize = 15): number {
  const clampedDiscovery = Math.max(0, Math.min(100, discovery));
  const share = 0.4 - 0.2 * (clampedDiscovery / 100);
  return Math.round(batchSize * share);
}

/**
 * Extracts top 5 unique taste artists from downloaded tracks, liked tracks,
 * and context-engine affinity artists.
 */
export function extractTasteArtists(
  downloaded: { artist?: string | undefined }[] = [],
  liked: { artist?: string | undefined }[] = [],
  affinityArtists: string[] = [],
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const add = (artist?: string) => {
    if (!artist) return;
    const clean = artist.trim();
    const norm = normalizeArtistName(clean);
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      result.push(clean);
    }
  };

  for (const d of downloaded) add(d.artist);
  for (const l of liked) add(l.artist);
  for (const a of affinityArtists) add(a);

  return result.slice(0, 5);
}

/**
 * Evenly interleaves taste tracks with similar-to-current tracks according
 * to the discovery-calibrated taste quota.
 */
export function interleaveTasteTracks<T>(
  similar: T[],
  taste: T[],
  discovery = 40,
  targetBatchSize = 15,
): T[] {
  if (!taste || taste.length === 0) return similar.slice(0, targetBatchSize);
  if (!similar || similar.length === 0) return taste.slice(0, targetBatchSize);

  const targetTaste = Math.min(taste.length, computeTasteShare(discovery, targetBatchSize));
  const targetSimilar = Math.min(similar.length, targetBatchSize - targetTaste);

  const sPool = similar.slice(0, targetSimilar);
  const tPool = taste.slice(0, targetTaste);

  const result: T[] = [];
  let sIdx = 0;
  let tIdx = 0;
  const total = sPool.length + tPool.length;

  for (let i = 0; i < total; i++) {
    // Proportional interleaving
    if (
      tIdx < tPool.length &&
      (sIdx >= sPool.length || (tIdx + 1) * sPool.length <= (sIdx + 1) * tPool.length)
    ) {
      result.push(tPool[tIdx++]!);
    } else if (sIdx < sPool.length) {
      result.push(sPool[sIdx++]!);
    }
  }

  return result;
}
