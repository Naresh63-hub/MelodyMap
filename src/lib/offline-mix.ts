import type { Track } from "./library";
import { listDownloads, type DownloadInfo } from "./offline";
import { dedupeTracks } from "./track-dedup";
import { thompsonSamplingPolicy, type SessionContext } from "./bandit-policy";
import { tagTrackSource } from "./rec-source";

export interface BuildOfflineMixOptions {
  listDownloadsFn?: () => Promise<DownloadInfo[]>;
  history?: Track[] | undefined;
  ctx?: SessionContext | undefined;
  rankCandidatesFn?: ((candidates: Track[], ctx: SessionContext) => Track[]) | undefined;
}

/**
 * Builds an Offline Mix from downloaded tracks (blob > 10 KB in IndexedDB)
 * plus cached history, ranked by the bandit with the session context,
 * deduplicated, capped at 30. Strictly makes zero network calls.
 * Tags all tracks with "offline-mix".
 */
export async function buildOfflineMix(options: BuildOfflineMixOptions = {}): Promise<Track[]> {
  const getDownloads = options.listDownloadsFn || listDownloads;
  let downloadedItems: DownloadInfo[] = [];

  try {
    downloadedItems = await getDownloads();
  } catch {
    downloadedItems = [];
  }

  // Filter downloaded tracks with verified blob > 10 KB (10,240 bytes)
  const validDownloads: Track[] = downloadedItems
    .filter((d) => d && d.size > 10 * 1024 && d.track)
    .map((d) => d.track);

  const historyTracks: Track[] = options.history || [];

  // Combine downloaded tracks + cached history
  const combined = [...validDownloads, ...historyTracks];
  if (combined.length === 0) {
    return [];
  }

  // Deduplicate
  const deduped = dedupeTracks(combined);

  // Rank with bandit using session context
  const ranker =
    options.rankCandidatesFn ||
    ((cands: Track[], ctx: SessionContext) =>
      thompsonSamplingPolicy.rankCandidates(cands, ctx) as Track[]);

  const sessionCtx: SessionContext = options.ctx || {
    hourOfDay: new Date().getHours(),
  };

  const ranked = ranker(deduped, sessionCtx);

  // Cap at 30 tracks
  const capped = ranked.slice(0, 30);

  // Tag with offline-mix
  tagTrackSource(capped, "offline-mix");

  return capped;
}
