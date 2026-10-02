/**
 * Jamendo Music API Provider
 * Official catalog for Creative Commons and independent licensed music.
 * Supplies authorized full-length MP3 streaming audio.
 *
 * API Docs: https://developer.jamendo.com/v3.0/tracks
 */

import type { UnifiedTrack, ProviderSearchOptions } from "./types";

interface JamendoTrack {
  id: string;
  name: string;
  duration: number; // in seconds
  artist_id: string;
  artist_name: string;
  album_name?: string;
  album_id?: string;
  image?: string;
  audio?: string;
  audiodownload?: string;
  releasedate?: string;
  license_ccurl?: string;
}

interface JamendoResponse {
  headers: {
    status: string;
    code: number;
    results_count: number;
  };
  results: JamendoTrack[];
}

const JAMENDO_CLIENT_ID = "56d30c95"; // Standard public Jamendo application client ID
const JAMENDO_API_BASE = "https://api.jamendo.com/v3.0";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export async function searchJamendo(
  query: string,
  options: ProviderSearchOptions = {},
): Promise<UnifiedTrack[]> {
  const clean = query.trim();
  if (!clean) return [];

  const limit = options.limit ?? 15;
  const url = `${JAMENDO_API_BASE}/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=jsonpretty&limit=${limit}&namesearch=${encodeURIComponent(clean)}&include=musicinfo&audioformat=mp32`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "MelodyMap/1.0",
      },
      signal: options.signal ?? AbortSignal.timeout(6000),
    });

    if (!res.ok) return [];

    const body = (await res.json()) as JamendoResponse;
    if (!Array.isArray(body.results)) return [];

    return body.results
      .filter((t) => t.id && t.name && t.audio && t.duration > 0 && t.duration <= 600)
      .map((t) => {
        const artwork =
          t.image ||
          "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop";

        return {
          id: `jamendo:${t.id}`,
          canonicalTrackId: `jamendo:${t.id}`,
          title: t.name,
          artist: t.artist_name || "Jamendo Artist",
          album: t.album_name || "Jamendo Music",
          duration: formatDuration(t.duration),
          durationSeconds: Math.round(t.duration),
          thumbnail: artwork,
          artwork,
          provider: "jamendo" as const,
          providerTrackId: String(t.id),
          playable: true,
          playbackSource: {
            provider: "jamendo" as const,
            providerTrackId: String(t.id),
            url: t.audio!,
            type: "full" as const,
            format: "mp3",
          },
          availableAlternatives: [],
          previewUrl: t.audio,
          source: "jamendo" as const,
        };
      });
  } catch {
    return [];
  }
}

export async function getTrendingJamendo(
  options: ProviderSearchOptions = {},
): Promise<UnifiedTrack[]> {
  const limit = options.limit ?? 20;
  const url = `${JAMENDO_API_BASE}/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=jsonpretty&limit=${limit}&order=popularity_week_desc&include=musicinfo&audioformat=mp32`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "MelodyMap/1.0",
      },
      signal: options.signal ?? AbortSignal.timeout(6000),
    });

    if (!res.ok) return [];

    const body = (await res.json()) as JamendoResponse;
    if (!Array.isArray(body.results)) return [];

    return body.results
      .filter((t) => t.id && t.name && t.audio && t.duration > 0 && t.duration <= 600)
      .map((t) => {
        const artwork =
          t.image ||
          "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop";

        return {
          id: `jamendo:${t.id}`,
          canonicalTrackId: `jamendo:${t.id}`,
          title: t.name,
          artist: t.artist_name || "Jamendo Artist",
          album: t.album_name || "Featured Discovery",
          duration: formatDuration(t.duration),
          durationSeconds: Math.round(t.duration),
          thumbnail: artwork,
          artwork,
          provider: "jamendo" as const,
          providerTrackId: String(t.id),
          playable: true,
          playbackSource: {
            provider: "jamendo" as const,
            providerTrackId: String(t.id),
            url: t.audio!,
            type: "full" as const,
            format: "mp3",
          },
          availableAlternatives: [],
          previewUrl: t.audio,
          source: "jamendo" as const,
        };
      });
  } catch {
    return [];
  }
}
