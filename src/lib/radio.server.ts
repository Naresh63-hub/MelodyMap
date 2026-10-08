/**
 * Fetches song radio / similar tracks using JioSaavn catalog.
 * Delivers licensed, full-length tracks with rich metadata and smart artist/album diversity.
 */

import type { Track } from "./music.server";
import { searchSaavn } from "./providers/saavn";
import { LANGUAGE_ARTISTS } from "./language-artists";
import { norm } from "./track-dedup";

export interface RadioOptions {
  title?: string | undefined;
  artist?: string | undefined;
  album?: string | undefined;
  languages?: string[] | undefined;
}

export async function getRadioTracks(
  videoId: string,
  limit = 25,
  _continuation?: string,
  options?: RadioOptions,
): Promise<{ tracks: Track[]; continuation?: string }> {
  try {
    let title = options?.title?.trim() || "";
    let artist = options?.artist?.trim() || "";
    let album = options?.album?.trim() || "";

    if (!title && videoId) {
      const clean = videoId.replace(/^saavn:/, "").replace(/[-_]/g, " ").trim();
      if (!/^\d+$/.test(clean)) {
        title = clean;
      }
    }

    const cleanTitle = title
      .replace(/\[.*?\]|\(.*?\)|\|.*/g, "")
      .replace(/(full\s+)?(video|audio|lyric|lyrical)\s+song/gi, "")
      .replace(/(official|original)\s+(music\s+)?(video|audio|track)/gi, "")
      .replace(/\b(4k|hd|remix|feat|ft\.)\b/gi, "")
      .trim();

    const normalizedSeedTitle = norm(cleanTitle);

    // Determine target languages: from options or inferred from artist
    let languages = (options?.languages || []).map((l) => l.trim()).filter(Boolean);
    if (languages.length === 0 && artist) {
      for (const [lang, artists] of Object.entries(LANGUAGE_ARTISTS)) {
        if (artists.some((a) => a.toLowerCase() === artist.toLowerCase())) {
          languages = [lang];
          break;
        }
      }
    }

    const primaryLang = languages[0] || "";

    // Build 2–3 high-value queries on JioSaavn for smart queue progression
    const queries: string[] = [];

    // 1. Same artist top hits
    if (artist) {
      queries.push(`${artist} top hit songs`);
      if (primaryLang) {
        queries.push(`${artist} ${primaryLang} best songs`);
      }
    }

    // 2. Same album/soundtrack hits (other songs from the same movie!)
    if (album && album.length > 2 && norm(album) !== normalizedSeedTitle) {
      queries.push(`${album} songs`);
    }

    // 3. Co-artists in the same language for natural musical progression
    if (primaryLang && LANGUAGE_ARTISTS[primaryLang]) {
      const coArtists = LANGUAGE_ARTISTS[primaryLang].filter(
        (a) => a.toLowerCase() !== artist.toLowerCase(),
      );
      if (coArtists.length > 0) {
        const randA = coArtists[Math.floor(Math.random() * coArtists.length)]!;
        queries.push(`${randA} top songs`);
      }
    }

    // Fallback query if no artist or album known
    if (queries.length === 0) {
      if (cleanTitle) {
        queries.push(`${cleanTitle} song`);
      } else {
        queries.push(`${primaryLang || "top"} superhit songs`);
      }
    }

    // Fetch queries concurrently on JioSaavn with timeout protection
    const searchPromises = queries.slice(0, 3).map((q) =>
      searchSaavn(q, { limit: Math.min(limit, 12) }).catch(() => []),
    );
    const searchResults = await Promise.all(searchPromises);

    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();
    if (normalizedSeedTitle) {
      seenTitles.add(normalizedSeedTitle);
    }

    const tracks: Track[] = [];

    for (const batch of searchResults) {
      for (const t of batch) {
        if (!t.id || seenIds.has(t.id)) continue;

        const tTitleNorm = norm(t.title);
        // Exclude the current song or any version/remix/cover of it
        if (
          normalizedSeedTitle &&
          (tTitleNorm === normalizedSeedTitle ||
            tTitleNorm.includes(normalizedSeedTitle) ||
            normalizedSeedTitle.includes(tTitleNorm))
        ) {
          continue;
        }

        // Deduplicate across batch
        if (seenTitles.has(tTitleNorm)) continue;

        seenIds.add(t.id);
        seenTitles.add(tTitleNorm);

        tracks.push({
          id: t.id,
          title: t.title,
          artist: t.artist,
          duration: t.duration,
          thumbnail: t.thumbnail,
          album: t.album,
          previewUrl: t.previewUrl,
        });

        if (tracks.length >= limit) break;
      }
      if (tracks.length >= limit) break;
    }

    return { tracks };
  } catch (err) {
    console.warn("[getRadioTracks] Radio resolution notice:", err);
    return { tracks: [] };
  }
}
