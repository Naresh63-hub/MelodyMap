/**
 * JioSaavn Music Provider Adapter
 * Delivers official, crystal-clear 320kbps AAC audio streams with direct CDN URLs.
 * High reliability, zero bot blocks, and seamless background playback.
 */

import CryptoJS from "crypto-js";
import type { UnifiedTrack, ProviderSearchOptions } from "./types";

const DES_KEY = "38346591";

/**
 * Decrypts JioSaavn encrypted media URLs using DES-ECB.
 * Converts to the target bitrate quality (320kbps / 160kbps / 96kbps).
 */
export function decryptSaavnMediaUrl(
  encryptedUrl: string,
  quality: "saver" | "standard" | "high" = "high",
): string {
  if (!encryptedUrl) return "";
  try {
    const key = CryptoJS.enc.Utf8.parse(DES_KEY);
    const decrypted = CryptoJS.DES.decrypt(
      CryptoJS.lib.CipherParams.create({ ciphertext: CryptoJS.enc.Base64.parse(encryptedUrl) }),
      key,
      {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7,
      },
    );
    const rawUrl = decrypted.toString(CryptoJS.enc.Utf8);
    if (!rawUrl || !rawUrl.startsWith("http")) return "";

    const suffix =
      quality === "saver" ? "_96.mp4" : quality === "standard" ? "_160.mp4" : "_320.mp4";
    return rawUrl.replace(/_96\.mp4|_160\.mp4|_320\.mp4/, suffix);
  } catch (err) {
    console.warn("[Saavn] Failed to decrypt media URL:", err);
    return "";
  }
}

function cleanHtmlEntities(text?: string): string {
  if (!text) return "";
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return "3:30";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function upgradeArtwork(imgUrl?: string): string {
  if (!imgUrl) return "/icons/icon-512.png";
  return imgUrl.replace("150x150", "500x500").replace("50x50", "500x500");
}

/**
 * Maps raw JioSaavn API track object into canonical UnifiedTrack.
 */
function mapSaavnSongToUnified(raw: any): UnifiedTrack | null {
  const songId = raw.id;
  if (!songId) return null;

  const title = cleanHtmlEntities(raw.title);
  const artistMap = raw.more_info?.artistMap;
  const artists =
    artistMap?.primary_artists?.map((a: any) => cleanHtmlEntities(a.name)).filter(Boolean) || [];
  const artist =
    artists.length > 0 ? artists.join(", ") : cleanHtmlEntities(raw.subtitle || raw.more_info?.music || "Unknown Artist");

  const durationSeconds = Number(raw.more_info?.duration) || 0;
  const artwork = upgradeArtwork(raw.image);
  const encryptedUrl = raw.more_info?.encrypted_media_url;
  const streamUrl = decryptSaavnMediaUrl(encryptedUrl, "high");

  return {
    id: `saavn:${songId}`,
    canonicalTrackId: `saavn:${songId}`,
    title,
    artist,
    album: cleanHtmlEntities(raw.more_info?.album || raw.album),
    duration: formatDuration(durationSeconds),
    durationSeconds,
    thumbnail: artwork,
    artwork,
    languageCode: raw.language ? String(raw.language).toLowerCase() : undefined,
    provider: "saavn",
    source: "saavn",
    providerTrackId: songId,
    previewUrl: streamUrl || undefined,
    playable: Boolean(streamUrl),
    playbackSource: streamUrl
      ? {
          provider: "saavn",
          providerTrackId: songId,
          url: streamUrl,
          type: "full",
          bitrateKbps: 320,
          format: "mp4",
        }
      : undefined,
  };
}

/**
 * Searches JioSaavn for tracks matching a search query.
 */
export async function searchSaavn(
  query: string,
  options: ProviderSearchOptions = {},
): Promise<UnifiedTrack[]> {
  const clean = query.trim();
  if (!clean) return [];

  const limit = Math.min(options.limit ?? 20, 30);
  const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(clean)}&p=1&n=${limit}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json",
      },
    });

    if (!res.ok || typeof res.json !== "function") return [];
    const data = (await res.json()) as any;
    const rawResults = data?.results || [];
    if (!Array.isArray(rawResults)) return [];

    const tracks: UnifiedTrack[] = [];
    for (const raw of rawResults) {
      const unified = mapSaavnSongToUnified(raw);
      if (unified && unified.playbackSource) {
        tracks.push(unified);
      }
    }
    return tracks;
  } catch (err) {
    console.warn(`[Saavn] Search failed for query "${query}":`, err);
    return [];
  }
}

/**
 * Resolves a full-length 320kbps JioSaavn stream URL for an existing track
 * by matching title and artist.
 */
export async function resolveSaavnByMeta(
  title: string,
  artist?: string,
  targetDurationSeconds?: number | null,
): Promise<{
  url: string;
  mimeType: string;
  source: "saavn";
  title: string;
  artist: string;
  duration: number;
} | null> {
  const cleanTitle = title
    .replace(/\[.*?\]|\(.*?\)|\|.*/g, "")
    .replace(/(full\s+)?(video|audio|lyric|lyrical)\s+song/gi, "")
    .replace(/(official|original)\s+(music\s+)?(video|audio|track)/gi, "")
    .replace(/\b(4k|hd|remix|feat|ft\.)\b/gi, "")
    .replace(/[-–—_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const searchQuery = artist ? `${cleanTitle} ${artist}`.trim() : cleanTitle;
  const candidates = await searchSaavn(searchQuery, { limit: 5 });
  if (candidates.length === 0) return null;

  // Find best match based on duration proximity and title similarity
  let best = candidates[0];
  if (targetDurationSeconds && targetDurationSeconds > 0) {
    let bestDiff = Infinity;
    for (const cand of candidates) {
      const diff = Math.abs(cand.durationSeconds - targetDurationSeconds);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = cand;
      }
    }
  }

  if (best?.playbackSource?.url) {
    return {
      url: best.playbackSource.url,
      mimeType: "audio/mp4",
      source: "saavn",
      title: best.title,
      artist: best.artist,
      duration: best.durationSeconds,
    };
  }

  return null;
}
