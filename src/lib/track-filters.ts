/**
 * Unified track validation, keyword bans, and duration parsing.
 * Shared across server and client to eliminate filter duplication.
 */

import { isChannelOrLabelName } from "./track-metadata";

export const NON_MUSIC_KEYWORDS = [
  "podcast",
  "podcasts",
  "episode",
  "ep.",
  "ep ",
  "#ep",
  "interview",
  "reaction",
  "review",
  "vlog",
  "talk show",
  "talkshow",
  "audiobook",
  "documentary",
  "news",
  "discussion",
  "debate",
  "speech",
  "lecture",
  "commentary",
  "chapter",
  "session",
  "full movie",
  "trailer",
  "teaser",
  "making of",
  "standup",
  "comedy show",
  "livestream",
  "live stream",
  "raj shamani",
  "ranveer allahbadia",
  "beerbiceps",
  "prakhar",
  "samay raina",
  "huberman",
  "rogan",
  "lex fridman",
  "remix",
  "remixes",
  "cover",
  "covers",
  "mix",
  "mashup",
  "mashups",
  "version",
  "instrumental",
  "karaoke",
  "acoustic",
  "unplugged",
  "tribute",
  "recreation",
  "recreation",
  "dj mix",
  "dj remix",
  "club mix",
  "extended mix",
  "radio edit",
  "medley",
  "bootleg",
  "flip",
  "rework",
  "reimagined",
  "live performance",
  "live version",
] as const;

export const COMPILATION_KEYWORDS = [
  "jukebox",
  "audio playlist",
  "compilation",
  "all songs",
  "full album",
  "best of",
  "top 100",
  "non stop",
  "nonstop",
  "mashup mix",
  "hits collection",
  "audio songs jukebox",
] as const;

export const JUNK_MEDIA_KEYWORDS = [
  "trailer",
  "teaser",
  "gameplay",
  "reaction",
  "review",
  "vlog",
  "shorts",
  "tiktok",
  "unboxing",
  "prank",
  "making of",
  "behind the scenes",
  "tutorial",
  "comedy scene",
  "funny clips",
  "status video",
  "whatsapp status",
] as const;

export const PODCAST_POSITIVE_KEYWORDS = [
  "podcast",
  "podcasts",
  "episode",
  "ep.",
  "ep ",
  "#ep",
  "interview",
  "talk show",
  "talkshow",
  "audiobook",
  "huberman",
  "rogan",
  "lex fridman",
  "beerbiceps",
  "raj shamani",
  "ranveer allahbadia",
  "prakhar",
  "samay raina",
  "audio show",
  "storytelling",
  "stories",
  "lecture",
  "documentary",
  "masterclass",
  "deep dive",
] as const;

/**
 * Unified duration string parser (e.g. "3:45", "1:02:15", "45", or 225) -> seconds.
 */
export function parseDurationSeconds(dur: string | number | undefined | null): number {
  if (dur == null) return 0;
  if (typeof dur === "number") return Number.isFinite(dur) ? Math.max(0, Math.floor(dur)) : 0;
  const parts = dur.split(":").map((p) => Number(p.trim()));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/**
 * Regex for non-original music keywords: remixes, covers, mixes, mashups, lofi, etc.
 * Uses word boundaries so legitimate titles like "Matrix", "Six", "Reminisce" are untouched.
 */
export const NON_ORIGINAL_TRACK_REGEX =
  /\b(remix|remixes|remixed|cover|covers|mix|mixes|mixed|mashup|mashups|instrumental|instrumentals|karaoke|acoustic|unplugged|tribute|recreation|recreated|lofi|lo-fi|lo fi|flip|bootleg|rework|reimagined|medley|slowed|reverb|bass boosted|sped up|speed up|club mix|dj mix|dance mix|chill mix|party mix|retro mix|extended mix|radio edit|female version|male version|sad version|duet version|reprise|jhankar|dholki|ringtone|dialogue promo|dialogue|trailer|teaser|bgm|theme music|8d audio|3d audio|trap mix|chipmunk|nightcore|ai version|ai cover|guitar cover|piano cover|flute cover|violin cover|drum cover|dance cover|fan made|fans made)\b/i;

export const NON_ORIGINAL_ARTIST_REGEX =
  /\b(cover|covers|instrumental|instrumentals|karaoke|tribute|lofi|lo-fi|slowed|reverb|orchestra|jhankar|dj\s|remix|acoustic)\b/i;

/**
 * Strict filters for cheap local compilations, generic repackaged CDs, and festival holiday tracks.
 * Enforces pure Spotify-quality catalog integrity (original soundtracks & official singles only).
 */
export const LOCAL_COMPILATION_REGEX =
  /\b(classics\s+of|classic\s+telugu|classic\s+hindi|classic\s+tamil|ultimate\s+blockbuster|ultimate\s+hits|blockbuster\s+hits|blockbuster\s+tollywood|tollywood\s+ugadi|holi\s+special|bhaje\s+bhaje|rose\s+day|valentine\s+hits|valentines?\s+day|kuchi\s+kuchi|top\s+90s|top\s+80s|top\s+70s|best\s+of\s+tollywood|best\s+of\s+bollywood|all\s+time\s+hits|evergreen\s+hits|non\s*stop\s*hits|jani\s+master|hits\s+collection|songs\s+jukebox|audio\s+playlist|full\s+album\s+jukebox)\b/i;

/**
 * Rejects devotional, temple, religious chants, hymns, pooja, bhajans, keerthanas, and village paatalu.
 */
export const DEVOTIONAL_REGEX =
  /\b(devotional|bhajan|bhajans|keerthana|keerthanas|keerthanalu|stotram|stotrams|sloka|slokas|chalisa|aarti|pooja|puja|mantra|mantras|paatalu|suprabhatam|devatha|swamy|ayyappa|shiva|govinda|venkateswara|hanuman|ganesh|sai\s*baba|krishna|rama|namam|satsang|bhakthi|bhakti|annamayya|akkadevathala|keerthanam|dhyanam|harikatha)\b/i;

/**
 * Rejects speeches, discourses, web series, dialogues, scenes, and promos.
 */
export const SPOKEN_AND_PROMO_REGEX =
  /\b(speech|speeches|pravachanam|pravachan|discourse|web\s*series|kadapa|short\s*film|promo|first\s*look|motion\s*poster|glimpse|press\s*meet|audio\s*launch|dialogue\s*promo|dialogue|interview|scene|scenes)\b/i;

/**
 * Strict validator to guarantee a track is an original song.
 * Rejects remixes, covers, mixes, mashups, instrumentals, acoustic cuts, lofi,
 * cheap local compilations, devotional hymns, and spoken-word promos.
 */
export function isOriginalSong(track: {
  title?: string | undefined;
  artist?: string | undefined;
  album?: string | undefined;
  subtitle?: string | undefined;
} | null | undefined): boolean {
  if (!track || !track.title) return false;
  const title = track.title;
  const artist = track.artist || "";
  const album = track.album || "";
  const subtitle = track.subtitle || "";

  // 1. Remixes, covers, mixes, mashups, karaoke, lofi
  if (NON_ORIGINAL_TRACK_REGEX.test(title)) return false;
  if (album && NON_ORIGINAL_TRACK_REGEX.test(album)) return false;
  if (subtitle && NON_ORIGINAL_TRACK_REGEX.test(subtitle)) return false;
  if (artist && (NON_ORIGINAL_TRACK_REGEX.test(artist) || NON_ORIGINAL_ARTIST_REGEX.test(artist))) return false;

  // 2. Reject cheap local compilations & holiday festival CDs
  if (LOCAL_COMPILATION_REGEX.test(title)) return false;
  if (album && LOCAL_COMPILATION_REGEX.test(album)) return false;
  if (subtitle && LOCAL_COMPILATION_REGEX.test(subtitle)) return false;

  // 3. Reject devotional / religious temple chants & hymns
  if (DEVOTIONAL_REGEX.test(title)) return false;
  if (album && DEVOTIONAL_REGEX.test(album)) return false;
  if (subtitle && DEVOTIONAL_REGEX.test(subtitle)) return false;
  if (artist && DEVOTIONAL_REGEX.test(artist)) return false;

  // 4. Reject speeches, web series, dialogues, promo snippets
  if (SPOKEN_AND_PROMO_REGEX.test(title)) return false;
  if (album && SPOKEN_AND_PROMO_REGEX.test(album)) return false;
  if (subtitle && SPOKEN_AND_PROMO_REGEX.test(subtitle)) return false;

  return true;
}

/**
 * Strict validator to guarantee a track is a single, pure musical song.
 * Hard rule: only tracks <= 600s (10 min) are playable recommendations.
 * Unknown/invalid durations are rejected (parseDurationSeconds returns 0).
 */
export const MAX_TRACK_DURATION_SECONDS = 600;

export function isMusicTrack(
  track: { title?: string | undefined; artist?: string | undefined; album?: string | undefined; duration?: string | number | undefined } | null | undefined,
  allowLong?: boolean | unknown,
  allowUnknownDuration?: boolean | unknown,
): boolean {
  if (!track || !track.title) return false;
  const isAllowLong = typeof allowLong === "boolean" ? allowLong : false;
  const isAllowUnknown = typeof allowUnknownDuration === "boolean" ? allowUnknownDuration : false;

  if (!isOriginalSong(track)) return false;

  const title = track.title.toLowerCase();
  const artist = (track.artist || "").toLowerCase();

  if (NON_MUSIC_KEYWORDS.some((kw) => title.includes(kw) || artist.includes(kw))) return false;
  if (JUNK_MEDIA_KEYWORDS.some((kw) => title.includes(kw) || artist.includes(kw))) return false;
  if (!isAllowLong && COMPILATION_KEYWORDS.some((kw) => title.includes(kw))) return false;

  const secs = parseDurationSeconds(track.duration);
  const maxCap = isAllowLong ? 7200 : MAX_TRACK_DURATION_SECONDS;
  // Unknown duration (secs === 0): allow for library hydration if requested, otherwise exclude from fresh search
  if (secs <= 0) return isAllowUnknown;
  if (secs < 30 || secs > maxCap) return false;

  return true;
}

/**
 * Common music song and jukebox indicators that disqualify a track from being a podcast.
 */
const MUSIC_DISQUALIFIERS = [
  "song",
  "songs",
  "jukebox",
  "audio song",
  "video song",
  "romantic songs",
  "love vibes",
  "hit songs",
  "melody songs",
  "all songs",
  "music video",
  "soundtrack",
  "ost",
];

/**
 * Strict validator to guarantee a track is a genuine podcast episode.
 * Explicitly rejects music tracks, music compilations, and record label channels.
 */
export function isPodcastTrack(
  track: { id?: string | undefined; source?: string | undefined; title?: string | undefined; artist?: string | undefined; duration?: string | number | undefined } | null | undefined,
  _ignored?: unknown,
): boolean {
  if (!track || !track.title) return false;
  if (track.source === "podcast" || track.id?.startsWith("podcast:")) return true;
  const title = track.title.toLowerCase();
  const artist = (track.artist || "").toLowerCase();

  // Reject junk media tags
  if (JUNK_MEDIA_KEYWORDS.some((kw) => title.includes(kw) || artist.includes(kw))) return false;

  // Music record labels / channels are NEVER podcasts
  if (isChannelOrLabelName(track.artist)) return false;

  // Music song / jukebox terms are NEVER podcasts
  if (MUSIC_DISQUALIFIERS.some((kw) => title.includes(kw))) return false;

  // Must have an explicit podcast positive signal
  return PODCAST_POSITIVE_KEYWORDS.some((kw) => title.includes(kw) || artist.includes(kw));
}
