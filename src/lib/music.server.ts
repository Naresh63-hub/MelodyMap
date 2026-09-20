import type { Track } from "./types";
import { createLruCache } from "./lru-cache";
import { getRequestClientIp } from "./request-context.server";
import {
  isMusicTrack,
  isPodcastTrack,
  parseDurationSeconds,
  NON_MUSIC_KEYWORDS,
  JUNK_MEDIA_KEYWORDS,
} from "./track-filters";

export type { Track };

type AnyRecord = Record<string, unknown>;

export type SearchFilter = "all" | "songs" | "artists" | "albums" | "playlists";

export const SEARCH_FILTER_PARAMS: Record<SearchFilter, string | undefined> = {
  all: undefined,
  songs: "EgIQAQ%253D%253D",
  artists: "EgIQBA%253D%253D",
  playlists: "EgIQAw%253D%253D",
  albums: "EgIQAw%253D%253D",
};

function collectSearchRenderers(node: unknown, out: AnyRecord[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectSearchRenderers(item, out);
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as AnyRecord;
    if (obj["videoRenderer"]) {
      out.push({ _rendererType: "video", ...(obj["videoRenderer"] as AnyRecord) });
    } else if (obj["compactVideoRenderer"]) {
      out.push({ _rendererType: "video", ...(obj["compactVideoRenderer"] as AnyRecord) });
    } else if (obj["playlistRenderer"]) {
      out.push({ _rendererType: "playlist", ...(obj["playlistRenderer"] as AnyRecord) });
    } else if (obj["channelRenderer"]) {
      out.push({ _rendererType: "channel", ...(obj["channelRenderer"] as AnyRecord) });
    }
    for (const value of Object.values(obj)) collectSearchRenderers(value, out);
  }
}

function collectVideoRenderers(node: unknown, out: AnyRecord[]): void {
  collectSearchRenderers(node, out);
}

function text(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const obj = node as AnyRecord;
  if (typeof obj["simpleText"] === "string") return obj["simpleText"] as string;
  const runs = obj["runs"];
  if (Array.isArray(runs)) {
    return runs.map((r) => (r as AnyRecord)["text"] ?? "").join("");
  }
  return "";
}

/** YouTube "Music" category filter — keeps results to songs, not vlogs/interviews. */
const MUSIC_FILTER = "EgWKAQIYAWoKEAoQAxAEEAkQBQ%253D%253D";
const VIDEO_FILTER = "EgIQAQ%253D%253D";

/** Upload-date filters — only videos published today / this week. */
const UPLOAD_FILTERS = {
  today: "EgQIARAB",
  week: "EgQIBRAB",
} as const;

export type UploadRange = keyof typeof UPLOAD_FILTERS;

/** High-capacity in-memory LRU cache for search results. 30-minute sliding TTL. */
const searchCache = createLruCache<Track[]>(500, 30 * 60 * 1000);
const inFlightSearches = new Map<string, Promise<Track[]>>();

/**
 * Rate limiter: sliding-window counters per key. Two keys are checked per
 * search — a per-IP bucket (fed from request context) and a global cap that
 * protects the upstream catalog regardless of source.
 */
const searchTimestamps = new Map<string, number[]>();
const MAX_SEARCH_PER_MINUTE_GLOBAL = 180;
const MAX_SEARCH_PER_MINUTE_PER_IP = 60;
let rateLimitSweepAt = 0;

function checkSearchRateLimit(key: string, max: number): boolean {
  const now = Date.now();
  if (now - rateLimitSweepAt > 60_000) {
    rateLimitSweepAt = now;
    for (const [k, hits] of searchTimestamps) {
      const alive = hits.filter((t) => now - t < 60_000);
      if (alive.length === 0) searchTimestamps.delete(k);
      else searchTimestamps.set(k, alive);
    }
  }
  const hits = (searchTimestamps.get(key) ?? []).filter((t) => now - t < 60_000);
  if (hits.length >= max) {
    searchTimestamps.set(key, hits);
    return false;
  }
  hits.push(now);
  searchTimestamps.set(key, hits);
  return true;
}

/** Autocomplete suggestions straight from YouTube's suggest service. */
export async function suggestQueries(query: string): Promise<string[]> {
  const url = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&hl=en&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return [];
    const body = await res.text();
    const json = body.slice(body.indexOf("(") + 1, body.lastIndexOf(")"));
    const parsed = JSON.parse(json) as [string, Array<[string, ...unknown[]]>];
    return (parsed[1] ?? []).map((entry) => entry[0]).filter(Boolean).slice(0, 8);
  } catch {
    return [];
  }
}

const WEB_CLIENT = { clientName: "WEB", clientVersion: "2.20240801.00.00", hl: "en", gl: "US" };

/** InnerTube API search query */
async function searchWithInnerTube(
  searchQuery: string,
  params?: string,
  continuation?: string,
): Promise<AnyRecord | null> {
  try {
    const res = await fetch("https://www.youtube.com/youtubei/v1/search?prettyPrint=false", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      body: JSON.stringify(
        continuation
          ? {
              context: { client: WEB_CLIENT },
              continuation,
            }
          : {
              context: { client: WEB_CLIENT },
              query: searchQuery,
              ...(params ? { params } : {}),
            },
      ),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as AnyRecord;
  } catch {
    return null;
  }
}

/** Recursively extracts the InnerTube continuation token if present */
function extractContinuation(node: unknown): string | undefined {
  if (!node) return undefined;
  if (Array.isArray(node)) {
    for (const item of node) {
      const token = extractContinuation(item);
      if (token) return token;
    }
    return undefined;
  }
  if (typeof node === "object") {
    const obj = node as AnyRecord;
    const contRenderer = obj["continuationItemRenderer"] as AnyRecord | undefined;
    if (contRenderer) {
      const endpoint = contRenderer["continuationEndpoint"] as AnyRecord | undefined;
      const command = endpoint?.["continuationCommand"] as AnyRecord | undefined;
      if (typeof command?.["token"] === "string") {
        return command["token"];
      }
    }
    for (const val of Object.values(obj)) {
      const token = extractContinuation(val);
      if (token) return token;
    }
  }
  return undefined;
}

/** Shared conversion loop from raw video/channel/playlist renderers to validated Track items */
function renderersToTracks(
  renderers: AnyRecord[],
  options: { musicOnly: boolean; allowLong: boolean; filter?: SearchFilter },
  seen: Set<string>,
  tracks: Track[],
  cap?: number,
): void {
  for (const r of renderers) {
    if (cap && tracks.length >= cap) break;
    const rendererType = (r["_rendererType"] as string) || "video";

    if (rendererType === "channel") {
      const id = (r["channelId"] as string) || "";
      if (!id || seen.has(id)) continue;
      const title = text(r["title"]).trim();
      if (!title) continue;
      const subs = text(r["subscriberCountText"]).trim() || text(r["videoCountText"]).trim() || "Artist";
      const thumbs = ((r["thumbnail"] as AnyRecord | undefined)?.["thumbnails"] ?? []) as AnyRecord[];
      seen.add(id);
      tracks.push({
        id,
        title,
        artist: subs,
        duration: "Artist",
        thumbnail:
          (thumbs[thumbs.length - 1]?.["url"] as string | undefined) ??
          `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      });
      continue;
    }

    if (rendererType === "playlist") {
      const id = (r["playlistId"] as string) || "";
      if (!id || seen.has(id)) continue;
      const title = text(r["title"]).trim();
      if (!title) continue;
      const byline =
        text(r["shortBylineText"]).trim() ||
        text(r["longBylineText"]).trim() ||
        "Playlist";
      const videoCount = text(r["videoCount"]).trim() || text(r["videoCountShortText"]).trim() || "Playlist";
      const thumbs = ((r["thumbnails"] ?? (r["thumbnail"] as AnyRecord | undefined)?.["thumbnails"]) ?? []) as AnyRecord[];
      seen.add(id);
      tracks.push({
        id,
        title,
        artist: byline,
        duration:
          videoCount.includes("track") || videoCount.includes("song") || videoCount.includes("video")
            ? videoCount
            : `${videoCount} songs`,
        thumbnail:
          (thumbs[thumbs.length - 1]?.["url"] as string | undefined) ??
          `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      });
      continue;
    }

    const id = r["videoId"] as string | undefined;
    if (!id || seen.has(id)) continue;

    const title = text(r["title"]).trim();
    const artist =
      text(r["ownerText"]).trim() ||
      text(r["shortBylineText"]).trim() ||
      text(r["longBylineText"]).trim() ||
      "";
    const duration = text(r["lengthText"]).trim();
    if (!title) continue;

    const candidateTrack = { title, artist, duration };

    if (
      options.musicOnly &&
      options.filter !== "artists" &&
      options.filter !== "playlists" &&
      options.filter !== "albums"
    ) {
      if (!isMusicTrack(candidateTrack, options.allowLong)) continue;
      const lowerArtist = artist.toLowerCase();
      if (NON_MUSIC_KEYWORDS.some((w) => lowerArtist.includes(w))) continue;
      if (JUNK_MEDIA_KEYWORDS.some((w) => lowerArtist.includes(w))) continue;
    } else if (!options.musicOnly) {
      if (!isPodcastTrack(candidateTrack)) continue;
    }

    const thumbs = ((r["thumbnail"] as AnyRecord | undefined)?.["thumbnails"] ?? []) as AnyRecord[];
    seen.add(id);

    tracks.push({
      id,
      title,
      artist,
      duration,
      thumbnail:
        (thumbs[thumbs.length - 1]?.["url"] as string | undefined) ??
        `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    });
  }
}

export type SearchPageResult = {
  tracks: Track[];
  continuation?: string | undefined;
};

/**
 * Queries YouTube with filter support and pagination continuation.
 */
export async function searchYouTubePaginated(
  query: string,
  filter: SearchFilter = "all",
  continuation?: string,
  limit = 20,
): Promise<SearchPageResult> {
  if (continuation) {
    try {
      const data = await searchWithInnerTube("", undefined, continuation);
      if (!data) return { tracks: [] };

      const renderers: AnyRecord[] = [];
      collectSearchRenderers(data, renderers);

      const seen = new Set<string>();
      const tracks: Track[] = [];
      renderersToTracks(
        renderers,
        { musicOnly: filter === "all" || filter === "songs", allowLong: false, filter },
        seen,
        tracks,
        limit,
      );

      const nextToken = extractContinuation(data);
      return { tracks, continuation: nextToken };
    } catch {
      return { tracks: [] };
    }
  }

  const cleanQ = query.toLowerCase();
  let filterParam = SEARCH_FILTER_PARAMS[filter];
  if (!filterParam && filter === "all") {
    filterParam = !cleanQ.includes("podcast") ? MUSIC_FILTER : VIDEO_FILTER;
  }

  const isExplicitMusicOrAudio =
    cleanQ.includes("song") ||
    cleanQ.includes("audio") ||
    cleanQ.includes("track") ||
    cleanQ.includes("music") ||
    cleanQ.includes("lyrics") ||
    cleanQ.includes("jukebox");

  const searchQuery =
    (filter === "all" || filter === "songs") && !isExplicitMusicOrAudio
      ? `${query} song`
      : filter === "albums"
        ? `${query} album`
        : query;

  const allowLong =
    cleanQ.includes("jukebox") ||
    cleanQ.includes("album") ||
    cleanQ.includes("collection") ||
    cleanQ.includes("top 50") ||
    cleanQ.includes("hits");

  try {
    let data: AnyRecord | null = await searchWithInnerTube(searchQuery, filterParam);
    if (!data && filterParam) {
      data = await searchWithInnerTube(searchQuery);
    }
    if (!data) return { tracks: [] };

    const renderers: AnyRecord[] = [];
    collectSearchRenderers(data, renderers);

    const seen = new Set<string>();
    const tracks: Track[] = [];
    renderersToTracks(
      renderers,
      { musicOnly: filter === "all" || filter === "songs", allowLong, filter },
      seen,
      tracks,
      limit,
    );

    const nextToken = extractContinuation(data);
    return { tracks, continuation: nextToken };
  } catch {
    return { tracks: [] };
  }
}

/**
 * Automatically fetches up to targetCount items across multiple continuation pages.
 */
export async function searchYouTubeDeep(
  query: string,
  targetCount = 50,
  filter: SearchFilter = "songs",
): Promise<Track[]> {
  const seen = new Set<string>();
  const tracks: Track[] = [];

  let res = await searchYouTubePaginated(query, filter, undefined, targetCount);
  for (const t of res.tracks) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      tracks.push(t);
    }
  }

  let page = 0;
  let continuation = res.continuation;
  while (tracks.length < targetCount && continuation && page < 5) {
    page++;
    res = await searchYouTubePaginated(query, filter, continuation, targetCount);
    for (const t of res.tracks) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        tracks.push(t);
        if (tracks.length >= targetCount) break;
      }
    }
    continuation = res.continuation;
  }

  return tracks;
}

/** Fetches a single page of YouTube search results via continuation token */
export async function searchYouTubePage(
  continuation: string,
  musicOnly = true,
  allowLong = false,
): Promise<SearchPageResult> {
  return searchYouTubePaginated("", musicOnly ? "songs" : "all", continuation);
}

/** Queries YouTube search with automatic multi-page expansion and returns continuation token */
export async function searchYouTubeWithPage(
  query: string,
  limit = 20,
  musicOnly = true,
  upload?: UploadRange,
  bypassCache = false,
): Promise<SearchPageResult> {
  const cacheKey = `yt:${query}:${limit}:${musicOnly}:${upload ?? ""}`;
  if (!bypassCache) {
    const cached = searchCache.get(cacheKey);
    if (cached && cached.length >= Math.min(limit, 10)) {
      return { tracks: cached };
    }
  }

  const inFlight = inFlightSearches.get(cacheKey);
  if (inFlight && !bypassCache) {
    const cachedTracks = await inFlight;
    return { tracks: cachedTracks };
  }

  const searchPromise = (async (): Promise<SearchPageResult> => {
    const clientIp = getRequestClientIp();
    const rateLimited =
      !checkSearchRateLimit(`ip:${clientIp}`, MAX_SEARCH_PER_MINUTE_PER_IP) ||
      !checkSearchRateLimit("global", MAX_SEARCH_PER_MINUTE_GLOBAL);
    if (rateLimited) {
      return { tracks: searchCache.get(cacheKey) ?? [] };
    }

    const cleanQ = query.toLowerCase();
    const isExplicitMusicOrAudio =
      cleanQ.includes("song") ||
      cleanQ.includes("audio") ||
      cleanQ.includes("track") ||
      cleanQ.includes("music") ||
      cleanQ.includes("lyrics") ||
      cleanQ.includes("jukebox");

    const searchQuery = musicOnly
      ? isExplicitMusicOrAudio
        ? query
        : `${query} song`
      : query;

    let filterParam: string | undefined = upload ? UPLOAD_FILTERS[upload] : undefined;
    if (!filterParam) {
      filterParam = musicOnly && !cleanQ.includes("podcast") ? MUSIC_FILTER : VIDEO_FILTER;
    }

    const allowLong =
      cleanQ.includes("jukebox") ||
      cleanQ.includes("album") ||
      cleanQ.includes("collection") ||
      cleanQ.includes("top 50") ||
      cleanQ.includes("hits");

    try {
      let data: AnyRecord | null = await searchWithInnerTube(searchQuery, filterParam);

      if (!data && filterParam !== VIDEO_FILTER) {
        data = await searchWithInnerTube(searchQuery, VIDEO_FILTER);
      }

      if (!data) {
        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(
          searchQuery,
        )}${filterParam ? `&sp=${filterParam}` : ""}`;

        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
          },
          signal: AbortSignal.timeout(8_000),
        });
        if (!res.ok) return { tracks: [] };

        const html = await res.text();
        const jsonMatch = html.match(/ytInitialData\s*=\s*({.+?});\s*<\/script>/s);
        if (!jsonMatch?.[1]) return { tracks: [] };
        data = JSON.parse(jsonMatch[1]) as AnyRecord;
      }

      const renderers: AnyRecord[] = [];
      collectVideoRenderers(data, renderers);

      const seen = new Set<string>();
      const tracks: Track[] = [];
      renderersToTracks(renderers, { musicOnly, allowLong }, seen, tracks, limit);

      let nextContinuation = extractContinuation(data);

      // Follow continuation tokens if more results are requested and available
      let page = 0;
      while (tracks.length < limit && nextContinuation && page < 4) {
        page++;
        const nextPage = await searchYouTubePage(nextContinuation, musicOnly, allowLong);
        for (const t of nextPage.tracks) {
          if (!seen.has(t.id)) {
            seen.add(t.id);
            tracks.push(t);
            if (tracks.length >= limit) break;
          }
        }
        nextContinuation = nextPage.continuation;
      }

      // If upload filter returned 0 tracks, retry without it
      if (tracks.length === 0 && upload) {
        return await searchYouTubeWithPage(query, limit, musicOnly, undefined, bypassCache);
      }

      if (tracks.length > 0) {
        searchCache.set(cacheKey, tracks);
      }
      return { tracks, continuation: nextContinuation };
    } catch {
      return { tracks: [] };
    }
  })();

  inFlightSearches.set(
    cacheKey,
    searchPromise.then((r) => r.tracks),
  );
  try {
    return await searchPromise;
  } finally {
    inFlightSearches.delete(cacheKey);
  }
}

/** Scrapes/Queries YouTube search results — cached for 30 minutes. Backward-compatible wrapper. */
export async function searchYouTube(
  query: string,
  limit = 20,
  musicOnly = true,
  upload?: UploadRange,
  bypassCache = false,
): Promise<Track[]> {
  const res = await searchYouTubeWithPage(query, limit, musicOnly, upload, bypassCache);
  return res.tracks;
}

// ─── Track metadata enrichment (ytdl-core) ───────────────────────────

export type TrackDetails = {
  /** Canonical song title from YouTube's music knowledge graph. */
  song: string | null;
  /** Artist / channel name. */
  artist: string;
  /** Album or single name. */
  album: string | null;
  /** Release year. */
  year: number | null;
  /** Record label / licensing info. */
  licensedBy: string | null;
  /** High-res thumbnail URL. */
  thumbnail: string;
  /** Duration in seconds. */
  durationSeconds: number;
  /** Whether the video is a live stream. */
  isLive: boolean;
  /** View count (string, e.g. "123456789"). */
  viewCount: string;
};

/**
 * Fetch detailed metadata for a YouTube video using ytdl-core's getBasicInfo.
 */
export async function getTrackDetails(videoId: string): Promise<TrackDetails | null> {
  const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{1,32}$/;
  if (!videoId || !VIDEO_ID_REGEX.test(videoId)) {
    return null;
  }
  try {
    const { default: youtubedl } = await import("youtube-dl-exec");
    const output = await youtubedl(`https://www.youtube.com/watch?v=${videoId}`, {
      dumpJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      skipDownload: true,
      addHeader: [
        "referer:youtube.com",
        "user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ],
    });

    const info = output as any;

    return {
      song: info.track || info.title || null,
      artist: info.artist || info.channel || info.uploader || "Unknown artist",
      album: info.album || null,
      year: info.release_year || null,
      licensedBy: info.license || null,
      thumbnail: info.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      durationSeconds: Number(info.duration) || 0,
      isLive: Boolean(info.is_live),
      viewCount: String(info.view_count || "0"),
    };
  } catch (err) {
    console.warn(`[music] Failed to fetch track details for ${videoId}:`, err);
    return null;
  }
}
