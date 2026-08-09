import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SearchInput = z.object({ query: z.string().min(1), limit: z.number().optional() });

export const searchTracks = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SearchInput.parse(input))
  .handler(async ({ data }) => {
    const { searchYouTube } = await import("./music.server");
    try {
      return { tracks: await searchYouTube(data.query, data.limit ?? 20), error: null };
    } catch {
      return { tracks: [], error: "Could not reach the music catalog. Try again." };
    }
  });

export const suggestSearch = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ query: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data }) => {
    const { suggestQueries } = await import("./music.server");
    try {
      return { suggestions: await suggestQueries(data.query) };
    } catch {
      return { suggestions: [] as string[] };
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
  .inputValidator((input: unknown) => RecommendInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { tracks: [], error: "AI is not configured yet." };

    const { generateText } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
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
      const gateway = createLovableAiGatewayProvider(key);
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
  .inputValidator((input: unknown) => MixInput.parse(input))
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

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { tracks: [], error: "AI is not configured yet." };

    const { generateText } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");

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
      const gateway = createLovableAiGatewayProvider(key);
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
