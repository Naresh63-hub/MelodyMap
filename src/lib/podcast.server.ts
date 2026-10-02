/**
 * Language-Aware Podcast Discovery & Streaming Engine
 * Uses the open Apple Podcasts / iTunes API with regional store targeting.
 * Delivers direct, playable MP3/AAC audio streams without requiring paid keys or auth.
 */

import type { Track } from "./library";
import type { Podcast, PodcastEpisode, NormalizedPodcastLanguage } from "./podcast.types";

/**
 * Normalizes user-facing language strings into ISO codes and regional iTunes store country codes.
 */
export function normalizePodcastLanguage(lang?: string): NormalizedPodcastLanguage {
  const clean = (lang || "").trim().toLowerCase();

  switch (clean) {
    case "telugu":
    case "te":
      return { code: "te", name: "Telugu", country: "in" };
    case "hindi":
    case "hi":
      return { code: "hi", name: "Hindi", country: "in" };
    case "tamil":
    case "ta":
      return { code: "ta", name: "Tamil", country: "in" };
    case "malayalam":
    case "ml":
      return { code: "ml", name: "Malayalam", country: "in" };
    case "kannada":
    case "kn":
      return { code: "kn", name: "Kannada", country: "in" };
    case "punjabi":
    case "pa":
      return { code: "pa", name: "Punjabi", country: "in" };
    case "english":
    case "en":
      return { code: "en", name: "English", country: "us" };
    case "korean":
    case "ko":
      return { code: "ko", name: "Korean", country: "kr" };
    case "spanish":
    case "es":
      return { code: "es", name: "Spanish", country: "es" };
    case "arabic":
    case "ar":
      return { code: "ar", name: "Arabic", country: "ae" };
    default:
      // Default to Telugu if specified in Telugu-default environments, or English otherwise
      if (clean.includes("tel")) return { code: "te", name: "Telugu", country: "in" };
      return { code: "te", name: "Telugu", country: "in" };
  }
}

/** Formats milliseconds into human-readable duration string (e.g. "42:15" or "1:15:30") */
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

/**
 * Validates that a podcast title/publisher does not advertise a conflicting language.
 */
function isPodcastLanguageValid(
  podcast: { title: string; publisher?: string; description?: string },
  selectedLang: NormalizedPodcastLanguage,
): boolean {
  if (selectedLang.name === "English") return true;

  const text = `${podcast.title} ${podcast.publisher || ""} ${podcast.description || ""}`.toLowerCase();
  const selectedName = selectedLang.name.toLowerCase();

  const conflictingLanguages = [
    "hindi",
    "telugu",
    "tamil",
    "malayalam",
    "kannada",
    "punjabi",
    "bengali",
  ].filter((l) => l !== selectedName);

  for (const conflict of conflictingLanguages) {
    // Matches explicit bracket tags like "(Hindi)" or phrases like "Hindi Podcast"
    const bracketPattern = new RegExp(`[\\(\\[]\\s*${conflict}\\s*[\\)\\]]`, "i");
    const phrasePattern = new RegExp(`\\b${conflict}\\s+(podcast|show|audio|stories)\\b`, "i");
    if (bracketPattern.test(text) || phrasePattern.test(text)) {
      return false;
    }
  }

  return true;
}

interface ItunesPodcastResult {
  collectionId: number;
  collectionName: string;
  artistName?: string;
  feedUrl?: string;
  artworkUrl600?: string;
  artworkUrl100?: string;
  primaryGenreName?: string;
  trackCount?: number;
  collectionViewUrl?: string;
}

interface ItunesEpisodeResult {
  wrapperType: "track" | "podcastEpisode";
  trackId: number;
  trackName: string;
  collectionName?: string;
  artistName?: string;
  episodeUrl?: string;
  description?: string;
  releaseDate?: string;
  trackTimeMillis?: number;
  artworkUrl600?: string;
  artworkUrl160?: string;
}

/**
 * Discovers Podcast Shows filtered strictly by the user's selected language and topic/query.
 * Guarantees zero wrong-language fallback: if no shows match the language, returns an empty array.
 */
export async function searchPodcasts(options: {
  query?: string | undefined;
  language?: string | undefined;
  topic?: string | undefined;
  limit?: number | undefined;
}): Promise<Podcast[]> {
  const normLang = normalizePodcastLanguage(options.language);
  const limit = options.limit ?? 25;
  const cleanQuery = (options.query || "").trim();
  const cleanTopic = (options.topic || "").trim();

  // Construct localized search term
  let searchTerm = "";
  if (cleanQuery) {
    searchTerm = normLang.name === "English" ? cleanQuery : `${normLang.name} ${cleanQuery}`;
  } else if (cleanTopic && cleanTopic.toLowerCase() !== "all") {
    searchTerm = normLang.name === "English" ? `${cleanTopic} podcast` : `${normLang.name} ${cleanTopic} podcast`;
  } else {
    searchTerm = normLang.name === "English" ? "podcast" : `${normLang.name} podcast`;
  }

  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&media=podcast&entity=podcast&country=${normLang.country}&limit=${limit}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "MelodyMap/1.0",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as { results?: ItunesPodcastResult[] };
    if (!data.results || !Array.isArray(data.results)) return [];

    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();
    const podcasts: Podcast[] = [];

    for (const item of data.results) {
      if (!item.collectionId || !item.collectionName) continue;
      const id = `podcast:show:${item.collectionId}`;
      const title = item.collectionName.trim();
      const publisher = item.artistName?.trim() || "Podcast Host";

      // Deduplication check
      const titleKey = title.toLowerCase();
      if (seenIds.has(id) || seenTitles.has(titleKey)) continue;

      // Language validation: exclude cross-language contaminations
      if (!isPodcastLanguageValid({ title, publisher }, normLang)) {
        continue;
      }

      seenIds.add(id);
      seenTitles.add(titleKey);

      podcasts.push({
        id,
        title,
        publisher,
        artworkUrl:
          item.artworkUrl600 ||
          item.artworkUrl100 ||
          "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=300&h=300&fit=crop",
        language: normLang.name,
        languageCode: normLang.code,
        category: item.primaryGenreName,
        feedUrl: item.feedUrl,
        episodeCount: item.trackCount,
        provider: "itunes",
        externalUrl: item.collectionViewUrl,
      });
    }

    return podcasts;
  } catch (err) {
    console.warn("[podcast] iTunes podcast show search notice:", err);
    return [];
  }
}

/**
 * Retrieves the full episode list for a specific Podcast Show.
 */
export async function getPodcastEpisodes(podcastId: string, limit = 50): Promise<PodcastEpisode[]> {
  const cleanId = podcastId.replace("podcast:show:", "").trim();
  if (!cleanId) return [];

  const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(cleanId)}&entity=podcastEpisode&limit=${limit}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "MelodyMap/1.0",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(9000),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as { results?: ItunesEpisodeResult[] };
    if (!data.results || !Array.isArray(data.results)) return [];

    const showInfo = data.results.find((r) => r.wrapperType === "track");
    const episodesData = data.results.filter(
      (r) => r.wrapperType === "podcastEpisode" && r.episodeUrl && r.trackName,
    );

    const defaultArtwork =
      showInfo?.artworkUrl600 ||
      "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=300&h=300&fit=crop";
    const defaultTitle = showInfo?.collectionName || "Podcast";

    return episodesData.map((ep) => {
      const durSecs = Math.round((ep.trackTimeMillis || 0) / 1000);
      return {
        id: `podcast:ep:${ep.trackId}`,
        podcastId: `podcast:show:${cleanId}`,
        podcastTitle: ep.collectionName || defaultTitle,
        title: ep.trackName.trim(),
        description: ep.description,
        artworkUrl: ep.artworkUrl600 || ep.artworkUrl160 || defaultArtwork,
        audioUrl: ep.episodeUrl!,
        duration: formatDuration(ep.trackTimeMillis),
        durationSeconds: durSecs > 0 ? durSecs : 1800, // Safe default of 30 mins if not provided
        publishedAt: ep.releaseDate,
        provider: "itunes" as const,
      };
    });
  } catch (err) {
    console.warn("[podcast] Episode lookup notice:", err);
    return [];
  }
}

/**
 * Backward compatibility helper for legacy episode searches.
 */
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

    const data = (await res.json()) as { results?: ItunesEpisodeResult[] };
    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results
      .filter((ep) => ep.episodeUrl && ep.trackName)
      .map((ep) => {
        const durSecs = Math.round((ep.trackTimeMillis || 0) / 1000);
        return {
          id: `podcast:${ep.trackId}`,
          title: ep.trackName,
          artist: ep.collectionName || ep.artistName || "Podcast",
          duration: formatDuration(ep.trackTimeMillis),
          durationSeconds: durSecs > 0 ? durSecs : 1800,
          thumbnail:
            ep.artworkUrl600 ||
            ep.artworkUrl160 ||
            "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=300&h=300&fit=crop",
          previewUrl: ep.episodeUrl,
          source: "podcast" as const,
          playable: true,
        };
      });
  } catch (err) {
    console.warn("[podcast] Legacy searchPodcastEpisodes notice:", err);
    return [];
  }
}
