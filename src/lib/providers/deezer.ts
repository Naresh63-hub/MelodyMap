/**
 * Deezer API Provider Adapter
 * Provides rich commercial music metadata and ISRC codes. Deezer's 30-second sample MP3s are ignored — playback is full-length only.
 *
 * API Docs: https://developers.deezer.com/api
 */

import type { UnifiedTrack, ProviderSearchOptions } from "./types";

interface DeezerRawTrack {
  id: number;
  title: string;
  title_short?: string;
  isrc?: string;
  duration: number; // in seconds
  preview?: string; // 30-second sample MP3 from the API — intentionally never used
  artist: {
    id: number;
    name: string;
  };
  album?: {
    id: number;
    title: string;
    cover_medium?: string;
    cover_big?: string;
    cover_xl?: string;
  };
  explicit_lyrics?: boolean;
}

interface DeezerSearchResponse {
  data: DeezerRawTrack[];
  total: number;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export async function searchDeezerTracks(
  query: string,
  options: ProviderSearchOptions = {},
): Promise<UnifiedTrack[]> {
  const clean = query.trim();
  if (!clean) return [];

  const limit = options.limit ?? 15;
  const url = `https://api.deezer.com/search?q=${encodeURIComponent(clean)}&limit=${limit}`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "MelodyMap/1.0",
      },
      signal: options.signal ?? AbortSignal.timeout(6000),
    });

    if (!res.ok) return [];

    const body = (await res.json()) as DeezerSearchResponse;
    if (!Array.isArray(body.data)) return [];

    return body.data
      .filter((t) => t.id && t.title && t.duration > 0 && t.duration <= 600)
      .map((t) => {
        const artwork =
          t.album?.cover_big ||
          t.album?.cover_medium ||
          t.album?.cover_xl ||
          "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop";

        return {
          id: `deezer:${t.id}`,
          canonicalTrackId: `deezer:${t.id}`,
          title: t.title_short || t.title,
          artist: t.artist?.name || "Unknown Artist",
          album: t.album?.title,
          duration: formatDuration(t.duration),
          durationSeconds: Math.round(t.duration),
          thumbnail: artwork,
          artwork,
          isrc: t.isrc,
          isExplicit: Boolean(t.explicit_lyrics),
          provider: "deezer" as const,
          providerTrackId: String(t.id),
          playable: false,
          playbackSource: undefined,
          availableAlternatives: [],
          previewUrl: undefined,
          source: "deezer" as const,
        };
      });
  } catch {
    return [];
  }
}
