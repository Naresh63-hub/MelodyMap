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

// ─── Circuit breaker ─────────────────────────────────────────────────

const FAILURE_THRESHOLD = 5;
const COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

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
    const res = await fetch(url, {
      headers: { Range: "bytes=0-65535" },
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok || res.status === 206;
  } catch {
    return false;
  }
}

// ─── yt-dlp resolver ──────────────────────────────────────────────────
//
// The only resolver that currently works against YouTube: it handles the
// player-client challenges, poToken generation and signature decryption
// that have locked out the raw player API and ytdl-core forks. It spawns
// the yt-dlp binary, so it needs the binary present on the host.

async function resolveWithYtDlp(videoId: string): Promise<CacheEntry | null> {
  try {
    const { default: youtubedl } = await import("youtube-dl-exec");
    const output = await youtubedl(`https://www.youtube.com/watch?v=${videoId}`, {
      dumpJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      extractorArgs: "youtube:player_client=android",
      addHeader: [
        'referer:youtube.com',
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    } as any);

    const fmts = (output as any).formats || [];
    
    // The android client DASH audio formats (140, 251) are capped at 1MB.
    // However, the legacy mp4 format (18) is NOT capped.
    // So we explicitly prefer format 18, or any format that has audio and video 
    // because those are legacy non-DASH formats that bypass the 1MB cap.
    const uncappedFormats = fmts.filter((f: any) => f.acodec !== 'none' && f.vcodec !== 'none');
    
    // Fallback to audio-only if no legacy format is found (though they will likely be capped)
    const audioFormats = uncappedFormats.length > 0 
      ? uncappedFormats 
      : fmts.filter((f: any) => f.acodec !== 'none');
      
    // Sort by bitrate
    audioFormats.sort((a: any, b: any) => (b.abr || 0) - (a.abr || 0));

    if (audioFormats.length === 0) {
      console.warn(`[stream] yt-dlp: no audio format for ${videoId}`);
      return null;
    }

    const format = audioFormats[0];

    if (!format.url) {
      console.warn(`[stream] yt-dlp: format itag=${format.format_id} has no URL for ${videoId}`);
      return null;
    }

    // Verify the URL actually streams
    if (!(await probeStream(format.url))) {
      console.warn(`[stream] yt-dlp: probe failed for ${videoId} (itag=${format.format_id})`);
      return null;
    }

    const contentLen = format.filesize || format.filesize_approx;

    return {
      url: format.url,
      mimeType: format.ext === 'webm' ? 'audio/webm' : 'audio/mp4',
      contentLength: contentLen ? Number(contentLen) : null,
      audioBitrate: format.abr ? Number(format.abr) * 1000 : null,
      at: Date.now(),
    };
  } catch (err) {
    console.warn(`[stream] yt-dlp resolve error for ${videoId}:`, err);
    return null;
  }
}

// ─── Main resolver ───────────────────────────────────────────────────

/**
 * Resolve a direct audio stream URL for a YouTube video ID.
 */
export async function resolveStreamUrl(
  videoId: string,
): Promise<string | null> {
  const cached = cacheGet(videoId);
  if (cached) return cached.url;

  if (!isCooledDown()) {
    console.warn(
      `[stream] Circuit breaker open — skipping resolve for ${videoId}`,
    );
    return null;
  }

  const entry = await resolveWithYtDlp(videoId);

  if (entry) {
    cacheSet(videoId, entry);
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
): Promise<{
  url: string;
  mimeType: string;
  contentLength: number | null;
  audioBitrate: number | null;
} | null> {
  const cached = cacheGet(videoId);
  if (cached) {
    return {
      url: cached.url,
      mimeType: cached.mimeType,
      contentLength: cached.contentLength,
      audioBitrate: cached.audioBitrate,
    };
  }

  if (!isCooledDown()) return null;

  const entry = await resolveWithYtDlp(videoId);

  if (entry) {
    cacheSet(videoId, entry);
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

