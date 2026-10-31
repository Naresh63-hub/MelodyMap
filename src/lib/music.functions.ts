import { LANGUAGE_ARTISTS } from "./language-artists";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Track } from "./types";
import { norm, areSameTrack, diversifyTrackList } from "./track-dedup";
import { resolveAiModelId } from "./ai-gateway.server";
import { getTemporalContext, MOOD_ENVELOPES } from "./context-engine";
import { isLanguageConsistent, isOldEraTrack } from "./library";
import { isOriginalSong } from "./track-filters";

/** Normalizes user-provided strings for AI context inclusion while preserving real song/artist names */
export function sanitizePromptInput(str: string | undefined): string {
  if (!str) return "";
  return str
    // eslint-disable-next-line no-control-regex -- stripping control characters is intentional
    .replace(/[\x00-\x1F\x7F]/g, "") // control characters
    .replace(/<!--|--!>|-->|```|`|\${|[\\{}[\]^~|<>]/g, " ") // disarm comment tags, fences, and template delimiters
    .replace(/\s+/g, " ") // collapse whitespace
    .slice(0, 150)
    .trim();
}

/** Canonical composite key for track deduplication */
function getTrackDedupeKey(title: string, artist?: string): string {
  const t = norm(title);
  const a = artist ? norm(artist) : "";
  return a ? `${t}::${a}` : t;
}

const SearchInput = z.object({
  query: z.string().min(1),
  limit: z.number().optional(),
  type: z.enum(["songs", "podcasts"]).optional(),
  filter: z.enum(["all", "songs", "artists", "albums", "playlists"]).optional(),
  continuation: z.string().optional(),
  page: z.number().optional(),
  offset: z.number().optional(),
});

export const searchTracks = createServerFn({ method: "POST" })
  .validator((input: unknown) => SearchInput.parse(input))
  .handler(async ({ data }) => {
    const limit = data.limit ?? 50;
    const isMusicOnly = data.type !== "podcasts";
    const filter = data.filter ?? "all";

    if (isMusicOnly) {
      try {
        const { searchHybrid } = await import("./music-hybrid.server");
        const res = await searchHybrid(
          data.query,
          limit,
          data.continuation,
          filter,
          data.offset,
          data.page,
        );
        const originalTracks = res.tracks.filter(isOriginalSong);
        return { tracks: originalTracks, continuation: res.continuation, error: null };
      } catch (error) {
        console.error("Search failed:", error);
        return { tracks: [], continuation: undefined, error: "Could not reach the catalog. Try again." };
      }
    }

    if (data.type === "podcasts") {
      try {
        const { searchPodcastEpisodes } = await import("./podcast.server");
        const podcastTracks = await searchPodcastEpisodes(data.query, limit);
        if (podcastTracks.length > 0) {
          return { tracks: podcastTracks, continuation: undefined, error: null };
        }
      } catch (err) {
        console.warn("[search] Direct podcast episode search notice:", err);
      }

      try {
        const { searchYouTubePaginated } = await import("./music.server");
        const res = await searchYouTubePaginated(data.query, "all", data.continuation, limit);
        return { tracks: res.tracks, continuation: res.continuation, error: null };
      } catch (error) {
        console.error("Search failed:", error);
        return { tracks: [], continuation: undefined, error: "Could not reach the catalog. Try again." };
      }
    }

    try {
      const { searchHybrid } = await import("./music-hybrid.server");
      const res = await searchHybrid(data.query, limit, data.continuation, "songs", data.offset, data.page);
      return { tracks: res.tracks, continuation: res.continuation, error: null };
    } catch (error) {
      console.error("Search failed:", error);
      return { tracks: [], continuation: undefined, error: "Could not reach the catalog. Try again." };
    }
  });


export const suggestSearch = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ query: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data }) => {
    const { suggestQueries } = await import("./music.server");
    try {
      return { suggestions: await suggestQueries(data.query) };
    } catch {
      return { suggestions: [] as string[] };
    }
  });

/** Search Deezer for track metadata — free, no API key. Metadata only; playback resolves through the full-length stream proxy. */
export const searchDeezerTracks = createServerFn({ method: "POST" })
  .validator((input: unknown) => SearchInput.parse(input))
  .handler(async ({ data }) => {
    const { searchDeezer } = await import("./deezer.server");
    try {
      return { tracks: await searchDeezer(data.query, data.limit ?? 15), error: null };
    } catch {
      return { tracks: [], error: null };
    }
  });

const LyricsInput = z.object({
  title: z.string().min(1),
  artist: z.string().min(1),
  duration: z.number().optional(),
  trackId: z.string().optional(),
});

/** Fetches real-time synced and plain lyrics via LRCLIB with JioSaavn fallback */
export const getTrackLyrics = createServerFn({ method: "POST" })
  .validator((input: unknown) => LyricsInput.parse(input))
  .handler(async ({ data }) => {
    const { fetchTrackLyrics } = await import("./lyrics.server");
    try {
      const res = await fetchTrackLyrics(data.title, data.artist, data.duration, data.trackId);
      return { lyrics: res, error: null };
    } catch (err) {
      console.warn("[getTrackLyrics] Lyrics fetch error:", err);
      return { lyrics: null, error: "Lyrics unavailable" };
    }
  });

const RadioInput = z.object({
  videoId: z.string().min(1),
  limit: z.number().optional(),
  continuation: z.string().optional(),
  title: z.string().optional(),
  artist: z.string().optional(),
  album: z.string().optional(),
  languages: z.array(z.string()).optional(),
  page: z.number().optional(),
});

/** Fetches song radio / next queue recommendations using JioSaavn */
export const getSongRadio = createServerFn({ method: "POST" })
  .validator((input: unknown) => RadioInput.parse(input))
  .handler(async ({ data }) => {
    const { getRadioTracks } = await import("./radio.server");
    try {
      const res = await getRadioTracks(data.videoId, data.limit ?? 20, data.continuation, {
        title: data.title,
        artist: data.artist,
        album: data.album,
        languages: data.languages,
        page: data.page,
      });
      return { tracks: res.tracks, continuation: res.continuation, error: null };
    } catch {
      return { tracks: [], error: "Radio unavailable" };
    }
  });


const RecommendInput = z.object({
  liked: z.array(z.string()).max(40).default([]),
  recent: z.array(z.string()).max(40).default([]),
  disliked: z.array(z.string()).max(40).default([]),
  sequence: z.array(z.string()).max(20).default([]),
  skipped: z.array(z.string()).max(20).default([]),
  mood: z.string().max(120).optional(),
  brief: z.string().max(800).optional(),
  count: z.number().min(1).max(100).optional(),
  page: z.number().min(1).max(50).default(1).optional(),
  artists: z.array(z.string()).max(20).default([]),
  languages: z.array(z.string()).max(10).default([]),
  refreshNonce: z.union([z.string(), z.number()]).optional(),
  discovery: z.number().min(0).max(100).default(40),
  affinityArtists: z.array(z.string()).max(20).default([]),
  penalizedArtists: z.array(z.string()).max(20).default([]),
  clientHour: z.number().min(0).max(23).optional(),
  temporalContext: z.string().max(300).optional(),
  isNewUser: z.boolean().optional(),
});

const CURRENT_YEAR = new Date().getFullYear();
const PREV_YEAR = CURRENT_YEAR - 1;

const DIVERSE_THEMES = [
  `melodies ${CURRENT_YEAR}`,
  `soundtrack songs ${CURRENT_YEAR}`,
  `movie songs ${CURRENT_YEAR}`,
  `album tracks`,
  `unplugged acoustic`,
  `evergreen melodies`,
  `soulful songs`,
  `classics`,
];

function getDynamicQueries(
  languages: string[],
  userArtists: string[],
  options?: {
    affinityArtists?: string[] | undefined;
    penalizedArtists?: string[] | undefined;
    relatedArtists?: string[] | undefined;
    discovery?: number | undefined;
    clientHour?: number | undefined;
    mood?: string | undefined;
  },
): { newQueries: string[]; oldQueries: string[] } {
  let langs = languages.map((l) => l.trim()).filter(Boolean);
  const penalizedSet = new Set((options?.penalizedArtists ?? []).map((a) => a.toLowerCase().trim()));

  const filteredUserArtists = userArtists.filter((a) => !penalizedSet.has(a.toLowerCase().trim()));
  const filteredAffinityArtists = (options?.affinityArtists ?? []).filter((a) => !penalizedSet.has(a.toLowerCase().trim()));
  const filteredRelatedArtists = (options?.relatedArtists ?? []).filter((a) => !penalizedSet.has(a.toLowerCase().trim()));

  // If no language chosen, infer from user artists or blend top language categories
  if (langs.length === 0) {
    const matchedLangs: string[] = [];
    for (const [langName, artistList] of Object.entries(LANGUAGE_ARTISTS)) {
      if (filteredUserArtists.some((ua) => artistList.some((la) => la.toLowerCase() === ua.toLowerCase()))) {
        matchedLangs.push(langName);
      }
    }
    langs = matchedLangs.length > 0 ? matchedLangs : ["Telugu", "Hindi", "Tamil", "English", "Punjabi"];
  }

  const primaryLang = langs[0] || "";
  const langArtistPool = (primaryLang && LANGUAGE_ARTISTS[primaryLang] ? LANGUAGE_ARTISTS[primaryLang] : Object.values(LANGUAGE_ARTISTS).flat())
    .filter((a) => !penalizedSet.has(a.toLowerCase().trim()));

  const userNewQ: string[] = [];
  const userOldQ: string[] = [];
  const generalNewQ: string[] = [];
  const generalOldQ: string[] = [];

  // 1. High-priority queries for user's affinity + favorited artists (delving into discographies)
  // When user is starting fresh or has few artists, seed from the top language artists pool!
  const effectiveUserArtists = filteredUserArtists.length > 0
    ? filteredUserArtists
    : langArtistPool.slice(0, 6);

  const priorityArtists = [...new Set([...filteredAffinityArtists, ...effectiveUserArtists])];
  const langQualifier = primaryLang ? ` ${primaryLang}` : "";
  if (priorityArtists.length > 0) {
    for (const art of priorityArtists.slice(0, 6)) {
      userNewQ.push(art);
      userNewQ.push(`${art}${langQualifier} songs`);
      userNewQ.push(`${art} album songs`);
      userOldQ.push(art);
      userOldQ.push(`${art} melodies`);
    }
  }

  // 2. Exploration / Related artists queries if discovery slider > 30
  const discovery = options?.discovery ?? 40;
  if (discovery > 30 && filteredRelatedArtists.length > 0) {
    for (const art of filteredRelatedArtists.slice(0, 4)) {
      generalNewQ.push(art);
      generalNewQ.push(`${art} songs`);
      generalOldQ.push(art);
      generalOldQ.push(`${art} album songs`);
    }
  }

  // 3. Circadian & Mood Anchor queries (clean studio hits)
  const normMood = (options?.mood || "").toLowerCase().trim();
  const moodEnvelope = normMood ? MOOD_ENVELOPES[normMood] : undefined;

  if (moodEnvelope && moodEnvelope.queryThemes.length > 0) {
    for (const theme of moodEnvelope.queryThemes) {
      for (const lang of langs.slice(0, 3)) {
        generalNewQ.push(`${lang} ${theme}`);
      }
    }
  } else {
    const temporalCtx = getTemporalContext(options?.clientHour);
    for (const theme of temporalCtx.queryThemes) {
      for (const lang of langs.slice(0, 2)) {
        generalNewQ.push(`${lang} ${theme}`);
      }
    }
  }

  // 4. Supplementary queries across active languages (pure artist & soundtrack searches)
  const otherArtists = shuffleArray(langArtistPool.filter((a) => !priorityArtists.includes(a)));
  for (const lang of langs.slice(0, 3)) {
    const langPrefix = `${lang} `;
    for (const art of otherArtists.slice(0, 3)) {
      generalNewQ.push(art);
      generalNewQ.push(`${art} ${langPrefix}songs`);
      generalOldQ.push(art);
      generalOldQ.push(`${art} melodies`);
    }

    for (const theme of shuffleArray(DIVERSE_THEMES).slice(0, 2)) {
      generalNewQ.push(`${langPrefix}${theme}`);
    }
  }

  return {
    newQueries: [...userNewQ, ...shuffleArray(generalNewQ)],
    oldQueries: [...userOldQ, ...shuffleArray(generalOldQ)],
  };
}

/** Shuffle array randomly with Fisher-Yates algorithm */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = temp;
  }
  return arr;
}

/** Helper to execute and deduplicate multi-query search batches using JioSaavn & multi-provider primary */
export async function runQueryBatch(
  queries: string[],
  perQueryLimit = 10,
  musicOnly = true,
  bypassCache = false,
  page = 1,
): Promise<Track[]> {
  const { searchSaavn } = await import("./providers/saavn");
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const results: Track[] = [];

  const batchResults = await Promise.allSettled(
    queries.map(async (q, idx) => {
      try {
        const queryPage = Math.max(1, page + (idx % 2));
        const saavnRes = await searchSaavn(q, { limit: perQueryLimit, page: queryPage });
        if (saavnRes.length > 0) return saavnRes as Track[];
      } catch {}

      if (!musicOnly) {
        try {
          const { searchMultiProvider } = await import("./providers/multi-search");
          const multi = await searchMultiProvider(q, { limit: perQueryLimit, page });
          if (multi.tracks.length > 0) return multi.tracks as Track[];
        } catch {}
      }

      return [];
    }),
  );

  for (const r of batchResults) {
    if (r.status === "fulfilled" && Array.isArray(r.value)) {
      for (const t of r.value) {
        if (!t || !t.id || seenIds.has(t.id)) continue;
        if (!isOriginalSong(t)) continue;
        const key = getTrackDedupeKey(t.title, t.artist);
        if (key && seenKeys.has(key)) continue;
        if (key) seenKeys.add(key);
        seenIds.add(t.id);
        results.push(t);
      }
    }
  }
  return results;
}

async function getLocalPicks(data: {
  artists: string[];
  currentArtist?: string | undefined;
  mode?: "feed" | "discover" | "nextup" | undefined;
  count?: number | undefined;
  page?: number | undefined;
  languages?: string[] | undefined;
  refreshNonce?: string | number | undefined;
  exclude?: string[] | undefined;
  discovery?: number | undefined;
  affinityArtists?: string[] | undefined;
  penalizedArtists?: string[] | undefined;
  clientHour?: number | undefined;
  isNewUser?: boolean | undefined;
  mood?: string | undefined;
}): Promise<Track[]> {
  const count = data.count ?? 28;
  const page = Math.max(1, data.page ?? 1);
  const bypassCache = !!data.refreshNonce || page > 1;
  const artists = data.artists.map((a) => a.trim()).filter(Boolean);
  const languages = (data.languages ?? []).map((l) => l.trim()).filter(Boolean);
  const excludeSet = new Set((data.exclude ?? []).map((s) => norm(s)));
  const penalizedSet = new Set((data.penalizedArtists ?? []).map((s) => norm(s)));
  const isNewUser = Boolean(
    data.isNewUser ?? (artists.length === 0 && (data.affinityArtists?.length ?? 0) === 0 && (data.exclude?.length ?? 0) === 0),
  );

  // Filter out any excluded / recently played / penalized / cross-language tracks
  const isCandidateValid = (t: Track) => {
    const key = norm(`${t.artist} - ${t.title}`);
    const titleKey = norm(t.title);
    const artKey = norm(t.artist);
    if (excludeSet.has(key) || excludeSet.has(titleKey)) return false;
    if (penalizedSet.has(artKey)) return false;
    if (languages.length > 0 && !isLanguageConsistent(t, languages)) return false;
    if (isNewUser && isOldEraTrack(t)) return false;
    return isOriginalSong(t);
  };

  // For a brand new user on first login: strictly deliver ONLY new released songs and recently popular hits
  if (isNewUser) {
    const { newQueries } = getDynamicQueries(languages, artists, {
      discovery: data.discovery,
      clientHour: data.clientHour,
      mood: data.mood,
    });

    const popularQueries: string[] = [];
    const activeLangs = languages.length > 0 ? languages : ["Telugu", "Hindi", "Tamil", "English", "Punjabi"];
    for (const lang of activeLangs) {
      popularQueries.push(`${lang} Top Trending Hit Songs ${CURRENT_YEAR}`);
      popularQueries.push(`${lang} Most Popular Viral Songs`);
      popularQueries.push(`Top 50 ${lang} songs`);
      popularQueries.push(`${lang} latest hit songs ${CURRENT_YEAR}`);
      popularQueries.push(`${lang} new releases ${CURRENT_YEAR}`);
    }

    const queryOffset = (page - 1) * 3;
    const rotateQueries = (arr: string[], offset: number) => {
      if (arr.length === 0) return [];
      const normalized = offset % arr.length;
      return [...arr.slice(normalized), ...arr.slice(0, normalized)];
    };

    const pickedNew = rotateQueries(newQueries, queryOffset).slice(0, 4);
    const pickedPopular = rotateQueries(popularQueries, queryOffset).slice(0, 4);

    const [queryCandidates, trendingCandidates, newReleasesCandidates] = await Promise.all([
      runQueryBatch([...pickedNew, ...pickedPopular], 14, true, bypassCache, page),
      (async () => {
        try {
          const { getSaavnTrendingSongs } = await import("./providers/saavn");
          return await getSaavnTrendingSongs(languages, 15);
        } catch {
          return [];
        }
      })(),
      (async () => {
        try {
          const { getSaavnNewReleases } = await import("./providers/saavn");
          return await getSaavnNewReleases(languages, 15);
        } catch {
          return [];
        }
      })(),
    ]);

    const combined = [
      ...queryCandidates,
      ...(trendingCandidates as Track[]),
      ...(newReleasesCandidates as Track[]),
    ];

    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    const validCandidates: Track[] = [];

    for (const t of combined) {
      if (!t || !t.id || seenIds.has(t.id)) continue;
      if (!isCandidateValid(t)) continue;
      const key = getTrackDedupeKey(t.title, t.artist);
      if (key && seenKeys.has(key)) continue;
      if (key) seenKeys.add(key);
      seenIds.add(t.id);
      validCandidates.push(t);
    }

    const shuffled = shuffleArray(validCandidates);
    const diversified = diversifyTrackList(shuffled, {
      maxPerArtist: 2,
      maxPerAlbum: 1,
      minArtistSpacing: 2,
      minAlbumSpacing: 3,
    });

    return diversified.slice(0, count);
  }

  // Expand with related artists via Deezer
  const relatedArtists: string[] = [];
  try {
    const { getRelatedArtists } = await import("./deezer.server");
    const seedPool = [...(data.affinityArtists ?? []), ...artists].slice(0, 3);
    const settled = await Promise.allSettled(seedPool.map((a) => getRelatedArtists(a, 3)));
    for (const r of settled) {
      if (r.status === "fulfilled" && Array.isArray(r.value)) {
        relatedArtists.push(...r.value);
      }
    }
  } catch {}

  const { newQueries, oldQueries } = getDynamicQueries(languages, artists, {
    affinityArtists: data.affinityArtists,
    penalizedArtists: data.penalizedArtists,
    relatedArtists,
    discovery: data.discovery,
    clientHour: data.clientHour,
    mood: data.mood,
  });

  // Sample queries with offset rotation based on page depth so deeper pages explore different facets/discographies
  const queryOffset = (page - 1) * 3;
  const rotateQueries = (arr: string[], offset: number) => {
    if (arr.length === 0) return [];
    const normalized = offset % arr.length;
    return [...arr.slice(normalized), ...arr.slice(0, normalized)];
  };

  const pickedNew = rotateQueries(newQueries, queryOffset).slice(0, 6);
  const pickedOld = rotateQueries(oldQueries, queryOffset).slice(0, 6);

  const [newCandidates, oldCandidates] = await Promise.all([
    runQueryBatch(pickedNew, 14, true, bypassCache, page),
    runQueryBatch(pickedOld, 14, true, bypassCache, page),
  ]);

  const newQuota = Math.ceil(count / 2);
  const oldQuota = count - newQuota;

  const filteredNew = newCandidates.filter(isCandidateValid);
  const filteredOld = oldCandidates.filter(isCandidateValid);

  // Draw 50% new releases
  const selectedNew = shuffleArray(filteredNew).slice(0, newQuota);
  const chosenKeys = new Set<string>(selectedNew.map((t) => getTrackDedupeKey(t.title, t.artist)));
  const chosenIds = new Set<string>(selectedNew.map((t) => t.id));

  // Draw 50% golden classics, avoiding cross-bucket duplicates
  const distinctOldCandidates = shuffleArray(filteredOld).filter(
    (t) => !chosenIds.has(t.id) && !chosenKeys.has(getTrackDedupeKey(t.title, t.artist)),
  );
  const selectedOld = distinctOldCandidates.slice(0, oldQuota);

  // If one bucket is short on deeper pages, backfill from the other bucket
  if (selectedNew.length < newQuota) {
    const needed = count - (selectedNew.length + selectedOld.length);
    if (needed > 0) {
      const extraOld = distinctOldCandidates.slice(selectedOld.length, selectedOld.length + needed);
      selectedOld.push(...extraOld);
    }
  } else if (selectedOld.length < oldQuota) {
    const needed = count - (selectedNew.length + selectedOld.length);
    if (needed > 0) {
      const extraNew = filteredNew
        .filter((t) => !chosenIds.has(t.id) && !chosenKeys.has(getTrackDedupeKey(t.title, t.artist)))
        .slice(0, needed);
      selectedNew.push(...extraNew);
    }
  }

  // Interleave New and Old tracks: [New1, Old1, New2, Old2, New3, Old3, ...] to enforce exact 50/50 balance
  const interleaved: Track[] = [];
  const max = Math.max(selectedNew.length, selectedOld.length);
  for (let i = 0; i < max; i++) {
    const n = selectedNew[i];
    const o = selectedOld[i];
    if (n) interleaved.push(n);
    if (o) interleaved.push(o);
  }

  const diversified = diversifyTrackList(interleaved, {
    maxPerArtist: 2,
    maxPerAlbum: 1,
    minArtistSpacing: 2,
    minAlbumSpacing: 3,
  });

  return diversified.slice(0, count);
}


const TrendingInput = z.object({
  languages: z.array(z.string()).max(10).default([]),
  count: z.number().min(1).max(100).optional(),
  refreshNonce: z.union([z.string(), z.number()]).optional(),
  clientHour: z.number().min(0).max(23).optional(),
  page: z.number().min(1).max(50).optional(),
  recentSeenIds: z.array(z.string()).max(300).optional(),
});

/** Multi-category query pools for REAL-WORLD global and chart-topping trending music */
const CATEGORIZED_TRENDING_QUERIES = {
  billboard: [
    "Billboard Hot 100 Chart Songs",
    "Top 50 Songs Global Trending Chart",
    "Global Top Hits This Week",
    "Top Streaming Hits Worldwide",
  ],
  viral: [
    `Viral Global Hit Songs ${CURRENT_YEAR}`,
    `Top Viral Spotify Hits ${CURRENT_YEAR}`,
    "Shazam Top 50 Trending Songs",
    `Viral Reels Trending Music ${CURRENT_YEAR}`,
  ],
  party: [
    "Top 40 Music Chart Hits Worldwide",
    `Global Dance Party Trending Tracks ${CURRENT_YEAR}`,
    `High Energy Hit Songs ${CURRENT_YEAR}`,
  ],
  charts: [
    "YouTube Music Charts Top Trending Songs",
    `Trending Hit Songs ${PREV_YEAR} ${CURRENT_YEAR}`,
    `Top 50 Most Streamed Songs ${CURRENT_YEAR}`,
  ],
};

export const getRealTrendingTracks = createServerFn({ method: "POST" })
  .validator((input: unknown) => TrendingInput.parse(input))
  .handler(async ({ data }) => {
    const count = data.count ?? 20;
    const page = data.page ?? 1;
    const langs = data.languages.map((l) => l.trim()).filter(Boolean);
    const poolLimit = Math.max(count * 2, 70);
    const recentSeenSet = new Set((data.recentSeenIds || []).map((id) => id.toLowerCase()));

    try {
      const { getSaavnTrendingSongs } = await import("./providers/saavn");
      const saavnTrending = await getSaavnTrendingSongs(langs, poolLimit, data.refreshNonce, page);
      if (saavnTrending.length > 0) {
        const pool = saavnTrending as Track[];
        // Deduplicate in pool
        const seenIds = new Set<string>();
        const uniquePool: Track[] = [];
        for (const t of pool) {
          if (!t?.id || seenIds.has(t.id)) continue;
          seenIds.add(t.id);
          uniquePool.push(t);
        }

        // Language consistency
        const langFiltered = langs.length > 0
          ? uniquePool.filter((t) => isLanguageConsistent(t, langs) && isOriginalSong(t))
          : uniquePool.filter(isOriginalSong);
        const candidates = langFiltered.length >= 10 ? langFiltered : uniquePool;

        // When recentSeenIds are provided (e.g. on explicit refresh):
        // Exclude recently seen tracks so fresh discovery is served!
        // Never reinsert previously displayed tracks just to fill a batch.
        if (recentSeenSet.size > 0) {
          const unseen = candidates.filter((t) => !recentSeenSet.has(t.id.toLowerCase()));
          if (unseen.length > 0) {
            return {
              tracks: unseen.slice(0, count),
              error: null,
            };
          }
        } else {
          return {
            tracks: candidates.slice(0, count),
            error: null,
          };
        }
      }
    } catch (err) {
      console.warn("[getRealTrendingTracks] Saavn trending feed notice:", err);
    }

    const bypassCache = !!data.refreshNonce;
    const queries: string[] = [];

    if (langs.length > 0) {
      // 1. Circadian temporal keywords strictly in user's selected languages
      if (typeof data.clientHour === "number") {
        const { getTemporalContext } = await import("./context-engine");
        const ctx = getTemporalContext(data.clientHour);
        for (const lang of langs) {
          queries.push(`${lang} ${ctx.queryThemes[0] || "top trending songs"}`);
        }
      }

      // 2. Language-specific trending chart queries for all selected languages
      for (const lang of langs) {
        queries.push(`${lang} Top Trending Hit Songs ${CURRENT_YEAR}`);
        queries.push(`${lang} Official Music Hits Chart ${CURRENT_YEAR}`);
        queries.push(`${lang} Most Popular Viral Songs ${CURRENT_YEAR}`);
        queries.push(`Top ${lang} Songs This Week`);
        queries.push(`Latest ${lang} Trending Songs`);
      }
    } else {
      const fallbackLangs = ["Telugu", "Hindi", "Tamil", "English", "Punjabi"];
      if (typeof data.clientHour === "number") {
        const { getTemporalContext } = await import("./context-engine");
        const ctx = getTemporalContext(data.clientHour);
        for (const lang of fallbackLangs.slice(0, 2)) {
          queries.push(`${lang} ${ctx.queryThemes[0] || "top trending songs"}`);
        }
      }

      for (const lang of fallbackLangs.slice(0, 3)) {
        queries.push(`${lang} Top Trending Hit Songs ${CURRENT_YEAR}`);
        queries.push(`${lang} Official Music Hits Chart`);
        queries.push(`${lang} Most Popular Viral Songs`);
      }

      const categories = Object.values(CATEGORIZED_TRENDING_QUERIES);
      for (const cat of categories) {
        queries.push(...shuffleArray(cat).slice(0, 2));
      }
    }

    const tracks = await runQueryBatch(shuffleArray(queries).slice(0, 6), 8, true, bypassCache, page);
    const filteredTracks = langs.length > 0
      ? tracks.filter((t) => isLanguageConsistent(t, langs) && isOriginalSong(t))
      : tracks.filter(isOriginalSong);
    const unseenFallback = recentSeenSet.size > 0
      ? filteredTracks.filter((t) => !recentSeenSet.has(t.id.toLowerCase()))
      : filteredTracks;
    const finalFallback = unseenFallback.length > 0 ? unseenFallback : (recentSeenSet.size > 0 ? [] : filteredTracks);
    return { tracks: shuffleArray(finalFallback).slice(0, count), error: null };
  });

const OldSongsInput = z.object({
  languages: z.array(z.string()).max(10).default([]),
  count: z.number().min(1).max(100).optional(),
  refreshNonce: z.union([z.string(), z.number()]).optional(),
  artists: z.array(z.string()).max(20).optional(),
  page: z.number().min(1).max(50).optional(),
  recentSeenIds: z.array(z.string()).max(300).optional(),
});

/**
 * Dedicated Old Songs / Golden Era / Retro Classics feed.
 * Language-aware curation of timeless classic hits, vintage gems, and evergreen melodies.
 */
export const getOldSongsTracks = createServerFn({ method: "POST" })
  .validator((input: unknown) => OldSongsInput.parse(input))
  .handler(async ({ data }) => {
    const count = data.count ?? 20;
    const page = data.page ?? 1;
    const langs = data.languages.map((l) => l.trim()).filter(Boolean);
    const poolLimit = Math.max(count * 2, 60);
    const recentSeenSet = new Set((data.recentSeenIds || []).map((id) => id.toLowerCase()));

    try {
      const { getSaavnOldSongs } = await import("./providers/saavn");
      const saavnOld = await getSaavnOldSongs(langs, poolLimit, data.refreshNonce, page);
      if (saavnOld.length > 0) {
        const pool = (saavnOld as Track[]).filter(isOldEraTrack);
        const candidates = pool.length > 0 ? pool : (saavnOld as Track[]);
        if (recentSeenSet.size > 0) {
          const unseen = candidates.filter((t) => !recentSeenSet.has(t.id.toLowerCase()));
          if (unseen.length > 0) {
            return {
              tracks: unseen.slice(0, count),
              error: null,
            };
          }
        } else {
          return {
            tracks: candidates.slice(0, count),
            error: null,
          };
        }
      }
    } catch (err) {
      console.warn("[getOldSongsTracks] Saavn old songs feed notice:", err);
    }

    const bypassCache = !!data.refreshNonce;
    const userLangs = langs.length > 0 ? langs : ["Telugu", "Hindi", "Tamil", "English", "Punjabi"];
    const queries: string[] = [];

    for (const lang of userLangs) {
      const lower = lang.toLowerCase();
      if (lower === "telugu") {
        queries.push("Telugu 2000s hit songs");
        queries.push("Telugu 2000s super hit melodies");
        queries.push("Mani Sharma 2000s Telugu hits");
        queries.push("Devi Sri Prasad 2000s Telugu hits");
        queries.push("Harris Jayaraj Telugu hits 2000s");
        queries.push("RP Patnaik Chakri 2000s hits");
        queries.push("Telugu 2000s love songs");
        queries.push("Best of 2000 to 2010 Telugu hits");
      } else if (lower === "hindi") {
        queries.push("Bollywood 2000s hit songs");
        queries.push("Best of 2000s Hindi songs");
        queries.push("Pritam 2000s hit songs");
        queries.push("KK 2000s evergreen hit songs");
        queries.push("Hindi 2000s romantic melodies");
        queries.push("Emraan Hashmi 2000s hit songs");
        queries.push("Mohit Chauhan 2000s hits");
        queries.push("Sonu Nigam 2000s Bollywood hits");
      } else if (lower === "tamil") {
        queries.push("Tamil 2000s hit songs");
        queries.push("Harris Jayaraj 2000s Tamil hits");
        queries.push("Yuvan Shankar Raja 2000s hits");
        queries.push("AR Rahman 2000s Tamil hits");
        queries.push("Vidyasagar Tamil 2000s hits");
        queries.push("Tamil 2000 to 2010 melody hits");
      } else if (lower === "malayalam") {
        queries.push("Malayalam 2000s hit songs");
        queries.push("Vidyasagar Malayalam 2000s hits");
        queries.push("Deepak Dev 2000s Malayalam hits");
        queries.push("Malayalam 2000 to 2010 melody songs");
      } else if (lower === "kannada") {
        queries.push("Kannada 2000s hit songs");
        queries.push("Mano Murthy 2000s Kannada hits");
        queries.push("Gurukiran 2000s Kannada hits");
        queries.push("Kannada 2000 to 2010 super hits");
      } else if (lower === "punjabi") {
        queries.push("Punjabi 2000s hit songs");
        queries.push("Bally Sagoo Sukhbir 2000s hits");
        queries.push("Stereo Nation 2000s Punjabi hits");
        queries.push("Punjabi 2000 to 2010 pop hits");
      } else if (lower === "english") {
        queries.push("2000s pop rock hits");
        queries.push("Best 2000s songs");
        queries.push("2000 to 2010 greatest hits");
        queries.push("Coldplay Linkin Park 2000s hits");
      } else {
        queries.push(`${lang} 2000s hit songs`);
        queries.push(`${lang} 2000 to 2010 classic melodies`);
      }
    }

    // Only query artists if they are verified 2000s era artists (never modern contemporary or ancient vintage)
    if (data.artists && data.artists.length > 0) {
      for (const artist of data.artists.slice(0, 3)) {
        if (isOldEraTrack({ artist })) {
          queries.push(`${artist} 2000s hit songs`);
        }
      }
    }

    const tracks = await runQueryBatch(shuffleArray(queries).slice(0, 6), 8, true, bypassCache, page);
    const filteredTracks = tracks.filter((t) => {
      const langOk = langs.length > 0 ? isLanguageConsistent(t, langs) : true;
      return langOk && isOldEraTrack(t) && isOriginalSong(t);
    });
    const unseenFallback = recentSeenSet.size > 0
      ? filteredTracks.filter((t) => !recentSeenSet.has(t.id.toLowerCase()))
      : filteredTracks;
    const finalFallback = unseenFallback.length > 0 ? unseenFallback : (recentSeenSet.size > 0 ? [] : filteredTracks);
    return { tracks: shuffleArray(finalFallback).slice(0, count), error: null };
  });

/**
 * Intelligent AI Recommendation Engine powered by DeepMind / Gemini AI Gateway
 */
export const recommendTracks = createServerFn({ method: "POST" })
  .validator((input: unknown) => RecommendInput.parse(input))
  .handler(async ({ data }) => {
    const count = data.count ?? 30;
    const hasTaste = data.liked.length > 0 || data.recent.length > 0;
    const isNewUser = Boolean(
      data.isNewUser ?? (!hasTaste && (data.artists?.length ?? 0) === 0 && (data.affinityArtists?.length ?? 0) === 0),
    );

    const key = process.env["AI_API_KEY"];
    if (!key) {
      // No AI key — fall back to local YouTube-based picks with dynamic New & Old mix
      const artists = [
        ...new Set(
          [...(data.affinityArtists ?? []), ...data.liked, ...data.recent, ...(data.artists ?? [])]
            .map((s) => s.split(" - ")[0]?.trim())
            .filter((a): a is string => !!a),
        ),
      ].slice(0, 8);
      const tracks = await getLocalPicks({
        artists,
        mode: "feed",
        count: data.count ?? 24,
        page: data.page ?? 1,
        languages: data.languages,
        refreshNonce: data.refreshNonce,
        exclude: data.recent,
        discovery: data.discovery,
        affinityArtists: data.affinityArtists,
        penalizedArtists: data.penalizedArtists,
        clientHour: data.clientHour,
        isNewUser,
        mood: data.mood,
      });
      return { tracks, error: null };
    }

    const { generateText } = await import("ai");
    const { createAiGatewayProvider } = await import("./ai-gateway.server");
    const sanitizedLiked = data.liked.slice(0, 20).map(sanitizePromptInput).filter(Boolean);
    const sanitizedRecent = data.recent.slice(0, 20).map(sanitizePromptInput).filter(Boolean);
    const sanitizedSequence = (data.sequence ?? []).slice(0, 20).map(sanitizePromptInput).filter(Boolean);
    const sanitizedSkipped = (data.skipped ?? []).slice(0, 20).map(sanitizePromptInput).filter(Boolean);
    const sanitizedDisliked = (data.disliked ?? []).slice(0, 20).map(sanitizePromptInput).filter(Boolean);
    const sanitizedAffinity = (data.affinityArtists ?? []).slice(0, 10).map(sanitizePromptInput).filter(Boolean);
    const sanitizedPenalized = (data.penalizedArtists ?? []).slice(0, 10).map(sanitizePromptInput).filter(Boolean);
    const sanitizedMood = sanitizePromptInput(data.mood);
    const sanitizedBrief = sanitizePromptInput(data.brief);
    const sanitizedLangs = data.languages.map(sanitizePromptInput).filter(Boolean);

    const temporalCtx = getTemporalContext(data.clientHour);
    const timeInstruction = data.temporalContext || temporalCtx.promptContext;
    const discovery = typeof data.discovery === "number" ? Math.max(0, Math.min(100, data.discovery)) : 40;
    const exploreRatio = Math.round(discovery);
    const familiarRatio = 100 - exploreRatio;

    const seedNonce = `${data.refreshNonce ?? Date.now()}-${crypto.randomUUID()}`;

    const prompt = [
      "You map the sonic DNA of a listener's taste — tempo, pitch, instrumentation, vocal texture and energy — and read their behaviour sequentially: the order they play, replay and skip tracks.",
      hasTaste
        ? `Songs this listener loved:\n${sanitizedLiked.join("\n") || "(none yet)"}\n\nRecently played:\n${sanitizedRecent.join("\n") || "(none yet)"}`
        : "The listener is brand new on their first session. Strictly recommend widely loved current hits and fresh popular songs in their selected languages.",
      sanitizedSequence.length
        ? `Their last sessions in order, with what they did with each track:\n${sanitizedSequence.join("\n")}`
        : "",
      sanitizedSkipped.length
        ? `Repeatedly skipped — steer away from this sound:\n${sanitizedSkipped.join("\n")}`
        : "",
      sanitizedDisliked.length
        ? `They disliked these songs — never suggest them or very similar tracks:\n${sanitizedDisliked.join("\n")}`
        : "",
      timeInstruction ? `SESSION TIME CONTEXT: ${timeInstruction}` : "",
      sanitizedAffinity.length > 0
        ? `AFFINITY BOOST: Listener has high completion rates for: ${sanitizedAffinity.join(", ")}. Favor these artists and related sounds.`
        : "",
      sanitizedPenalized.length > 0
        ? `STRICT EXCLUSION: Listener dislikes and repeatedly skips songs by: ${sanitizedPenalized.join(", ")}. Never suggest any songs by these artists.`
        : "",
      `DISCOVERY MIX: Set to ${discovery}% (${familiarRatio}% familiar comfort-zone hits from preferred artists, ${exploreRatio}% exciting new releases & unexpected gems).`,
      sanitizedMood ? `They asked for: ${sanitizedMood}` : "",
      sanitizedBrief ? `Tuning preferences: ${sanitizedBrief}` : "",
      sanitizedLangs.length > 0
        ? `CRITICAL LANGUAGE RESTRICTION: The user strictly wants songs in: ${sanitizedLangs.join(", ")}. EVERY single recommended track MUST be in one of these languages: ${sanitizedLangs.join(", ")}. Do NOT suggest tracks in any other language.`
        : "",
      "",
      isNewUser
        ? `The listener is brand new. Recommend ${count} songs composed ONLY of brand new releases (released in ${PREV_YEAR}-${CURRENT_YEAR}) and the most popular songs that are currently trending and viral hits in their selected languages (${sanitizedLangs.join(", ")}). Absolutely DO NOT include any old, retro, vintage, 90s, or 2000s classics.`
        : `Recommend ${count} songs with a dynamic 50/50 balance: exactly 50% brand new songs (released in ${PREV_YEAR}-${CURRENT_YEAR} or current trending hits) and 50% classic evergreen songs (90s, 2000s, iconic timeless tracks). Respect tuning preferences above.`,
      "CRITICAL: Do NOT suggest songs that are already in recently played list above. Every suggestion MUST be a different, unplayed song that the listener has not heard recently.",
      `CRITICAL DIVERSITY INSTRUCTION: Refresh session entropy token: [${seedNonce}]. On every refresh you MUST explore completely different tracks, unexpected classics, and fresh popular hits. Do not repeat songs.`,
      'Reply with ONLY a JSON array like: [{"title":"Song name","artist":"Artist name","reason":"why, max 8 words"}]',
    ]
      .filter(Boolean)
      .join("\n");

    const fallbackToLocal = async () => {
      const artists = [
        ...new Set(
          [...(data.affinityArtists ?? []), ...data.liked, ...data.recent, ...(data.artists ?? [])]
            .map((s) => s.split(" - ")[0]?.trim())
            .filter((a): a is string => !!a),
        ),
      ].slice(0, 8);
      const tracks = await getLocalPicks({
        artists,
        mode: "feed",
        count: data.count ?? 24,
        page: data.page ?? 1,
        languages: data.languages,
        refreshNonce: data.refreshNonce,
        exclude: data.recent,
        discovery: data.discovery,
        affinityArtists: data.affinityArtists,
        penalizedArtists: data.penalizedArtists,
        clientHour: data.clientHour,
        isNewUser,
        mood: data.mood,
      });
      return { tracks, error: null };
    };

    let raw = "";
    try {
      const gateway = createAiGatewayProvider(key);
      const result = await generateText({
        model: gateway(resolveAiModelId()),
        prompt,
        temperature: 0.95,
      });
      raw = result.text;
    } catch {
      return await fallbackToLocal();
    }

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return await fallbackToLocal();

    let picks: Array<{ title?: string; artist?: string; reason?: string }> = [];
    try {
      picks = JSON.parse(jsonMatch[0]);
    } catch {
      return await fallbackToLocal();
    }

    const recentSet = new Set(data.recent.map((s) => norm(s)));
    const penalizedSet = new Set((data.penalizedArtists ?? []).map((s) => norm(s)));
    const valid = picks
      .filter((p) => {
        if (!p.title || !p.artist) return false;
        const fullKey = norm(`${p.artist} - ${p.title}`);
        const titleKey = norm(p.title);
        const artKey = norm(p.artist);
        if (recentSet.has(fullKey) || recentSet.has(titleKey)) return false;
        if (penalizedSet.has(artKey)) return false;
        return true;
      })
      .slice(0, count);

    const resolved: Track[] = [];
    const CHUNK_SIZE = 4;
    for (let i = 0; i < valid.length; i += CHUNK_SIZE) {
      const chunk = valid.slice(i, i + CHUNK_SIZE);
      const batch = await Promise.all(
        chunk.map(async (p) => {
          try {
            const { searchSaavn } = await import("./providers/saavn");
            let saavnHits = await searchSaavn(`${p.artist} ${p.title}`, { limit: 3 });
            if (saavnHits.length === 0 && p.title) {
              saavnHits = await searchSaavn(p.title, { limit: 3 });
            }
            if (saavnHits.length > 0) {
              const target = { id: "", title: p.title ?? "", artist: p.artist ?? "", duration: 0 };
              const track = saavnHits.find((candidate) => areSameTrack(candidate, target)) ?? saavnHits[0];
              return track ? ({ ...track, reason: p.reason ?? "" } as Track) : null;
            }
            return null;
          } catch {
            return null;
          }
        }),
      );
      for (const t of batch) {
        if (t && (data.languages.length === 0 || isLanguageConsistent(t, data.languages))) {
          resolved.push(t);
        }
      }
    }

    if (resolved.length === 0) {
      return await fallbackToLocal();
    }

    return { tracks: resolved, error: null };
  });


const MixInput = z.object({
  kind: z.enum(["discover", "newrelease", "explore"]),
  liked: z.array(z.string()).max(30).default([]),
  recent: z.array(z.string()).max(30).default([]),
  sequence: z.array(z.string()).max(20).default([]),
  skipped: z.array(z.string()).max(20).default([]),
  artists: z.array(z.string()).max(15).default([]),
  languages: z.array(z.string()).max(10).default([]),
  brief: z.string().max(800).optional(),
  count: z.number().min(1).max(30).optional(),
  refreshNonce: z.union([z.string(), z.number()]).optional(),
});

/**
 * Builds a personalised mix.
 * - discover: brand-new artists that match the listener's sonic profile.
 * - newrelease: the latest drops from the artists they actually play.
 * - explore: balanced blend of fresh new hits and classic evergreen old songs.
 */
export const buildMix = createServerFn({ method: "POST" })
  .validator((input: unknown) => MixInput.parse(input))
  .handler(async ({ data }) => {
    const count = data.count ?? 20;
    const primaryLang = data.languages[0]?.trim();
    const langSuffix = primaryLang ? ` ${primaryLang}` : "";

    if (data.kind === "explore") {
      const tracks = await getLocalPicks({
        artists: data.artists,
        mode: "feed",
        count,
        languages: data.languages,
        refreshNonce: data.refreshNonce,
      });
      return { tracks, error: null };
    }

    if (data.kind === "newrelease") {
      const year = new Date().getFullYear();
      const langArtists = primaryLang && LANGUAGE_ARTISTS[primaryLang] ? LANGUAGE_ARTISTS[primaryLang] : Object.values(LANGUAGE_ARTISTS).flat();
      const combinedArtists = shuffleArray([...new Set([...data.artists, ...langArtists])]);

      const freshReleaseQueries: string[] = primaryLang
        ? [
            `latest ${primaryLang} songs ${year}`,
            `new ${primaryLang} single release ${year}`,
            `brand new ${primaryLang} lyrical video ${year}`,
            `fresh ${primaryLang} music audio launch ${year}`,
            `latest ${primaryLang} movie songs ${year}`,
            `new ${primaryLang} indie release ${year}`,
            `just dropped ${primaryLang} songs ${year}`,
            `fresh new ${primaryLang} tracks ${year}`,
            `new ${primaryLang} romantic song ${year}`,
            `top new ${primaryLang} party song ${year}`,
          ]
        : [
            `latest songs ${year}`,
            `new single release ${year}`,
            `brand new lyrical video ${year}`,
            `fresh music audio launch ${year}`,
            `latest movie songs ${year}`,
            `new indie release ${year}`,
            `just dropped songs ${year}`,
            `fresh new tracks ${year}`,
            `new romantic song ${year}`,
            `top new party song ${year}`,
          ];

      // Add artist-specific new release queries
      for (const art of combinedArtists.slice(0, 6)) {
        freshReleaseQueries.push(`${art}${langSuffix} latest new song ${year}`);
        freshReleaseQueries.push(`${art}${langSuffix} new lyrical track ${year}`);
      }

      const pickedQueries = shuffleArray(freshReleaseQueries).slice(0, 5);
      const candidates = await runQueryBatch(pickedQueries, 10, true, !!data.refreshNonce);
      const filtered = data.languages.length > 0
        ? candidates.filter((t) => isLanguageConsistent(t, data.languages))
        : candidates;

      return { tracks: shuffleArray(filtered).slice(0, count), error: null };
    }

    const key = process.env["AI_API_KEY"];
    if (!key) {
      // No AI key — use JioSaavn search for discover mix with randomized discovery queries
      const { searchSaavn } = await import("./providers/saavn");
      const out: Track[] = [];
      const seen = new Set<string>();
      const discoverQueries = shuffleArray(
        primaryLang
          ? [
              `underrated ${primaryLang} songs you need to hear`,
              `hidden gem ${primaryLang} songs trending`,
              `best new ${primaryLang} indie songs discovery`,
              `fresh ${primaryLang} music unique sound`,
              `${primaryLang} indie breakthrough songs`,
              `underground ${primaryLang} hit songs`,
              `emerging ${primaryLang} artists new songs`,
              `new ${primaryLang} melody songs`,
            ]
          : [
              "underrated songs you need to hear",
              "hidden gem songs trending",
              "best new artists discovery",
              "fresh music unique sound",
              "indie breakthrough songs",
              "underground hit songs",
              "emerging artists new songs",
              "new indie folk pop songs",
            ],
      );
      for (const q of discoverQueries) {
        if (out.length >= count) break;
        try {
          const saavnHits = await searchSaavn(q, { limit: 8 });
          const tracks: Track[] = (saavnHits as Track[]) ?? [];
          for (const t of tracks) {
            if (out.length >= count) break;
            if (seen.has(t.id) || data.artists.some((a) => t.artist.toLowerCase().includes(a.toLowerCase()))) continue;
            if (data.languages.length > 0 && !isLanguageConsistent(t, data.languages)) continue;
            seen.add(t.id);
            out.push(t);
          }
        } catch { /* skip */ }
      }
      return { tracks: out.slice(0, count), error: null };
    }

    const { generateText } = await import("ai");
    const { createAiGatewayProvider } = await import("./ai-gateway.server");

    const prompt = [
      "You are a music discovery engine. Map the sonic DNA of the listener's taste — tempo, key/pitch feel, instrumentation, vocal texture and overall energy — then recommend songs that match that profile.",
      data.liked.length ? `Loved songs:\n${data.liked.join("\n")}` : "",
      data.sequence.length
        ? `Recent listening in order, with what they did with each track:\n${data.sequence.join("\n")}`
        : "",
      data.skipped.length ? `Repeatedly skipped — avoid this sound:\n${data.skipped.join("\n")}` : "",
      data.artists.length
        ? `Artists they already know well — DO NOT recommend any of these artists:\n${data.artists.join(", ")}`
        : "",
      data.brief ? `Tuning preferences: ${data.brief}` : "",
      "",
      `Recommend ${count} songs by artists the listener has almost certainly never heard, that still sit close to their sonic profile. No artist may repeat.`,
      'Reply with ONLY a JSON array like: [{"title":"Song name","artist":"Artist name","reason":"why, max 8 words"}]',
    ]
      .filter(Boolean)
      .join("\n");

    let raw = "";
    try {
      const gateway = createAiGatewayProvider(key);
      const result = await generateText({ model: gateway(resolveAiModelId()), prompt });
      raw = result.text;
    } catch (err) {
      const message = String(err);
      if (message.includes("429")) return { tracks: [], error: "Too many requests — try again shortly." };
      if (message.includes("402") || /credit|payment_required/i.test(message))
        return { tracks: [], error: "AI credits are exhausted — add credits to keep generating picks." };
      return { tracks: [], error: "Mixes are unavailable right now." };
    }

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return { tracks: [], error: "Could not build that mix." };
    let picks: Array<{ title?: string; artist?: string; reason?: string }> = [];
    try {
      picks = JSON.parse(jsonMatch[0]);
    } catch {
      return { tracks: [], error: "Could not build that mix." };
    }

    const known = new Set(data.artists.map((a) => a.toLowerCase()));
    const valid = picks
      .filter((p) => p.title && p.artist && !known.has(p.artist.toLowerCase()))
      .slice(0, count);

    const resolved: Track[] = [];
    const CHUNK_SIZE = 4;
    for (let i = 0; i < valid.length; i += CHUNK_SIZE) {
      const chunk = valid.slice(i, i + CHUNK_SIZE);
      const batch = await Promise.all(
        chunk.map(async (p) => {
          try {
            const { searchSaavn } = await import("./providers/saavn");
            let saavnHits = await searchSaavn(`${p.artist} ${p.title}`, { limit: 3 });
            if (saavnHits.length === 0 && p.title) {
              saavnHits = await searchSaavn(p.title, { limit: 3 });
            }
            if (saavnHits.length > 0) {
              const target = { id: "", title: p.title ?? "", artist: p.artist ?? "", duration: 0 };
              const track = saavnHits.find((candidate) => areSameTrack(candidate, target)) ?? saavnHits[0];
              return track ? ({ ...track, reason: p.reason ?? "" } as Track) : null;
            }
            return null;
          } catch {
            return null;
          }
        }),
      );
      for (const t of batch) {
        if (t) resolved.push(t);
      }
    }
    return { tracks: resolved, error: null };
  });


const NewDropsInput = z.object({
  artists: z.array(z.string()).max(15).default([]),
  maxArtists: z.number().min(1).max(10).optional(),
});

/**
 * Fresh releases from the listener's own artists — powers the
 * "New from your artists" alert on the New Release Mix. No AI.
 */
export const newDrops = createServerFn({ method: "POST" })
  .validator((input: unknown) => NewDropsInput.parse(input))
  .handler(async ({ data }) => {
    const artists = data.artists
      .map((a) => a.trim())
      .filter(Boolean)
      .slice(0, data.maxArtists ?? 5);
    if (artists.length === 0) return { drops: [], error: null };

    // Search each artist for songs uploaded this week — a strong "just
    // dropped" signal — and keep the best match per artist.
    const batches = await Promise.all(
      artists.map(async (artist) => {
        try {
          const { searchSaavn } = await import("./providers/saavn");
          let saavnHits = await searchSaavn(`${artist} new song`, { limit: 5 });
          if (saavnHits.length === 0) {
            saavnHits = await searchSaavn(artist, { limit: 5 });
          }
          return (saavnHits as Track[]) ?? [];
        } catch {
          return [];
        }
      }),
    );

    const seen = new Set<string>();
    const drops: Array<{
      artist: string;
      title: string;
      videoId: string;
      thumbnail: string;
    }> = [];

    artists.forEach((artist, i) => {
      const tracks = batches[i] ?? [];
      if (tracks.length === 0) return;
      const name = artist.toLowerCase();
      // Prefer a result whose channel actually matches the artist, otherwise
      // take the top fresh upload for the query.
      const drop =
        tracks.find((t) => !seen.has(t.id) && t.artist.toLowerCase().includes(name)) ??
        tracks.find((t) => !seen.has(t.id));
      if (!drop) return;
      seen.add(drop.id);
      drops.push({
        artist,
        title: drop.title,
        videoId: drop.id,
        thumbnail: drop.thumbnail,
      });
    });

    return { drops, error: null };
  });


const LocalPicksInput = z.object({
  artists: z.array(z.string()).max(12).default([]),
  currentArtist: z.string().max(120).optional(),
  mode: z.enum(["feed", "discover", "nextup"]).default("feed"),
  count: z.number().min(1).max(40).optional(),
  isNewUser: z.boolean().optional(),
});

/**
 * No-AI picks mirroring the YouTube Music balance: ~40% comfort tracks in
 * the listener's taste, a share of new artists that sound similar to their
 * favourites, and familiar-but-older songs they may have forgotten.
 * Powers the For You feed, the Discover mix and Up Next autoplay when no
 * AI key is configured.
 */
export const localPicks = createServerFn({ method: "POST" })
  .validator((input: unknown) => LocalPicksInput.parse(input))
  .handler(async ({ data }) => {
    const tracks = await getLocalPicks(data);
    return { tracks, error: null };
  });

function seededRandom(seed: number) {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function seededShuffleArray<T>(array: T[], seedStr: string): T[] {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const arr = [...array];
  let currentSeed = Math.abs(hash) || 1;
  for (let i = arr.length - 1; i > 0; i--) {
    const rand = seededRandom(currentSeed++);
    const j = Math.floor(rand * (i + 1));
    const temp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = temp;
  }
  return arr;
}

const DailyMixInput = z.object({
  languages: z.array(z.string()).max(10).default([]),
  artists: z.array(z.string()).max(20).default([]),
  liked: z.array(z.string()).max(30).default([]),
  dateSeed: z.string().optional(),
  refreshNonce: z.union([z.string(), z.number()]).optional(),
  count: z.number().min(1).max(60).optional(),
  isNewUser: z.boolean().optional(),
});

/**
 * Daily Mix: Generates a stable, high-affinity mix that remains consistent
 * throughout the day (seeded by YYYY-MM-DD), automatically rotates at midnight,
 * and refreshes with fresh picks whenever a refreshNonce is supplied.
 */
export const getDailyMix = createServerFn({ method: "POST" })
  .validator((input: unknown) => DailyMixInput.parse(input))
  .handler(async ({ data }) => {
    const count = data.count ?? 25;
    const bypassCache = !!data.refreshNonce;
    const dateSeed = data.refreshNonce
      ? `${data.dateSeed || new Date().toISOString().slice(0, 10)}-${data.refreshNonce}`
      : (data.dateSeed || new Date().toISOString().slice(0, 10));
    const artists = data.artists.map((a) => a.trim()).filter(Boolean);
    const languages = data.languages.map((l) => l.trim()).filter(Boolean);
    const isNewUser = Boolean(data.isNewUser ?? (artists.length === 0 && (data.liked?.length ?? 0) === 0));
    const { newQueries, oldQueries } = getDynamicQueries(languages, artists);

    // Pick 4 dynamic new queries and 4 dynamic old queries (randomized on refresh, seeded on daily view)
    const pickedNew = data.refreshNonce
      ? shuffleArray(newQueries).slice(0, 4)
      : seededShuffleArray(newQueries, `${dateSeed}-new`).slice(0, 4);

    let pickedQueries: string[];
    if (isNewUser) {
      const popularQueries: string[] = [];
      const activeLangs = languages.length > 0 ? languages : ["Telugu", "Hindi", "Tamil", "English", "Punjabi"];
      for (const lang of activeLangs) {
        popularQueries.push(`${lang} Top Trending Hit Songs ${CURRENT_YEAR}`);
        popularQueries.push(`${lang} Most Popular Viral Songs`);
        popularQueries.push(`Top 50 ${lang} songs`);
      }
      const pickedPopular = shuffleArray(popularQueries).slice(0, 4);
      pickedQueries = [...pickedNew, ...pickedPopular];
    } else {
      const pickedOld = data.refreshNonce
        ? shuffleArray(oldQueries).slice(0, 4)
        : seededShuffleArray(oldQueries, `${dateSeed}-old`).slice(0, 4);
      pickedQueries = [...pickedNew, ...pickedOld];
    }

    const [queryCandidates, trendingCandidates, newReleasesCandidates] = await Promise.all([
      runQueryBatch(pickedQueries, 10, true, bypassCache),
      (async () => {
        try {
          const { getSaavnTrendingSongs } = await import("./providers/saavn");
          return await getSaavnTrendingSongs(languages, 12);
        } catch {
          return [];
        }
      })(),
      (async () => {
        try {
          const { getSaavnNewReleases } = await import("./providers/saavn");
          return await getSaavnNewReleases(languages, 10);
        } catch {
          return [];
        }
      })(),
    ]);

    const combined = [...queryCandidates, ...(trendingCandidates as Track[]), ...(newReleasesCandidates as Track[])];
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    const deduplicatedCandidates: Track[] = [];

    for (const t of combined) {
      if (!t || !t.id || seenIds.has(t.id)) continue;
      const key = getTrackDedupeKey(t.title, t.artist);
      if (key && seenKeys.has(key)) continue;
      if (key) seenKeys.add(key);
      seenIds.add(t.id);
      deduplicatedCandidates.push(t);
    }

    // Rigorous language consistency and zero old songs for new users:
    const consistent = deduplicatedCandidates.filter((t) => {
      if (isNewUser && isOldEraTrack(t)) return false;
      const langOk = languages.length > 0 ? isLanguageConsistent(t, languages) : true;
      return langOk && isOriginalSong(t);
    });
    const shuffled = data.refreshNonce
      ? shuffleArray(consistent)
      : seededShuffleArray(consistent, `${dateSeed}-final`);
    const diversified = diversifyTrackList(shuffled, {
      maxPerArtist: 2,
      maxPerAlbum: 1,
      minArtistSpacing: 2,
      minAlbumSpacing: 3,
    });
    return { tracks: diversified.slice(0, count), dateSeed, error: null };
  });



const NewSongsInput = z.object({
  artists: z.array(z.string()).max(50).default([]),
  count: z.number().min(1).max(60).optional(),
  languages: z.array(z.string()).max(30).default([]),
  refreshNonce: z.union([z.string(), z.number()]).optional(),
  page: z.number().min(1).max(50).optional(),
  recentSeenIds: z.array(z.string()).max(300).optional(),
});

/** Language names from Tune picks → search terms for YouTube queries. */
const LANG_SEARCH: Record<string, string> = {
  Hindi: "hindi",





  
  Telugu: "telugu",
  Tamil: "tamil",
  Malayalam: "malayalam",
  Kannada: "kannada",
  Punjabi: "punjabi",
  English: "english",
  Korean: "korean",
  Spanish: "spanish",
  Arabic: "arabic",
};

/**
 * Explore New: genuinely fresh tracks — new this week, latest of the year,
 * new drops from the listener's own artists, and what's trending. When the
 * listener has set language preferences in Tune picks, the searches focus
 * on those languages. No AI.
 */
export const newSongs = createServerFn({ method: "POST" })
  .validator((input: unknown) => NewSongsInput.parse(input))
  .handler(async ({ data }) => {
    const count = data.count ?? 24;
    const page = data.page ?? 1;
    const year = new Date().getFullYear();
    const langs = data.languages.map((l) => l.trim()).filter(Boolean);
    const poolLimit = Math.max(count * 2, 60);
    const recentSeenSet = new Set((data.recentSeenIds || []).map((id) => id.toLowerCase()));

    try {
      const { getSaavnNewReleases } = await import("./providers/saavn");
      const releases = await getSaavnNewReleases(langs, poolLimit, data.refreshNonce, page);
      if (releases.length > 0) {
        const pool = (releases as Track[]).filter((t) => !isOldEraTrack(t));
        const candidates = pool.length > 0 ? pool : (releases as Track[]);
        if (recentSeenSet.size > 0) {
          const unseen = candidates.filter((t) => !recentSeenSet.has(t.id.toLowerCase()));
          if (unseen.length > 0) {
            return {
              tracks: unseen.slice(0, count),
              error: null,
            };
          }
        } else {
          return {
            tracks: candidates.slice(0, count),
            error: null,
          };
        }
      }
    } catch (err) {
      console.warn("[newSongs] Saavn new releases feed notice:", err);
    }

    const out: Track[] = [];
    const seen = new Set<string>();

    try {
      const { searchSaavn } = await import("./providers/saavn");
      const queryTemplates = [
        (l: string) => `${l} latest new hit songs ${year}`,
        (l: string) => `${l} new release songs ${year}`,
        (l: string) => `latest ${l} movie songs ${year}`,
        (l: string) => `${l} top new songs ${year}`,
        (l: string) => `new ${l} albums ${year}`,
      ];
      const qIndex = (page - 1) % queryTemplates.length;
      const fn = queryTemplates[qIndex] || queryTemplates[0]!;
      const queries = langs.length > 0
        ? langs.map((l) => fn(l))
        : [`latest hit songs ${year}`];

      for (const q of queries) {
        if (out.length >= count) break;
        const hits = await searchSaavn(q, { limit: 15, page });
        for (const t of hits) {
          if (out.length >= count) break;
          if (!seen.has(t.id) && isOriginalSong(t) && !isOldEraTrack(t)) {
            if (recentSeenSet.size > 0 && recentSeenSet.has(t.id.toLowerCase())) continue;
            seen.add(t.id);
            out.push(t as Track);
          }
        }
      }
    } catch {}

    if (out.length < 8) {
      try {
        const queryPool = langs.length > 0
          ? langs.map((l) => `${l} latest songs ${year} official audio`)
          : [`latest hit songs ${year} official audio`];
        const ytTracks = await runQueryBatch(queryPool, 10, true, false, page);
        for (const t of ytTracks) {
          if (out.length >= count) break;
          if (!seen.has(t.id) && isOriginalSong(t) && !isOldEraTrack(t)) {
            if (recentSeenSet.size > 0 && recentSeenSet.has(t.id.toLowerCase())) continue;
            seen.add(t.id);
            out.push(t as Track);
          }
        }
      } catch {}
    }

    return { tracks: out.slice(0, count), error: null };
  });


const LanguagePicksInput = z.object({
  languages: z.array(z.string()).max(30).default([]),
  artists: z.array(z.string()).max(50).default([]),
  count: z.number().min(1).max(40).optional(),
});

/**
 * Language-based songs: hits from the listener's chosen languages, plus the
 * favorite artists/singers picked on login and in settings. No AI.
 */
export const languagePicks = createServerFn({ method: "POST" })
  .validator((input: unknown) => LanguagePicksInput.parse(input))
  .handler(async ({ data }) => {
    const count = data.count ?? 24;
    const langs = data.languages
      .map((l) => LANG_SEARCH[l.trim()])
      .filter((t): t is string => Boolean(t))
      .slice(0, 4);
    const artists = data.artists.map((a) => a.trim()).filter(Boolean).slice(0, 6);

    const out: Track[] = [];
    const seen = new Set<string>();

    const add = async (queries: string[], quota: number) => {
      if (out.length >= count || quota <= 0) return;
      const per = Math.max(1, Math.ceil(quota / queries.length));
      for (const query of queries) {
        if (out.length >= count) return;
        let tracks: Track[] = [];
        try {
          const { searchSaavn } = await import("./providers/saavn");
          const saavnHits = await searchSaavn(query, { limit: per + 6 });
          tracks = (saavnHits as Track[]) ?? [];
        } catch {
          continue;
        }
        for (const t of tracks) {
          if (out.length >= count) return;
          if (seen.has(t.id)) continue;
          seen.add(t.id);
          out.push(t);
        }
      }
    };

    // Favorite artists first — their own language when one is selected.
    const artistQueries =
      artists.length > 0
        ? langs.length > 0
          ? artists
              .slice(0, 4)
              .flatMap((a) => langs.slice(0, 2).map((l) => `${a} ${l} songs`))
          : artists.slice(0, 6).map((a) => `${a} songs`)
        : [];
    await add(artistQueries, Math.floor(count * 0.5));

    // Fill the rest with language-focused hits.
    const langQueries =
      langs.length > 0
        ? langs.map((l) => `top ${l} songs this week`)
        : ["trending songs this week"];
    await add(langQueries, count);

    // Strict policy: only serve tracks consistent with the selected languages
    // so the Language picks never leak cross-language contamination.
    const picks = data.languages.length > 0
      ? out.filter((t) => isLanguageConsistent(t, data.languages))
      : out;
    return { tracks: picks.slice(0, count), error: null };
  });


const LanguageChartsInput = z.object({
  languages: z.array(z.string()).max(30).default([]),
  count: z.number().min(1).max(40).optional(),
});

/**
 * Language charts — this week's hottest songs per selected language, so the
 * Languages tab can switch from personal picks to "what's hot right now".
 * No AI.
 */
export const languageCharts = createServerFn({ method: "POST" })
  .validator((input: unknown) => LanguageChartsInput.parse(input))
  .handler(async ({ data }) => {
    const count = data.count ?? 24;
    const langs = data.languages
      .map((l) => LANG_SEARCH[l.trim()])
      .filter((t): t is string => Boolean(t))
      .slice(0, 4);
    if (langs.length === 0) return { tracks: [], error: null };

    const out: Track[] = [];
    const seen = new Set<string>();
    const per = Math.max(4, Math.ceil(count / langs.length));

    for (const lang of langs) {
      if (out.length >= count) break;
      let tracks: Track[] = [];
      try {
        const { getSaavnTrendingSongs, searchSaavn } = await import("./providers/saavn");
        const trending = await getSaavnTrendingSongs([lang], per + 6);
        if (trending.length > 0) {
          tracks = trending as Track[];
        } else {
          tracks = (await searchSaavn(`top ${lang} hits`, { limit: per + 6 })) as Track[];
        }
      } catch {
        continue;
      }
      for (const t of tracks) {
        if (out.length >= count) break;
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        out.push(t);
      }
    }
    return { tracks: out.slice(0, count), error: null };
  });


const PodcastInput = z.object({
  artists: z.array(z.string()).max(50).default([]),
  count: z.number().min(1).max(30).optional(),
  languages: z.array(z.string()).max(30).default([]),
  topics: z.array(z.string()).max(30).default([]),
});

/** Podcast topic names from Tune picks → search terms for YouTube queries. */
const TOPIC_SEARCH: Record<string, string> = {
  Tech: "technology",
  Cinema: "cinema movies",
  History: "history",
  Motivation: "motivation self improvement",
  Business: "business",
  Science: "science",
  Health: "health fitness",
  Comedy: "comedy",
  "True Crime": "true crime",
  Sports: "sports",
  News: "news",
  Finance: "finance money",
  Psychology: "psychology",
  Travel: "travel",
};

/**
 * Podcast suggestions: fresh episodes from this week, top shows in your
 * languages, shows from your favourite artists, and what's trending. The
 * app streams them audio-only like any other track. No AI.
 */
export const podcastPicks = createServerFn({ method: "POST" })
  .validator((input: unknown) => PodcastInput.parse(input))
  .handler(async ({ data }) => {
    const count = data.count ?? 20;
    const langs = data.languages.map((l) => l.trim()).filter(Boolean);
    const topics = data.topics
      .map((t) => TOPIC_SEARCH[t.trim()] || t.trim())
      .filter((t): t is string => Boolean(t) && t.toLowerCase() !== "all")
      .slice(0, 4);
    const hasTopics = topics.length > 0;
    const hasLang = langs.length > 0;

    const out: Track[] = [];
    const seen = new Set<string>();

    const primaryLang = langs[0] || "";

    // 1. Primary Strategy: Direct podcast episodes with official MP3 CDN streams
    try {
      const { searchPodcastEpisodes } = await import("./podcast.server");
      const podcastSearchQueries: string[] = [];

      if (hasLang && hasTopics) {
        for (const t of topics) {
          podcastSearchQueries.push(`${primaryLang} ${t} podcast`);
        }
      } else if (hasLang) {
        for (const l of langs) {
          podcastSearchQueries.push(`${l} podcast`);
        }
      } else if (hasTopics) {
        for (const t of topics) {
          podcastSearchQueries.push(`${t} podcast`);
        }
      } else {
        podcastSearchQueries.push("top podcasts", "science podcast", "motivation podcast", "technology podcast");
      }

      for (const query of podcastSearchQueries) {
        if (out.length >= count) break;
        const episodes = await searchPodcastEpisodes(query, 8);
        for (const ep of episodes) {
          if (out.length >= count) break;
          const key = ep.title.toLowerCase();
          if (seen.has(ep.id) || seen.has(key)) continue;
          seen.add(ep.id);
          seen.add(key);
          out.push(ep);
        }
      }
    } catch (err) {
      console.warn("[podcast] Direct episode stream search notice:", err);
    }

    if (out.length >= Math.min(count, 8)) {
      return { tracks: out.slice(0, count), error: null };
    }

    // 2. Supplementary Strategy: YouTube podcasts with strict language adherence
    const { searchYouTube } = await import("./music.server");
    const artists = data.artists.map((a) => a.trim()).filter(Boolean).slice(0, 4);

    /** Runs a set of queries and merges results (musicOnly=false → podcasts pass the filter). */
    const add = async (queries: string[], quota: number, upload?: "today" | "week") => {
      if (out.length >= count || quota <= 0) return;
      const per = Math.max(1, Math.ceil(quota / Math.max(1, queries.length)));
      for (const query of queries) {
        if (out.length >= count) return;
        let tracks: Track[] = [];
        try {
          tracks = await searchYouTube(query, per + 6, false, upload);
          if (tracks.length === 0 && upload) {
            tracks = await searchYouTube(query, per + 6, false);
          }
        } catch {
          continue;
        }
        for (const t of tracks) {
          if (out.length >= count) return;
          if (seen.has(t.id)) continue;
          seen.add(t.id);
          out.push(t);
        }
      }
    };

    const freshQueries: string[] = [];
    const topQueries: string[] = [];
    const topicQueries: string[] = [];

    if (hasLang && hasTopics) {
      for (const t of topics) {
        freshQueries.push(`${primaryLang} ${t} podcast latest episodes`);
        topQueries.push(`top ${primaryLang} ${t} podcast`);
        topicQueries.push(`${primaryLang} ${t} podcast conversation`);
      }
    } else if (hasLang) {
      for (const l of langs) {
        freshQueries.push(`new ${l} podcast episodes`);
        topQueries.push(`top ${l} podcasts`);
        topicQueries.push(`best ${l} podcasts`);
      }
    } else if (hasTopics) {
      for (const t of topics) {
        freshQueries.push(`${t} podcast latest episodes`);
        topQueries.push(`top ${t} podcast`);
        topicQueries.push(`${t} podcast conversation`);
      }
    } else {
      freshQueries.push("new podcast episodes this week");
      topQueries.push("trending podcasts", "best podcasts to listen to");
      topicQueries.push("popular podcast interview");
    }

    await add(freshQueries, Math.floor(count * 0.4), "week");
    await add(topQueries, Math.floor(count * 0.35));
    if (artists.length > 0 && !hasLang) {
      for (const artist of artists) {
        await add([`${artist} podcast`], Math.ceil(count / 8));
      }
    }
    await add(topicQueries, count);

    // Only add generic fallback if NO language was specified
    if (out.length < 6 && !hasLang) {
      await add(["top podcasts", `best podcast episodes ${CURRENT_YEAR}`], count - out.length);
    }

    return { tracks: out.slice(0, count), error: null };
  });

const DiscoverPodcastsInput = z.object({
  language: z.string().optional(),
  topic: z.string().optional(),
  query: z.string().optional(),
  limit: z.number().min(1).max(50).optional(),
});

export const discoverPodcastsServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => DiscoverPodcastsInput.parse(input))
  .handler(async ({ data }) => {
    const { searchPodcasts } = await import("./podcast.server");
    const podcasts = await searchPodcasts({
      language: data.language,
      topic: data.topic,
      query: data.query,
      limit: data.limit,
    });
    return { podcasts, error: null };
  });

const GetPodcastEpisodesInput = z.object({
  podcastId: z.string(),
  limit: z.number().min(1).max(100).optional(),
});

export const getPodcastEpisodesServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => GetPodcastEpisodesInput.parse(input))
  .handler(async ({ data }) => {
    const { getPodcastEpisodes } = await import("./podcast.server");
    const episodes = await getPodcastEpisodes(data.podcastId, data.limit ?? 50);
    return { episodes, error: null };
  });

const GetPodcastShowInput = z.object({
  podcastId: z.string().optional(),
  query: z.string().optional(),
  language: z.string().optional(),
  limit: z.number().min(1).max(100).optional(),
});

export const getPodcastShowServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => GetPodcastShowInput.parse(input))
  .handler(async ({ data }) => {
    const { getPodcastShow } = await import("./podcast.server");
    const res = await getPodcastShow({
      podcastId: data.podcastId,
      query: data.query,
      language: data.language,
      limit: data.limit ?? 60,
    });
    return { show: res.show, episodes: res.episodes, error: null };
  });



const RadioTracksInput = z.object({
  videoId: z.string().min(1).max(64),
  count: z.number().min(1).max(30).optional(),
  continuation: z.string().optional(),
});

/**
 * Song radio — same artist, genre, mood and feel as the picked track,
 * via YouTube's own recommendation engine. No AI needed.
 */
export const radioTracks = createServerFn({ method: "POST" })
  .validator((input: unknown) => RadioTracksInput.parse(input))
  .handler(async ({ data }) => {
    const { getRadioTracks } = await import("./radio.server");
    try {
      const res = await getRadioTracks(data.videoId, data.count ?? 20, data.continuation);
      return { tracks: res.tracks, continuation: res.continuation, error: null };
    } catch {
      return { tracks: [], error: null };
    }
  });


const MoodPicksInput = z.object({
  mood: z.string().min(1).max(40),
  language: z.string().max(40).optional(),
  languages: z.array(z.string().max(40)).max(10).optional(),
});

/** Curated search per mood — clean 2-3 word queries strictly aligned with user's selected languages. */
export function getMoodSearchQueries(
  mood: string,
  language?: string,
  languages?: string[],
): string[] {
  const rawLangs = languages && languages.length > 0 ? languages : language ? [language] : [];
  const userLangs = rawLangs
    .map((l) => l.trim())
    .filter((l) => l && l.toLowerCase() !== "english");

  const cleanMood = mood.toLowerCase().trim();

  // If user has specific regional languages selected (e.g. Telugu, Hindi, Tamil)
  if (userLangs.length > 0) {
    const allQueries: string[] = [];

    for (const lang of userLangs) {
      switch (cleanMood) {
        case "romantic":
          allQueries.push(`${lang} love songs`, `${lang} melody songs`, `${lang} romantic hits`);
          break;
        case "chill":
          allQueries.push(`${lang} slow songs`, `${lang} chill songs`, `${lang} melody songs`);
          break;
        case "upbeat workout":
        case "workout":
          allQueries.push(`${lang} mass songs`, `${lang} beat songs`, `${lang} energetic songs`);
          break;
        case "party":
          allQueries.push(`${lang} party songs`, `${lang} dance songs`, `${lang} dj hits`);
          break;
        case "sad hours":
        case "sad":
          allQueries.push(`${lang} sad songs`, `${lang} emotional songs`, `${lang} heartbreak songs`);
          break;
        case "focus":
          allQueries.push(`${lang} peaceful songs`, `${lang} melody songs`, "focus study instrumental");
          break;
        case "late night":
          allQueries.push(`${lang} night songs`, `${lang} melody songs`, `${lang} soft songs`);
          break;
        case "devotional":
          allQueries.push(`${lang} devotional songs`, `${lang} bhakti songs`, `${lang} stotram songs`);
          break;
        default:
          allQueries.push(`${lang} ${mood} songs`, `${lang} hits`);
          break;
      }
    }
    return allQueries;
  }

  // Universal / English / No language specified
  switch (cleanMood) {
    case "romantic":
      return ["romantic love songs", "love hits", "romantic melody songs"];
    case "chill":
      return ["chill relaxing songs", "calm acoustic songs", "chill melody songs"];
    case "upbeat workout":
    case "workout":
      return ["workout motivation songs", "energetic gym songs", "high energy songs"];
    case "party":
      return ["party dance songs", "dance hits", "club bangers"];
    case "sad hours":
    case "sad":
      return ["sad emotional songs", "heartbreak soulful songs", "sad hits"];
    case "focus":
      return ["focus study instrumental", "ambient concentration piano", "calm focus songs"];
    case "late night":
      return ["late night songs", "midnight drive songs", "calm night songs"];
    case "devotional":
      return ["devotional bhakti songs", "peaceful spiritual songs", "bhajan songs"];
    default:
      return [`${mood} songs`, "top hits"];
  }
}

/** Builds a mood radio instantly from JioSaavn catalog — strictly locked to user's selected languages. */
export const moodPicks = createServerFn({ method: "POST" })
  .validator((input: unknown) => MoodPicksInput.parse(input))
  .handler(async ({ data }) => {
    // Resolve user's full selected languages array
    const selectedLanguages =
      data.languages && data.languages.length > 0
        ? data.languages.map((l) => l.trim()).filter(Boolean)
        : data.language?.trim()
        ? [data.language.trim()]
        : [];

    const queries = getMoodSearchQueries(data.mood, data.language, selectedLanguages);
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    const tracks: Track[] = [];

    try {
      const { searchSaavn } = await import("./providers/saavn");

      for (const q of queries) {
        if (tracks.length >= 30) break;
        try {
          const hits = await searchSaavn(q, { limit: 15 });
          for (const t of hits) {
            if (!t?.id || seenIds.has(t.id)) continue;
            // STRICT LANGUAGE CHECK: Reject any song from an unselected language
            if (selectedLanguages.length > 0 && !isLanguageConsistent(t, selectedLanguages)) {
              continue;
            }
            const key = getTrackDedupeKey(t.title, t.artist);
            if (key && seenKeys.has(key)) continue;
            if (key) seenKeys.add(key);
            seenIds.add(t.id);
            tracks.push(t as Track);
          }
        } catch {}
      }

      if (tracks.length > 0) {
        return { tracks: tracks.slice(0, 35), error: null };
      }
    } catch {}

    // Fallback: strictly locked to user's selected languages! Never unlocalized generic queries.
    try {
      const { searchSaavn } = await import("./providers/saavn");

      if (selectedLanguages.length > 0) {
        for (const lang of selectedLanguages) {
          if (tracks.length >= 25) break;
          try {
            const fallbackHits = await searchSaavn(`${lang} top hits`, { limit: 15 });
            for (const t of fallbackHits) {
              if (!t?.id || seenIds.has(t.id)) continue;
              if (!isLanguageConsistent(t, selectedLanguages)) continue;
              seenIds.add(t.id);
              tracks.push(t as Track);
            }
          } catch {}
        }
      } else {
        const hits = await searchSaavn(`${data.mood} songs`, { limit: 20 });
        for (const t of hits) {
          if (!t?.id || seenIds.has(t.id)) continue;
          seenIds.add(t.id);
          tracks.push(t as Track);
        }
      }

      if (tracks.length > 0) {
        return { tracks: tracks.slice(0, 35), error: null };
      }
    } catch {}

    return { tracks, error: tracks.length === 0 ? "Could not load mood songs right now." : null };
  });


const StreamInput = z.object({ videoId: z.string().min(1).max(64) });

/** Resolves a direct audio URL so playback avoids ads and keeps running in the background. */
export const getStreamUrl = createServerFn({ method: "POST" })
  .validator((input: unknown) => StreamInput.parse(input))
  .handler(async ({ data }) => {
    const { resolveStreamUrl } = await import("./stream.server");
    try {
      const url = await resolveStreamUrl(data.videoId);
      return { url, error: null };
    } catch {
      return { url: null, error: "This track could not be streamed." };
    }
  });


const TrackDetailsInput = z.object({ videoId: z.string().min(1).max(64) });

/** Fetches enriched track metadata from YouTube's music knowledge graph. */
export const fetchTrackDetails = createServerFn({ method: "POST" })
  .validator((input: unknown) => TrackDetailsInput.parse(input))
  .handler(async ({ data }) => {
    const { getTrackDetails } = await import("./music.server");
    try {
      const details = await getTrackDetails(data.videoId);
      return { details, error: null };
    } catch {
      return { details: null, error: "Could not fetch track details." };
    }
  });


const PrewarmInput = z.object({ ids: z.array(z.string()).max(3).default([]) });

/**
 * Pre-resolves stream URLs for upcoming tracks so playback starts from the
 * cache instead of waiting on a fresh resolve (~12s) the moment you hit play.
 * Resolves are sequential to avoid spawning several yt-dlp processes at once.
 */
export const prewarmStreams = createServerFn({ method: "POST" })
  .validator((input: unknown) => PrewarmInput.parse(input))
  .handler(async ({ data }) => {
    if (data.ids.length === 0) return { ok: true };
    const { resolveStreamUrl } = await import("./stream.server");
    for (const id of data.ids) {
      try {
        await resolveStreamUrl(id);
      } catch {
        // Pre-warming is best-effort — a failure here shouldn't surface.
      }
    }
    return { ok: true };
  });

