import type { Track } from "./types";
import { createLruCache } from "./lru-cache";
import {
  isMusicTrack,
  isPodcastTrack,
  parseDurationSeconds,
  NON_MUSIC_KEYWORDS,
  JUNK_MEDIA_KEYWORDS,
} from "./track-filters";

export type { Track };

type AnyRecord = Record<string, unknown>;

function collectVideoRenderers(node: unknown, out: AnyRecord[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectVideoRenderers(item, out);
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as AnyRecord;
    if (obj["videoRenderer"]) out.push(obj["videoRenderer"] as AnyRecord);
    for (const value of Object.values(obj)) collectVideoRenderers(value, out);
  }
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

/** Rate limiter: allows up to 180 requests per minute with sliding window */
const searchTimestamps: number[] = [];
const MAX_SEARCH_PER_MINUTE = 180;

function checkSearchRateLimit(): boolean {
  const now = Date.now();
  while (searchTimestamps.length > 0 && now - searchTimestamps[0]! > 60_000) {
    searchTimestamps.shift();
  }
  if (searchTimestamps.length >= MAX_SEARCH_PER_MINUTE) {
    return false;
  }
  searchTimestamps.push(now);
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
): Promise<AnyRecord | null> {
  try {
    const res = await fetch("https://www.youtube.com/youtubei/v1/search?prettyPrint=false", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      body: JSON.stringify({
        context: { client: WEB_CLIENT },
        query: searchQuery,
        ...(params ? { params } : {}),
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as AnyRecord;
  } catch {
    return null;
  }
}

/** Scrapes/Queries YouTube search results — cached for 30 minutes. */
export async function searchYouTube(
  query: string,
  limit = 20,
  musicOnly = true,
  upload?: UploadRange,
  bypassCache = false,
): Promise<Track[]> {
  const cacheKey = `yt:${query}:${limit}:${musicOnly}:${upload ?? ""}`;
  if (!bypassCache) {
    const cached = searchCache.get(cacheKey);
    if (cached && cached.length >= Math.min(limit, 10)) return cached;
  }

  const inFlight = inFlightSearches.get(cacheKey);
  if (inFlight && !bypassCache) return inFlight;

  const searchPromise = (async (): Promise<Track[]> => {
    if (!checkSearchRateLimit()) {
      return searchCache.get(cacheKey) ?? [];
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
        if (!res.ok) return [];

        const html = await res.text();
        const jsonMatch = html.match(/ytInitialData\s*=\s*({.+?});\s*<\/script>/s);
        if (!jsonMatch?.[1]) return [];
        data = JSON.parse(jsonMatch[1]) as AnyRecord;
      }

      const renderers: AnyRecord[] = [];
      collectVideoRenderers(data, renderers);

      const seen = new Set<string>();
      const tracks: Track[] = [];

      const allowLong =
        cleanQ.includes("jukebox") ||
        cleanQ.includes("album") ||
        cleanQ.includes("collection") ||
        cleanQ.includes("top 50") ||
        cleanQ.includes("hits");

      for (const r of renderers) {
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

        if (musicOnly) {
          if (!isMusicTrack(candidateTrack, allowLong)) continue;
          const lowerArtist = artist.toLowerCase();
          if (NON_MUSIC_KEYWORDS.some((w) => lowerArtist.includes(w))) continue;
          if (JUNK_MEDIA_KEYWORDS.some((w) => lowerArtist.includes(w))) continue;
        } else {
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
        if (tracks.length >= limit) break;
      }

      // If upload filter returned 0 tracks, retry without it
      if (tracks.length === 0 && upload) {
        return await searchYouTube(query, limit, musicOnly, undefined, bypassCache);
      }

      if (tracks.length > 0) {
        searchCache.set(cacheKey, tracks);
      }
      return tracks;
    } catch {
      return [];
    }
  })();

  inFlightSearches.set(cacheKey, searchPromise);
  try {
    return await searchPromise;
  } finally {
    inFlightSearches.delete(cacheKey);
  }
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
