import { decodeEntities } from "./track-metadata";
import { createLruCache } from "./lru-cache";

export type LyricLine = {
  time: number; // in seconds
  text: string;
};

export type LyricsResult = {
  synced: LyricLine[];
  plain: string | null;
  instrumental: boolean;
  source: string;
};

// 1-hour in-memory LRU cache for fetched lyrics
const lyricsCache = createLruCache<LyricsResult>(250, 60 * 60 * 1000);

/**
 * Parses LRC format lyrics into array of time (seconds) and text.
 * Format example: [01:23.45] Some lyric text
 */
export function parseLrcLyrics(lrcText: string): LyricLine[] {
  if (!lrcText) return [];
  const lines = lrcText.split("\n");
  const result: LyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\]/g;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const matches = Array.from(trimmed.matchAll(timeRegex));
    if (matches.length === 0) continue;

    const text = trimmed.replace(timeRegex, "").trim();
    if (!text && matches.length === 1) continue; // skip empty time markers unless needed

    for (const match of matches) {
      const minutes = parseInt(match[1] || "0", 10);
      const seconds = parseFloat(match[2] || "0");
      const totalSeconds = minutes * 60 + seconds;
      result.push({ time: Math.round(totalSeconds * 100) / 100, text: text || "♪" });
    }
  }

  // Sort chronologically
  result.sort((a, b) => a.time - b.time);
  return result;
}

/** Clean search terms for higher hit rates on lyrics lookup */
export function cleanForLyrics(s: string): string {
  if (!s) return "";
  return decodeEntities(s)
    .replace(/\(.*?\)|\[.*?\]/g, "") // remove parenthetical remarks like (Official Video), (From "Movie"), [4K]
    .replace(/\b(from\s+the\s+movie|from\s+movie|from\s+the\s+album)\b/gi, "")
    .replace(/\b(featuring|feat|ft)\b\.?/gi, "")
    .replace(/\b(official|music|video|audio|lyrics|lyrical|hd|4k|8k|mv|original soundtrack|ost)\b/gi, "")
    .replace(/["'“”’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract primary artist from composite artist string (e.g., "Pritam, Arijit Singh" -> "Pritam") */
export function getPrimaryArtist(artist: string): string {
  if (!artist) return "";
  const cleaned = cleanForLyrics(artist);
  const first = cleaned.split(/[,&/|]/)[0]?.trim();
  return first || cleaned;
}

/** Clean and format raw HTML lyrics from JioSaavn into readable lines */
export function formatSaavnLyrics(raw: string): string {
  if (!raw) return "";
  return decodeEntities(raw)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Fetches plain lyrics from JioSaavn if available.
 */
export async function fetchSaavnLyrics(
  trackName: string,
  artistName: string,
  trackId?: string,
): Promise<LyricsResult | null> {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Accept: "application/json",
  };

  // 1. Direct song ID lookup if trackId is provided and looks like a Saavn ID (not custom prefix)
  if (trackId && !trackId.includes("_") && trackId.length >= 6 && trackId.length <= 16) {
    try {
      const url = `https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics&lyrics_id=${encodeURIComponent(trackId)}&ctx=web6dot0&_format=json&_marker=0`;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(5_000) });
      if (res.ok) {
        const data = (await res.json()) as { lyrics?: string };
        if (data?.lyrics && typeof data.lyrics === "string" && data.lyrics.trim().length > 10) {
          const plain = formatSaavnLyrics(data.lyrics);
          if (plain) {
            return {
              synced: [],
              plain,
              instrumental: false,
              source: "saavn",
            };
          }
        }
      }
    } catch {
      // fallback to search
    }
  }

  // 2. Query JioSaavn search for song with has_lyrics
  try {
    const cleanTrack = cleanForLyrics(trackName);
    const primaryArtist = getPrimaryArtist(artistName);
    const query = `${cleanTrack} ${primaryArtist}`.trim();
    if (!query) return null;

    const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(query)}&p=1&n=5`;
    const sRes = await fetch(searchUrl, { headers, signal: AbortSignal.timeout(5_000) });
    if (sRes.ok) {
      const sData = (await sRes.json()) as {
        results?: Array<{
          id: string;
          has_lyrics?: string;
          more_info?: { has_lyrics?: string; lyrics_id?: string };
        }>;
      };
      const songs = sData?.results || [];
      for (const s of songs) {
        const hasLyrics = s.more_info?.has_lyrics === "true" || s.has_lyrics === "true";
        if (hasLyrics) {
          const lId = s.more_info?.lyrics_id || s.id;
          const lUrl = `https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics&lyrics_id=${encodeURIComponent(lId)}&ctx=web6dot0&_format=json&_marker=0`;
          const lRes = await fetch(lUrl, { headers, signal: AbortSignal.timeout(5_000) });
          if (lRes.ok) {
            const lData = (await lRes.json()) as { lyrics?: string };
            if (lData?.lyrics && typeof lData.lyrics === "string" && lData.lyrics.trim().length > 10) {
              const plain = formatSaavnLyrics(lData.lyrics);
              if (plain) {
                return {
                  synced: [],
                  plain,
                  instrumental: false,
                  source: "saavn",
                };
              }
            }
          }
        }
      }
    }
  } catch {
    // no lyrics from saavn
  }

  return null;
}

/**
 * Fetches synced & plain lyrics from LRCLIB with JioSaavn fallback.
 */
export async function fetchTrackLyrics(
  trackName: string,
  artistName: string,
  durationSec?: number,
  trackId?: string,
): Promise<LyricsResult | null> {
  const cleanTrack = cleanForLyrics(trackName);
  const cleanArtist = cleanForLyrics(artistName);
  const primaryArtist = getPrimaryArtist(artistName);

  if (!cleanTrack) return null;

  // Check cache first
  const cacheKey = `${trackId || ""}:${cleanTrack}:${cleanArtist}`.toLowerCase();
  const cached = lyricsCache.get(cacheKey);
  if (cached) return cached;

  // Helper to query LRCLIB exact match
  async function queryLrclibExact(title: string, artist: string): Promise<LyricsResult | null> {
    try {
      const params = new URLSearchParams({
        track_name: title,
        artist_name: artist,
      });
      if (durationSec && durationSec > 0) {
        params.append("duration", Math.round(durationSec).toString());
      }

      const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
        headers: {
          "User-Agent": "MelodyMap/1.0 (https://github.com/Naresh63-hub/MelodyMap)",
        },
        signal: AbortSignal.timeout(5_000),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          syncedLyrics?: string;
          plainLyrics?: string;
          instrumental?: boolean;
        };

        if (data.instrumental) {
          return {
            synced: [{ time: 0, text: "♪ Instrumental Track ♪" }],
            plain: null,
            instrumental: true,
            source: "lrclib",
          };
        }

        if (data.syncedLyrics) {
          const parsed = parseLrcLyrics(data.syncedLyrics);
          if (parsed.length > 0) {
            return {
              synced: parsed,
              plain: data.plainLyrics || null,
              instrumental: false,
              source: "lrclib",
            };
          }
        }

        if (data.plainLyrics) {
          return {
            synced: [],
            plain: data.plainLyrics,
            instrumental: false,
            source: "lrclib",
          };
        }
      }
    } catch {}
    return null;
  }

  // Helper to query LRCLIB search
  async function queryLrclibSearch(query: string): Promise<LyricsResult | null> {
    try {
      const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`, {
        headers: {
          "User-Agent": "MelodyMap/1.0 (https://github.com/Naresh63-hub/MelodyMap)",
        },
        signal: AbortSignal.timeout(5_000),
      });

      if (res.ok) {
        const results = (await res.json()) as Array<{
          syncedLyrics?: string;
          plainLyrics?: string;
          instrumental?: boolean;
        }>;

        if (Array.isArray(results) && results.length > 0) {
          // Pick the first result that has synced lyrics, or plain lyrics
          for (const item of results) {
            if (item.instrumental) {
              return {
                synced: [{ time: 0, text: "♪ Instrumental Track ♪" }],
                plain: null,
                instrumental: true,
                source: "lrclib",
              };
            }
            if (item.syncedLyrics) {
              const parsed = parseLrcLyrics(item.syncedLyrics);
              if (parsed.length > 0) {
                return {
                  synced: parsed,
                  plain: item.plainLyrics || null,
                  instrumental: false,
                  source: "lrclib",
                };
              }
            }
            if (item.plainLyrics) {
              return {
                synced: [],
                plain: item.plainLyrics,
                instrumental: false,
                source: "lrclib",
              };
            }
          }
        }
      }
    } catch {}
    return null;
  }

  // 1. Try LRCLIB exact match with cleanArtist
  let lrclibRes = await queryLrclibExact(cleanTrack, cleanArtist);

  // 2. Try LRCLIB exact match with primaryArtist if different
  if (!lrclibRes && primaryArtist && primaryArtist !== cleanArtist) {
    lrclibRes = await queryLrclibExact(cleanTrack, primaryArtist);
  }

  // 3. Try LRCLIB search fallback
  if (!lrclibRes) {
    lrclibRes = await queryLrclibSearch(`${primaryArtist || cleanArtist} ${cleanTrack}`.trim());
  }

  // If LRCLIB returned synced lyrics, this is the best experience! Cache & return.
  if (lrclibRes && (lrclibRes.synced.length > 0 || lrclibRes.instrumental)) {
    lyricsCache.set(cacheKey, lrclibRes);
    return lrclibRes;
  }

  // 4. Try JioSaavn native lyrics fallback (especially high hit-rate for Indian catalog)
  const saavnRes = await fetchSaavnLyrics(trackName, artistName, trackId);
  if (saavnRes) {
    lyricsCache.set(cacheKey, saavnRes);
    return saavnRes;
  }

  // 5. Fallback to LRCLIB plain lyrics if we got any
  if (lrclibRes && lrclibRes.plain) {
    lyricsCache.set(cacheKey, lrclibRes);
    return lrclibRes;
  }

  return null;
}

