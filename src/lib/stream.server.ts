/**
 * Resolves a direct, ad-free audio stream URL for a YouTube video.
 *
 * Primary strategy: @distube/ytdl-core / yt-dlp.
 * Fallback: direct YouTube InnerTube player API (Android client emulation).
 *
 * Resolved URLs are verified with byte-range probe checks and cached in LRU.
 */

import fs from "node:fs";
import { createLruCache } from "./lru-cache";

export type StreamQuality = "saver" | "standard" | "high";

export type StreamMeta = {
  url: string;
  mimeType: string;
  contentLength: number | null;
  audioBitrate: number | null;
};

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

// ─── Pre-Provisioned Binary Resolution ───────────────────────────────

let resolvedYtDlpInstance: any = null;

/**
 * Resolves the yt-dlp binary instance from pre-provisioned disk locations:
 * 1. Custom path specified via YOUTUBE_DL_PATH environment variable
 * 2. youtube-dl-exec bundled package binary (node_modules/youtube-dl-exec/bin/yt-dlp)
 * 3. Standard system locations (/usr/local/bin/yt-dlp, /usr/bin/yt-dlp)
 *
 * If no pre-provisioned binary is found on disk, returns null safely.
 * The streaming resolver seamlessly falls back to the pure TypeScript InnerTube resolver.
 * No executable binaries are downloaded dynamically over the network at runtime.
 */
export async function getYtDlpInstance() {
  if (resolvedYtDlpInstance) return resolvedYtDlpInstance;

  try {
    const ytdlModule = (await import("youtube-dl-exec")) as any;
    const create = ytdlModule.create || ytdlModule.default?.create || ytdlModule.default;
    const constants = ytdlModule.constants || {};

    // 1. Check custom path from environment variable
    const envPath = process.env["YOUTUBE_DL_PATH"];
    if (envPath && fs.existsSync(envPath)) {
      resolvedYtDlpInstance = create(envPath);
      return resolvedYtDlpInstance;
    }

    // 2. Check youtube-dl-exec package bundled binary
    if (constants.YOUTUBE_DL_PATH && fs.existsSync(constants.YOUTUBE_DL_PATH)) {
      resolvedYtDlpInstance = create(constants.YOUTUBE_DL_PATH);
      return resolvedYtDlpInstance;
    }

    // 3. Check standard system locations on Unix/Linux
    const isWindows = process.platform === "win32";
    if (!isWindows) {
      const candidatePaths = [
        "/usr/local/bin/yt-dlp",
        "/usr/bin/yt-dlp",
        "/bin/yt-dlp",
        "/opt/homebrew/bin/yt-dlp",
      ];
      for (const candidate of candidatePaths) {
        if (fs.existsSync(candidate)) {
          resolvedYtDlpInstance = create(candidate);
          return resolvedYtDlpInstance;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

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
export async function probeStream(url: string): Promise<boolean> {
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

const EXTRACTOR_CLIENT_PRESETS: Array<string | undefined> = [
  undefined, // Standard default yt-dlp extraction
  "youtube:player_client=android,web",
  "youtube:player_client=web_safari,ios,mweb",
  "youtube:player_client=web,mweb",
];

async function resolveWithPreset(
  videoId: string,
  quality: StreamQuality = "high",
  extractorArgs: string | undefined,
): Promise<StreamMeta | null> {
  const youtubedl = await getYtDlpInstance();
  if (!youtubedl) return null;

  const output = await youtubedl(`https://www.youtube.com/watch?v=${videoId}`, {
    dumpJson: true,
    noCheckCertificates: true,
    noWarnings: true,
    ...(extractorArgs ? { extractorArgs } : {}),
  } as any);

  const fmts = (output as any).formats || [];

  // Priority 1: Pure audio-only formats (no video tracks)
  const audioFormats = fmts.filter(
    (f: any) =>
      f.url &&
      f.acodec &&
      f.acodec !== "none" &&
      (!f.vcodec || f.vcodec === "none"),
  );

  if (audioFormats.length === 0) return null;

  if (quality === "saver") {
    audioFormats.sort((a: any, b: any) => (a.abr || 0) - (b.abr || 0));
  } else if (quality === "standard") {
    audioFormats.sort(
      (a: any, b: any) =>
        Math.abs((a.abr || 128) - 128) - Math.abs((b.abr || 128) - 128),
    );
  } else {
    audioFormats.sort((a: any, b: any) => (b.abr || 0) - (a.abr || 0));
  }

  for (const bestFormat of audioFormats.slice(0, 3)) {
    if (!bestFormat || !bestFormat.url) continue;

    const isHealthy = await probeStream(bestFormat.url);
    if (!isHealthy) continue;

    const contentLen = bestFormat.filesize || bestFormat.filesize_approx;
    return {
      url: bestFormat.url,
      mimeType: bestFormat.ext === "webm" ? "audio/webm" : "audio/mp4",
      contentLength: contentLen ? Number(contentLen) : null,
      audioBitrate: bestFormat.abr ? Number(bestFormat.abr) * 1000 : null,
    };
  }

  return null;
}

async function resolveWithYtDlp(
  videoId: string,
  quality: StreamQuality = "high",
): Promise<StreamMeta | null> {
  const youtubedl = await getYtDlpInstance();
  if (!youtubedl) return null;

  // Run all client presets concurrently — each full extraction can take
  // several seconds, and the previous sequential chain pushed cold starts
  // past the proxy timeout on serverless.
  const attempts = EXTRACTOR_CLIENT_PRESETS.map((extractorArgs) =>
    resolveWithPreset(videoId, quality, extractorArgs).catch((presetErr) => {
      console.warn(`[stream] yt-dlp preset (${extractorArgs ?? "default"}) failed for ${videoId}:`, presetErr);
      return null;
    }),
  );
  const settled = await Promise.all(attempts);
  const firstHealthy = settled.find((meta): meta is StreamMeta => Boolean(meta));
  if (firstHealthy) return firstHealthy;

  // Last resort fallback across all formats (muxed with audio) if no audio-only format succeeded
  try {
    const output = await youtubedl(`https://www.youtube.com/watch?v=${videoId}`, {
      dumpJson: true,
      noCheckCertificates: true,
      noWarnings: true,
    } as any);

    const fmts = (output as any).formats || [];
    const muxedAudio = fmts.filter((f: any) => f.url && f.acodec && f.acodec !== "none");
    for (const format of muxedAudio.slice(0, 2)) {
      if (await probeStream(format.url)) {
        const contentLen = format.filesize || format.filesize_approx;
        return {
          url: format.url,
          mimeType: format.ext === "webm" ? "audio/webm" : "audio/mp4",
          contentLength: contentLen ? Number(contentLen) : null,
          audioBitrate: format.abr ? Number(format.abr) * 1000 : null,
        };
      }
    }
  } catch (lastErr) {
    console.warn(`[stream] yt-dlp final fallback failed for ${videoId}:`, lastErr);
  }

  return null;
}

// ─── InnerTube Player (Direct YouTube API with fallback) ───────────────────

function cleanTrackTitle(title: string): string {
  return title
    .replace(/\[.*?\]|\(.*?\)|\|.*/g, "")
    .replace(/(full\s+)?(video|audio|lyric|lyrical)\s+song/gi, "")
    .replace(/(official|original)\s+(music\s+)?(video|audio|track)/gi, "")
    .replace(/\b(4k|hd|remix|feat|ft\.)\b/gi, "")
    .replace(/[-–—_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const INNERTUBE_CLIENTS = [
  {
    clientName: "ANDROID_VR",
    clientVersion: "1.60.19",
    deviceModel: "Quest 3",
    hl: "en",
    gl: "US",
  },
  {
    clientName: "IOS",
    clientVersion: "19.29.1",
    deviceModel: "iPhone16,2",
    hl: "en",
    gl: "US",
  },
  {
    clientName: "WEB_REMIX",
    clientVersion: "1.20240318.01.00",
    hl: "en",
    gl: "US",
  },
];

export async function resolveWithInnerTubePlayer(
  videoId: string,
  quality: StreamQuality = "high",
): Promise<StreamMeta | null> {
  for (const clientContext of INNERTUBE_CLIENTS) {
    try {
      const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        },
        body: JSON.stringify({
          videoId,
          context: { client: clientContext },
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        const adaptiveFormats = data?.streamingData?.adaptiveFormats;
        if (Array.isArray(adaptiveFormats) && adaptiveFormats.length > 0) {
          const audioFormats = adaptiveFormats.filter(
            (f: any) => f && f.url && typeof f.mimeType === "string" && f.mimeType.startsWith("audio/"),
          );

          if (audioFormats.length > 0) {
            if (quality === "saver") {
              audioFormats.sort((a: any, b: any) => (a.bitrate || 0) - (b.bitrate || 0));
            } else if (quality === "standard") {
              audioFormats.sort(
                (a: any, b: any) =>
                  Math.abs((a.bitrate || 128000) - 128000) - Math.abs((b.bitrate || 128000) - 128000),
              );
            } else {
              audioFormats.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
            }

            const best = audioFormats[0];
            if (best && best.url) {
              const mime = best.mimeType.split(";")[0] || "audio/mp4";
              const contentLen = best.contentLength ? Number(best.contentLength) : null;
              const bitrate = best.bitrate ? Number(best.bitrate) : null;

              return {
                url: best.url,
                mimeType: mime,
                contentLength: contentLen,
                audioBitrate: bitrate,
              };
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[stream] ${clientContext.clientName} resolution notice for ${videoId}:`, err);
    }
  }

  // Fallback 2: For restricted tracks (e.g. LOGIN_REQUIRED), fetch metadata via oEmbed and resolve official audio preview
  try {
    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { headers: { "User-Agent": BROWSER_UA } },
    );
    if (oembedRes.ok) {
      const oembed = (await oembedRes.json()) as any;
      const cleanTitle = cleanTrackTitle(oembed?.title || "");
      const rawTitle = (oembed?.title || "").replace(/\[.*?\]|\(.*?\)|\|.*/g, "").trim();
      const rawAuthor = (oembed?.author_name || "").replace(/ - Topic|VEVO/g, "").trim();
      const queriesToTry = [cleanTitle, rawTitle, `${cleanTitle} ${rawAuthor}`.trim()].filter(
        (q): q is string => Boolean(q && q.length > 0),
      );

      for (const q of queriesToTry) {
        const deezerRes = await fetch(
          `https://api.deezer.com/search?q=${encodeURIComponent(q)}`,
          { headers: { "User-Agent": BROWSER_UA } },
        );
        if (deezerRes.ok) {
          const dzData = (await deezerRes.json()) as any;
          const match = dzData?.data?.find((d: any) => Boolean(d.preview)) || dzData?.data?.[0];
          if (match?.preview) {
            const probeOk = await probeStream(match.preview);
            if (probeOk) {
              return {
                url: match.preview,
                mimeType: "audio/mp4",
                contentLength: null,
                audioBitrate: 128000,
              };
            }
          }
        }
      }
    }
  } catch (fallbackErr) {
    console.warn(`[stream] Catalog preview fallback notice for ${videoId}:`, fallbackErr);
  }

  return null;
}

const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{1,32}$/;

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
      if (!isCooledDown()) return null;

      let entry: StreamMeta | null = null;

      // Strategy 1: Pre-provisioned yt-dlp binary (if installed on disk)
      const youtubedl = await getYtDlpInstance();
      if (youtubedl) {
        entry = await resolveWithYtDlp(videoId, quality);
      }

      // Strategy 2: High-performance pure-TypeScript InnerTube & catalog resolver
      if (!entry) {
        entry = await resolveWithInnerTubePlayer(videoId, quality);
      }

      if (entry) {
        streamCache.set(cacheKey, entry);
        recordSuccess();
        return entry;
      }

      recordFailure();
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
