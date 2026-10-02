/**
 * YouTube Fallback Provider Adapter
 * Used strictly as an optional fallback provider when decentralized and open catalogs
 * cannot locate the requested song or user requests YouTube catalog.
 */

import type { UnifiedTrack, ProviderSearchOptions } from "./types";
import { parseDurationSeconds } from "../track-filters";

export async function searchYouTubeFallback(
  query: string,
  options: ProviderSearchOptions = {},
): Promise<UnifiedTrack[]> {
  try {
    const { searchYouTubePaginated } = await import("../music.server");
    const res = await searchYouTubePaginated(query, "songs", undefined, options.limit ?? 15);

    return (res.tracks ?? []).map((t) => {
      const durSec = parseDurationSeconds(t.duration);
      return {
        id: t.id,
        canonicalTrackId: `youtube:${t.id}`,
        title: t.title,
        artist: t.artist,
        duration: t.duration,
        durationSeconds: durSec,
        thumbnail: t.thumbnail,
        artwork: t.thumbnail,
        provider: "youtube",
        providerTrackId: t.id,
        playable: true,
        playbackSource: {
          provider: "youtube",
          providerTrackId: t.id,
          url: `/api/stream/${encodeURIComponent(t.id)}`,
          type: "stream_proxy",
        },
        availableAlternatives: [],
        source: "youtube",
      };
    });
  } catch {
    return [];
  }
}
