export type Track = {
  id: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string;
  /** Direct audio URL (e.g. Deezer preview) — bypasses the YouTube stream proxy. */
  previewUrl?: string;
  /** Source provider: "youtube" (default) or "deezer". */
  source?: "youtube" | "deezer";
  /** AI recommendation reason (shown in the feed). */
  reason?: string;
};

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

/** Simple in-memory LRU-style cache for search results. 5-minute TTL. */
const SEARCH_CACHE_TTL = 5 * 60 * 1000;
const SEARCH_CACHE_MAX = 50;
type CacheEntry = { tracks: Track[]; at: number };
const searchCache = new Map<string, CacheEntry>();

function getCached(key: string): Track[] | null {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > SEARCH_CACHE_TTL) {
    searchCache.delete(key);
    return null;
  }
  return entry.tracks;
}

function setCached(key: string, tracks: Track[]) {
  // Evict oldest if full
  if (searchCache.size >= SEARCH_CACHE_MAX) {
    const oldest = searchCache.keys().next().value;
    if (oldest) searchCache.delete(oldest);
  }
  searchCache.set(key, { tracks, at: Date.now() });
}

const NON_MUSIC = [
  "interview",
  "podcast",
  "reaction",
  "review",
  "vlog",
  "trailer",
  "teaser",
  "full movie",
  "episode",
  "behind the scenes",
  "making of",
  "tutorial",
  "gameplay",
  "news",
  "shorts",
  "speech",
  "documentary",
  "video song",
  "full video",
  "lyric video",
  "official video",
  "video",
  "hd video",
  "4k video",
  "8k video",
  "live performance",
  "concert",
  "stage show",
  "dance performance",
  "choreography",
  "making video",
  "behind the scenes",
  "teaser",
  "trailer",
  "promo",
  "promotion",
  "visualizer",
  "animated video",
  "3d video",
  "video clip",
  "music video",
  "mv",
  "official mv",
  "hd mv",
];

/**
 * Long compilation videos (jukeboxes / "best of" mixes) — they're dozens of
 * songs stitched together, not single tracks, so they feel unrelated and
 * old when they show up in mixes. Kept out of music results.
 */
const COMPILATION = [
  "jukebox",
  "compilation",
  "non-stop",
  "nonstop",
  "mashup",
  "best of",
  "greatest hits",
  "hit songs",
  "top hits",
  "top 10",
  "top 40",
  "top 100",
  "evergreen songs",
  "superhit",
  "full album",
  "hits collection",
  "audio jukebox",
];

function durationSeconds(text: string): number {
  const parts = text.split(":").map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

function looksLikeMusic(title: string, seconds: number): boolean {
  const t = title.toLowerCase();
  if (NON_MUSIC.some((word) => t.includes(word))) return false;
  if (COMPILATION.some((word) => t.includes(word))) return false;
  // Songs are usually 45s–15min.
  if (seconds > 0 && seconds < 45) return false;
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

/** Scrapes YouTube search results — no API key required. Cached for 5 minutes. */
export async function searchYouTube(
  query: string,
  limit = 20,
  musicOnly = true,
  upload?: UploadRange,
): Promise<Track[]> {
  const cacheKey = `yt:${query}:${limit}:${musicOnly}:${upload ?? ""}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Add "audio" to search query to prioritize audio-only content
  const searchQuery = musicOnly ? `${query} audio` : query;
  const sp = upload ? UPLOAD_FILTERS[upload] : musicOnly ? MUSIC_FILTER : VIDEO_FILTER;
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}&sp=${sp}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
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
    if (musicOnly && !looksLikeMusic(title, durationSeconds(duration))) continue;
    const thumbs = ((r["thumbnail"] as AnyRecord | undefined)?.["thumbnails"] ?? []) as AnyRecord[];
    seen.add(id);

    tracks.push({
      id,
      title,
      artist: text(r["ownerText"]) || text(r["longBylineText"]) || "Unknown artist",

      duration,
      thumbnail:
        (thumbs[thumbs.length - 1]?.["url"] as string | undefined) ??
        `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    });
    if (tracks.length >= limit) break;
  }

  setCached(cacheKey, tracks);
  return tracks;
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
