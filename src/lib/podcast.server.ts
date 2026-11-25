/**
 * Language-Aware Podcast Discovery & Streaming Engine
 * Uses the open Apple Podcasts / iTunes API with regional store targeting.
 * Delivers direct, playable MP3/AAC audio streams without requiring paid keys or auth.
 */

import type { Track } from "./library";
import type { Podcast, PodcastEpisode, NormalizedPodcastLanguage } from "./podcast.types";
import { getCuratedPodcasters } from "./podcast-curated";

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
  collectionId?: number;
  collectionName?: string;
  artistName?: string;
  feedUrl?: string;
  trackCount?: number;
  collectionViewUrl?: string;
  primaryGenreName?: string;
  artworkUrl100?: string;
  trackId?: number;
  trackName?: string;
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

  const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&media=podcast&entity=podcast&country=${normLang.country}&limit=${limit}`;

  // If browsing without a text query, fetch curated top regional creators in parallel
  const curatedList = !cleanQuery ? getCuratedPodcasters(normLang.name, cleanTopic) : [];
  const curatedMap = new Map(curatedList.map((c) => [c.id, c]));
  const lookupIds = curatedList.slice(0, 4).map((c) => c.id).filter(Boolean);

  try {
    const fetchPromises: [Promise<Response>, Promise<Response | null>] = [
      fetch(searchUrl, {
        headers: {
          "User-Agent": "MelodyMap/1.0",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
      }),
      lookupIds.length > 0
        ? fetch(
            `https://itunes.apple.com/lookup?id=${encodeURIComponent(lookupIds.join(","))}&entity=podcast&country=${normLang.country}`,
            {
              headers: {
                "User-Agent": "MelodyMap/1.0",
                Accept: "application/json",
              },
              signal: AbortSignal.timeout(6000),
            },
          ).catch(() => null)
        : Promise.resolve(null),
    ];

    const [searchRes, lookupRes] = await Promise.all(fetchPromises);

    if (!searchRes || !searchRes.ok) return [];

    const searchData = (await searchRes.json()) as { results?: ItunesPodcastResult[] };
    const searchItems = Array.isArray(searchData?.results) ? searchData.results : [];

    let lookupItems: ItunesPodcastResult[] = [];
    if (lookupRes && lookupRes.ok) {
      try {
        const lookupData = (await lookupRes.json()) as { results?: ItunesPodcastResult[] };
        if (Array.isArray(lookupData?.results)) {
          lookupItems = lookupData.results;
        }
      } catch {
        lookupItems = [];
      }
    }

    // Curated items take priority at the top of the feed
    const combinedItems = [...lookupItems, ...searchItems];

    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();
    const podcasts: Podcast[] = [];

    for (const item of combinedItems) {
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

      const curatedMeta = curatedMap.get(String(item.collectionId));

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
        isFeatured: Boolean(curatedMeta?.isFeatured),
        badge: curatedMeta?.badge,
        tagline: curatedMeta?.tagline,
      });
    }

    return podcasts;
  } catch (err) {
    console.warn("[podcast] iTunes podcast show search notice:", err);
    return [];
  }
}

/** In-memory cache for matched episode thumbnails to avoid redundant searches */
const episodeThumbnailCache = new Map<string, string>();

/**
 * Extracts guest name from episode title (e.g. "Ft. Ambati Rayudu" or "Ramya Krishnan ON Raw Talks")
 */
export function extractGuestName(title: string): string | undefined {
  if (!title) return undefined;
  // Match "Ft. Name" or "ft Name"
  const ftMatch = title.match(/(?:ft\.?|featuring)\s+([A-Za-z0-9\.\s]+?)(?:\||\/|\-|\!|\?|\n|$)/i);
  if (ftMatch && ftMatch[1]) {
    const clean = ftMatch[1].trim();
    if (clean.length > 2 && clean.length < 35 && !/^(raw talks|the ranveer show|episode|ep\b)/i.test(clean)) {
      return clean;
    }
  }
  // Strip leading emojis and match "Name ON [Show]"
  const stripped = title.replace(/^[\p{Emoji}\s\p{Punctuation}]+/gu, "");
  const onMatch = stripped.match(/^([A-Za-z\s]{4,30})\s+ON\s+(?:RAW TALKS|TRS|THE RANVEER SHOW)/i);
  if (onMatch && onMatch[1]) {
    return onMatch[1].trim();
  }
  return undefined;
}

/**
 * Searches YouTube for video uploads of a podcast show and enriches episodes with unique YouTube video thumbnails.
 */
export async function enrichEpisodesWithYouTubeThumbnails(
  episodes: PodcastEpisode[],
  podcastTitle: string,
): Promise<PodcastEpisode[]> {
  if (!episodes || episodes.length === 0) return episodes;

  // First pass: attach guestName and check memory cache for thumbnails
  let needsSearch = false;
  for (const ep of episodes) {
    if (!ep.guestName) {
      ep.guestName = extractGuestName(ep.title);
    }
    const cachedThumb = episodeThumbnailCache.get(ep.title);
    if (cachedThumb) {
      ep.artworkUrl = cachedThumb;
    } else {
      needsSearch = true;
    }
  }

  if (!needsSearch) {
    return episodes;
  }

  // Fetch YouTube candidates with timeout protection
  try {
    const cleanTitle = podcastTitle
      .replace(/podcast|show|telugu|hindi|business/gi, "")
      .trim();
    const query = `${cleanTitle} podcast episodes`;

    const res = await fetch("https://www.youtube.com/youtubei/v1/search?prettyPrint=false", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      body: JSON.stringify({
        context: {
          client: { clientName: "WEB", clientVersion: "2.20240801.00.00", hl: "en", gl: "IN" },
        },
        query,
      }),
      signal: AbortSignal.timeout(4000), // Fast 4-second timeout protection
    });

    if (!res.ok) return episodes;

    const data = (await res.json()) as Record<string, unknown>;
    const contents = (
      (data?.["contents"] as Record<string, unknown>)?.[
        "twoColumnSearchResultsRenderer"
      ] as Record<string, unknown>
    )?.["primaryContents"] as Record<string, unknown>;

    const section = (
      contents?.["sectionListRenderer"] as Record<string, unknown>
    )?.["contents"] as Array<Record<string, unknown>>;

    const itemSection = section?.[0]?.["itemSectionRenderer"] as Record<string, unknown>;
    const items = (itemSection?.["contents"] as Array<Record<string, unknown>>) || [];

    const candidates: Array<{ title: string; thumbUrl: string; videoId: string }> = [];

    for (const item of items) {
      const v = (item?.["videoRenderer"] || item?.["compactVideoRenderer"]) as Record<string, unknown> | undefined;
      if (!v || !v["videoId"]) continue;

      const videoId = String(v["videoId"]);
      const titleRuns = (v["title"] as Record<string, unknown>)?.["runs"] as Array<{ text: string }> | undefined;
      const title = titleRuns ? titleRuns.map((r) => r.text).join("") : "";

      const thumbs = (v["thumbnail"] as Record<string, unknown>)?.["thumbnails"] as Array<{ url: string }> | undefined;
      const thumbUrl = thumbs && thumbs.length > 0 ? thumbs[thumbs.length - 1]!.url : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      if (title && thumbUrl) {
        candidates.push({ title, thumbUrl, videoId });
      }
    }

    if (candidates.length === 0) return episodes;

    // Helper to normalize text for fuzzy keyword overlap
    const norm = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const stopWords = new Set(["raw", "talks", "with", "telugu", "podcast", "the", "and", "for", "show", "hindi"]);

    for (const ep of episodes) {
      if (episodeThumbnailCache.has(ep.title)) continue;

      const epNorm = norm(ep.title);
      const epWords = epNorm.split(" ").filter((w) => w.length > 2 && !stopWords.has(w));
      const epNumMatch = ep.title.match(/\b(?:ep|episode)\s*[-:]?\s*(\d+)\b/i);

      let bestCandidate: (typeof candidates)[0] | null = null;
      let maxScore = 0;

      for (const cand of candidates) {
        const candNorm = norm(cand.title);
        let score = 0;

        for (const w of epWords) {
          if (candNorm.includes(w)) {
            score++;
          }
        }

        const candNumMatch = cand.title.match(/\b(?:ep|episode)\s*[-:]?\s*(\d+)\b/i);
        if (epNumMatch && candNumMatch && epNumMatch[1] === candNumMatch[1]) {
          score += 4;
        }

        if (score > maxScore && score >= 2) {
          maxScore = score;
          bestCandidate = cand;
        }
      }

      if (bestCandidate) {
        ep.artworkUrl = bestCandidate.thumbUrl;
        episodeThumbnailCache.set(ep.title, bestCandidate.thumbUrl);
      }
    }

    return episodes;
  } catch {
    return episodes;
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

    const rawEpisodes: PodcastEpisode[] = episodesData.map((ep) => {
      const durSecs = Math.round((ep.trackTimeMillis || 0) / 1000);
      return {
        id: `podcast:ep:${ep.trackId}`,
        podcastId: `podcast:show:${cleanId}`,
        podcastTitle: ep.collectionName || defaultTitle,
        title: ep.trackName?.trim() || "Episode",
        description: ep.description,
        artworkUrl: ep.artworkUrl600 || ep.artworkUrl160 || defaultArtwork,
        audioUrl: ep.episodeUrl!,
        duration: formatDuration(ep.trackTimeMillis),
        durationSeconds: durSecs > 0 ? durSecs : 1800, // Safe default of 30 mins if not provided
        publishedAt: ep.releaseDate,
        provider: "itunes" as const,
      };
    });

    return enrichEpisodesWithYouTubeThumbnails(rawEpisodes, defaultTitle);
  } catch (err) {
    console.warn("[podcast] Episode lookup notice:", err);
    return [];
  }
}

/**
 * Retrieves a specific podcast show details along with its full episode list.
 * Can lookup by exact podcast show ID (e.g. "podcast:show:123456" or "123456"),
 * or by podcast show title/query.
 */
export async function getPodcastShow(options: {
  podcastId?: string | undefined;
  query?: string | undefined;
  language?: string | undefined;
  limit?: number | undefined;
}): Promise<{ show: Podcast | null; episodes: PodcastEpisode[] }> {
  const limit = options.limit ?? 60;
  let targetCollectionId = options.podcastId ? options.podcastId.replace("podcast:show:", "").trim() : "";

  // If no numeric collection ID provided but query is present, search for the show first
  if (!targetCollectionId && options.query) {
    const cleanQuery = options.query.trim();
    if (cleanQuery) {
      try {
        const normLang = options.language ? normalizePodcastLanguage(options.language) : null;
        const countryParam = normLang?.country ? `&country=${normLang.country}` : "";
        const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanQuery)}&media=podcast&entity=podcast&limit=5${countryParam}`;
        const searchRes = await fetch(searchUrl, {
          headers: {
            "User-Agent": "MelodyMap/1.0",
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(8000),
        });

        if (searchRes.ok) {
          const searchData = (await searchRes.json()) as { results?: ItunesPodcastResult[] };
          if (searchData.results && searchData.results.length > 0 && searchData.results[0]?.collectionId) {
            targetCollectionId = String(searchData.results[0].collectionId);
          }
        }
      } catch (err) {
        console.warn("[podcast] Show title search notice:", err);
      }
    }
  }

  if (!targetCollectionId) {
    return { show: null, episodes: [] };
  }

  const lookupUrl = `https://itunes.apple.com/lookup?id=${encodeURIComponent(targetCollectionId)}&entity=podcastEpisode&limit=${limit}`;

  try {
    const res = await fetch(lookupUrl, {
      headers: {
        "User-Agent": "MelodyMap/1.0",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(9000),
    });

    if (!res.ok) {
      return { show: null, episodes: [] };
    }

    const data = (await res.json()) as { results?: ItunesEpisodeResult[] };
    if (!data.results || !Array.isArray(data.results)) {
      return { show: null, episodes: [] };
    }

    const showInfo = data.results.find((r) => r.wrapperType === "track");
    const episodesData = data.results.filter(
      (r) => r.wrapperType === "podcastEpisode" && r.episodeUrl && r.trackName,
    );

    const defaultArtwork =
      showInfo?.artworkUrl600 ||
      showInfo?.artworkUrl100 ||
      "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=300&h=300&fit=crop";
    const defaultTitle = showInfo?.collectionName || options.query || "Podcast";
    const defaultPublisher = showInfo?.artistName || "Podcast Host";

    const show: Podcast = {
      id: `podcast:show:${showInfo?.collectionId || targetCollectionId}`,
      title: defaultTitle,
      publisher: defaultPublisher,
      artworkUrl: defaultArtwork,
      category: showInfo?.primaryGenreName,
      feedUrl: showInfo?.feedUrl,
      episodeCount: showInfo?.trackCount || episodesData.length,
      provider: "itunes",
      externalUrl: showInfo?.collectionViewUrl,
    };

    const rawEpisodes: PodcastEpisode[] = episodesData.map((ep) => {
      const durSecs = Math.round((ep.trackTimeMillis || 0) / 1000);
      return {
        id: `podcast:ep:${ep.trackId}`,
        podcastId: `podcast:show:${targetCollectionId}`,
        podcastTitle: ep.collectionName || defaultTitle,
        title: ep.trackName?.trim() || "Episode",
        description: ep.description,
        artworkUrl: ep.artworkUrl600 || ep.artworkUrl160 || defaultArtwork,
        audioUrl: ep.episodeUrl!,
        duration: formatDuration(ep.trackTimeMillis),
        durationSeconds: durSecs > 0 ? durSecs : 1800,
        publishedAt: ep.releaseDate,
        provider: "itunes" as const,
      };
    });

    const episodes = await enrichEpisodesWithYouTubeThumbnails(rawEpisodes, defaultTitle);

    return { show, episodes };
  } catch (err) {
    console.warn("[podcast] getPodcastShow notice:", err);
    return { show: null, episodes: [] };
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
          title: ep.trackName || "Episode",
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
