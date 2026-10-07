import { GENRES, MOODS, type Track } from "./library";

/**
 * Genre & Mood quick filters for the home feed.
 *
 * Filtering is instant and purely local: every active filter is matched against
 * the metadata of the tracks that are already loaded, so the feed narrows on the
 * same frame as the tap. The same definitions also carry the radio query used to
 * fetch fresh matching tracks afterwards through the existing `moodPicks` server
 * function (no AI key required).
 */

export type QuickFilterKind = "genre" | "mood";

export type QuickFilter = {
  /** Stable id, e.g. `genre:lo-fi` or `mood:chill`. */
  id: string;
  label: string;
  kind: QuickFilterKind;
  /** Keyword phrases matched against a track's text metadata (token-scoped). */
  keywords: readonly string[];
  /** Language codes that also count as a match (e.g. Desi / Bollywood). */
  languageCodes?: readonly string[];
  /** Query sent to the mood radio so fresh matching tracks can be fetched. */
  radioQuery: string;
};

const slug = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

type GenreSpec = { keywords: readonly string[]; languageCodes?: readonly string[]; radioQuery?: string };

const GENRE_SPECS: Record<string, GenreSpec> = {
  Pop: { keywords: ["pop", "top 40", "chart topper"], radioQuery: "popular pop hits" },
  "Hip-hop": { keywords: ["hip hop", "hip-hop", "rap", "trap", "drill", "freestyle"], radioQuery: "hip hop rap hits" },
  "R&B": { keywords: ["r&b", "rnb", "r and b", "soul", "neo soul"], radioQuery: "r&b soul hits" },
  Rock: { keywords: ["rock", "alt rock", "grunge", "punk"], radioQuery: "rock anthems" },
  Indie: { keywords: ["indie", "bedroom pop", "indie folk"], radioQuery: "indie songs" },
  Electronic: { keywords: ["electronic", "edm", "house", "techno", "dance", "remix", "synth"], radioQuery: "electronic edm dance" },
  Jazz: { keywords: ["jazz", "swing", "bebop", "saxophone"], radioQuery: "jazz classics" },
  "Lo-fi": { keywords: ["lo-fi", "lofi", "chillhop", "chill hop", "study beats"], radioQuery: "lofi chill beats" },
  Classical: { keywords: ["classical", "orchestra", "symphony", "carnatic", "hindustani"], radioQuery: "classical instrumental" },
  "Desi / Bollywood": {
    // Includes well-known playback singers so the instant filter still works on
    // tracks whose title/album carry no explicit "Bollywood" marker.
    keywords: [
      "bollywood",
      "desi",
      "filmi",
      "hindi",
      "tollywood",
      "kollywood",
      "punjabi",
      "arijit singh",
      "sid sriram",
      "ar rahman",
      "a r rahman",
      "anirudh ravichander",
      "diljit dosanjh",
      "shreya ghoshal",
      "s p balasubrahmanyam",
      "devi sri prasad",
      "kishore kumar",
      "lata mangeshkar",
    ],
    languageCodes: ["hi", "te", "ta", "pa", "ml", "kn", "bn", "mr", "gu", "ur"],
    radioQuery: "bollywood hindi hits",
  },
  Afrobeats: { keywords: ["afrobeats", "afrobeat", "amapiano", "afropop"], radioQuery: "afrobeats hits" },
  Metal: { keywords: ["metal", "heavy metal", "metalcore", "hardcore"], radioQuery: "metal heavy riffs" },
};

/** Mood keywords; the radio query is the mood label, which `moodPicks` already maps. */
const MOOD_KEYWORDS: Record<string, readonly string[]> = {
  "late night": ["late night", "midnight", "night drive", "insomnia"],
  "upbeat workout": ["workout", "gym", "energetic", "running", "motivation", "pump up"],
  focus: ["focus", "study", "concentration", "instrumental", "ambient"],
  "sad hours": ["sad", "heartbreak", "broken heart", "lonely", "alone", "judaai", "tears"],
  throwbacks: ["throwback", "retro", "old is gold", "evergreen", "90s", "80s"],
  romantic: ["romantic", "love", "pyar", "ishq", "dil", "valentine"],
  happy: ["happy", "feel good", "joy", "sunshine", "celebration"],
  party: ["party", "dance", "club", "anthem", "banger"],
  chill: ["chill", "relax", "calm", "mellow", "soothing", "acoustic", "lofi", "lo-fi"],
  devotional: [
    "devotional",
    "bhajan",
    "bhakti",
    "mantra",
    "temple",
    "aarti",
    "ganesh",
    "shiva",
    "krishna",
    "hanuman",
    "sai",
    "durga",
  ],
};

export const QUICK_FILTERS: readonly QuickFilter[] = [
  ...GENRES.map((genre): QuickFilter => {
    const spec: GenreSpec = GENRE_SPECS[genre] ?? { keywords: [genre.toLowerCase()] };
    return {
      id: `genre:${slug(genre)}`,
      label: genre,
      kind: "genre",
      keywords: spec.keywords,
      ...(spec.languageCodes ? { languageCodes: spec.languageCodes } : {}),
      radioQuery: spec.radioQuery ?? `${genre} songs`,
    };
  }),
  ...MOODS.map(
    (mood): QuickFilter => ({
      id: `mood:${slug(mood)}`,
      label: mood,
      kind: "mood",
      keywords: MOOD_KEYWORDS[mood] ?? [mood],
      radioQuery: mood,
    }),
  ),
];

const FILTERS_BY_ID = new Map(QUICK_FILTERS.map((filter) => [filter.id, filter]));

export function findQuickFilter(id: string): QuickFilter | undefined {
  return FILTERS_BY_ID.get(id);
}

export function quickFiltersByKind(kind: QuickFilterKind): readonly QuickFilter[] {
  return QUICK_FILTERS.filter((filter) => filter.kind === kind);
}

/** Add or remove a filter id (order preserved) — used by the chip bar. */
export function toggleQuickFilter(activeIds: readonly string[], id: string): string[] {
  return activeIds.includes(id) ? activeIds.filter((existing) => existing !== id) : [...activeIds, id];
}

/** Fold case, strip diacritics, and expand `&` so "R&B" and "r&b" share tokens. */
function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  const normalized = normalizeText(value);
  return normalized ? normalized.split(" ") : [];
}

/** Contiguous token match, so "pop" never matches "popular". */
function hasPhrase(haystack: string[], phrase: string[]): boolean {
  if (phrase.length === 0 || phrase.length > haystack.length) return false;
  outer: for (let i = 0; i + phrase.length <= haystack.length; i++) {
    for (let j = 0; j < phrase.length; j++) {
      if (haystack[i + j] !== phrase[j]) continue outer;
    }
    return true;
  }
  return false;
}

/** Text metadata a track can be matched against. */
export function trackFilterText(track: Track): string {
  return [track.title, track.artist, track.album, track.reason, track.languageCode].filter(Boolean).join(" ");
}

export function matchesQuickFilter(track: Track, filter: QuickFilter): boolean {
  if (filter.languageCodes?.length && track.languageCode) {
    const code = track.languageCode.toLowerCase().slice(0, 2);
    if (filter.languageCodes.includes(code)) return true;
  }
  const haystack = tokenize(trackFilterText(track));
  return filter.keywords.some((keyword) => hasPhrase(haystack, tokenize(keyword)));
}

/**
 * Instant feed filtering. A track is kept when it matches ANY active filter
 * (union), which behaves predictably when a genre and a mood are combined on a
 * feed that is only a few dozen tracks deep. No filters -> the feed is returned
 * untouched (same array identity, so React can skip work).
 */
export function filterTracksByQuickFilters(tracks: readonly Track[], activeIds: readonly string[]): Track[] {
  if (activeIds.length === 0) return tracks as Track[];
  const filters = activeIds.map(findQuickFilter).filter((filter): filter is QuickFilter => Boolean(filter));
  if (filters.length === 0) return tracks as Track[];
  return tracks.filter((track) => filters.some((filter) => matchesQuickFilter(track, filter)));
}

/** How many of these tracks match a filter — drives the chip counts. */
export function countQuickFilterMatches(tracks: readonly Track[], filter: QuickFilter): number {
  return tracks.reduce((total, track) => (matchesQuickFilter(track, filter) ? total + 1 : total), 0);
}

/** Deduplicated radio queries for the active filters (fetch fresh matching tracks). */
export function quickFilterRadioQueries(activeIds: readonly string[]): string[] {
  const queries = activeIds
    .map(findQuickFilter)
    .filter((filter): filter is QuickFilter => Boolean(filter))
    .map((filter) => filter.radioQuery);
  return Array.from(new Set(queries));
}
