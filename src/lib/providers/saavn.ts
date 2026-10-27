/**
 * JioSaavn Music Provider Adapter
 * Delivers official, crystal-clear 320kbps AAC audio streams with direct CDN URLs.
 * High reliability, zero bot blocks, and seamless background playback.
 */

import CryptoJS from "crypto-js";
import type { UnifiedTrack, ProviderSearchOptions } from "./types";
import { isOriginalSong } from "../track-filters";
import { isOldEraTrack } from "../library";
import { decodeEntities } from "../track-metadata";
import { cleanAlbumName, cleanMovieName, cleanSongTitle } from "../track-metadata";

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
    const httpsUrl = rawUrl.replace(/^http:\/\//i, "https://");
    return httpsUrl.replace(/_96\.mp4|_160\.mp4|_320\.mp4/, suffix);
  } catch (err) {
    console.warn("[Saavn] Failed to decrypt media URL:", err);
    return "";
  }
}

function cleanHtmlEntities(text?: string): string {
  if (!text) return "";
  return decodeEntities(text);
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
  const rawTitle = cleanHtmlEntities(raw.title || raw.song);
  const title = cleanSongTitle(rawTitle) || rawTitle;
  const rawAlbum = cleanHtmlEntities(raw.more_info?.album || raw.album);
  const movie = cleanMovieName(rawAlbum, rawTitle);
  const artistMap = raw.more_info?.artistMap;
  const artists =
    artistMap?.primary_artists?.map((a: any) => cleanHtmlEntities(a.name)).filter(Boolean) || [];
  const artist =
    artists.length > 0 ? artists.join(", ") : cleanHtmlEntities(raw.subtitle || raw.more_info?.music || "Unknown Artist");

  // Strict check on raw title, cleaned title, and album before processing
  if (!isOriginalSong({ title: rawTitle, artist, album: rawAlbum })) return null;
  if (!isOriginalSong({ title, artist, album: movie || rawAlbum })) return null;

  const durationSeconds = Number(raw.more_info?.duration || raw.duration) || 0;
  const artwork = upgradeArtwork(raw.image);
  const encryptedUrl = raw.more_info?.encrypted_media_url || raw.encrypted_media_url;
  const streamUrl = decryptSaavnMediaUrl(encryptedUrl, "high");

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
    year: raw.year || raw.more_info?.year ? String(raw.year || raw.more_info?.year) : undefined,
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
 * Supports deep catalogs with multi-page batching for artists and extensive discographies.
 */
export async function searchSaavn(
  query: string,
  options: ProviderSearchOptions = {},
): Promise<UnifiedTrack[]> {
  const clean = query.trim();
  if (!clean) return [];

  const requestedLimit = options.limit ?? 20;
  const limit = Math.min(Math.max(requestedLimit, 1), 100);
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const fetchLimit = Math.min(Math.max(limit * 2, 40), 50);

  const buildUrl = (p: number) =>
    `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(clean)}&p=${p}&n=${fetchLimit}`;

  try {
    // When a large discography/catalog is requested on page 1 (limit >= 45), fetch pages 1 & 2 in parallel for deep coverage
    const pagesToFetch = limit >= 45 && page === 1 ? [1, 2] : [page];
    const fetchPromises = pagesToFetch.map(async (p) => {
      try {
        const res = await fetch(buildUrl(p), {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            Accept: "application/json",
            Referer: "https://www.jiosaavn.com/",
          },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok || typeof res.json !== "function") return [];
        const data = (await res.json().catch(() => null)) as any;
        return Array.isArray(data?.results) ? data.results : [];
      } catch {
        return [];
      }
    });

    const resultsBatches = await Promise.all(fetchPromises);
    const rawResults = resultsBatches.flat();

    const tracks: UnifiedTrack[] = [];
    const seenIds = new Set<string>();
    for (const raw of rawResults) {
      const unified = mapSaavnSongToUnified(raw);
      if (unified && unified.playbackSource && isOriginalSong(unified)) {
        if (!seenIds.has(unified.id)) {
          seenIds.add(unified.id);
          tracks.push(unified);
        }
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

  const endpoints = [
    `https://www.jiosaavn.com/api.php?__call=song.getDetails&cc=in&_marker=0%3F_marker%3D0&_format=json&pids=${encodeURIComponent(cleanId)}`,
    `https://www.jiosaavn.com/api.php?__call=song.getDetails&pids=${encodeURIComponent(cleanId)}&_format=json&_marker=0&api_version=4&ctx=web6dot0`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: "https://www.jiosaavn.com/",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;

      const data = (await res.json().catch(() => null)) as any;
      if (!data || typeof data !== "object") continue;

      // Extract raw song: directly by cleanId, via songs array, or first valid song entry
      let raw = data[cleanId];
      if (!raw && Array.isArray(data.songs) && data.songs[0]) {
        raw = data.songs[0];
      }
      if (!raw) {
        raw = Object.values(data).find(
          (v: any) =>
            v &&
            typeof v === "object" &&
            (v.id === cleanId ||
              Boolean(v.encrypted_media_url) ||
              Boolean(v.more_info?.encrypted_media_url)),
        );
      }
      if (!raw) continue;

      const encryptedUrl = raw.encrypted_media_url || raw.more_info?.encrypted_media_url;
      if (!encryptedUrl) continue;

      const mediaUrl = decryptSaavnMediaUrl(encryptedUrl, quality);
      if (!mediaUrl) continue;

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
    } catch {
      // try next endpoint
    }
  }

  console.warn(`[Saavn] Failed to resolve song ID "${cleanId}" across endpoints`);
  return null;
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
  quality: "saver" | "standard" | "high" = "high",
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
    const targetSuffix =
      quality === "saver" ? "_96.mp4" : quality === "standard" ? "_160.mp4" : "_320.mp4";
    const mediaUrl = best.playbackSource.url.replace(/_(?:96|160|320)\.mp4/, targetSuffix);
    return {
      url: mediaUrl,
      mimeType: "audio/mp4",
      source: "saavn",
      title: best.title,
      artist: best.artist,
      duration: best.durationSeconds,
    };
  }

  return null;
}

// In-memory cache for launch data (10-minute TTL)
let launchDataCache: {
  key: string;
  timestamp: number;
  data: any;
} | null = null;

export function clearSaavnLaunchDataCache(): void {
  launchDataCache = null;
}

export async function fetchSaavnLaunchData(languages: string[] = [], bypassCache = false): Promise<any> {
  const normLangs = languages.map((l) => l.toLowerCase().trim()).filter(Boolean);
  const key = normLangs.sort().join(",") || "all";
  const now = Date.now();

  if (!bypassCache && launchDataCache && launchDataCache.key === key && now - launchDataCache.timestamp < 10 * 60 * 1000) {
    return launchDataCache.data;
  }

  const langParam = normLangs.join(",") || "telugu,hindi,tamil";
  const url = `https://www.jiosaavn.com/api.php?__call=webapi.getLaunchData&api_version=4&_format=json&_marker=0&ctx=web6dot0&languages=${encodeURIComponent(langParam)}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json",
        Referer: "https://www.jiosaavn.com/",
        cookie: `L=${encodeURIComponent(langParam)}`,
      },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    launchDataCache = { key, timestamp: now, data };
    return data;
  } catch (err) {
    console.warn("[Saavn] Failed to fetch launch data:", err);
    return null;
  }
}

function getNonceSeed(nonce?: string | number): number {
  if (typeof nonce === "number") {
    return Math.abs(Math.floor(nonce));
  }
  if (!nonce) return 0;
  let hash = 0;
  const str = String(nonce);
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function rotateArray<T>(arr: T[], offset: number): T[] {
  if (arr.length <= 1) return arr;
  const normalizedOffset = ((offset % arr.length) + arr.length) % arr.length;
  if (normalizedOffset === 0) return arr;
  return [...arr.slice(normalizedOffset), ...arr.slice(0, normalizedOffset)];
}

/**
 * Fetches official New Releases directly from JioSaavn's launch feed.
 * Guaranteed 100% pure original tracks with direct CDN audio.
 */
export async function getSaavnNewReleases(
  languages: string[] = [],
  limit = 45,
  refreshNonce?: string | number,
  page = 1,
): Promise<UnifiedTrack[]> {
  const normLangs = languages.map((l) => l.toLowerCase().trim()).filter(Boolean);
  const userLangs = normLangs.length > 0 ? normLangs : ["telugu", "hindi", "tamil"];
  const year = new Date().getFullYear();
  const tracks: UnifiedTrack[] = [];
  const seen = new Set<string>();
  const safePage = Math.max(1, Math.floor(page || 1));
  const bypassCache = Boolean(refreshNonce) || safePage > 1;

  // 1. Fetch launch data for new_albums on early pages
  try {
    const data = await fetchSaavnLaunchData(languages, bypassCache);
    const newAlbums: any[] = Array.isArray(data?.new_albums) ? data.new_albums : [];
    const albumOffset = ((safePage - 1) * 6) % Math.max(1, newAlbums.length || 1);
    const pagedAlbums = newAlbums.slice(albumOffset, albumOffset + 6);

    // Fetch songs from target new albums in parallel with timeout
    const albumTasks = pagedAlbums.map(async (alb) => {
      if (!alb?.id) return [];
      try {
        const albumUrl = `https://www.jiosaavn.com/api.php?__call=content.getAlbumDetails&albumid=${encodeURIComponent(alb.id)}&_format=json&_marker=0&api_version=4&ctx=web6dot0`;
        const res = await fetch(albumUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0",
            Accept: "application/json",
            Referer: "https://www.jiosaavn.com/",
          },
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return [];
        const albumData = await res.json();
        const songs: any[] = Array.isArray(albumData?.list) ? albumData.list : [];
        const resTracks: UnifiedTrack[] = [];
        for (const s of songs) {
          const unified = mapSaavnSongToUnified(s);
          if (unified && unified.playbackSource && isOriginalSong(unified) && !isOldEraTrack(unified)) {
            resTracks.push(unified);
          }
        }
        return resTracks;
      } catch {
        return [];
      }
    });

    const albumResults = await Promise.allSettled(albumTasks);
    for (const r of albumResults) {
      if (r.status === "fulfilled") {
        for (const t of r.value) {
          if (tracks.length >= limit) break;
          if (!seen.has(t.id)) {
            seen.add(t.id);
            tracks.push(t);
          }
        }
      }
    }
  } catch {}

  // 2. Supplement with targeted release query rotation across user languages
  if (tracks.length < limit) {
    const searchQueries: string[] = [];
    const queryBuckets = [
      (l: string) => `${l} latest new hit songs ${year}`,
      (l: string) => `${l} new release songs ${year}`,
      (l: string) => `latest ${l} movie songs ${year}`,
      (l: string) => `${l} top new songs ${year}`,
      (l: string) => `new ${l} albums ${year}`,
      (l: string) => `${l} latest cinema hits ${year}`,
      (l: string) => `${l} fresh hit songs ${year}`,
    ];

    for (const l of userLangs.slice(0, 3)) {
      const qIndex = (safePage - 1) % queryBuckets.length;
      const fn1 = queryBuckets[qIndex];
      const fn2 = queryBuckets[(qIndex + 1) % queryBuckets.length];
      if (fn1) searchQueries.push(fn1(l));
      if (fn2) searchQueries.push(fn2(l));
    }

    const searchTasks = searchQueries.map((q) => searchSaavn(q, { limit: 20, page: safePage }));
    const searchResults = await Promise.allSettled(searchTasks);
    for (const r of searchResults) {
      if (r.status === "fulfilled") {
        for (const t of r.value) {
          if (tracks.length >= limit) break;
          if (!seen.has(t.id) && isOriginalSong(t) && !isOldEraTrack(t)) {
            seen.add(t.id);
            tracks.push(t);
          }
        }
      }
    }
  }

  return tracks.slice(0, limit);
}

/**
 * Fetches official Trending Songs / Top 50 Charts directly from JioSaavn.
 * Guaranteed 100% pure original hit tracks with direct CDN audio.
 * Preserves genuine chart rankings without random shuffling or timestamp rotation.
 */
export async function getSaavnTrendingSongs(
  languages: string[] = [],
  limit = 50,
  refreshNonce?: string | number,
  page = 1,
): Promise<UnifiedTrack[]> {
  const normLangs = languages.map((l) => l.toLowerCase().trim()).filter(Boolean);
  const tracks: UnifiedTrack[] = [];
  const seen = new Set<string>();
  const safePage = Math.max(1, Math.floor(page || 1));
  const bypassCache = Boolean(refreshNonce) || safePage > 1;

  // 1. Fetch official launch charts from JioSaavn
  try {
    const data = await fetchSaavnLaunchData(languages, bypassCache);
    const charts: any[] = Array.isArray(data?.charts) ? data.charts : [];

    // Find candidate charts matching user languages
    const candidateCharts: any[] = [];
    if (normLangs.length > 0) {
      for (const c of charts) {
        const title = String(c.title || "").toLowerCase();
        if (normLangs.some((lang) => title.includes(lang))) {
          candidateCharts.push(c);
        }
      }
    }
    for (const c of charts) {
      if (!candidateCharts.some((existing) => existing.id === c.id)) {
        candidateCharts.push(c);
      }
    }

    // On safePage 1, fetch top charts; on safePage > 1, rotate chart selection
    const chartOffset = ((safePage - 1) * 2) % Math.max(1, candidateCharts.length || 1);
    const targetCharts = [
      ...candidateCharts.slice(chartOffset, chartOffset + 3),
      ...candidateCharts.slice(0, chartOffset),
    ].slice(0, 4);

    // Fetch playlist details from candidate charts in official chart order
    for (const chart of targetCharts) {
      if (tracks.length >= limit) break;
      if (!chart?.id) continue;
      try {
        const playlistUrl = `https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=${encodeURIComponent(chart.id)}&_format=json&_marker=0&api_version=4&ctx=web6dot0`;
        const res = await fetch(playlistUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            Accept: "application/json",
            Referer: "https://www.jiosaavn.com/",
          },
          signal: AbortSignal.timeout(9000),
        });
        if (res.ok) {
          const playlistData = await res.json();
          const songs: any[] = Array.isArray(playlistData?.list) ? playlistData.list : [];
          // On safePage > 1, slice offset deeper into the playlist so deeper chart positions are discovered
          const songOffset = safePage === 1 ? 0 : ((safePage - 1) * 12) % Math.max(1, songs.length || 1);
          const pagedSongs = songs.length > 15 ? [...songs.slice(songOffset), ...songs.slice(0, songOffset)] : songs;
          for (const s of pagedSongs) {
            if (tracks.length >= limit) break;
            const unified = mapSaavnSongToUnified(s);
            if (unified && unified.playbackSource && isOriginalSong(unified)) {
              if (!seen.has(unified.id)) {
                seen.add(unified.id);
                tracks.push(unified);
              }
            }
          }
        }
      } catch (err) {
        console.warn("[Saavn] Failed to fetch chart playlist:", err);
      }
    }
  } catch {}

  // If we already have enough official chart tracks on page 1, return them
  if (tracks.length >= Math.min(30, limit) && safePage === 1) {
    return tracks.slice(0, limit);
  }

  // Supplement with language-aware chart queries with real pagination
  const userLangs = languages.length > 0 ? languages : ["Telugu", "Hindi", "Tamil"];
  const trendingQueryBuckets = [
    (l: string) => `Top 50 ${l} songs`,
    (l: string) => `${l} top trending hit songs`,
    (l: string) => `${l} viral hits chart`,
    (l: string) => `latest trending ${l} hits`,
    (l: string) => `${l} most popular songs`,
    (l: string) => `${l} chartbusters hits`,
    (l: string) => `trending ${l} songs`,
  ];

  const queriesToRun: string[] = [];
  for (const lang of userLangs) {
    const bucketIndex = (safePage - 1) % trendingQueryBuckets.length;
    const bucketFn = trendingQueryBuckets[bucketIndex] || trendingQueryBuckets[0];
    if (bucketFn) {
      queriesToRun.push(bucketFn(lang));
    }
    // Only include Top 50 explicitly on page 1; on deeper pages, explore alternative chart queries
    if (safePage === 1) {
      queriesToRun.push(`Top 50 ${lang} songs`);
    } else {
      const altFn = trendingQueryBuckets[(bucketIndex + 1) % trendingQueryBuckets.length];
      if (altFn) queriesToRun.push(altFn(lang));
    }
  }

  const queryTasks = queriesToRun.map((q) => searchSaavn(q, { limit: 30, page: safePage }));
  const queryResults = await Promise.allSettled(queryTasks);

  for (const r of queryResults) {
    if (r.status === "fulfilled") {
      for (const t of r.value) {
        if (tracks.length >= limit) break;
        if (!seen.has(t.id) && isOriginalSong(t)) {
          seen.add(t.id);
          tracks.push(t);
        }
      }
    }
  }

  return tracks.slice(0, limit);
}

/**
 * Fetches official 2000s Era ("20's") Nostalgia Classics directly from JioSaavn.
 * Focuses strictly on 2000s melody and superhit classics, avoiding ancient 50s-70s vintage tracks.
 */
export async function getSaavnOldSongs(
  languages: string[] = [],
  limit = 45,
  refreshNonce?: string | number,
  page = 1,
): Promise<UnifiedTrack[]> {
  const normLangs = languages.map((l) => l.toLowerCase().trim()).filter(Boolean);
  const userLangs = normLangs.length > 0 ? normLangs : ["telugu", "hindi"];
  const safePage = Math.max(1, Math.floor(page || 1));

  const NOSTALGIA_2000S_BY_LANG: Record<string, string[]> = {
    telugu: [
      "Telugu 2000s hit songs",
      "Telugu 2000s super hit melodies",
      "Mani Sharma 2000s Telugu hits",
      "Devi Sri Prasad 2000s Telugu hits",
      "Harris Jayaraj Telugu hits 2000s",
      "RP Patnaik Chakri 2000s hits",
      "Telugu 2000s love songs",
      "Best of 2000 to 2010 Telugu hits",
      "Telugu 2000s evergreen melodies",
    ],
    hindi: [
      "Bollywood 2000s hit songs",
      "Best of 2000s Hindi songs",
      "Pritam 2000s hit songs",
      "KK 2000s evergreen hit songs",
      "Hindi 2000s romantic melodies",
      "Emraan Hashmi 2000s hit songs",
      "Mohit Chauhan 2000s hits",
      "Sonu Nigam 2000s Bollywood hits",
      "Udit Narayan Alka Yagnik 2000s hits",
      "2000 to 2010 Bollywood super hits",
    ],
    tamil: [
      "Tamil 2000s hit songs",
      "Harris Jayaraj 2000s Tamil hits",
      "Yuvan Shankar Raja 2000s hits",
      "AR Rahman 2000s Tamil hits",
      "Vidyasagar Tamil 2000s hits",
      "Tamil 2000 to 2010 melody hits",
      "Best of 2000s Tamil love songs",
    ],
    malayalam: [
      "Malayalam 2000s hit songs",
      "Vidyasagar Malayalam 2000s hits",
      "Deepak Dev 2000s Malayalam hits",
      "Malayalam 2000 to 2010 melody songs",
    ],
    kannada: [
      "Kannada 2000s hit songs",
      "Mano Murthy 2000s Kannada hits",
      "Gurukiran 2000s Kannada hits",
      "Kannada 2000 to 2010 super hits",
    ],
    punjabi: [
      "Punjabi 2000s hit songs",
      "Bally Sagoo Sukhbir 2000s hits",
      "Stereo Nation 2000s Punjabi hits",
      "Punjabi 2000 to 2010 pop hits",
    ],
    english: [
      "2000s pop rock hits",
      "Best 2000s songs",
      "2000 to 2010 greatest hits",
      "Coldplay Linkin Park 2000s hits",
      "Backstreet Boys Westlife 2000s hits",
    ],
  };

  const queries: string[] = [];
  for (const lang of userLangs) {
    const rawPool = NOSTALGIA_2000S_BY_LANG[lang] || [`${lang} 2000s hit songs`];
    const offset = ((safePage - 1) * 3) % rawPool.length;
    const q1 = rawPool[offset] || rawPool[0];
    const q2 = rawPool[(offset + 1) % rawPool.length];
    const q3 = rawPool[(offset + 2) % rawPool.length];
    if (q1) queries.push(q1);
    if (q2) queries.push(q2);
    if (q3) queries.push(q3);
  }

  const tracks: UnifiedTrack[] = [];
  const seen = new Set<string>();

  // Fetch 2000s nostalgia queries concurrently in parallel with pagination
  const searchTasks = queries.map((q) => searchSaavn(q, { limit: 15, page: safePage }));
  const searchResults = await Promise.allSettled(searchTasks);

  for (const r of searchResults) {
    if (r.status === "fulfilled") {
      for (const t of r.value) {
        if (tracks.length >= limit) break;
        if (!seen.has(t.id) && isOriginalSong(t) && isOldEraTrack(t)) {
          seen.add(t.id);
          tracks.push(t);
        }
      }
    }
  }

  return tracks.slice(0, limit);
}
