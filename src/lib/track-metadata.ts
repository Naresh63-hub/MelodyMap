/**
 * Display-metadata normalisation for catalog tracks (JioSaavn-first).
 *
 * Catalog APIs are noisy. JioSaavn returns film songs in the shape
 * `Song Name (From "Movie") (Telugu)` and, worse, mirrors that whole string into
 * the `album` field, so the movie name is never available for display and the
 * `(Telugu)` / `(From "...")` junk leaks into every card. This module turns that
 * raw text into the two things a listener actually wants on a card:
 *
 *   1. a clean song title  → "Yeshanagula"
 *   2. the movie/album name → "The Paradise"
 *
 * It also recognises YouTube channel / record-label names ("Aditya Music
 * PLAYBACK", "SriBalajiMovies", "Foo - Topic", "XVEVO") so they never appear
 * where an artist belongs.
 *
 * Everything here is pure and dependency-free so it can be unit-tested and
 * shared by the provider mappers, the feed cleaners and the UI.
 */

/** Languages JioSaavn tags onto titles/albums, e.g. "The Paradise (Telugu)". */
const LANGUAGE_TAGS = [
  "telugu", "hindi", "tamil", "malayalam", "kannada", "punjabi", "english",
  "bengali", "marathi", "gujarati", "bhojpuri", "urdu", "korean", "spanish",
  "japanese", "arabic", "assamese", "oriya", "odia", "nepali", "sanskrit",
  "konkani", "tulu", "rajasthani", "haryanvi", "sindhi", "manipuri",
] as const;

/** Trailing tags that are never part of a title or a movie name. */
const NOISE_TAGS = [
  "original motion picture soundtrack", "original soundtrack", "soundtrack",
  "single", "album version", "deluxe", "deluxe edition", "remastered",
  "remaster", "explicit", "clean", "from the album",
] as const;

/**
 * Album strings that are compilations / playlists / EPs rather than a movie or
 * an album a listener would recognise.
 */
const NON_MOVIE_ALBUM_PATTERNS: RegExp[] = [
  /\bbest of\b/i, /\bhits?\b/i, /\bcollection\b/i, /\btop\s*\d+/i,
  /\bplaylist\b/i, /\bessentials?\b/i, /\bevergreen\b/i, /\bmelodies\b/i,
  /\bgreatest\b/i, /\bvol\.?\s*\d+/i, /\bvolume\s*\d+/i, /\bmix\b/i,
  /\btribute\b/i, /\bkaraoke\b/i, /\bcovers?\b/i, /\bmashup\b/i,
  /\bcompilation\b/i, /\bchartbusters?\b/i, /\bromantic songs?\b/i,
  /\blove songs?\b/i, /\bdj\b/i, /\bremix(es)?\b/i, /\bnon[- ]?stop\b/i,
  /\blofi\b/i, /\blo-fi\b/i, /\binstrumental\b/i, /\bmedley\b/i,
];

/** Channel / label signatures that must never be shown as an artist. */
const CHANNEL_OR_LABEL_PATTERNS: RegExp[] = [
  /\bvevo\b/i,
  /vevo$/i,
  /-\s*topic$/i,
  /\bofficial\b/i,
  // End-anchored forms catch CamelCase channel handles ("SriBalajiMovies",
  // "AdityaMusic") where \b never triggers inside the glued word.
  /movies?$/i,
  /musics?$/i,
  /films?$/i,
  /records?$/i,
  /studios?$/i,
  /entertainments?$/i,
  /tunes?$/i,
  /\btrending\b/i,
  /\bcurated\b/i,
  /\bplaylists?$/i,
  /\bplayback\b/i,
  /\brecords?\b/i,
  /\bmusic\b/i,
  /\bentertainment\b/i,
  /\bfilms?\b/i,
  /\bmovies?\b/i,
  /\bstudios?\b/i,
  /\bproductions?\b/i,
  /\blabel\b/i,
  /\bmedia\b/i,
  /\bacademy\b/i,
  /\bchannel\b/i,
  /\bdigitals?\b/i,
  /\bt[- ]series\b/i,
  /\bsaregama\b/i,
  /\bsa re ga ma\b/i,
  /\blahari\b/i,
  /\byrf\b/i,
  /\btips\b/i,
  /\baditya\b/i,
  /\bgeetha arts\b/i,
  /\bthink music\b/i,
  /\bmango music\b/i,
  /\bmadhura\b/i,
  /\btimes music\b/i,
  /\bspeed records\b/i,
  /\beros\b/i,
  /\bzeemusic\b/i,
  /\bvolga\b/i,
  /\bmusic\s*box\b/i,
  /\bpaata\b/i,
];

/**
 * Video/YouTube junk that shows up in titles but is never part of a song name.
 * NOTE: a bare `song` word is deliberately NOT stripped — real titles contain it
 * ("Some Song", "Sad Song") and only the compound forms are junk.
 */
const VIDEO_JUNK_PATTERNS: RegExp[] = [
  /\b(4k|8k|hd|1080p|720p)\b/gi,
  /\b(video\s*song|lyric(al)?\s*video|full\s*video|full\s*song|audio\s*song|song\s*with\s*lyrics|with\s*lyrics|lyrics?|lyrical)\b/gi,
  /\b(official|original)\s+(music\s+)?(video|audio|track|song)\b/gi,
  /\bplayback\s*(song|video)?\b/gi,
];

/** Trailing "- Single" / "- EP" / "- Deluxe" style release suffixes. */
const TRAILING_RELEASE_SUFFIX_RE = /\s*[-–—_]\s*(single|ep|deluxe(\s+edition)?|remaster(ed)?|album\s+version)\s*$/gi;

/** Decode the HTML entities the catalog APIs emit (`&quot;`, `&#39;`, …). */
export function decodeEntities(text: string | undefined | null): string {
  if (!text) return "";
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tidy(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\(\s*\)|\[\s*\]/g, "") // empty brackets left behind by removals
    .replace(/\s*[-–—:|,]+\s*$/g, "")
    .replace(/^\s*[-–—:|,]+\s*/g, "")
    .replace(/\s+([,.)])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Remove *unmatched* trailing closers/quotes left behind when a `(From "…")`
 * style clause is cut out — e.g. `Tu Jahaan")` -> `Tu Jahaan`.
 * Balanced brackets are preserved so genuine titles survive:
 * `Bohemian Rhapsody (Live Aid)` is untouched.
 */
function stripDanglingClosers(text: string): string {
  let out = text.trim();
  const count = (s: string, ch: string) => s.split(ch).length - 1;
  for (let i = 0; i < 4; i++) {
    const before = out;
    if (count(out, "(") < count(out, ")") && /\)\s*$/.test(out)) out = out.replace(/\)\s*$/, "").trim();
    if (count(out, "[") < count(out, "]") && /\]\s*$/.test(out)) out = out.replace(/\]\s*$/, "").trim();
    if (count(out, "{") < count(out, "}") && /\}\s*$/.test(out)) out = out.replace(/\}\s*$/, "").trim();
    if (count(out, '"') % 2 === 1 && /"\s*$/.test(out)) out = out.replace(/"\s*$/, "").trim();
    if (count(out, "'") % 2 === 1 && /'\s*$/.test(out)) out = out.replace(/'\s*$/, "").trim();
    if (out === before) break;
  }
  return tidy(out);
}

/** Remove a trailing "(Telugu)" / "(Hindi)" / "(Original Motion Picture Soundtrack)". */
export function stripLanguageAndNoiseTags(text: string): string {
  let out = text;
  let changed = true;
  while (changed) {
    changed = false;
    const tagRe = /[([{]\s*([^()\[\]{}]*?)\s*[)\]}]\s*$/;
    const m = out.match(tagRe);
    if (!m || !m[1]) continue;
    const inner = m[1].trim().toLowerCase().replace(/[\s-]+/g, " ");
    const isLang = LANGUAGE_TAGS.some((l) => inner === l);
    const isNoise = NOISE_TAGS.some((n) => inner === n);
    if (isLang || isNoise) {
      out = out.slice(0, m.index).trim();
      changed = true;
    }
  }
  return out;
}

/**
 * Pull the movie name out of an `(From "Movie")` / `[From the movie X]` clause.
 * Returns undefined when there is no such clause.
 */
export function extractFromClause(text: string): string | undefined {
  const decoded = decodeEntities(text);
  // "from the movie X" first: the generic pattern would otherwise swallow
  // "the movie Vikram" as the movie name.
  const patterns = [
    /[([{]\s*from\s+the\s+(?:movie|film|series|album)\s+["'“‘]?([^"'“”’)\]}]+)["'“”’]?\s*[)\]}]\s*$/i,
    /[([{]\s*from\s*[:\-]?\s*["'“‘]?([^"'“”’)\]}]+)["'“”’]?\s*[)\]}]\s*$/i,
    /[([{]\s*from\s*[:\-]?\s*["'“‘]?([^"'“”’)\]}]+)["'“”’]?\s*[)\]}]\s*/i,
  ];
  for (const re of patterns) {
    const m = decoded.match(re);
    if (m && m[1]) {
      // A quoted name may legitimately start with "Movie"/"Film", so the
      // "the movie/film <name>" phrasing is handled purely by the first,
      // more specific pattern above rather than by stripping the capture.
      const movie = stripDanglingClosers(stripLanguageAndNoiseTags(m[1]));
      if (movie) return movie;
    }
  }
  return undefined;
}

/**
 * Normalise a raw song title for display: strips `(From "Movie")` clauses,
 * language/soundtrack tags and YouTube video junk, and repairs dangling quotes.
 */
export function cleanSongTitle(rawTitle: string | undefined | null): string {
  if (!rawTitle) return "";
  let title = decodeEntities(rawTitle);

  // Drop the "(From "Movie")" / "[From the movie X]" clause wherever it sits.
  title = title
    .replace(/[([{]\s*from\s*[:\-]?\s*["'“‘]?[^"'“”’)\]}]+["'“”’]?\s*[)\]}]\s*/gi, " ")
    .replace(/[([{]\s*from\s+the\s+(?:movie|film|series|album)\s+["'“‘]?[^"'“”’)\]}]+["'“”’]?\s*[)\]}]\s*/gi, " ");

  // Drop "| Official Video" style tails before the generic junk pass.
  title = title.replace(/\s*\|\s*.*$/g, " ").replace(/[~]\s*(topic|vevo)\s*$/gi, " ");
  title = stripLanguageAndNoiseTags(title);
  title = title.replace(TRAILING_RELEASE_SUFFIX_RE, " ");
  for (const re of VIDEO_JUNK_PATTERNS) title = title.replace(re, " ");
  title = title
    .replace(/[)\]}]\s*$/g, " ")   // dangling closing bracket from a cut clause
    .replace(/^["'“‘]+|["'“”’]+$/g, " ");

  const cleaned = stripDanglingClosers(title);
  return cleaned || stripDanglingClosers(decodeEntities(rawTitle));
}

/**
 * Derive a real movie / album name. `rawAlbum` is the catalog's album field,
 * which JioSaavn pollutes by mirroring the raw title into it.
 */
export function cleanMovieName(
  rawAlbum: string | undefined | null,
  songTitle?: string | undefined,
): string | undefined {
  if (!rawAlbum) return undefined;
  const decoded = decodeEntities(rawAlbum);
  const title = cleanSongTitle(songTitle);

  // Album mirrors the title ("Basinga Balaalu") -> it carries no movie info,
  // but it may still hide one in a "(From "…")" clause.
  const fromClause = extractFromClause(decoded);
  if (fromClause) return fromClause;

  let candidate = stripDanglingClosers(stripLanguageAndNoiseTags(decoded));
  if (!candidate) return undefined;
  // A bare language tag is not a movie.
  if (LANGUAGE_TAGS.some((l) => candidate.toLowerCase() === l)) return undefined;

  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();

  if (title && normalize(candidate) === normalize(title)) return undefined;
  if (title && normalize(candidate).startsWith(`${normalize(title)} from `)) return undefined;
  if (NON_MOVIE_ALBUM_PATTERNS.some((re) => re.test(candidate))) return undefined;
  if (candidate.length < 2 || candidate.length > 90) return undefined;
  return candidate;
}

/**
 * Tidy an album string for storage: strips language/soundtrack tags and dangling
 * brackets, but keeps compilation-style names (which `cleanMovieName` rejects).
 */
export function cleanAlbumName(rawAlbum: string | undefined | null): string {
  if (!rawAlbum) return "";
  const decoded = decodeEntities(rawAlbum);
  const fromClause = extractFromClause(decoded);
  if (fromClause) return fromClause; // album mirrored the title; the clause is the real album
  return stripDanglingClosers(stripLanguageAndNoiseTags(decoded));
}

/** True when `name` looks like a YouTube channel or a record label, not an artist. */
export function isChannelOrLabelName(name: string | undefined | null): boolean {
  if (!name) return false;
  const n = decodeEntities(name).trim();
  if (!n) return false;
  const parts = n.split(/\s*[,&]\s*/).map((p) => p.trim()).filter(Boolean);
  // Only treat it as a channel when EVERY name in the list is label-ish.
  return parts.length > 0 && parts.every((p) => CHANNEL_OR_LABEL_NAME_MATCH(p));
}

/** Internal single-name check (kept separate so lists can be evaluated as a whole). */
function CHANNEL_OR_LABEL_NAME_MATCH(part: string): boolean {
  if (/^[^a-z0-9]*$/i.test(part)) return false;
  if (CHANNEL_OR_LABEL_PATTERNS.some((re) => re.test(part))) return true;
  const splitCamel = part.replace(/([a-z])([A-Z])/g, "$1 $2");
  return CHANNEL_OR_LABEL_PATTERNS.some((re) => re.test(splitCamel));
}

/**
 * What a track card should show under the song name: the movie it belongs to
 * when known, otherwise the artist — but never a channel or label name.
 */
export function trackSubtitle(track: {
  title?: string | undefined;
  artist?: string | undefined;
  album?: string | undefined;
} | null | undefined): string {
  if (!track) return "";
  const movie = cleanMovieName(track.album, track.title);
  if (movie) return movie;
  const artist = decodeEntities(track.artist);
  if (artist && !isChannelOrLabelName(artist)) return stripDanglingClosers(artist);
  return "";
}
