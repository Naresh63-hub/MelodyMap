import type { Track } from "./types";
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
const SEARCH_CACHE_TTL = 30 * 60 * 1000;
const SEARCH_CACHE_MAX = 500;
type CacheEntry = { tracks: Track[]; at: number };
const searchCache = new Map<string, CacheEntry>();
const inFlightSearches = new Map<string, Promise<Track[]>>();

function cleanExpiredCache() {
  const now = Date.now();
  for (const [k, v] of searchCache.entries()) {
    if (now - v.at > SEARCH_CACHE_TTL) {
      searchCache.delete(k);
    }
  }
}

function getCached(key: string): Track[] | null {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > SEARCH_CACHE_TTL) {
    searchCache.delete(key);
    return null;
  }
  // Refresh LRU position
  searchCache.delete(key);
  searchCache.set(key, entry);
  return entry.tracks;
}

function setCached(key: string, tracks: Track[]) {
  cleanExpiredCache();
  // Evict oldest if still full
  while (searchCache.size >= SEARCH_CACHE_MAX) {
    const oldest = searchCache.keys().next().value;
    if (oldest) searchCache.delete(oldest);
    else break;
  }
  searchCache.set(key, { tracks, at: Date.now() });
}

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

const NON_MUSIC = [
  "podcast",
  "podcasts",
  "episode",
  "ep.",
  "ep ",
  "#ep",
  "interview",
  "reaction",
  "review",
  "vlog",
  "talk show",
  "talkshow",
  "audiobook",
  "story",
  "stories",
  "conversation",
  "discussion",
  "debate",
  "speech",
  "lecture",
  "documentary",
  "news",
  "commentary",
  "chapter",
  "session",
  "trailer",
  "teaser",
  "full movie",
  "behind the scenes",
  "making of",
  "tutorial",
  "gameplay",
  "shorts",
  "standup",
  "comedy show",
  "livestream",
  "live stream",
  "promo",
  "promotion",
];

/**
 * Long compilation videos (jukeboxes / bundles / albums / multi-song mixes).
 * Kept strictly out of music results so every track is a standalone single song.
 */
const COMPILATION = [
  "jukebox",
  "compilation",
  "non-stop",
  "nonstop",
  "mashup",
  "mega mix",
  "megamix",
  "best of",
  "greatest hits",
  "hit songs",
  "top hits",
  "top 10",
  "top 20",
  "top 30",
  "top 40",
  "top 50",
  "top 100",
  "evergreen songs",
  "superhit",
  "full album",
  "hits collection",
  "audio jukebox",
  "collection",
  "bundle",
  "all songs",
  "full ost",
  "complete ost",
  "discography",
  "medley",
  "soundtrack collection",
  "all hit songs",
  "continuous mix",
  "playlist",
  "pack",
];

function durationSeconds(text: string): number {
  const parts = text.split(":").map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

const JUNK_MEDIA = [
  "trailer",
  "teaser",
  "gameplay",
  "reaction",
  "review",
  "vlog",
  "shorts",
  "tiktok",
  "unboxing",
  "prank",
  "making of",
  "behind the scenes",
  "tutorial",
  "comedy scene",
  "funny clips",
  "status video",
  "whatsapp status",
];

const PODCAST_KEYWORDS = [
  "podcast",
  "episode",
  "ep.",
  "ep ",
  "#ep",
  "interview",
  "discussion",
  "conversation",
  "audiobook",
  "talk show",
  "talkshow",
  "series",
  "huberman",
  "rogan",
  "lex fridman",
  "beerbiceps",
  "raj shamani",
  "ranveer allahbadia",
  "prakhar",
  "samay raina",
  "audio show",
  "storytelling",
  "stories",
  "lecture",
  "documentary",
  "masterclass",
  "deep dive",
];

function looksLikePodcast(title: string, artist: string, seconds: number): boolean {
  const t = title.toLowerCase();
  const a = artist.toLowerCase();
  if (JUNK_MEDIA.some((word) => t.includes(word) || a.includes(word))) return false;
  if (seconds > 0 && seconds < 30) return false;
  if (PODCAST_KEYWORDS.some((word) => t.includes(word) || a.includes(word))) return true;
  // If not junk, accept any talk/episode content
  return true;
}

function looksLikeMusic(title: string, seconds: number): boolean {
  const t = title.toLowerCase();
  if (NON_MUSIC.some((word) => t.includes(word))) return false;
  if (COMPILATION.some((word) => t.includes(word))) return false;
  if (JUNK_MEDIA.some((word) => t.includes(word))) return false;
  // Single songs are strictly standalone tracks (45s to 8.0 minutes / 480s max).
  // Anything over 480s is a podcast, interview, or multi-song bundle.
  if (seconds > 0 && (seconds < 45 || seconds > 480)) return false;
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

/** Scrapes YouTube search results — no API key required. Cached for 30 minutes. */
export async function searchYouTube(
  query: string,
  limit = 20,
  musicOnly = true,
  upload?: UploadRange,
): Promise<Track[]> {
  const cacheKey = `yt:${query}:${limit}:${musicOnly}:${upload ?? ""}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const inFlight = inFlightSearches.get(cacheKey);
  if (inFlight) return inFlight;

  const searchPromise = (async (): Promise<Track[]> => {
    if (!checkSearchRateLimit()) {
      // Return cached query variations if available rather than empty
      return getCached(cacheKey) ?? [];
    }

    // For music, target songs specifically and exclude podcast channels
    const cleanQ = query.toLowerCase();
    const searchQuery = musicOnly
      ? cleanQ.includes("song") || cleanQ.includes("audio") || cleanQ.includes("track")
        ? query
        : `${query} song`
      : cleanQ.includes("podcast")
        ? query
        : `${query} podcast`;
    const sp = upload ? UPLOAD_FILTERS[upload] : musicOnly ? MUSIC_FILTER : VIDEO_FILTER;
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}&sp=${sp}`;

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const html = await res.text();
      const match = html.match(/ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
      if (!match?.[1]) return [];

      let data: unknown;
      try {
        data = JSON.parse(match[1]);
      } catch {
        return [];
      }

      const renderers: AnyRecord[] = [];
      collectVideoRenderers(data, renderers);

      const seen = new Set<string>();
      const tracks: Track[] = [];
      for (const r of renderers) {
        const id = r["videoId"];
        if (typeof id !== "string" || seen.has(id)) continue;
        const duration = text(r["lengthText"]);
        if (!duration) continue; // skip live streams / shorts
        const title = text(r["title"]);
        const artist = text(r["ownerText"]) || text(r["longBylineText"]) || "Unknown artist";
        const secs = durationSeconds(duration);
        if (musicOnly) {
          if (!looksLikeMusic(title, secs)) continue;
          const lowerArtist = artist.toLowerCase();
          if (NON_MUSIC.some((w) => lowerArtist.includes(w))) continue;
          if (JUNK_MEDIA.some((w) => lowerArtist.includes(w))) continue;
        } else {
          if (!looksLikePodcast(title, artist, secs)) continue;
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

      // If upload filter ("week") returned 0 tracks, retry once without the upload filter
      if (tracks.length === 0 && upload) {
        return await searchYouTube(query, limit, musicOnly, undefined);
      }

      setCached(cacheKey, tracks);
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
 *
 * YouTube's music knowledge graph often has structured song/artist/album
 * metadata that the search HTML scraping can't extract.  This is also a
 * good way to pre-warm the stream cache — calling getBasicInfo triggers
 * the same player API call that resolveStreamUrl will later use.
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
        'referer:youtube.com',
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
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
