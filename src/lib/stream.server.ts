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
import { searchAudius } from "./providers/audius";
import { searchJamendo } from "./providers/jamendo";

export type StreamQuality = "saver" | "standard" | "high";

export type StreamMeta = {
  url: string;
  mimeType: string;
  contentLength: number | null;
  audioBitrate: number | null;
  /** Which resolver produced this stream ("youtube" is the implicit default). */
  source?: "youtube" | "audius" | "jamendo";
};

// ─── Audius match scoring ────────────────────────────────────────────

const AUDIUS_MIN_SCORE = 1.2;

/** Lowers case, strips bracketed tags/punctuation, returns word tokens. */
function titleTokens(text: string | null | undefined): string[] {
  return (text || "")
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

// ─── Per-track resolve backoff ──────────────────────────────────────
//
// Previously a GLOBAL circuit breaker (20 consecutive failures → 15s cooldown)
// guarded resolution. One unresolvable track (bot-blocked, region-locked, or
// deleted) could freeze resolution for the ENTIRE catalog — the user saw
// "audio connection interrupted" for every song after a few bad tracks.
// Backoff is now per video ID: a track that keeps failing resolves gets paused
// (60s, doubling up to 10 min) while every other track resolves immediately.

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
        // Even a bot-blocked (LOGIN_REQUIRED) response carries videoDetails —
        // stash the real duration for the Audius fallback's match scoring.
        const lenSec = Number(data?.videoDetails?.lengthSeconds);
        if (Number.isFinite(lenSec) && lenSec > 0) {
          lastSeenDurations.set(videoId, lenSec);
        }
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

  // Fallback 2: Audius full-length match — YouTube is frequently bot-blocked
  // from serverless IPs (LOGIN_REQUIRED). A full-length replacement
  // stream keeps songs playing uninterrupted when YouTube refuses.
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
      const queriesToTry = [`${cleanTitle} ${rawAuthor}`.trim(), cleanTitle].filter(
        (q): q is string => Boolean(q && q.length > 0),
      );

      for (const q of queriesToTry) {
        const audiusMatches = await searchAudius(q, { limit: 10 });
        if (audiusMatches.length === 0) continue;
        const innerTubeDuration = lastSeenDurations.get(videoId);
        const targetDuration =
          innerTubeDuration && innerTubeDuration > 0
            ? innerTubeDuration
            : typeof oembed?.duration === "number"
              ? oembed.duration
              : null;
        const target = { title: cleanTitle, artist: rawAuthor, durationSeconds: targetDuration };
        let best: (typeof audiusMatches)[number] | null = null;
        let bestScore = 0;
        for (const candidate of audiusMatches) {
          const s = scoreAudiusCandidate(candidate, target);
          if (s > bestScore) {
            best = candidate;
            bestScore = s;
          }
        }
        // Below the threshold the pool only holds covers/unrelated recordings —
        // refusing here (per-track backoff) beats playing the wrong song.
        if (best && bestScore >= AUDIUS_MIN_SCORE) {
          const audiusStreamUrl = best.playbackSource?.url;
          if (audiusStreamUrl) {
            return {
              url: audiusStreamUrl,
              mimeType: "audio/mpeg",
              contentLength: null,
              audioBitrate: 320000,
              source: "audius",
            };
          }
        }
      }
    }
  } catch (audiusErr) {
    console.warn(`[stream] Audius full-length fallback notice for ${videoId}:`, audiusErr);
  }

  // Fallback 3: Jamendo full-length Creative Commons / independent licensed stream
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
      const queriesToTry = [`${cleanTitle} ${rawAuthor}`.trim(), cleanTitle].filter(
        (q): q is string => Boolean(q && q.length > 0),
      );

      for (const q of queriesToTry) {
        const jamendoMatches = await searchJamendo(q, { limit: 10 }).catch(() => []);
        if (jamendoMatches.length === 0) continue;
        const innerTubeDuration = lastSeenDurations.get(videoId);
        const targetDuration =
          innerTubeDuration && innerTubeDuration > 0
            ? innerTubeDuration
            : typeof oembed?.duration === "number"
              ? oembed.duration
              : null;
        const target = { title: cleanTitle, artist: rawAuthor, durationSeconds: targetDuration };
        let best: (typeof jamendoMatches)[number] | null = null;
        let bestScore = 0;
        for (const candidate of jamendoMatches) {
          const s = scoreAudiusCandidate(candidate, target);
          if (s > bestScore) {
            best = candidate;
            bestScore = s;
          }
        }
        if (best && bestScore >= AUDIUS_MIN_SCORE) {
          const jamendoStreamUrl = best.playbackSource?.url;
          // Verify bytes actually flow before the URL is cached for 25 minutes —
          // a dead match must fall through to the next query, not fail mid-play.
          if (jamendoStreamUrl && (await probeStream(jamendoStreamUrl))) {
            return {
              url: jamendoStreamUrl,
              mimeType: "audio/mpeg",
              contentLength: null,
              audioBitrate: 192000,
              source: "jamendo",
            };
          }
        }
      }
    }
  } catch (jamendoErr) {
    console.warn(`[stream] Jamendo full-length fallback notice for ${videoId}:`, jamendoErr);
  }

  // Strictly return null if no authorized full-length audio stream is found.
  // 30-second Deezer previews are completely eliminated to ensure full-length playback only.
  return null;
}

const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{1,32}$/;

/** Real track durations captured from InnerTube videoDetails (see client loop). */
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
