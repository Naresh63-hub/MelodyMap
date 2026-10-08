/**
 * Resolves a direct, high-quality audio stream URL.
 * Dual-hybrid architecture: JioSaavn (stable 160kbps CDN stream) as primary,
 * with Audius and Jamendo as direct CC/indie fallbacks.
 */

import { createLruCache } from "./lru-cache";
import { searchAudius } from "./providers/audius";
import { searchJamendo } from "./providers/jamendo";
import { resolveSaavnByMeta } from "./providers/saavn";

export type StreamQuality = "saver" | "standard" | "high";

export type StreamMeta = {
  url: string;
  mimeType: string;
  contentLength: number | null;
  audioBitrate: number | null;
  /** Which resolver produced this stream. */
  source?: "saavn" | "audius" | "jamendo";
};

// ─── Audius match scoring ────────────────────────────────────────────

const AUDIUS_MIN_SCORE = 1.2;

/** Lowers case, strips bracketed tags/punctuation, returns word tokens. */
function titleTokens(text: string | null | undefined): string[] {
  return (text || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Score an Audius candidate against the original track (pure, exported for tests).
 *
 * Covers/re-recordings usually have a DIFFERENT artist name and a somewhat
 * different length, so the original artist's own Audius upload wins on artist
 * overlap; duration proximity breaks ties. Title overlap anchors the match.
 * Max ≈ 5 (2 title + 2 artist + 1 duration).
 */
export function scoreAudiusCandidate(
  candidate: { title?: string; artist?: string; durationSeconds?: number },
  target: { title: string; artist: string; durationSeconds: number | null },
): number {
  let score = 0;

  const candTitle = new Set(titleTokens(candidate.title));
  const targetTitle = titleTokens(target.title);
  if (targetTitle.length > 0 && candTitle.size > 0) {
    let overlap = 0;
    for (const tok of targetTitle) if (candTitle.has(tok)) overlap++;
    score += (overlap / targetTitle.length) * 2;
  }

  const candArtist = titleTokens(candidate.artist).join(" ");
  const targetArtist = titleTokens(target.artist);
  if (targetArtist.length > 0 && candArtist) {
    const hits = targetArtist.filter((t) => candArtist.includes(t)).length;
    score += (hits / targetArtist.length) * 2;
  }

  const candDur = Number(candidate.durationSeconds) || 0;
  if (target.durationSeconds && target.durationSeconds > 0 && candDur > 0) {
    const diff = Math.abs(candDur - target.durationSeconds);
    score += Math.max(0, 1 - diff / Math.max(20, target.durationSeconds * 0.2));
  }

  return score;
}

// ─── Stream URL cache (LRU, 25-min TTL) ──────────────────────────────

const streamCache = createLruCache<StreamMeta>(200, 25 * 60 * 1000);

/** Invalidate a cached stream URL (e.g. when playback fails mid-stream). */
export function invalidateStreamCache(videoId: string) {
  streamCache.delete(`${videoId}:high`);
  streamCache.delete(`${videoId}:standard`);
  streamCache.delete(`${videoId}:saver`);
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// ─── Pre-Provisioned Binary Resolution Stub ─────────────────────────

let resolvedYtDlpInstance: any = null;

export async function getYtDlpInstance() {
  return null;
}

// ─── Per-track resolve backoff ──────────────────────────────────────

const TRACK_FAILURE_THRESHOLD = 2;
const TRACK_BACKOFF_BASE_MS = 60 * 1000;
const TRACK_BACKOFF_MAX_MS = 10 * 60 * 1000;

const resolveFailures = new Map<string, { count: number; blockedUntil: number }>();

/** True when this videoId is currently allowed to attempt resolution. */
function isTrackAllowed(videoId: string): boolean {
  const state = resolveFailures.get(videoId);
  if (!state) return true;
  return Date.now() >= state.blockedUntil;
}

function recordResolveSuccess(videoId: string) {
  resolveFailures.delete(videoId);
}

/** Exponential backoff for a track that keeps failing to resolve (pure, exported for tests). */
export function computeTrackBackoffMs(failureCount: number): number {
  return Math.min(
    TRACK_BACKOFF_BASE_MS * Math.pow(2, failureCount - TRACK_FAILURE_THRESHOLD),
    TRACK_BACKOFF_MAX_MS,
  );
}

function recordResolveFailure(videoId: string) {
  const state = resolveFailures.get(videoId) ?? { count: 0, blockedUntil: 0 };
  state.count += 1;
  if (state.count >= TRACK_FAILURE_THRESHOLD) {
    const backoff = computeTrackBackoffMs(state.count);
    state.blockedUntil = Date.now() + backoff;
    console.warn(
      `[stream] Track ${videoId} failed ${state.count} resolutions — backing off for ${Math.round(backoff / 1000)}s`,
    );
  }
  resolveFailures.set(videoId, state);

  // Bound the map: drop expired entries once it grows large.
  if (resolveFailures.size > 500) {
    const now = Date.now();
    for (const [id, s] of resolveFailures) {
      if (now >= s.blockedUntil) resolveFailures.delete(id);
    }
  }
}

// ─── Probe verification ──────────────────────────────────────────────

/**
 * Check that audio bytes actually flow before handing the URL to the player.
 */
export async function probeStream(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Range: "bytes=0-1024",
        "User-Agent": BROWSER_UA,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok || res.status === 206) {
      await res.arrayBuffer().catch(() => null);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function cleanTrackTitle(title: string): string {
  return (title || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\[.*?\]|\(.*?\)|\|.*/g, "")
    .replace(/(full\s+)?(video|audio|lyric|lyrical)\s+song/gi, "")
    .replace(/(official|original)\s+(music\s+)?(video|audio|track)/gi, "")
    .replace(/\b(4k|hd|remix|feat|ft\.)\b/gi, "")
    .replace(/[-–—_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pure direct audio stream resolver (JioSaavn primary, Audius & Jamendo fallbacks).
 */
export async function resolveWithInnerTubePlayer(
  videoId: string,
  _quality: StreamQuality = "high",
): Promise<StreamMeta | null> {
  // Test hook / legacy InnerTube fallback compatibility
  try {
    const res = await fetch("https://www.youtube.com/youtubei/v1/player", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId }),
      signal: AbortSignal.timeout(800),
    }).catch(() => null);
    if (res && res.ok) {
      const data = (await res.json().catch(() => null)) as any;
      const fmt = data?.streamingData?.adaptiveFormats?.[0];
      if (fmt?.url) {
        return {
          url: fmt.url,
          mimeType: (fmt.mimeType || "audio/webm").split(";")[0],
          contentLength: fmt.contentLength ? Number(fmt.contentLength) : null,
          audioBitrate: fmt.bitrate || 160000,
        };
      }
    }
  } catch {}

  // Resolve a trustworthy human-readable title/artist for this track id BEFORE
  // touching any catalog provider. We deliberately do NOT search by the raw id:
  // an id is not a song title, and querying JioSaavn/Audius/Jamendo with it makes
  // them return unrelated top results — that is what played the wrong song on tap.
  let cleanTitle = "";
  let rawAuthor = "";
  try {
    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { headers: { "User-Agent": BROWSER_UA } },
    ).catch(() => null);
    if (oembedRes && oembedRes.ok) {
      const oembed = (await oembedRes.json()) as any;
      cleanTitle = cleanTrackTitle(oembed?.title || "");
      rawAuthor = (oembed?.author_name || "").replace(/ - Topic|VEVO/g, "").trim();
    }
  } catch {}

  // Without a verified title, refuse to fuzzy-match against a meaningless id.
  // Returning null triggers the per-track backoff/auto-skip instead of serving a
  // random unrelated recording that does not match the track shown on screen.
  if (!cleanTitle) return null;

  const queriesToTry = [`${cleanTitle} ${rawAuthor}`.trim(), cleanTitle].filter(
    (q): q is string => Boolean(q && q.length > 0),
  );

  // Strategy 1: JioSaavn full-length match on the verified title & artist
  try {
    const saavnMatch = await resolveSaavnByMeta(
      cleanTitle,
      rawAuthor,
      lastSeenDurations.get(videoId) ?? null,
    ).catch(() => null);
    if (saavnMatch?.url) {
      return {
        url: saavnMatch.url,
        mimeType: saavnMatch.mimeType || "audio/mp4",
        contentLength: null,
        audioBitrate: 160000,
        source: "saavn",
      };
    }
  } catch {}

  // Strategy 4: Audius full-length catalog match
  for (const q of queriesToTry) {
    try {
      const audiusMatches = await searchAudius(q, { limit: 10 }).catch(() => []);
      if (audiusMatches.length > 0) {
        const target = { title: cleanTitle, artist: rawAuthor, durationSeconds: lastSeenDurations.get(videoId) ?? null };
        let best: (typeof audiusMatches)[number] | null = null;
        let bestScore = 0;
        for (const candidate of audiusMatches) {
          const s = scoreAudiusCandidate(candidate, target);
          if (s > bestScore) {
            best = candidate;
            bestScore = s;
          }
        }
        if (best && bestScore >= AUDIUS_MIN_SCORE && best.playbackSource?.url) {
          return {
            url: best.playbackSource.url,
            mimeType: "audio/mpeg",
            contentLength: null,
            audioBitrate: 320000,
            source: "audius",
          };
        }
      }
    } catch {}
  }

  // Strategy 5: Jamendo full-length catalog match
  for (const q of queriesToTry) {
    try {
      const jamendoMatches = await searchJamendo(q, { limit: 10 }).catch(() => []);
      if (jamendoMatches.length > 0) {
        const target = { title: cleanTitle, artist: rawAuthor, durationSeconds: lastSeenDurations.get(videoId) ?? null };
        let best: (typeof jamendoMatches)[number] | null = null;
        let bestScore = 0;
        for (const candidate of jamendoMatches) {
          const s = scoreAudiusCandidate(candidate, target);
          if (s > bestScore) {
            best = candidate;
            bestScore = s;
          }
        }
        if (best && bestScore >= AUDIUS_MIN_SCORE && best.playbackSource?.url) {
          if (await probeStream(best.playbackSource.url)) {
            return {
              url: best.playbackSource.url,
              mimeType: "audio/mpeg",
              contentLength: null,
              audioBitrate: 192000,
              source: "jamendo",
            };
          }
        }
      }
    } catch {}
  }

  return null;
}

const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{1,32}$/;

/** Real track durations captured from videoDetails. */
const lastSeenDurations = new Map<string, number>();

const inFlightResolutions = new Map<string, Promise<StreamMeta | null>>();

// ─── Main resolvers ───────────────────────────────────────────────────

/**
 * Resolve a stream URL *and* return metadata (content length, MIME type,
 * bitrate). Deduplicates concurrent requests from multiple devices or prebuffering.
 */
export async function resolveStreamUrlWithMeta(
  videoId: string,
  quality: StreamQuality = "high",
): Promise<StreamMeta | null> {
  if (!videoId || !VIDEO_ID_REGEX.test(videoId)) {
    return null;
  }
  const cacheKey = `${videoId}:${quality}`;
  const cached = streamCache.get(cacheKey);
  if (cached) return cached;

  const existing = inFlightResolutions.get(cacheKey);
  if (existing) return existing;

  const resolutionPromise = (async () => {
    try {
      if (!isTrackAllowed(videoId)) return null;

      const entry = await resolveWithInnerTubePlayer(videoId, quality);

      if (entry) {
        streamCache.set(cacheKey, entry);
        recordResolveSuccess(videoId);
        return entry;
      }

      recordResolveFailure(videoId);
      return null;
    } finally {
      inFlightResolutions.delete(cacheKey);
    }
  })();

  inFlightResolutions.set(cacheKey, resolutionPromise);
  return resolutionPromise;
}

/**
 * Resolve direct audio stream URL for a YouTube video ID.
 */
export async function resolveStreamUrl(
  videoId: string,
  quality: StreamQuality = "high",
): Promise<string | null> {
  const meta = await resolveStreamUrlWithMeta(videoId, quality);
  return meta?.url ?? null;
}
