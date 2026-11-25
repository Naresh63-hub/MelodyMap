/**
 * Audio Storytelling & Narrative Drama Data Models
 * Clean separation from music songs and conversational podcasts.
 */

import type { Track } from "../library";

export type StoryCategory =
  | "epics"
  | "warriors"
  | "thriller"
  | "audiobooks"
  | "kids"
  | "biographies"
  | "spiritual";

export type StoryLanguage = "Telugu" | "Hindi" | "English" | "All";

export interface StoryChapter {
  id: string; // e.g. "story:ch:mahabharata-1"
  seriesId: string;
  chapterNumber: number;
  title: string;
  duration: string; // "24:15"
  durationSeconds: number;
  streamUrl: string; // Direct high-speed MP3 audio stream
  synopsis?: string | undefined;
  thumbnail?: string | undefined;
}

export interface StorySeries {
  id: string; // e.g. "story:series:mahabharata"
  title: string;
  narrator: string; // e.g. "Sudipta Bhawmik", "Chaganti Koteswara Rao"
  language: "Telugu" | "Hindi" | "English";
  category: StoryCategory;
  coverUrl: string;
  description: string;
  rating: number; // e.g. 4.9
  totalChapters: number;
  featured?: boolean | undefined;
  tags?: string[] | undefined;
  chapters: StoryChapter[];
}

/**
 * Converts a StoryChapter into a playable Track for MelodyMap's audio player.
 * Uses source: "podcast" so long duration limits (>10min) are permitted,
 * chapter position auto-saving works, and the recommendation bandit is isolated.
 */
export function chapterToTrack(chapter: StoryChapter, series: StorySeries): Track {
  return {
    id: chapter.id,
    title: chapter.title,
    artist: series.narrator,
    album: series.title,
    duration: chapter.duration,
    durationSeconds: chapter.durationSeconds,
    thumbnail: chapter.thumbnail || series.coverUrl,
    previewUrl: chapter.streamUrl,
    source: "podcast",
    playable: true,
    languageCode: series.language.toLowerCase(),
    podcastId: series.id,
  };
}
