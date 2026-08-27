import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Track } from "./music.server";

const SearchInput = z.object({ query: z.string().min(1), limit: z.number().optional() });

export const searchTracks = createServerFn({ method: "POST" })
  .validator((input: unknown) => SearchInput.parse(input))
  .handler(async ({ data }) => {
    const { searchYouTube } = await import("./music.server");
    const limit = data.limit ?? 20;

    try {
      const tracks = await searchYouTube(data.query, limit);
      return { tracks, error: null };
    } catch (error) {
      console.error("Search failed:", error);
      return { tracks: [], error: "Could not reach the music catalog. Try again." };
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

/** Search Deezer for tracks — free, no API key. Returns tracks with playable preview URLs. */
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


const RecommendInput = z.object({
  liked: z.array(z.string()).max(40),
  recent: z.array(z.string()).max(40),
  disliked: z.array(z.string()).max(40).optional(),
  sequence: z.array(z.string()).max(20).optional(),
  skipped: z.array(z.string()).max(20).optional(),
  mood: z.string().max(120).optional(),
  brief: z.string().max(800).optional(),
  count: z.number().min(1).max(40).optional(),
});

export const recommendTracks = createServerFn({ method: "POST" })
  .validator((input: unknown) => RecommendInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["AI_API_KEY"];
    if (!key) {
      // No AI key — fall back to local YouTube-based picks
      const { localPicks: lp } = await import("./music.functions");
      const artists = [
        ...new Set(
          [...data.liked, ...data.recent]
            .map((s) => s.split(" - ")[0]?.trim())
            .filter((a): a is string => !!a),
        ),
      ].slice(0, 5);
      const result = await lp({ data: { artists, mode: "feed", count: data.count ?? 24 } });
      return { tracks: result.tracks, error: null };
    }

    const { generateText } = await import("ai");
    const { createAiGatewayProvider } = await import("./ai-gateway.server");
    const { searchYouTube } = await import("./music.server");

    const count = data.count ?? 30;
    const hasTaste = data.liked.length > 0 || data.recent.length > 0;
    const prompt = [
      "You map the sonic DNA of a listener's taste — tempo, pitch, instrumentation, vocal texture and energy — and read their behaviour sequentially: the order they play, replay and skip tracks.",
      hasTaste
        ? `Songs this listener loved:\n${data.liked.slice(0, 20).join("\n") || "(none yet)"}\n\nRecently played:\n${data.recent.slice(0, 20).join("\n") || "(none yet)"}`
        : "The listener is brand new. Suggest widely loved, high-quality songs across a few popular genres.",
      data.sequence?.length
        ? `Their last sessions in order, with what they did with each track:\n${data.sequence.join("\n")}`
        : "",
      data.skipped?.length
        ? `Repeatedly skipped — steer away from this sound:\n${data.skipped.join("\n")}`
        : "",
      data.disliked?.length
        ? `They disliked these songs — never suggest them or very similar tracks:\n${data.disliked.slice(0, 20).join("\n")}`
        : "",
      data.mood ? `They asked for: ${data.mood}` : "",
      data.brief ? `Tuning preferences: ${data.brief}` : "",
      "",
      `Recommend ${count} songs they would likely love next. Respect the tuning preferences above. Do not repeat songs already listed.`,
      "Balance the batch roughly: 40% comfort picks that sit right in their current taste, 30% older songs or forgotten favourites they likely have not heard in years, 30% completely new artists that sound strikingly close to their sonic profile. Never make it feel repetitive, and never jump to something jarring or off-profile.",
      'Reply with ONLY a JSON array like: [{"title":"Song name","artist":"Artist name","reason":"why, max 8 words"}]',
    ]
      .filter(Boolean)
      .join("\n");




    let raw = "";
    try {
      const gateway = createAiGatewayProvider(key);
      const result = await generateText({
        model: gateway("google/gemini-3.6-flash"),
        prompt,
      });
      raw = result.text;
    } catch (err) {
      const message = String(err);
      if (message.includes("429")) return { tracks: [], error: "Too many requests — try again shortly." };
      if (message.includes("402") || /credit|payment_required/i.test(message))
        return { tracks: [], error: "AI credits are exhausted — add credits to keep generating picks." };
      return { tracks: [], error: "Recommendations are unavailable right now." };
    }

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return { tracks: [], error: "Could not read the recommendations." };

    let picks: Array<{ title?: string; artist?: string; reason?: string }> = [];
    try {
      picks = JSON.parse(jsonMatch[0]);
    } catch {
      return { tracks: [], error: "Could not read the recommendations." };
    }

    const valid = picks.filter((p) => p.title && p.artist).slice(0, count);
    const resolved = await Promise.all(
      valid.map(async (p) => {
        try {
          const found = await searchYouTube(`${p.artist} ${p.title} audio`, 1);
          const track = found[0];
          return track ? { ...track, reason: p.reason ?? "" } : null;
        } catch {
          return null;
        }
      }),
    );

    return { tracks: resolved.filter((t): t is NonNullable<typeof t> => t !== null), error: null };
  });


const MixInput = z.object({
  kind: z.enum(["discover", "newrelease"]),
  liked: z.array(z.string()).max(30).default([]),
  recent: z.array(z.string()).max(30).default([]),
  sequence: z.array(z.string()).max(20).default([]),
  skipped: z.array(z.string()).max(20).default([]),
  artists: z.array(z.string()).max(15).default([]),
  brief: z.string().max(800).optional(),
  count: z.number().min(1).max(30).optional(),
});

/**
 * Builds a personalised mix.
 * - discover: brand-new artists that match the listener's sonic profile.
 * - newrelease: the latest drops from the artists they actually play.
 */
export const buildMix = createServerFn({ method: "POST" })
  .validator((input: unknown) => MixInput.parse(input))
  .handler(async ({ data }) => {
    const { searchYouTube } = await import("./music.server");
    const count = data.count ?? 20;

    if (data.kind === "newrelease") {
      if (data.artists.length === 0) return { tracks: [], error: null };
      const year = new Date().getFullYear();
      const perArtist = Math.max(1, Math.ceil(count / data.artists.length));
      const batches = await Promise.all(
        data.artists.slice(0, 12).map(async (artist) => {
          try {
            return await searchYouTube(`${artist} new song ${year}`, perArtist + 1);
          } catch {
            return [];
          }
        }),
      );
      const seen = new Set<string>();
      const tracks = batches
        .flat()
        .filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
        .slice(0, count);
      return { tracks, error: null };
    }

    const key = process.env["AI_API_KEY"];
    if (!key) {
      // No AI key — use YouTube search for discover mix
      const { searchYouTube } = await import("./music.server");
      const count = data.count ?? 20;
      const out: Track[] = [];
      const seen = new Set<string>();
      for (const q of ["underrated songs you need to hear", "hidden gem songs trending", "best new artists discovery", "fresh music unique sound"]
        .slice(0, 4)) {
        if (out.length >= count) break;
        try {
          const tracks = await searchYouTube(q, 8);
          for (const t of tracks) {
            if (out.length >= count) break;
            if (seen.has(t.id) || data.artists.some((a) => t.artist.toLowerCase().includes(a.toLowerCase()))) continue;
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
      const result = await generateText({ model: gateway("google/gemini-3.6-flash"), prompt });
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
    const resolved = await Promise.all(
      valid.map(async (p) => {
        try {
          const found = await searchYouTube(`${p.artist} ${p.title} audio`, 1);
          const track = found[0];
          return track ? { ...track, reason: p.reason ?? "" } : null;
        } catch {
          return null;
        }
      }),
    );
    return { tracks: resolved.filter((t): t is NonNullable<typeof t> => t !== null), error: null };
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
    const { searchYouTube } = await import("./music.server");
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
          return await searchYouTube(`${artist} new song`, 5, true, "week");
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
    const { searchYouTube } = await import("./music.server");
    const count = data.count ?? 24;
    const artists = data.artists.map((a) => a.trim()).filter(Boolean).slice(0, 5);
    const out: Track[] = [];
    const seen = new Set<string>();

    const add = async (query: string, quota: number) => {
      if (out.length >= count || quota <= 0) return;
      let tracks: Track[] = [];
      try {
        tracks = await searchYouTube(query, quota + 6);
      } catch {
        return;
      }
      for (const t of tracks) {
        if (out.length >= count) return;
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        out.push(t);
      }
    };

    if (data.mode === "nextup" && data.currentArtist) {
      // Up Next: starts from what's playing right now, then widens out.
      await add(`${data.currentArtist} songs`, Math.floor(count * 0.6));
      await add(`${data.currentArtist} similar artists songs`, count);
    } else if (artists.length > 0) {
      // Comfort picks: the hits from artists they already play.
      await add(`${artists[0]} best songs`, Math.floor(count * 0.4));
      if (artists[1]) await add(`${artists[1]} hit songs`, Math.floor(count * 0.25));
      // New artists that sound strikingly similar to their top pick.
      await add(`${artists[0]} similar artists songs`, Math.floor(count * 0.35));
    } else {
      // Brand-new listener: widely loved, high-quality picks across genres.
      await add("trending songs this week", count);
    }

    // Top up the batch if the quota math fell short.
    if (out.length < count && artists.length > 0) {
      await add(`${artists[0]} songs`, count);
    }
    return { tracks: out.slice(0, count), error: null };
  });


const NewSongsInput = z.object({
  artists: z.array(z.string()).max(10).default([]),
  count: z.number().min(1).max(30).optional(),
  languages: z.array(z.string()).max(10).default([]),
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
    const { searchYouTube } = await import("./music.server");
    const count = data.count ?? 24;
    const year = new Date().getFullYear();
    const artists = data.artists.map((a) => a.trim()).filter(Boolean).slice(0, 4);
    const langs = data.languages
      .map((l) => LANG_SEARCH[l.trim()])
      .filter((t): t is string => Boolean(t))
      .slice(0, 3);
    const hasLang = langs.length > 0;

    const out: Track[] = [];
    const seen = new Set<string>();

    /** Runs a set of queries (one per language when set) and merges results. */
    const add = async (
      queries: string[],
      quota: number,
      upload?: "today" | "week",
    ) => {
      if (out.length >= count || quota <= 0) return;
      const per = Math.max(1, Math.ceil(quota / queries.length));
      for (const query of queries) {
        if (out.length >= count) return;
        let tracks: Track[] = [];
        try {
          tracks = await searchYouTube(query, per + 6, true, upload);
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

    const weekQueries = hasLang
      ? langs.map((l) => `new ${l} songs`)
      : ["new songs"];
    const yearQueries = hasLang
      ? langs.map((l) => `latest ${l} songs ${year}`)
      : [`latest songs ${year}`];
    const trendQueries = hasLang
      ? langs.map((l) => `trending ${l} songs`)
      : ["trending songs this week"];

    // Fresh uploads from this week, then this year's latest, then their artists.
    await add(weekQueries, Math.floor(count * 0.35), "week");
    await add(yearQueries, Math.floor(count * 0.3));
    for (const artist of artists) {
      await add([`${artist} new song ${year}`], Math.ceil(count / 6));
    }
    // Top up with what people are listening to right now.
    await add(trendQueries, count);
    return { tracks: out.slice(0, count), error: null };
  });


const LanguagePicksInput = z.object({
  languages: z.array(z.string()).max(10).default([]),
  artists: z.array(z.string()).max(10).default([]),
  count: z.number().min(1).max(40).optional(),
});

/**
 * Language-based songs: hits from the listener's chosen languages, plus the
 * favorite artists/singers picked on login and in settings. No AI.
 */
export const languagePicks = createServerFn({ method: "POST" })
  .validator((input: unknown) => LanguagePicksInput.parse(input))
  .handler(async ({ data }) => {
    const { searchYouTube } = await import("./music.server");
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
          tracks = await searchYouTube(query, per + 6, true);
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

    return { tracks: out.slice(0, count), error: null };
  });


const LanguageChartsInput = z.object({
  languages: z.array(z.string()).max(10).default([]),
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
    const { searchYouTube } = await import("./music.server");
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
        tracks = await searchYouTube(`top ${lang} songs this week`, per + 6, true);
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
  artists: z.array(z.string()).max(10).default([]),
  count: z.number().min(1).max(30).optional(),
  languages: z.array(z.string()).max(10).default([]),
  topics: z.array(z.string()).max(10).default([]),
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
    const { searchYouTube } = await import("./music.server");
    const count = data.count ?? 20;
    const artists = data.artists.map((a) => a.trim()).filter(Boolean).slice(0, 4);
    const langs = data.languages
      .map((l) => LANG_SEARCH[l.trim()])
      .filter((t): t is string => Boolean(t))
      .slice(0, 3);
    const hasLang = langs.length > 0;
    const topics = data.topics
      .map((t) => TOPIC_SEARCH[t.trim()])
      .filter((t): t is string => Boolean(t))
      .slice(0, 4);
    const hasTopics = topics.length > 0;

    const out: Track[] = [];
    const seen = new Set<string>();

    /** Runs a set of queries and merges results (musicOnly=false → podcasts pass the filter). */
    const add = async (queries: string[], quota: number, upload?: "today" | "week") => {
      if (out.length >= count || quota <= 0) return;
      const per = Math.max(1, Math.ceil(quota / queries.length));
      for (const query of queries) {
        if (out.length >= count) return;
        let tracks: Track[] = [];
        try {
          tracks = await searchYouTube(query, per + 6, false, upload);
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

    // When topics are picked, they drive the mix; otherwise fall back to
    // language-focused and general trending shows.
    const freshQueries = hasTopics
      ? topics.map((t) => `${t} podcast new episodes`)
      : hasLang
        ? langs.map((l) => `new ${l} podcast episodes`)
        : ["new podcast episodes this week"];
    const topQueries = hasTopics
      ? topics.flatMap((t) => [`top ${t} podcasts`, `best ${t} podcasts`])
      : hasLang
        ? langs.map((l) => `top ${l} podcasts`)
        : ["trending podcasts"];
    const topicQueries = hasTopics
      ? topics.flatMap((t) => [`${t} podcast episodes`, `${t} podcast`])
      : hasLang
        ? langs.map((l) => `best ${l} podcasts`)
        : ["best podcasts to listen to"];

    // Fresh episodes, top shows in your topics/languages, then your artists' shows.
    await add(freshQueries, Math.floor(count * 0.4), "week");
    await add(topQueries, Math.floor(count * 0.35));
    for (const artist of artists) {
      await add([`${artist} podcast`], Math.ceil(count / 8));
    }
    // Top up with well-known shows.
    await add(topicQueries, count);
    return { tracks: out.slice(0, count), error: null };
  });


const RadioInput = z.object({
  videoId: z.string().min(1).max(64),
  count: z.number().min(1).max(30).optional(),
});

/**
 * Song radio — same artist, genre, mood and feel as the picked track,
 * via YouTube's own recommendation engine. No AI needed.
 */
export const radioTracks = createServerFn({ method: "POST" })
  .validator((input: unknown) => RadioInput.parse(input))
  .handler(async ({ data }) => {
    const { getRadioTracks } = await import("./radio.server");
    try {
      return { tracks: await getRadioTracks(data.videoId, data.count ?? 15), error: null };
    } catch {
      return { tracks: [], error: null };
    }
  });


const MoodPicksInput = z.object({ mood: z.string().min(1).max(40) });

/** Curated search per mood — YouTube-Music-style radio that needs no AI key. */
const MOOD_QUERIES: Record<string, string> = {
  "late night": "late night lofi songs mix",
  "upbeat workout": "upbeat workout songs energetic",
  focus: "focus music instrumental concentration",
  "sad hours": "sad songs soulful hindi",
  throwbacks: "throwback old hindi hits",
  romantic: "romantic love songs hindi",
  happy: "happy songs feel good bollywood",
  party: "party songs dance hindi",
  chill: "chill relaxing songs",
  devotional: "devotional bhajan songs",
};

/** Builds a mood radio instantly from YouTube search — no AI required. */
export const moodPicks = createServerFn({ method: "POST" })
  .validator((input: unknown) => MoodPicksInput.parse(input))
  .handler(async ({ data }) => {
    const { searchYouTube } = await import("./music.server");
    const query = MOOD_QUERIES[data.mood] ?? `${data.mood} songs`;
    try {
      return { tracks: await searchYouTube(query, 30), error: null };
    } catch {
      return { tracks: [], error: "Could not build that mood radio. Try again." };
    }
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
