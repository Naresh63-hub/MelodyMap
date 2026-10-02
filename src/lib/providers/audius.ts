/**
 * Audius API Provider
 * Official decentralized music catalog with artist-uploaded, Creative Commons,
 * and licensed independent music. Offers authorized full-length streaming.
 *
 * API Docs: https://audiusproject.github.io/api-docs/
 */

import type { UnifiedTrack, ProviderSearchOptions } from "./types";

interface AudiusTrack {
  id: string;
  title: string;
  user: {
    name: string;
    handle: string;
  };
  duration: number; // in seconds
  artwork?: {
    "150x150"?: string;
    "480x480"?: string;
    "1000x1000"?: string;
  };
  genre?: string;
  mood?: string;
  release_date?: string;
  is_streamable?: boolean;
}

interface AudiusSearchResponse {
  data: AudiusTrack[];
}

const AUDIUS_DISCOVERY_NODES = [
  "https://discoveryprovider.audius.co/v1",
  "https://creatornode.audius.co/v1",
  "https://discoveryprovider2.audius.co/v1",
];

const APP_NAME = "MelodyMap";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export async function searchAudius(
  query: string,
  options: ProviderSearchOptions = {},
): Promise<UnifiedTrack[]> {
  const clean = query.trim();
  if (!clean) return [];

  const limit = options.limit ?? 15;

  for (const node of AUDIUS_DISCOVERY_NODES) {
    try {
      const url = `${node}/tracks/search?query=${encodeURIComponent(clean)}&limit=${limit}&app_name=${APP_NAME}`;
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "MelodyMap/1.0",
        },
        signal: options.signal ?? AbortSignal.timeout(6000),
      });

      if (!res.ok) continue;

      const body = (await res.json()) as AudiusSearchResponse;
      if (!Array.isArray(body.data)) continue;

      const streamBase = `${node}/tracks`;

      return body.data
        .filter((t) => t.id && t.title && t.duration > 0 && t.duration <= 600 && t.is_streamable !== false)
        .map((t) => {
          const artwork =
            t.artwork?.["480x480"] ||
            t.artwork?.["1000x1000"] ||
            t.artwork?.["150x150"] ||
            "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop";

          const streamUrl = `${streamBase}/${encodeURIComponent(t.id)}/stream?app_name=${APP_NAME}`;

          return {
            id: `audius:${t.id}`,
            canonicalTrackId: `audius:${t.id}`,
            title: t.title,
            artist: t.user?.name || t.user?.handle || "Audius Artist",
            album: t.genre ? `${t.genre} Single` : "Audius Release",
            duration: formatDuration(t.duration),
            durationSeconds: Math.round(t.duration),
            thumbnail: artwork,
            artwork,
            provider: "audius",
            providerTrackId: String(t.id),
            playable: true,
            playbackSource: {
              provider: "audius",
              providerTrackId: String(t.id),
              url: streamUrl,
              type: "full",
              format: "mp3",
            },
            availableAlternatives: [],
            previewUrl: streamUrl,
            source: "audius",
          };
        });
    } catch {
      // Try next node on network timeout/failure
      continue;
    }
  }

  return [];
}

export async function getTrendingAudius(
  options: ProviderSearchOptions = {},
): Promise<UnifiedTrack[]> {
  const limit = options.limit ?? 20;

  for (const node of AUDIUS_DISCOVERY_NODES) {
    try {
      const url = `${node}/tracks/trending?limit=${limit}&app_name=${APP_NAME}`;
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "MelodyMap/1.0",
        },
        signal: options.signal ?? AbortSignal.timeout(6000),
      });

      if (!res.ok) continue;

      const body = (await res.json()) as AudiusSearchResponse;
      if (!Array.isArray(body.data)) continue;

      const streamBase = `${node}/tracks`;

      return body.data
        .filter((t) => t.id && t.title && t.duration > 0 && t.duration <= 600 && t.is_streamable !== false)
        .map((t) => {
          const artwork =
            t.artwork?.["480x480"] ||
            t.artwork?.["1000x1000"] ||
            t.artwork?.["150x150"] ||
            "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop";

          const streamUrl = `${streamBase}/${encodeURIComponent(t.id)}/stream?app_name=${APP_NAME}`;

          return {
            id: `audius:${t.id}`,
            canonicalTrackId: `audius:${t.id}`,
            title: t.title,
            artist: t.user?.name || "Audius Artist",
            album: t.genre || "Audius Trending",
            duration: formatDuration(t.duration),
            durationSeconds: Math.round(t.duration),
            thumbnail: artwork,
            artwork,
            provider: "audius",
            providerTrackId: String(t.id),
            playable: true,
            playbackSource: {
              provider: "audius",
              providerTrackId: String(t.id),
              url: streamUrl,
              type: "full",
              format: "mp3",
            },
            availableAlternatives: [],
            previewUrl: streamUrl,
            source: "audius",
          };
        });
    } catch {
      continue;
    }
  }

  return [];
}
