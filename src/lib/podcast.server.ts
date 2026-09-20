/**
 * Podcast search and discovery engine using Apple Podcasts / iTunes open API.
 * Free, public, no API key needed, returns direct playable MP3/AAC audio streams.
 */

import type { Track } from "./library";

type ItunesEpisode = {
  trackId: number;
  trackName: string;
  artistName?: string;
  collectionName?: string;
  episodeUrl?: string;
  artworkUrl600?: string;
  artworkUrl100?: string;
  trackTimeMillis?: number;
  releaseDate?: string;
};

type ItunesResponse = {
  resultCount: number;
  results: ItunesEpisode[];
};

function formatDuration(ms?: number): string {
  if (!ms || isNaN(ms)) return "Podcast";
  const totalSecs = Math.floor(ms / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export async function searchPodcastEpisodes(query: string, limit = 20): Promise<Track[]> {
  const clean = query.trim();
  if (!clean) return [];

  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(clean)}&media=podcast&entity=podcastEpisode&limit=${limit}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "MelodyMap/1.0",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as ItunesResponse;
    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results
      .filter((ep) => ep.episodeUrl && ep.trackName)
      .map((ep) => ({
        id: `podcast:${ep.trackId}`,
        title: ep.trackName,
        artist: ep.collectionName || ep.artistName || "Podcast",
        duration: formatDuration(ep.trackTimeMillis),
        thumbnail:
          ep.artworkUrl600 ||
          ep.artworkUrl100 ||
          "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=300&h=300&fit=crop",
        previewUrl: ep.episodeUrl,
        source: "podcast" as const,
      }));
  } catch (err) {
    console.warn("[podcast] iTunes podcast search failed:", err);
    return [];
  }
}
