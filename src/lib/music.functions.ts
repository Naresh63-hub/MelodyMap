import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Track } from "./types";
import { norm } from "./track-dedup";

/** Sanitizes user-provided strings to prevent AI prompt injection while preserving real song/artist names */
function sanitizePromptInput(str: string | undefined): string {
  if (!str) return "";
  return str
    .replace(/[\x00-\x1F\x7F]/g, "") // control characters
    .replace(/```[\s\S]*?```/g, "") // markdown code blocks
    .replace(/<!--[\s\S]*?-->/g, "") // html comments
    .replace(/[\\{}[\]^~`|]/g, " ") // template/code injection delimiters
    .replace(/\s+/g, " ")
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
});

export const searchTracks = createServerFn({ method: "POST" })
  .validator((input: unknown) => SearchInput.parse(input))
  .handler(async ({ data }) => {
    const { searchYouTube } = await import("./music.server");
    const limit = data.limit ?? 20;
    const isMusicOnly = data.type !== "podcasts";

    try {
      const tracks = await searchYouTube(data.query, limit, isMusicOnly);
      return { tracks, error: null };
    } catch (error) {
      console.error("Search failed:", error);
      return { tracks: [], error: "Could not reach the catalog. Try again." };
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

const LyricsInput = z.object({
  title: z.string().min(1),
  artist: z.string().min(1),
  duration: z.number().optional(),
});

/** Fetches real-time synced and plain lyrics via LRCLIB */
export const getTrackLyrics = createServerFn({ method: "POST" })
  .validator((input: unknown) => LyricsInput.parse(input))
  .handler(async ({ data }) => {
    const { fetchTrackLyrics } = await import("./lyrics.server");
    try {
      const res = await fetchTrackLyrics(data.title, data.artist, data.duration);
      return { lyrics: res, error: null };
    } catch (err) {
      console.warn("[getTrackLyrics] Lyrics fetch error:", err);
      return { lyrics: null, error: "Lyrics unavailable" };
    }
  });

const RadioInput = z.object({
  videoId: z.string().min(1),
  limit: z.number().optional(),
});

/** Fetches YouTube native RD song radio */
export const getSongRadio = createServerFn({ method: "POST" })
  .validator((input: unknown) => RadioInput.parse(input))
  .handler(async ({ data }) => {
    const { getRadioTracks } = await import("./radio.server");
    try {
      const tracks = await getRadioTracks(data.videoId, data.limit ?? 15);
      return { tracks, error: null };
    } catch {
      return { tracks: [], error: "Radio unavailable" };
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
  artists: z.array(z.string()).max(20).optional(),
  languages: z.array(z.string()).max(10).default([]),
  refreshNonce: z.union([z.string(), z.number()]).optional(),
});

/** Query pools for fresh new songs & trending releases */
const NEW_SONGS_QUERIES = [
  "latest trending songs 2026",
  "new release songs 2025 2026",
  "top new viral music hits",
  "fresh hit music chart today",
  "new popular songs this week",
  "latest romantic songs 2026",
  "top new indie music releases",
  "fresh workout upbeat songs 2026",
  "latest viral songs trending now",
  "top billboard hot songs new",
  "new dance party tracks 2026",
  "latest melody songs new",
];

/** Query pools for golden classics, 90s, 2000s & nostalgic evergreen songs */
const OLD_SONGS_QUERIES = [
  "90s superhit classic songs",
  "2000s nostalgic superhit songs",
  "all time golden evergreen hit songs",
  "timeless classic melody songs",
  "retro nostalgic melody hits",
  "iconic all time greatest songs",
  "90s 2000s romantic evergreen songs",
  "vintage superhit songs",
  "legendary classic all time hits",
  "golden oldies greatest hits",
  "best retro hits all time",
  "timeless 90s love songs",
];

const LANGUAGE_ARTISTS: Record<string, string[]> = {
  Telugu: [
    "Sid Sriram", "Anurag Kulkarni", "Ram Miriyala", "Devi Sri Prasad", "S. Thaman",
    "Anirudh Ravichander", "Shreya Ghoshal", "Armaan Malik", "Mangli", "Jaspreet Jasz",
    "SP Balasubrahmanyam", "M.M. Keeravaani", "Karthik", "Hariharan", "K.S. Chithra",
    "Haricharan", "Mano", "Geetha Madhuri", "Sunitha", "Rahul Sipligunj", "Hemachandra",
    "Pradeep Kumar", "Kapil Kapilan", "Hesham Abdul Wahab", "G.V. Prakash Kumar",
    "Chaitan Bharadwaj", "Mickey J Meyer", "Bheems Ceciroleo", "Vivek Sagar"
  ],
  Hindi: [
    "Arijit Singh", "Shreya Ghoshal", "Vishal Mishra", "Jubin Nautiyal", "B Praak",
    "Atif Aslam", "Sonu Nigam", "KK", "Mohit Chauhan", "Sunidhi Chauhan", "Neha Kakkar",
    "Pritam", "A.R. Rahman", "Sachin-Jigar", "Badshah", "Diljit Dosanjh", "Kishore Kumar",
    "Lata Mangeshkar", "Mohammed Rafi", "Kumar Sanu", "Udit Narayan", "Alka Yagnik",
    "Shaan", "Armaan Malik", "Darshan Raval", "Anuv Jain", "Prateek Kuhad", "Amit Trivedi"
  ],
  Tamil: [
    "Anirudh Ravichander", "A.R. Rahman", "Yuvan Shankar Raja", "Harris Jayaraj",
    "Sid Sriram", "Pradeep Kumar", "D. Imman", "Santhosh Narayanan", "Sean Roldan",
    "Ilaiyaraaja", "SP Balasubrahmanyam", "Karthik", "Shreya Ghoshal", "Vijay Antony",
    "G.V. Prakash Kumar", "Dhanush", "Jonita Gandhi", "K.J. Yesudas", "Haricharan"
  ],
  English: [
    "The Weeknd", "Taylor Swift", "Bruno Mars", "Ed Sheeran", "Billie Eilish",
    "Drake", "Post Malone", "Dua Lipa", "Coldplay", "Eminem", "Imagine Dragons",
    "Ariana Grande", "Justin Bieber", "Maroon 5", "Adele", "Sam Smith", "Harry Styles",
    "Lady Gaga", "OneRepublic", "Charlie Puth", "Shawn Mendes", "Sia", "Katy Perry"
  ],
  Punjabi: [
    "Diljit Dosanjh", "Karan Aujla", "AP Dhillon", "Sidhu Moose Wala", "Shubh",
    "Guru Randhawa", "Amrinder Gill", "B Praak", "Jassie Gill", "Hardy Sandhu",
    "Gurdas Maan", "Satinder Sartaaj", "Maninder Buttar"
  ],
  Malayalam: [
    "Sushin Shyam", "Hesham Abdul Wahab", "Jassie Gift", "K.J. Yesudas", "K.S. Chithra",
    "Vineeth Sreenivasan", "Shaan Rahman", "Gopi Sundar", "Haricharan", "Vijay Yesudas"
  ],
  Kannada: [
    "Vijay Prakash", "Sanjith Hegde", "Arjun Janya", "Charan Raj", "Raghu Dixit",
    "Sonu Nigam", "Shreya Ghoshal", "Armaan Malik", "B. Ajaneesh Loknath"
  ],
};

const DIVERSE_THEMES = [
  "latest romantic melody songs 2026",
  "mass high energy dance party hits",
  "soulful emotional love songs",
  "viral reels trending songs 2026",
  "acoustic lo-fi chill vibes",
  "all time golden evergreen hits",
  "90s classic superhit songs",
  "2000s nostalgic romantic hits",
  "unplugged live studio hits",
  "top movie chartbuster songs 2025 2026",
  "folk fusion upbeat songs",
  "indie new artist discovery",
];

function getDynamicQueries(languages: string[], userArtists: string[]): { newQueries: string[]; oldQueries: string[] } {
  let langs = languages.map((l) => l.trim()).filter(Boolean);

  // If no language chosen, infer from user artists or blend top language categories
  if (langs.length === 0) {
    const matchedLangs: string[] = [];
    for (const [langName, artistList] of Object.entries(LANGUAGE_ARTISTS)) {
      if (userArtists.some((ua) => artistList.some((la) => la.toLowerCase() === ua.toLowerCase()))) {
        matchedLangs.push(langName);
      }
    }
    langs = matchedLangs.length > 0 ? matchedLangs : ["Telugu", "Hindi", "Tamil", "English", "Punjabi"];
  }

  const primaryLang = langs[0] || "";
  const langArtistPool = primaryLang && LANGUAGE_ARTISTS[primaryLang] ? LANGUAGE_ARTISTS[primaryLang] : Object.values(LANGUAGE_ARTISTS).flat();
  const allArtists = [...new Set([...userArtists, ...langArtistPool])];
  const shuffledArtists = shuffleArray(allArtists);

  const newQ: string[] = [];
  const oldQ: string[] = [];

  // Distribute queries across the active languages
  for (const lang of langs.slice(0, 3)) {
    const langPrefix = `${lang} `;
    for (const art of shuffledArtists.slice(0, 5)) {
      newQ.push(`${art} ${langPrefix}latest new hit songs 2026`);
      newQ.push(`${art} ${langPrefix}top songs`);
      newQ.push(`${art} ${langPrefix}viral hit tracks`);
      oldQ.push(`${art} ${langPrefix}all time classic evergreen hits`);
      oldQ.push(`${art} ${langPrefix}best melody songs`);
      oldQ.push(`${art} ${langPrefix}golden nostalgic superhits`);
    }

    for (const theme of shuffleArray(DIVERSE_THEMES).slice(0, 5)) {
      if (theme.includes("classic") || theme.includes("90s") || theme.includes("2000s") || theme.includes("evergreen")) {
        oldQ.push(`${langPrefix}${theme}`);
      } else {
        newQ.push(`${langPrefix}${theme}`);
      }
    }
  }

  return {
    newQueries: shuffleArray(newQ),
    oldQueries: shuffleArray(oldQ),
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

async function getLocalPicks(data: {
  artists: string[];
  currentArtist?: string | undefined;
  mode?: "feed" | "discover" | "nextup" | undefined;
  count?: number | undefined;
  languages?: string[] | undefined;
  refreshNonce?: string | number | undefined;
}): Promise<Track[]> {
  const { searchYouTube } = await import("./music.server");
  const count = data.count ?? 28;
  const artists = data.artists.map((a) => a.trim()).filter(Boolean);
  const languages = (data.languages ?? []).map((l) => l.trim()).filter(Boolean);
  const { newQueries, oldQueries } = getDynamicQueries(languages, artists);

  const seenNewIds = new Set<string>();
  const seenNewKeys = new Set<string>();
  const seenOldIds = new Set<string>();
  const seenOldKeys = new Set<string>();

  // Sample 4 distinct new queries and 4 distinct old queries concurrently
  const pickedNew = shuffleArray(newQueries).slice(0, 4);
  const pickedOld = shuffleArray(oldQueries).slice(0, 4);

  const [newResults, oldResults] = await Promise.all([
    Promise.allSettled(
      pickedNew.map(async (q) => {
        try {
          return await searchYouTube(q, 10);
        } catch {
          return [];
        }
      }),
    ),
    Promise.allSettled(
      pickedOld.map(async (q) => {
        try {
          return await searchYouTube(q, 10);
        } catch {
          return [];
        }
      }),
    ),
  ]);

  const newCandidates: Track[] = [];
  for (const r of newResults) {
    if (r.status === "fulfilled") {
      for (const t of shuffleArray(r.value)) {
        if (seenNewIds.has(t.id)) continue;
        const key = getTrackDedupeKey(t.title, t.artist);
        if (key && seenNewKeys.has(key)) continue;
        if (key) seenNewKeys.add(key);
        seenNewIds.add(t.id);
        newCandidates.push(t);
      }
    }
  }

  const oldCandidates: Track[] = [];
  for (const r of oldResults) {
    if (r.status === "fulfilled") {
      for (const t of shuffleArray(r.value)) {
        if (seenOldIds.has(t.id)) continue;
        const key = getTrackDedupeKey(t.title, t.artist);
        if (key && seenOldKeys.has(key)) continue;
        if (key) seenOldKeys.add(key);
        seenOldIds.add(t.id);
        oldCandidates.push(t);
      }
    }
  }

  const newQuota = Math.ceil(count / 2);
  const oldQuota = count - newQuota;

  // Draw 50% new releases
  const selectedNew = shuffleArray(newCandidates).slice(0, newQuota);
  const chosenKeys = new Set<string>(selectedNew.map((t) => getTrackDedupeKey(t.title, t.artist)));
  const chosenIds = new Set<string>(selectedNew.map((t) => t.id));

  // Draw 50% golden classics, avoiding cross-bucket duplicates
  const distinctOldCandidates = shuffleArray(oldCandidates).filter(
    (t) => !chosenIds.has(t.id) && !chosenKeys.has(getTrackDedupeKey(t.title, t.artist)),
  );
  const selectedOld = distinctOldCandidates.slice(0, oldQuota);

  // Interleave New and Old tracks: [New1, Old1, New2, Old2, New3, Old3, ...] to enforce exact 50/50 balance
  const interleaved: Track[] = [];
  const max = Math.max(selectedNew.length, selectedOld.length);
  for (let i = 0; i < max; i++) {
    const n = selectedNew[i];
    const o = selectedOld[i];
    if (n) interleaved.push(n);
    if (o) interleaved.push(o);
  }

  return interleaved.slice(0, count);
}

const TrendingInput = z.object({
  languages: z.array(z.string()).max(10).default([]),
  count: z.number().min(1).max(50).optional(),
  refreshNonce: z.union([z.string(), z.number()]).optional(),
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
    "Viral Global Hit Songs 2026",
    "Top Viral Spotify Hits 2026",
    "Shazam Top 50 Trending Songs",
    "Viral Reels Trending Music 2026",
  ],
  party: [
    "Top 40 Music Chart Hits Worldwide",
    "Global Dance Party Trending Tracks 2026",
    "High Energy Hit Songs 2026",
  ],
  charts: [
    "YouTube Music Charts Top Trending Songs",
    "Trending Hit Songs 2025 2026",
    "Top 50 Most Streamed Songs 2026",
  ],
};

export const getRealTrendingTracks = createServerFn({ method: "POST" })
  .validator((input: unknown) => TrendingInput.parse(input))
  .handler(async ({ data }) => {
    const { searchYouTube } = await import("./music.server");
    const count = data.count ?? 20;
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();

    const langs = data.languages.map((l) => l.trim()).filter(Boolean);

    let selectedQueries: string[] = [];
    if (langs.length > 0) {
      for (const l of langs.slice(0, 3)) {
        selectedQueries.push(
          `Top 50 ${l} Songs Global Trending Chart`,
          `Viral ${l} Reels Trending Audio 2026`,
          `Most Streamed ${l} Songs 2026`,
          `${l} Chartbuster Hit Songs 2026`,
          `Top ${l} Party Dance Songs 2026`,
          `Latest ${l} Movie Songs 2026`,
        );
      }
      selectedQueries = shuffleArray(selectedQueries).slice(0, 5);
    } else {
      // Sample 1 distinct query from each musical category for maximum breadth
      selectedQueries = [
        shuffleArray(CATEGORIZED_TRENDING_QUERIES.billboard)[0]!,
        shuffleArray(CATEGORIZED_TRENDING_QUERIES.viral)[0]!,
        shuffleArray(CATEGORIZED_TRENDING_QUERIES.party)[0]!,
        shuffleArray(CATEGORIZED_TRENDING_QUERIES.charts)[0]!,
      ];
    }

    const batchResults = await Promise.allSettled(
      selectedQueries.map(async (q) => {
        try {
          return await searchYouTube(q, 10);
        } catch {
          return [];
        }
      }),
    );

    const candidates: Track[] = [];
    for (const r of batchResults) {
      if (r.status === "fulfilled") {
        for (const t of r.value) {
          if (seenIds.has(t.id)) continue;
          const key = getTrackDedupeKey(t.title, t.artist);
          if (key && seenKeys.has(key)) continue;
          if (key) seenKeys.add(key);
          seenIds.add(t.id);
          candidates.push(t);
        }
      }
    }

    return { tracks: shuffleArray(candidates).slice(0, count), error: null };
  });

export const recommendTracks = createServerFn({ method: "POST" })
  .validator((input: unknown) => RecommendInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["AI_API_KEY"];
    if (!key) {
      // No AI key — fall back to local YouTube-based picks with dynamic New & Old mix
      const artists = [
        ...new Set(
          [...data.liked, ...data.recent, ...(data.artists ?? [])]
            .map((s) => s.split(" - ")[0]?.trim())
            .filter((a): a is string => !!a),
        ),
      ].slice(0, 5);
      const tracks = await getLocalPicks({
        artists,
        mode: "feed",
        count: data.count ?? 24,
        languages: data.languages,
        refreshNonce: data.refreshNonce,
      });
      return { tracks, error: null };
    }

    const { generateText } = await import("ai");
    const { createAiGatewayProvider } = await import("./ai-gateway.server");
    const { searchYouTube } = await import("./music.server");

    const count = data.count ?? 30;
    const hasTaste = data.liked.length > 0 || data.recent.length > 0;
    const sanitizedLiked = data.liked.slice(0, 20).map(sanitizePromptInput).filter(Boolean);
    const sanitizedRecent = data.recent.slice(0, 20).map(sanitizePromptInput).filter(Boolean);
    const sanitizedSequence = (data.sequence ?? []).slice(0, 20).map(sanitizePromptInput).filter(Boolean);
    const sanitizedSkipped = (data.skipped ?? []).slice(0, 20).map(sanitizePromptInput).filter(Boolean);
    const sanitizedDisliked = (data.disliked ?? []).slice(0, 20).map(sanitizePromptInput).filter(Boolean);
    const sanitizedMood = sanitizePromptInput(data.mood);
    const sanitizedBrief = sanitizePromptInput(data.brief);
    const sanitizedLangs = data.languages.map(sanitizePromptInput).filter(Boolean);

    const prompt = [
      "You map the sonic DNA of a listener's taste — tempo, pitch, instrumentation, vocal texture and energy — and read their behaviour sequentially: the order they play, replay and skip tracks.",
      hasTaste
        ? `Songs this listener loved:\n${sanitizedLiked.join("\n") || "(none yet)"}\n\nRecently played:\n${sanitizedRecent.join("\n") || "(none yet)"}`
        : "The listener is brand new. Suggest widely loved, high-quality songs across popular genres.",
      sanitizedSequence.length
        ? `Their last sessions in order, with what they did with each track:\n${sanitizedSequence.join("\n")}`
        : "",
      sanitizedSkipped.length
        ? `Repeatedly skipped — steer away from this sound:\n${sanitizedSkipped.join("\n")}`
        : "",
      sanitizedDisliked.length
        ? `They disliked these songs — never suggest them or very similar tracks:\n${sanitizedDisliked.join("\n")}`
        : "",
      sanitizedMood ? `They asked for: ${sanitizedMood}` : "",
      sanitizedBrief ? `Tuning preferences: ${sanitizedBrief}` : "",
      sanitizedLangs.length > 0
        ? `CRITICAL LANGUAGE RESTRICTION: The user strictly wants songs in: ${sanitizedLangs.join(", ")}. EVERY single recommended track MUST be in one of these languages: ${sanitizedLangs.join(", ")}. Do NOT suggest tracks in any other language.`
        : "",
      "",
      `Recommend ${count} songs with a dynamic 50/50 balance: exactly 50% brand new songs (released in 2024-2026 or current trending hits) and 50% classic evergreen songs (90s, 2000s, iconic timeless tracks). Respect tuning preferences above.`,
      "CRITICAL: On every refresh, provide a completely fresh, diverse, and newly randomized selection with zero repetitive patterns.",
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
    const resolved: Track[] = [];
    const CHUNK_SIZE = 4;
    for (let i = 0; i < valid.length; i += CHUNK_SIZE) {
      const chunk = valid.slice(i, i + CHUNK_SIZE);
      const batch = await Promise.all(
        chunk.map(async (p) => {
          try {
            const found = await searchYouTube(`${p.artist} ${p.title} audio`, 1);
            const track = found[0];
            return track ? { ...track, reason: p.reason ?? "" } : null;
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
    const { searchYouTube } = await import("./music.server");
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
      const seenIds = new Set<string>();
      const seenTitles = new Set<string>();

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
      const batchResults = await Promise.allSettled(
        pickedQueries.map(async (q) => {
          try {
            return await searchYouTube(q, 10);
          } catch {
            return [];
          }
        }),
      );

      const candidates: Track[] = [];
      const seenKeys = new Set<string>();
      for (const r of batchResults) {
        if (r.status === "fulfilled") {
          for (const t of r.value) {
            if (seenIds.has(t.id)) continue;
            const key = getTrackDedupeKey(t.title, t.artist);
            if (key && seenKeys.has(key)) continue;
            if (key) seenKeys.add(key);
            seenIds.add(t.id);
            candidates.push(t);
          }
        }
      }

      return { tracks: shuffleArray(candidates).slice(0, count), error: null };
    }

    const key = process.env["AI_API_KEY"];
    if (!key) {
      // No AI key — use YouTube search for discover mix with randomized discovery queries
      const { searchYouTube } = await import("./music.server");
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

    const resolved: Track[] = [];
    const CHUNK_SIZE = 4;
    for (let i = 0; i < valid.length; i += CHUNK_SIZE) {
      const chunk = valid.slice(i, i + CHUNK_SIZE);
      const batch = await Promise.all(
        chunk.map(async (p) => {
          try {
            const found = await searchYouTube(`${p.artist} ${p.title} audio`, 1);
            const track = found[0];
            return track ? { ...track, reason: p.reason ?? "" } : null;
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
    const tracks = await getLocalPicks(data);
    return { tracks, error: null };
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


const RadioTracksInput = z.object({
  videoId: z.string().min(1).max(64),
  count: z.number().min(1).max(30).optional(),
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

