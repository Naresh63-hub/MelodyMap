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
  page?: number | undefined;
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
    const page = Math.max(1, Math.floor(options?.page ?? 1));

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

    // Build deep, taste-weighted catalog queries across albums, discography & co-artists:
    // (Notice: no shallow "top songs" or "hit songs" bias that traps recommendations in 3 viral singles)
    const queries: { query: string; limit: number; page?: number }[] = [];

    if (artist) {
      // 1. Primary artist natural discography at current pagination depth
      queries.push({ query: `${artist} songs`, limit: 8, page });

      // 2. Specific album/deep cut exploration for the artist
      if (page === 1) {
        queries.push({ query: `${artist} album songs`, limit: 5, page: 1 });
      } else if (page === 2) {
        queries.push({ query: `${artist} melodies`, limit: 5, page: 1 });
      } else {
        queries.push({ query: `${artist} unplugged`, limit: 5, page: 1 });
      }
    }

    if (album && album.length > 2 && norm(album) !== normalizedSeedTitle) {
      queries.push({ query: `${album} album`, limit: 5, page: Math.min(page, 2) });
    }

    // Co-artists for sonic variety in listener's language(s)
    const availableCoArtists = (primaryLang && LANGUAGE_ARTISTS[primaryLang]
      ? LANGUAGE_ARTISTS[primaryLang]
      : Object.values(LANGUAGE_ARTISTS).flat()
    ).filter((a) => !artist || a.toLowerCase() !== artist.toLowerCase());

    if (availableCoArtists.length > 0) {
      // Pick up to 3 distinct co-artists
      const shuffled = [...availableCoArtists].sort(() => Math.random() - 0.5);
      const pickedCoArtists = shuffled.slice(0, 3);
      pickedCoArtists.forEach((ca, idx) => {
        const coArtistPage = page > 1 && idx % 2 === 1 ? 2 : 1;
        queries.push({ query: `${ca} songs`, limit: 6, page: coArtistPage });
      });
    }

    // Fallback if no queries were formed
    if (queries.length === 0) {
      if (cleanTitle) {
        queries.push({ query: `${cleanTitle} songs`, limit: 10, page });
      } else {
        queries.push({ query: `${primaryLang || "trending"} melodies`, limit: 12, page });
      }
    }

    // Fetch queries concurrently on JioSaavn with timeout protection and pagination depth
    const searchPromises = queries.map(({ query, limit: qLimit, page: qPage }) =>
      searchSaavn(query, { limit: qLimit, page: qPage }).catch(() => [] as Track[]),
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
