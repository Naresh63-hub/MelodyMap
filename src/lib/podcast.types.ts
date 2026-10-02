/**
 * Dedicated Podcast Data Models & Types
 * Clean separation between Podcast Shows and Podcast Episodes.
 */

import type { Track } from "./library";

export interface Podcast {
  id: string; // e.g. "podcast:show:123456"
  title: string;
  publisher: string;
  description?: string | undefined;
  artworkUrl: string;
  language?: string | undefined;
  languageCode?: string | undefined;
  category?: string | undefined;
  feedUrl?: string | undefined;
  episodeCount?: number | undefined;
  provider: "itunes" | "rss";
  externalUrl?: string | undefined;
}

export interface PodcastEpisode {
  id: string; // e.g. "podcast:ep:987654"
  podcastId: string;
  podcastTitle: string;
  title: string;
  description?: string | undefined;
  artworkUrl: string;
  audioUrl: string; // Direct playable MP3/AAC audio URL
  duration: string; // UI format: "42:15" or "1:15:30"
  durationSeconds: number; // Raw seconds - podcasts can legitimately exceed 600s
  publishedAt?: string | undefined;
  language?: string | undefined;
  languageCode?: string | undefined;
  provider: "itunes" | "rss";
  externalUrl?: string | undefined;
}

export interface NormalizedPodcastLanguage {
  code: string; // ISO 639-1: "te", "hi", "en", "ta", etc.
  name: string; // "Telugu", "Hindi", "English", etc.
  country: string; // iTunes store country code: "in", "us", etc.
}

/**
 * Converts a PodcastEpisode into a compatible Track object for the audio player.
 * Preserves source="podcast" to ensure long duration allowance and LinTS bandit isolation.
 */
export function episodeToTrack(ep: PodcastEpisode): Track {
  return {
    id: ep.id,
    canonicalTrackId: ep.id,
    title: ep.title,
    artist: ep.podcastTitle,
    album: ep.podcastTitle,
    duration: ep.duration,
    durationSeconds: ep.durationSeconds,
    thumbnail:
      ep.artworkUrl ||
      "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=300&h=300&fit=crop",
    previewUrl: ep.audioUrl,
    source: "podcast",
    provider: "archive", // Internal playback adapter source
    providerTrackId: ep.id,
    playable: Boolean(ep.audioUrl),
  };
}
