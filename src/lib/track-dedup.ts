/**
 * Reusable track identity & deduplication helpers.
 *
 * Use these everywhere tracks are collected — queue, playlists, likes,
 * history, recommendations, search, downloads — so duplicate-detection
 * logic lives in exactly one place.
 *
 * This module is intentionally free of circular dependencies: it defines
 * a minimal compatible Track interface rather than importing from library.ts.
 */

import { parseDurationSeconds } from "./track-filters";
import { cleanMovieName, cleanSongTitle, isChannelOrLabelName } from "./track-metadata";

/** Minimal track shape used for identity and comparison. */
export interface TrackLike {
  id: string;
  title: string;
  artist: string;
  duration?: string | number | undefined;
  thumbnail?: string | undefined;
  reason?: string | undefined;
  previewUrl?: string | undefined;
  source?: string | undefined;
}

// ─── Normalization & Fuzzy Distance ─────────────────────────────────

/** Lowercase, collapse whitespace, strip noise words/punctuation. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘'’`]/g, "'") // normalize smart quotes
    .replace(/[()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .replace(
      /\b(official|music|video|audio|lyric|lyrics|lyrical|hd|4k|8k|mv|vevo|topic|full song|full video|full audio|song|songs|track|tracks|remastered|remaster|live version|live|acoustic version|acoustic)\b/gi,
      "",
    )
    .replace(/[^\p{L}\p{N}' ]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokenize and return sorted unique word set for order-independent comparison */
export function tokenizeSorted(s: string): string[] {
  return Array.from(new Set(norm(s).split(/\s+/).filter(Boolean))).sort();
}

/** Levenshtein distance calculation between two normalized strings */
export function levenshteinDistance(s1: string, s2: string): number {
  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;

  const v0 = new Int32Array(s2.length + 1);
  const v1 = new Int32Array(s2.length + 1);

  for (let i = 0; i <= s2.length; i++) v0[i] = i;

  for (let i = 0; i < s1.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < s2.length; j++) {
      const cost = s1[i] === s2[j] ? 0 : 1;
      const val1 = (v1[j] ?? 0) + 1;
      const val2 = (v0[j + 1] ?? 0) + 1;
      const val3 = (v0[j] ?? 0) + cost;
      v1[j + 1] = Math.min(val1, val2, val3);
    }
    for (let j = 0; j <= s2.length; j++) v0[j] = v1[j] ?? 0;
  }
  return v0[s2.length] ?? s2.length;
}

/** Fuzzy string similarity score between 0.0 (completely different) and 1.0 (identical) */
export function stringSimilarity(s1: string, s2: string): number {
  const n1 = norm(s1);
  const n2 = norm(s2);
  if (!n1 && !n2) return 1.0;
  if (!n1 || !n2) return 0.0;
  if (n1 === n2) return 1.0;

  // Token-sorted comparison (handles "Artist - Song" vs "Song - Artist")
  const tokens1 = tokenizeSorted(n1).join(" ");
  const tokens2 = tokenizeSorted(n2).join(" ");
  if (tokens1 === tokens2) return 0.98;

  const maxLen = Math.max(tokens1.length, tokens2.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(tokens1, tokens2);
  return Math.max(0, 1.0 - dist / maxLen);
}

/** Duration tolerance: two tracks are "the same length" if within ±8 seconds. */

const DURATION_TOLERANCE = 8;

function durationSec(d: string | number | undefined): number {
  if (typeof d === "number") return d;
  return parseDurationSeconds(d);
}


// ─── Identity & Multi-Factor Similarity ──────────────────────────

/**
 * Stable identity string for a track.
 */
export function getTrackIdentity(track: TrackLike): string {
  if (track.source && track.id) {
    return `${track.source}:${track.id}`;
  }
  return `meta:${norm(track.title)}|${norm(track.artist)}`;
}

/**
 * Multi-factor similarity score between two tracks (0.0 to 1.0).
 * Weighted across Title (40%), Artist (40%), and Duration (20%).
 */
export function calculateTrackSimilarity(a: TrackLike, b: TrackLike): number {
  if (a.id === b.id) return 1.0;

  const titleScore = stringSimilarity(a.title, b.title);
  const artistScore = stringSimilarity(a.artist, b.artist);

  const durA = durationSec(a.duration);
  const durB = durationSec(b.duration);

  // Same song re-uploaded by a different label channel (e.g. Sony Music India vs Aditya Music):
  // near-identical title AND duration => same song regardless of channel name
  if (titleScore >= 0.92 && durA > 0 && durB > 0 && Math.abs(durA - durB) <= 3) {
    return 0.95; // >= 0.88 threshold => duplicate
  }

  let durationScore = 0.85; // neutral when duration is unknown

  if (durA > 0 && durB > 0) {
    const diff = Math.abs(durA - durB);
    if (diff <= 3) durationScore = 1.0;
    else if (diff <= DURATION_TOLERANCE) durationScore = 0.8;
    else if (diff > 45) return 0.2; // Likely radio vs extended or completely different
    else durationScore = Math.max(0.1, 1.0 - diff / 30);
  }

  return titleScore * 0.45 + artistScore * 0.4 + durationScore * 0.15;
}

/**
 * Check if two tracks represent the same logical song using multi-factor matching.
 */
export function areSameTrack(a: TrackLike, b: TrackLike): boolean {
  if (a.id && b.id && a.id === b.id) return true;
  return calculateTrackSimilarity(a, b) >= 0.88;
}

// ─── Deduplication ─────────────────────────────────────────────────

/**
 * Remove duplicate tracks from an array using multi-factor fuzzy clustering.
 * Preserves first occurrence and retains highest-fidelity metadata.
 */
export function dedupeTracks<T extends TrackLike>(tracks: T[]): T[] {
  const out: T[] = [];

  for (const candidate of tracks) {
    const isDuplicate = out.some((existing) => areSameTrack(existing, candidate));
    if (!isDuplicate) {
      out.push(candidate);
    }
  }
  return out;
}

/**
 * Check if a track already exists in a collection.
 */
export function trackExistsIn<T extends TrackLike>(collection: T[], track: T): boolean {
  return collection.some((t) => areSameTrack(t, track));
}

/**
 * Append a track to a collection only if it's not already present.
 */
export function appendIfNew<T extends TrackLike>(collection: T[], track: T): T[] {
  if (trackExistsIn(collection, track)) return collection;
  return [...collection, track];
}

/**
 * Cleans YouTube video titles and channel names to yield clean song titles, real artist names, and album names.
 * Strips record labels (e.g. SonyMusicSouthVEVO, Aditya Music, T-Series) and video junk (e.g. Video Song, 4K, Official Video).
 */
export function cleanYouTubeTrackMetadata(
  rawTitle: string,
  rawArtist: string,
): { title: string; artist: string; album?: string } {
  let title = (rawTitle || "").trim();
  let artist = (rawArtist || "").trim();
  let album: string | undefined = undefined;

  const LABEL_PATTERNS = [
    /vevo$/i,
    /-\s*topic$/i,
    /\b(music|records|recordings|series|company|official|audio|entertainment|films|studios|production|media)\b/i,
    /\b(t-series|saregama|lahari|yrf|tips|aditya|sony|zee|speed\s*records|eros|geetha\s*arts|think\s*music|mango|madhura|times\s*music|volga|maa\s*paata)\b/i,
  ];
  const isLabelArtist = isChannelOrLabelName(artist) || LABEL_PATTERNS.some((p) => p.test(artist));

  // Extract '(From "Album/Movie")' if present
  const fromMatch = title.match(/\((?:From\s+["']?([^"')]+)["']?)\)/i);
  if (fromMatch && fromMatch[1]) {
    album = fromMatch[1].trim();
  }

  // Normalize delimiters (double pipes || -> |, // -> |)
  let cleaned = title
    .replace(/\|\|+/g, " | ")
    .replace(/\/\/+/g, " | ")
    .trim();

  // Strip typical video noise tags
  cleaned = cleaned
    .replace(/\s*\[[^\]]*\b(official|video|song|lyric|audio|4k|8k|hd|1080p|720p|1440p|remastered)\b[^\]]*\]/gi, "")
    .replace(/\s*\([^)]*\b(official|video|song|lyric|audio|4k|8k|hd|1080p|720p|1440p|remastered)\b[^)]*\)/gi, "")
    .replace(/\s*\|\s*(official\s*(music\s*)?video|video\s*song|lyric(al)?\s*video|full\s*(video\s*)?song|audio\s*song|audio|4k|8k|hd|1080p|remastered).*/gi, "")
    .replace(/\s*\|\s*$/g, "")
    .trim();

  // Strip noise phrases commonly in Indian YouTube titles
  cleaned = cleaned
    .replace(/\b(8k|4k|1080p|720p|hd|uhd)\s+full\s+song\b/gi, "")
    .replace(/\bwith\s*(?:telugu|hindi|tamil|english|kannada|malayalam)?\s*lyrics?\b/gi, "")
    .replace(/\bfull\s*song\s*with\s*lyrics\b/gi, "")
    .replace(/\b(full\s*song|video\s*song|lyric(al)?\s*song|audio\s*song)\b/gi, "")
    .trim();

  // Check colon pattern: "Movie: Song Name" (e.g. "Aashiqui 2: Tum Hi Ho")
  const colonMatch = cleaned.match(/^([^:|]+?)\s*:\s*(.+)$/);
  if (colonMatch && colonMatch[1] && colonMatch[2] && !colonMatch[1].includes(" - ")) {
    if (!album) album = colonMatch[1].trim();
    cleaned = colonMatch[2].trim();
  }

  const cleanPart = (str: string) =>
    str
      .replace(/\b(video\s*song|lyric(al)?\s*video|video|full\s*song|audio\s*song|audio|lyric(al)?)\b/gi, "")
      .replace(/^[-–—:\s|]+|[-–—:\s|]+$/g, "")
      .trim();

  // Split by pipe '|'
  const pipeParts = cleaned.split(/\s*\|\s*/).map((p) => p.trim()).filter(Boolean);

  if (pipeParts.length > 1 && pipeParts[0]) {
    const movieIndicatorRe = /^(.+?)\s+(?:telugu|hindi|tamil|malayalam|kannada)?\s*(?:movie|film|cinema|songs?)$/i;

    let candidateTitle = "";
    let candidateAlbum = album;

    const firstMovieMatch = pipeParts[0].match(movieIndicatorRe);
    const secondMovieMatch = pipeParts[1]?.match(movieIndicatorRe);

    if (firstMovieMatch && firstMovieMatch[1]) {
      candidateAlbum = firstMovieMatch[1].trim();
      candidateTitle = cleanPart(pipeParts[1] || "");
    } else if (secondMovieMatch && secondMovieMatch[1]) {
      candidateAlbum = secondMovieMatch[1].trim();
      candidateTitle = cleanPart(pipeParts[0] || "");
    } else {
      const dashInFirst = pipeParts[0].split(/\s+-\s+/);
      if (dashInFirst.length === 2 && dashInFirst[0] && dashInFirst[1]) {
        const part0 = dashInFirst[0].trim();
        const isPart0Movie =
          /\b(movie|film|cinema)\b/i.test(part0) ||
          /\((?:telugu|hindi|tamil|malayalam|kannada)\)/i.test(part0) ||
          (isLabelArtist && pipeParts.length > 2);
        if (isPart0Movie) {
          if (!candidateAlbum) {
            candidateAlbum = part0.replace(/\s+(?:telugu|hindi|tamil|malayalam|kannada)?\s*(?:movie|film|cinema)$/i, "").trim();
          }
        } else if (isLabelArtist) {
          artist = part0;
        }
        candidateTitle = cleanPart(dashInFirst[1]);
      } else {
        candidateTitle = cleanPart(pipeParts[0]);
        if (!candidateAlbum && pipeParts[1]) {
          candidateAlbum = cleanPart(pipeParts[1]);
        }
      }
    }

    title = candidateTitle || cleanPart(pipeParts[0]);
    if (candidateAlbum) album = candidateAlbum;

    if (isLabelArtist) {
      // Find artist among remaining parts
      const remaining = pipeParts.filter((p) => p !== pipeParts[0] && (!album || !p.includes(album)) && cleanPart(p) !== title);
      if (remaining.length > 0) {
        const singerPart = remaining.find((p) => /\b(shreya|arijit|anirudh|thaman|sid sriram|spb|raja|radhan|sagar|chaitra)\b/i.test(p));
        artist = singerPart || remaining[remaining.length - 1] || "";
      } else {
        artist = "";
      }
    }
  } else {
    // Single or no pipe, check dash 'Artist - Title' or 'Movie - Title'
    const dashParts = cleaned.split(/\s+-\s+/);
    if (dashParts.length === 2 && dashParts[0] && dashParts[1]) {
      const part0 = dashParts[0].trim();
      const part1 = cleanPart(dashParts[1]);
      const isPart0Movie = /\b(movie|film|cinema)\b/i.test(part0) || /\((?:telugu|hindi|tamil|malayalam|kannada)\)/i.test(part0);
      if (isPart0Movie) {
        album = part0.replace(/\s+(?:telugu|hindi|tamil|malayalam|kannada)?\s*(?:movie|film|cinema)$/i, "").trim();
        title = part1;
      } else {
        artist = part0;
        title = part1;
      }
    } else {
      title = cleanPart(cleaned);
    }
  }

  // Remove (From ...) from title once captured in album
  title = title.replace(/\s*\((?:From\s+["']?[^"')]+["']?)\)/gi, "").trim();

  // Clean trailing punctuation
  title = title.replace(/^[-–—:\s|]+|[-–—:\s|]+$/g, "").trim();
  artist = artist.replace(/^[-–—:\s|]+|[-–—:\s|]+$/g, "").trim();
  if (album) {
    album = album.replace(/^[-–—:\s|]+|[-–—:\s|]+$/g, "").trim();
  }

  // If artist still ends in VEVO or - Topic, strip it and split CamelCase if needed
  if (/VEVO$/i.test(artist)) {
    artist = artist.replace(/VEVO$/i, "").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  }
  artist = artist.replace(/\s*-\s*Topic$/i, "").trim();

  return {
    title: title || rawTitle,
    artist: (isLabelArtist && (isChannelOrLabelName(artist) || LABEL_PATTERNS.some((p) => p.test(artist)))) ? "" : (artist || rawArtist),
    ...(album ? { album } : {}),
  };
}

/**
 * Sanitises any track's title and artist for UI display.
 *
 * Beyond the YouTube-specific cleanup this also normalises catalog metadata:
 * plugin titles keep the `(From "Movie")` clause and JioSaavn mirrors that whole
 * polluted string into `album`, so the movie name was never shown and the junk
 * leaked into every card. The derived movie name now REPLACES a polluted album
 * (previously it was only set when the album was missing, so it was discarded).
 */
export function cleanTrackDisplayMetadata<T extends TrackLike>(track: T): T {
  if (!track || !track.title) return track;
  const { title, artist, album } = cleanYouTubeTrackMetadata(track.title, track.artist);
  const cleanTitle = cleanSongTitle(title) || title;
  const rawAlbum = album || (track as any).album;
  const movie = cleanMovieName(rawAlbum, cleanTitle) || (album ? album : undefined);
  const cleanArtist = isChannelOrLabelName(artist) ? "" : artist;
  const finalArtist = cleanArtist || (track.artist && !isChannelOrLabelName(track.artist) ? track.artist : "");
  return {
    ...track,
    title: cleanTitle,
    artist: finalArtist,
    ...(movie ? { album: movie } : {}),
  };
}
