import { LANGUAGE_ARTISTS, COMPOSERS_BY_LANGUAGE } from "./language-artists";
import {
  extractPrimaryArtist,
  normalizeArtistAlias,
  dedupeTracks,
  diversifyTrackList,
  type TrackLike,
} from "./track-dedup";
import { LANGUAGES, type Track } from "./library";
import { isOriginalSong } from "./track-filters";
import { hasPlayableDuration } from "./feed-freshness";

export interface ParsedDjPrompt {
  energy: "chill" | "medium" | "high";
  era: "classic" | "retro" | "modern" | "all";
  languages: string[];
  artists: string[];
  vibeKeywords: string[];
  title: string;
}

export interface QuickVibePreset {
  id: string;
  emoji: string;
  label: string;
  prompt: string;
  color: string;
}

export const QUICK_VIBE_PRESETS: QuickVibePreset[] = [
  {
    id: "late-night-drive",
    emoji: "🚗",
    label: "Late Night Drive",
    prompt: "Late night highway drive with melodic bass and soothing vocals",
    color: "from-blue-600/30 to-indigo-900/40 border-blue-500/30",
  },
  {
    id: "rainy-monsoon",
    emoji: "🌧️",
    label: "Rainy Melodies",
    prompt: "Soulful acoustic monsoon melodies with soft acoustic guitar and flute",
    color: "from-cyan-600/30 to-sky-900/40 border-cyan-500/30",
  },
  {
    id: "gym-pump",
    emoji: "⚡",
    label: "Workout Mass Beats",
    prompt: "High-energy mass dance anthems with heavy bass and workout rhythm",
    color: "from-amber-600/30 to-red-900/40 border-amber-500/30",
  },
  {
    id: "sunday-chill",
    emoji: "☕",
    label: "Sunday Acoustic Chill",
    prompt: "Soothing acoustic morning coffee melodies with gentle relaxing singing",
    color: "from-emerald-600/30 to-teal-900/40 border-emerald-500/30",
  },
  {
    id: "90s-nostalgia",
    emoji: "📻",
    label: "90s Golden Era",
    prompt: "Evergreen 90s golden melodies and nostalgic vintage classic songs",
    color: "from-purple-600/30 to-fuchsia-900/40 border-purple-500/30",
  },
  {
    id: "deep-focus",
    emoji: "🌿",
    label: "Focus & Flow",
    prompt: "Calm instrumental flow and relaxing background tunes for deep work",
    color: "from-emerald-600/30 to-cyan-900/40 border-emerald-500/30",
  },
];

/**
 * Parses user prompt into structured mood, era, language, and artist vectors.
 */
export function parseDjPrompt(rawPrompt: string, defaultLanguages: string[] = []): ParsedDjPrompt {
  const p = (rawPrompt || "").toLowerCase().trim();

  // 1. Detect Energy
  let energy: "chill" | "medium" | "high" = "medium";
  if (
    /\b(gym|workout|pump|fast|party|dance|mass|high\s*energy|dj|edm|beat|beats|running|hype)\b/i.test(p)
  ) {
    energy = "high";
  } else if (
    /\b(chill|relax|soothing|sleep|calm|soft|acoustic|coffee|peaceful|lofi|slow|unwind|study)\b/i.test(p)
  ) {
    energy = "chill";
  }

  // 2. Detect Era
  let era: "classic" | "retro" | "modern" | "all" = "all";
  if (/\b(90s|90's|1990|80s|vintage|classic|retro|golden|evergreen|old)\b/i.test(p)) {
    era = "classic";
  } else if (/\b(2000s|2000's|early\s*2000)\b/i.test(p)) {
    era = "retro";
  } else if (/\b(latest|new|recent|fresh|2024|2025|2026|current)\b/i.test(p)) {
    era = "modern";
  }

  // 3. Detect Languages
  const detectedLangs: string[] = [];
  for (const lang of LANGUAGES) {
    const regex = new RegExp(`\\b${lang.toLowerCase()}\\b`, "i");
    if (regex.test(p)) {
      detectedLangs.push(lang);
    }
  }
  const languages = detectedLangs.length > 0 ? detectedLangs : (defaultLanguages.length > 0 ? defaultLanguages : ["Telugu", "Hindi"]);

  // 4. Detect Artists or Composers
  const artists: string[] = [];
  for (const [_, artistList] of Object.entries(LANGUAGE_ARTISTS)) {
    for (const art of artistList) {
      if (p.includes(art.toLowerCase()) && !artists.includes(art)) {
        artists.push(art);
      }
    }
  }
  for (const [_, composerList] of Object.entries(COMPOSERS_BY_LANGUAGE)) {
    for (const comp of composerList) {
      if (p.includes(comp.toLowerCase()) && !artists.includes(comp)) {
        artists.push(comp);
      }
    }
  }

  // 5. Extract Vibe Keywords
  const vibeKeywords: string[] = [];
  const keywordCandidates = [
    "monsoon", "rain", "highway", "drive", "travel", "road trip",
    "romantic", "love", "melody", "heartbreak", "sad", "happy", "celebration",
    "guitar", "flute", "piano", "violin", "folk", "indie", "soulful",
    "breezy", "ambient", "night", "morning", "sunset", "dusk",
  ];
  for (const kw of keywordCandidates) {
    if (p.includes(kw)) {
      vibeKeywords.push(kw);
    }
  }

  // Generate a clean title for the DJ playlist
  let title = "Melody DJ Mix";
  if (artists.length > 0) {
    title = `${artists[0]} & Similar Vibe`;
  } else if (vibeKeywords.length > 0) {
    const cap = vibeKeywords[0]!.charAt(0).toUpperCase() + vibeKeywords[0]!.slice(1);
    title = `${cap} Vibe DJ`;
  } else if (energy === "high") {
    title = "High Energy DJ Mix";
  } else if (energy === "chill") {
    title = "Chill Acoustic DJ Mix";
  }

  return {
    energy,
    era,
    languages,
    artists,
    vibeKeywords,
    title,
  };
}

/**
 * Builds search queries tailored to the parsed DJ prompt.
 */
export function buildDjQueries(parsed: ParsedDjPrompt): string[] {
  const queries: string[] = [];
  const primaryLang = parsed.languages[0] || "";

  // 1. If specific artists were mentioned, prioritize them
  if (parsed.artists.length > 0) {
    for (const art of parsed.artists) {
      if (parsed.era === "classic") {
        queries.push(`${art} classic golden hits`);
      } else if (parsed.energy === "high") {
        queries.push(`${art} high energy mass dance hits`);
      } else if (parsed.energy === "chill") {
        queries.push(`${art} soulful acoustic melodies`);
      } else {
        queries.push(`${art} best hit songs`);
      }
    }
  }

  // 2. Language & Vibe combinations
  for (const lang of parsed.languages) {
    const l = lang.toLowerCase();
    for (const vibe of parsed.vibeKeywords) {
      queries.push(`${l} ${vibe} songs`);
      queries.push(`${l} ${vibe} melodies`);
    }

    if (parsed.era === "classic") {
      queries.push(`${l} 90s evergreen melodies`);
      queries.push(`${l} classic golden era songs`);
    }

    if (parsed.energy === "high") {
      queries.push(`${l} mass workout dance hits`);
      queries.push(`${l} high energy party songs`);
    } else if (parsed.energy === "chill") {
      queries.push(`${l} relaxing acoustic coffee songs`);
      queries.push(`${l} soothing chill melodies`);
    } else {
      queries.push(`${l} best travel drive songs`);
    }
  }

  // 3. Fallbacks if queries list is sparse
  if (queries.length < 3) {
    const l = primaryLang.toLowerCase();
    queries.push(`${l} popular melodies hits`);
    queries.push(`${l} top chart songs`);
  }

  return Array.from(new Set(queries)).slice(0, 6);
}

/**
 * Formats and deduplicates candidate tracks for the Melody DJ queue.
 */
export function formatDjTracks<T extends TrackLike>(
  candidates: readonly T[],
  parsed: ParsedDjPrompt,
  limit = 20,
): T[] {
  const validTracks = candidates.filter((t) => {
    if (!t || !t.title) return false;
    return isOriginalSong(t) && hasPlayableDuration(t);
  });

  const deduped = dedupeTracks(validTracks);
  const diversified = diversifyTrackList(deduped, {
    maxPerArtist: 2,
    maxPerAlbum: 1,
    minArtistSpacing: 2,
    minAlbumSpacing: 3,
  });

  return diversified.slice(0, limit);
}
