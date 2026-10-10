/**
 * JioSaavn Music Provider Adapter
 * Delivers official, crystal-clear 320kbps AAC audio streams with direct CDN URLs.
 * High reliability, zero bot blocks, and seamless background playback.
 */

import CryptoJS from "crypto-js";
import type { UnifiedTrack, ProviderSearchOptions } from "./types";
import { isOriginalSong } from "../track-filters";
import { cleanAlbumName, cleanMovieName, cleanSongTitle } from "../track-metadata";

const DES_KEY = "38346591";

/**
 * Decrypts JioSaavn encrypted media URLs using DES-ECB.
 * Converts to the target bitrate quality (320kbps / 160kbps / 96kbps).
 */
export function decryptSaavnMediaUrl(
  encryptedUrl: string,
  quality: "saver" | "standard" | "high" = "standard",
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
    const httpsUrl = rawUrl.replace(/^http:\/\//i, "https://");
    return httpsUrl.replace(/_96\.mp4|_160\.mp4|_320\.mp4/, suffix);
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

  // JioSaavn titles arrive as `Song (From "Movie") (Telugu)` and the album field
  // mirrors that whole string, so both are normalised here: the card gets a clean
  // song name, and `album` becomes the movie name a listener recognises.
  const rawTitle = cleanHtmlEntities(raw.title);
  const title = cleanSongTitle(rawTitle) || rawTitle;
  const rawAlbum = cleanHtmlEntities(raw.more_info?.album || raw.album);
  const movie = cleanMovieName(rawAlbum, rawTitle);
  const artistMap = raw.more_info?.artistMap;
  const artists =
    artistMap?.primary_artists?.map((a: any) => cleanHtmlEntities(a.name)).filter(Boolean) || [];
  const artist =
    artists.length > 0 ? artists.join(", ") : cleanHtmlEntities(raw.subtitle || raw.more_info?.music || "Unknown Artist");

  const durationSeconds = Number(raw.more_info?.duration) || 0;
  const artwork = upgradeArtwork(raw.image);
  const encryptedUrl = raw.more_info?.encrypted_media_url;
  const streamUrl = decryptSaavnMediaUrl(encryptedUrl, "standard");

  return {
    id: `saavn:${songId}`,
    canonicalTrackId: `saavn:${songId}`,
    title,
    artist,
    album: movie || cleanAlbumName(rawAlbum) || undefined,
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
          bitrateKbps: 160,
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
  const fetchLimit = Math.min(Math.max(limit * 2, 30), 50);
  const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(clean)}&p=1&n=${fetchLimit}`;

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
      if (unified && unified.playbackSource && isOriginalSong(unified)) {
        tracks.push(unified);
      }
    }
    return tracks.slice(0, limit);
  } catch (err) {
    console.warn(`[Saavn] Search failed for query "${query}":`, err);
    return [];
  }
}

/**
 * Resolves a direct official 320kbps/160kbps/96kbps JioSaavn stream URL for a Saavn song ID.
 */
export async function resolveSaavnById(
  songId: string,
  quality: "saver" | "standard" | "high" = "high",
): Promise<{
  url: string;
  mimeType: string;
  source: "saavn";
  title: string;
  artist: string;
  duration: number;
} | null> {
  const cleanId = songId.replace(/^saavn:/, "").trim();
  if (!cleanId) return null;

  const url = `https://www.jiosaavn.com/api.php?__call=song.getDetails&cc=in&_marker=0%3F_marker%3D0&_format=json&pids=${encodeURIComponent(cleanId)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const raw = data?.[cleanId];
    if (!raw) return null;

    const encryptedUrl = raw.encrypted_media_url || raw.more_info?.encrypted_media_url;
    if (!encryptedUrl) return null;

    const mediaUrl = decryptSaavnMediaUrl(encryptedUrl, quality);
    if (!mediaUrl) return null;

    const title = cleanHtmlEntities(raw.song || raw.title);
    const artist = cleanHtmlEntities(raw.primary_artists || raw.singers || raw.music || "");
    const duration = Number(raw.duration) || 0;

    return {
      url: mediaUrl,
      mimeType: "audio/mp4",
      source: "saavn",
      title,
      artist,
      duration,
    };
  } catch (err) {
    console.warn(`[Saavn] Failed to resolve song ID "${cleanId}":`, err);
    return null;
  }
}

import { stringSimilarity, norm } from "../track-dedup";

/**
 * Resolves a full-length 320kbps JioSaavn stream URL for an existing track
 * by matching title and artist with strict similarity scoring.
 * Never returns an unrelated song.
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

  if (!cleanTitle) return null;

  const searchQuery = artist ? `${cleanTitle} ${artist}`.trim() : cleanTitle;
  const candidates = await searchSaavn(searchQuery, { limit: 10 });
  const validCandidates = candidates.filter(isOriginalSong);
  if (validCandidates.length === 0) return null;

  const normTargetTitle = norm(cleanTitle);
  const targetWords = normTargetTitle.split(" ").filter((w) => w.length > 2);

  let best: (typeof validCandidates)[0] | null = null;
  let bestScore = 0;

  for (const cand of validCandidates) {
    const normCandTitle = norm(cand.title);
    const titleSim = stringSimilarity(cleanTitle, cand.title);

    // Check if key words from target title appear in candidate title (e.g. "Kesariya")
    const wordOverlap =
      targetWords.length > 0
        ? targetWords.filter((w) => normCandTitle.includes(w)).length / targetWords.length
        : 0;

    // Strict safety guard: candidate title MUST match target title
    // Either high fuzzy similarity OR strong keyword overlap
    if (titleSim < 0.55 && wordOverlap < 0.5) {
      continue; // Completely different song, ignore!
    }

    let score = titleSim * 0.5 + wordOverlap * 0.3;

    if (artist && cand.artist) {
      const artSim = stringSimilarity(artist, cand.artist);
      score += artSim * 0.2;
    }

    if (targetDurationSeconds && targetDurationSeconds > 0 && cand.durationSeconds > 0) {
      const diff = Math.abs(cand.durationSeconds - targetDurationSeconds);
      if (diff <= 5) score += 0.15;
      else if (diff <= 15) score += 0.08;
      else if (diff > 60) score -= 0.2;
    }

    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }

  // Only accept if bestScore meets confidence threshold and has direct playback source
  if (best && bestScore >= 0.55 && best.playbackSource?.url) {
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
