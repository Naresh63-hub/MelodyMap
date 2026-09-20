/**
 * Resolves a direct, ad-free audio stream URL for a YouTube video.
 *
 * Primary strategy: @distube/ytdl-core / yt-dlp.
 * Fallback: direct YouTube InnerTube player API (Android client emulation).
 *
 * Resolved URLs are verified with byte-range probe checks and cached in LRU.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
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

// ─── Serverless Binary Auto-Resolution (Vercel / Linux) ──────────────

const YT_DLP_RELEASE_BASE = "https://github.com/yt-dlp/yt-dlp/releases/latest/download";

let resolvedYtDlpInstance: any = null;
let downloadPromise: Promise<void> | null = null;

/**
 * Download the standalone yt-dlp binary and verify it against the SHA2-256SUMS
 * asset published with the same release. A binary that cannot be verified is
 * refused (fail closed) — the app then falls back to the InnerTube resolver.
 */
async function downloadVerifiedYtDlpBinary(
  tmpPath: string,
  binaryName: string,
  isWindows: boolean,
): Promise<boolean> {
  const [binRes, sumsRes] = await Promise.all([
    fetch(`${YT_DLP_RELEASE_BASE}/${binaryName}`),
    fetch(`${YT_DLP_RELEASE_BASE}/SHA2-256SUMS`),
  ]);
  if (!binRes.ok || !sumsRes.ok) return false;

  const buffer = Buffer.from(await binRes.arrayBuffer());
  const sums = await sumsRes.text();
  // GNU-style lines: "<sha256>  <filename>"
  const expectedSha = sums
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 2)
    .find((parts) => parts.slice(1).join(" ") === binaryName)?.[0]
    ?.toLowerCase();

  if (!expectedSha) return false;
  const actualSha = createHash("sha256").update(buffer).digest("hex");
  if (actualSha !== expectedSha) return false;

  fs.writeFileSync(tmpPath, buffer);
  if (!isWindows) {
    fs.chmodSync(tmpPath, 0o755);
  }
  return true;
}

async function getYtDlpInstance() {
  const ytdlModule = (await import("youtube-dl-exec")) as any;
  const create = ytdlModule.create || ytdlModule.default?.create || ytdlModule.default;
  const constants = ytdlModule.constants || {};

  // 1. Check if the default binary exists on disk
  if (constants.YOUTUBE_DL_PATH && fs.existsSync(constants.YOUTUBE_DL_PATH)) {
    resolvedYtDlpInstance = create(constants.YOUTUBE_DL_PATH);
    return resolvedYtDlpInstance;
  }

  // 2. Check if cached binary in /tmp already exists
  const isWindows = process.platform === "win32";
  const binaryName = isWindows ? "yt-dlp.exe" : "yt-dlp";
  const tmpPath = path.join(os.tmpdir(), binaryName);

  if (fs.existsSync(tmpPath)) {
    try {
      if (!isWindows) {
        fs.chmodSync(tmpPath, 0o755);
      }
      resolvedYtDlpInstance = create(tmpPath);
      return resolvedYtDlpInstance;
    } catch {}
  }

  // 3. Download standalone binary to /tmp if running on serverless Linux (e.g. Vercel)
  if (!downloadPromise) {
    downloadPromise = (async () => {
      try {
        console.info(`[stream] yt-dlp binary missing from bundle, downloading to ${tmpPath}...`);
        const installed = await downloadVerifiedYtDlpBinary(tmpPath, binaryName, isWindows);
        console.info(
          installed
            ? `[stream] Installed checksum-verified yt-dlp to ${tmpPath}`
            : `[stream] yt-dlp install refused (release unavailable or checksum verification failed)`,
        );
      } catch (err) {
        console.warn(`[stream] Failed to download yt-dlp binary to /tmp:`, err);
      }
    })();
  }

  await downloadPromise;

  if (fs.existsSync(tmpPath)) {
    resolvedYtDlpInstance = create(tmpPath);
    return resolvedYtDlpInstance;
  }

  resolvedYtDlpInstance = create(constants.YOUTUBE_DL_PATH);
  return resolvedYtDlpInstance;
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
    const youtubedl = await getYtDlpInstance();
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

// ─── InnerTube Player Fallback (Direct YouTube API) ───────────────────

async function resolveWithInnerTubePlayer(
  videoId: string,
  quality: StreamQuality = "high",
): Promise<StreamMeta | null> {
  try {
    const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "com.google.android.youtube/19.09.37 (Linux; U; Android 11; Pixel 5) gzip",
        "X-YouTube-Client-Name": "3",
        "X-YouTube-Client-Version": "19.09.37",
      },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: "19.09.37",
            androidSdkVersion: 30,
            hl: "en",
            gl: "US",
          },
        },
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as any;
    const adaptiveFormats = data?.streamingData?.adaptiveFormats;
    if (!Array.isArray(adaptiveFormats)) return null;

    // Filter audio formats with direct playable URLs
    const audioFormats = adaptiveFormats.filter(
      (f: any) => f && f.url && typeof f.mimeType === "string" && f.mimeType.startsWith("audio/"),
    );

    if (audioFormats.length === 0) return null;

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

    for (const fmt of audioFormats.slice(0, 3)) {
      if (!fmt || !fmt.url) continue;
      const isHealthy = await probeStream(fmt.url);
      if (!isHealthy) continue;

      const mime = fmt.mimeType.split(";")[0] || "audio/mp4";
      const contentLen = fmt.contentLength ? Number(fmt.contentLength) : null;
      const bitrate = fmt.bitrate ? Number(fmt.bitrate) : null;

      return {
        url: fmt.url,
        mimeType: mime,
        contentLength: contentLen,
        audioBitrate: bitrate,
      };
    }

    return null;
  } catch (err) {
    console.warn(`[stream] InnerTube player fallback error for ${videoId}:`, err);
    return null;
  }
}

const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{1,32}$/;

// ─── Main resolvers ───────────────────────────────────────────────────

/**
 * Resolve a stream URL *and* return metadata (content length, MIME type,
 * bitrate).
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

  if (!isCooledDown()) return null;

  // Strategy 1: yt-dlp
  let entry = await resolveWithYtDlp(videoId, quality);

  // Strategy 2: InnerTube Player direct API fallback
  if (!entry) {
    console.info(`[stream] yt-dlp unavailable or failed for ${videoId}, attempting InnerTube fallback...`);
    entry = await resolveWithInnerTubePlayer(videoId, quality);
  }

  if (entry) {
    streamCache.set(cacheKey, entry);
    recordSuccess();
    return entry;
  }

  recordFailure();
  return null;
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
