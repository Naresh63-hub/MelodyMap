/**
 * High-performance lyrics service integrating with LRCLIB.
 * Provides synchronized time-stamped lyrics (LRC) and plain lyrics.
 */

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
function cleanForLyrics(s: string): string {
  return s
    .replace(/\(.*?\)|\[.*?\]/g, "") // remove parenthetical remarks like (Official Video), [4K]
    .replace(/\b(feat\.|ft\.|official|music|video|audio|lyrics|lyrical|hd|4k)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fetches synced & plain lyrics from LRCLIB.
 */
export async function fetchTrackLyrics(
  trackName: string,
  artistName: string,
  durationSec?: number,
): Promise<LyricsResult | null> {
  const cleanTrack = cleanForLyrics(trackName);
  const cleanArtist = cleanForLyrics(artistName);

  if (!cleanTrack) return null;

  // 1. Try exact match /api/get
  try {
    const params = new URLSearchParams({
      track_name: cleanTrack,
      artist_name: cleanArtist,
    });
    if (durationSec && durationSec > 0) {
      params.append("duration", Math.round(durationSec).toString());
    }

    const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
      headers: {
        "User-Agent": "MelodyMap/1.0 (https://github.com/Naresh63-hub/Musicplayer)",
      },
      signal: AbortSignal.timeout(6_000),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        syncedLyrics?: string;
        plainLyrics?: string;
        instrumental?: boolean;
      };

      if (data.instrumental) {
        return {
          synced: [{ time: 0, text: "♪ Instrumental ♪" }],
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
  } catch {
    // proceed to fuzzy search fallback
  }

  // 2. Fallback to /api/search
  try {
    const query = `${cleanArtist} ${cleanTrack}`.trim();
    const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`, {
      headers: {
        "User-Agent": "MelodyMap/1.0 (https://github.com/Naresh63-hub/Musicplayer)",
      },
      signal: AbortSignal.timeout(6_000),
    });

    if (res.ok) {
      const results = (await res.json()) as Array<{
        syncedLyrics?: string;
        plainLyrics?: string;
        instrumental?: boolean;
      }>;

      if (Array.isArray(results) && results.length > 0) {
        // Pick the first result that has lyrics
        for (const item of results) {
          if (item.instrumental) {
            return {
              synced: [{ time: 0, text: "♪ Instrumental ♪" }],
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
  } catch {
    // skip
  }

  return null;
}
