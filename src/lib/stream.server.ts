/**
 * Resolves a direct, ad-free audio stream URL for a YouTube video.
 *
 * Primary strategy: @distube/ytdl-core — the same engine that powers
 * yt-dlp, SimpMusic, Nuclear, and most open-source YouTube Music clients.
 * It handles signature decryption, player-client rotation, and format
 * selection automatically.
 *
 * Fallback: manual YouTube player API calls (the previous approach) for
 * resilience if ytdl-core is ever rate-limited or blocked.
 *
 * Resolved URLs are cached for 25 minutes (YouTube stream URLs typically
 * expire after ~6 hours, so this is well within the safe window).
 *
 * A lightweight circuit breaker prevents hammering YouTube when it's
 * rate-limiting or blocking — after N consecutive failures we back off
 * for a cooldown period instead of burning CPU on doomed requests.
 */

// ─── Stream URL cache (LRU, 25-min TTL) ──────────────────────────────

const CACHE_TTL = 25 * 60 * 1000; // 25 minutes
const CACHE_MAX = 200;

type CacheEntry = {
  url: string;
  mimeType: string;
  contentLength: number | null;
  audioBitrate: number | null;
  at: number;
};

const streamCache = new Map<string, CacheEntry>();

function cacheGet(videoId: string): CacheEntry | null {
  const entry = streamCache.get(videoId);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL) {
    streamCache.delete(videoId);
    return null;
  }
  // Refresh LRU position
  streamCache.delete(videoId);
  streamCache.set(videoId, entry);
  return entry;
}

function cacheSet(videoId: string, entry: CacheEntry) {
  // Evict oldest entries when full
  while (streamCache.size >= CACHE_MAX) {
    const oldest = streamCache.keys().next().value;
    if (oldest) streamCache.delete(oldest);
    else break;
  }
  streamCache.set(videoId, entry);
}

/** Invalidate a cached stream URL (e.g. when playback fails mid-stream). */
export function invalidateStreamCache(videoId: string) {
  streamCache.delete(videoId);
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// ─── Circuit breaker ─────────────────────────────────────────────────

const FAILURE_THRESHOLD = 20;
const COOLDOWN_MS = 15 * 1000; // 15 seconds

let consecutiveFailures = 0;
let cooldownUntil = 0;

function isCooledDown(): boolean {
  return Date.now() > cooldownUntil;
}

function recordSuccess() {
  consecutiveFailures = 0;
  cooldownUntil = 0;
}

function recordFailure() {
  consecutiveFailures++;
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    cooldownUntil = Date.now() + COOLDOWN_MS;
    console.warn(
      `[stream] Circuit breaker tripped — ${consecutiveFailures} consecutive failures, backing off for ${COOLDOWN_MS / 1000}s`,
    );
  }
}

// ─── Probe verification ──────────────────────────────────────────────

/**
 * Some resolved URLs are throttled and answer 403 — check that the bytes
 * actually flow before handing the URL to the player.
 */
async function probeStream(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Range: "bytes=0-1024",
        "User-Agent": BROWSER_UA,
        Referer: "https://www.youtube.com/",
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

// ─── yt-dlp resolver ──────────────────────────────────────────────────

export type StreamQuality = "saver" | "standard" | "high";

async function resolveWithYtDlp(
  videoId: string,
  quality: StreamQuality = "high",
): Promise<CacheEntry | null> {
  try {
    const { default: youtubedl } = await import("youtube-dl-exec");
    const output = await youtubedl(`https://www.youtube.com/watch?v=${videoId}`, {
      dumpJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      extractorArgs: "youtube:player_client=android,tv_embedded",
    } as any);

    const fmts = (output as any).formats || [];

    // Audio-only formats: has audio, no video.
    const audioFormats = fmts.filter(
      (f: any) =>
        f.url &&
        f.acodec &&
        f.acodec !== "none" &&
        (!f.vcodec || f.vcodec === "none"),
    );

    // Fallback: if no audio-only format, try any format with audio
    const candidates =
      audioFormats.length > 0
        ? audioFormats
        : fmts.filter((f: any) => f.url && f.acodec && f.acodec !== "none");

    if (candidates.length === 0) {
      console.warn(`[stream] yt-dlp: no usable audio stream found for ${videoId}`);
      return null;
    }

    // Quality-aware sorting:
    if (quality === "saver") {
      // Smallest bitrate (data saver: ~48-70kbps)
      candidates.sort((a: any, b: any) => (a.abr || 0) - (b.abr || 0));
    } else if (quality === "standard") {
      // Target ~128kbps
      candidates.sort(
        (a: any, b: any) =>
          Math.abs((a.abr || 128) - 128) - Math.abs((b.abr || 128) - 128),
      );
    } else {
      // High quality (~160-256kbps)
      candidates.sort((a: any, b: any) => (b.abr || 0) - (a.abr || 0));
    }

    for (const bestFormat of candidates.slice(0, 3)) {
      if (!bestFormat || !bestFormat.url) continue;
      
      const isHealthy = await probeStream(bestFormat.url);
      if (!isHealthy) {
        console.warn(`[stream] Candidate format failed probe check for ${videoId}, trying next format...`);
        continue;
      }

      const contentLen = bestFormat.filesize || bestFormat.filesize_approx;
      return {
        url: bestFormat.url,
        mimeType: bestFormat.ext === "webm" ? "audio/webm" : "audio/mp4",
        contentLength: contentLen ? Number(contentLen) : null,
        audioBitrate: bestFormat.abr ? Number(bestFormat.abr) * 1000 : null,
        at: Date.now(),
      };
    }

    console.warn(`[stream] yt-dlp: all stream candidates failed probe verification for ${videoId}`);
    return null;
  } catch (err) {
    console.warn(`[stream] yt-dlp resolve error for ${videoId}:`, err);
    return null;
  }
}

const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{1,32}$/;

// ─── Main resolver ───────────────────────────────────────────────────

/**
 * Resolve a direct audio stream URL for a YouTube video ID.
 */
export async function resolveStreamUrl(
  videoId: string,
  quality: StreamQuality = "high",
): Promise<string | null> {
  if (!videoId || !VIDEO_ID_REGEX.test(videoId)) {
    return null;
  }
  const cacheKey = `${videoId}:${quality}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached.url;

  if (!isCooledDown()) {
    console.warn(
      `[stream] Circuit breaker open — skipping resolve for ${videoId}`,
    );
    return null;
  }

  const entry = await resolveWithYtDlp(videoId, quality);

  if (entry) {
    cacheSet(cacheKey, entry);
    recordSuccess();
    return entry.url;
  }

  recordFailure();
  console.error(
    `[stream] All resolve strategies failed for ${videoId}`,
  );
  return null;
}

/**
 * Resolve a stream URL *and* return metadata (content length, MIME type,
 * bitrate). Useful for the proxy server to skip the HEAD probe.
 */
export async function resolveStreamUrlWithMeta(
  videoId: string,
  quality: StreamQuality = "high",
): Promise<{
  url: string;
  mimeType: string;
  contentLength: number | null;
  audioBitrate: number | null;
} | null> {
  if (!videoId || !VIDEO_ID_REGEX.test(videoId)) {
    return null;
  }
  const cacheKey = `${videoId}:${quality}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    return {
      url: cached.url,
      mimeType: cached.mimeType,
      contentLength: cached.contentLength,
      audioBitrate: cached.audioBitrate,
    };
  }

  if (!isCooledDown()) return null;

  const entry = await resolveWithYtDlp(videoId, quality);

  if (entry) {
    cacheSet(cacheKey, entry);
    recordSuccess();
    return {
      url: entry.url,
      mimeType: entry.mimeType,
      contentLength: entry.contentLength,
      audioBitrate: entry.audioBitrate,
    };
  }

  recordFailure();
  return null;
}

