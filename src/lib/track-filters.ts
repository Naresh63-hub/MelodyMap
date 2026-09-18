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
 * Unified duration string parser (e.g. "3:45", "1:02:15", "45") -> seconds.
 */
export function parseDurationSeconds(dur: string | undefined | null): number {
  if (!dur) return 0;
  const parts = dur.split(":").map((p) => Number(p.trim()));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/**
 * Strict validator to guarantee a track is a single, pure musical song.
 * Max duration 900s (15 min) for songs, allows jukeboxes if query explicitly asks.
 */
export function isMusicTrack(
  track: { title?: string; artist?: string; duration?: string } | null | undefined,
  allowLong?: boolean | unknown,
): boolean {
  if (!track || !track.title) return false;
  const isAllowLong = typeof allowLong === "boolean" ? allowLong : false;
  const title = track.title.toLowerCase();
  const artist = (track.artist || "").toLowerCase();

  if (NON_MUSIC_KEYWORDS.some((kw) => title.includes(kw) || artist.includes(kw))) return false;
  if (JUNK_MEDIA_KEYWORDS.some((kw) => title.includes(kw) || artist.includes(kw))) return false;
  if (!isAllowLong && COMPILATION_KEYWORDS.some((kw) => title.includes(kw))) return false;

  const secs = parseDurationSeconds(track.duration);
  const maxCap = isAllowLong ? 7200 : 900;
  if (secs > 0 && (secs < 30 || secs > maxCap)) return false;

  return true;
}

/**
 * Strict validator to guarantee a track is a genuine podcast episode.
 */
export function isPodcastTrack(
  track: { title?: string; artist?: string; duration?: string } | null | undefined,
  _ignored?: unknown,
): boolean {
  if (!track || !track.title) return false;
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
