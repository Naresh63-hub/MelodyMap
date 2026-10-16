/**
 * Fetches song radio / similar tracks using JioSaavn catalog.
 * Delivers licensed, full-length tracks with rich metadata and smart artist/album diversity.
 */

import type { Track } from "./music.server";
import { searchSaavn } from "./providers/saavn";
import { LANGUAGE_ARTISTS } from "./language-artists";
import { norm, diversifyTrackList } from "./track-dedup";
import { isOriginalSong } from "./track-filters";

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
    const artist = options?.artist?.trim() || "";
    const album = options?.album?.trim() || "";

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

    // Build balanced queries:
    // 1 query for seed artist top hits (max 6 tracks)
    // 1 query for seed album/soundtrack (if valid and distinct from track title)
    // 2-3 queries for distinct co-artists in the same language or user languages
    const queries: { query: string; limit: number }[] = [];

    if (artist) {
      const artistQuery = primaryLang ? `${artist} ${primaryLang} top songs` : `${artist} top songs`;
      queries.push({ query: artistQuery, limit: 6 });
    }

    if (album && album.length > 2 && norm(album) !== normalizedSeedTitle) {
      queries.push({ query: `${album} songs`, limit: 4 });
    }

    // Co-artists for musical variety in the listener's language(s)
    const availableCoArtists = (primaryLang && LANGUAGE_ARTISTS[primaryLang]
      ? LANGUAGE_ARTISTS[primaryLang]
      : Object.values(LANGUAGE_ARTISTS).flat()
    ).filter((a) => !artist || a.toLowerCase() !== artist.toLowerCase());

    if (availableCoArtists.length > 0) {
      // Pick up to 3 distinct random co-artists
      const shuffled = [...availableCoArtists].sort(() => Math.random() - 0.5);
      const pickedCoArtists = shuffled.slice(0, 3);
      for (const ca of pickedCoArtists) {
        queries.push({ query: `${ca} hit songs`, limit: 6 });
      }
    }

    // Fallback if no queries were formed
    if (queries.length === 0) {
      if (cleanTitle) {
        queries.push({ query: `${cleanTitle} song`, limit: 10 });
      } else {
        queries.push({ query: `${primaryLang || "top"} superhit songs`, limit: 12 });
      }
    }

    // Fetch queries concurrently on JioSaavn with timeout protection
    const searchPromises = queries.map(({ query, limit: qLimit }) =>
      searchSaavn(query, { limit: qLimit }).catch(() => [] as Track[]),
    );
    const searchResults = await Promise.all(searchPromises);

    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();
    if (normalizedSeedTitle) {
      seenTitles.add(normalizedSeedTitle);
    }

    // Interleave query results round-robin to ensure diversity across queries,
    // rather than letting the seed artist query fill the entire initial quota!
    const interleavedCandidates: Track[] = [];
    const maxBatchLen = Math.max(...searchResults.map((b) => b.length), 0);

    for (let i = 0; i < maxBatchLen; i++) {
      for (const batch of searchResults) {
        const t = batch[i];
        if (!t || !t.id || seenIds.has(t.id)) continue;

        const tTitleNorm = norm(t.title);
        // Exclude the seed song itself or duplicate titles
        if (
          normalizedSeedTitle &&
          (tTitleNorm === normalizedSeedTitle ||
            tTitleNorm.includes(normalizedSeedTitle) ||
            normalizedSeedTitle.includes(tTitleNorm))
        ) {
          continue;
        }

        if (seenTitles.has(tTitleNorm)) continue;

        // Non-film devotional/festival folk song filter
        if (!isOriginalSong(t)) continue;

        seenIds.add(t.id);
        seenTitles.add(tTitleNorm);

        interleavedCandidates.push({
          id: t.id,
          title: t.title,
          artist: t.artist,
          duration: t.duration,
          thumbnail: t.thumbnail,
          album: t.album,
          previewUrl: t.previewUrl,
        });
      }
    }

    // Apply strict anti-clustering diversification:
    // max 2 tracks per artist, max 1 track per movie, minimum artist spacing of 2
    const diversified = diversifyTrackList(interleavedCandidates, {
      maxPerArtist: 2,
      maxPerAlbum: 1,
      minArtistSpacing: 2,
      minAlbumSpacing: 3,
    });

    return { tracks: diversified.slice(0, limit) };
  } catch (err) {
    console.warn("[getRadioTracks] Radio resolution notice:", err);
    return { tracks: [] };
  }
}
