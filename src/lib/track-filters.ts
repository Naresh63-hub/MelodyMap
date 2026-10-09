/**
 * Unified track validation, keyword bans, and duration parsing.
 * Shared across server and client to eliminate filter duplication.
 */

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
  /\b(remix|remixes|remixed|cover|covers|mix|mixes|mixed|mashup|mashups|instrumental|instrumentals|karaoke|acoustic|unplugged|tribute|recreation|lofi|lo-fi|lo fi|flip|bootleg|rework|reimagined|medley|slowed|reverb|bass boosted|sped up|speed up|club mix|dj mix|dance mix|chill mix|party mix|retro mix|extended mix|radio edit)\b/i;

export const NON_ORIGINAL_ARTIST_REGEX =
  /\b(cover|covers|instrumental|instrumentals|karaoke|tribute|lofi|lo-fi|slowed|reverb)\b/i;

/**
 * Strict validator to guarantee a track is an original song.
 * Rejects remixes, covers, mixes, mashups, instrumentals, acoustic cuts, lofi, etc.
 */
export function isOriginalSong(track: {
  title?: string | undefined;
  artist?: string | undefined;
  album?: string | undefined;
} | null | undefined): boolean {
  if (!track || !track.title) return false;
  const title = track.title;
  const artist = track.artist || "";
  const album = track.album || "";

  if (NON_ORIGINAL_TRACK_REGEX.test(title)) return false;
  if (album && NON_ORIGINAL_TRACK_REGEX.test(album)) return false;
  if (artist && (NON_ORIGINAL_TRACK_REGEX.test(artist) || NON_ORIGINAL_ARTIST_REGEX.test(artist))) return false;

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
 * Strict validator to guarantee a track is a genuine podcast episode.
 */
export function isPodcastTrack(
  track: { id?: string | undefined; source?: string | undefined; title?: string | undefined; artist?: string | undefined; duration?: string | number | undefined } | null | undefined,
  _ignored?: unknown,
): boolean {
  if (!track || !track.title) return false;
  if (track.source === "podcast" || track.id?.startsWith("podcast:")) return true;
  const title = track.title.toLowerCase();
  const artist = (track.artist || "").toLowerCase();

  if (JUNK_MEDIA_KEYWORDS.some((kw) => title.includes(kw) || artist.includes(kw))) return false;

  const secs = parseDurationSeconds(track.duration);
  const hasPodcastSignal = PODCAST_POSITIVE_KEYWORDS.some(
    (kw) => title.includes(kw) || artist.includes(kw),
  );

  if (hasPodcastSignal) return true;
  // If no explicit keyword, must be long-form audio (>= 5 mins) and NOT a standard music song
  if (secs >= 300 && !isMusicTrack(track)) return true;

  return false;
}
