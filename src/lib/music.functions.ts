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

const RecommendInput = z.object({
  liked: z.array(z.string()).max(40),
  recent: z.array(z.string()).max(40),
  mood: z.string().max(120).optional(),
  brief: z.string().max(800).optional(),
});

export const recommendTracks = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RecommendInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { tracks: [], error: "AI is not configured yet." };

    const { generateText } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const { searchYouTube } = await import("./music.server");

    const hasTaste = data.liked.length > 0 || data.recent.length > 0;
    const prompt = [
      hasTaste
        ? `Songs this listener loved:\n${data.liked.slice(0, 20).join("\n") || "(none yet)"}\n\nRecently played:\n${data.recent.slice(0, 20).join("\n") || "(none yet)"}`
        : "The listener is brand new. Suggest widely loved, high-quality songs across a few popular genres.",
      data.mood ? `They asked for: ${data.mood}` : "",
      data.brief ? `Tuning preferences: ${data.brief}` : "",
      "",
      "Recommend 12 songs they would likely love next. Respect the tuning preferences above. Do not repeat songs already listed.",
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
      if (message.includes("402")) return { tracks: [], error: "AI credits are exhausted." };
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

    const valid = picks.filter((p) => p.title && p.artist).slice(0, 12);
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
