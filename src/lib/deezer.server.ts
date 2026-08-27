/**
 * Deezer Search API — free, no API key needed.
 *
 * Provides 30-second audio previews for tracks. Used as a fallback when
 * YouTube search fails or tracks are restricted. The preview URLs are
 * direct MP3 links that play in a plain <audio> element.
 */

import type { Track } from "./music.server";

type DeezerTrack = {
  id: number;
  title: string;
  artist: { name: string };
  album: {
    title: string;
    cover_medium: string;
    cover_big: string;
  };
  preview: string; // 30-second MP3 URL
  duration: number; // seconds
};

type DeezerSearchResponse = {
  data: DeezerTrack[];
  total: number;
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Search Deezer for tracks matching a query.
 * Returns tracks with direct audio preview URLs.
 */
export async function searchDeezer(
  query: string,
  limit = 10,
): Promise<Track[]> {
  const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "MelodyMap/1.0" },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  let body: DeezerSearchResponse;
  try {
    body = (await res.json()) as DeezerSearchResponse;
  } catch {
    return [];
  }

  return (body.data ?? [])
    .filter((t) => t.preview && t.duration > 30)
    .map((t) => ({
      id: `deezer:${t.id}`,
      title: t.title,
      artist: t.artist?.name ?? "Unknown",
      duration: formatDuration(t.duration),
      thumbnail: t.album?.cover_medium ?? t.album?.cover_big ?? "",
      previewUrl: t.preview,
      source: "deezer" as const,
    }));
}

/**
 * Given a YouTube track title + artist, search Deezer for the same song.
 * Returns the direct preview URL or null.
 */
export async function findDeezerPreview(
  title: string,
  artist: string,
): Promise<string | null> {
  // Strip common YouTube title clutter for a cleaner search
  const cleanTitle = title
    .replace(/\|.*$/, "") // everything after |
    .replace(/\(.*official.*\)/gi, "") // (Official Video), etc.
    .replace(/\[.*\]/g, "") // [Lyrics], [HD], etc.
    .replace(/official video|official audio|lyrics|hd|4k|mv/gi, "")
    .trim()
    .slice(0, 80);

  const query = cleanTitle ? `${cleanTitle} ${artist}` : `${title} ${artist}`;
  const results = await searchDeezer(query, 3);
  return results[0]?.previewUrl ?? null;
}
