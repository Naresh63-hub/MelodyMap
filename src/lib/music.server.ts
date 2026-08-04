export type Track = {
  id: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string;
};

type AnyRecord = Record<string, unknown>;

function collectVideoRenderers(node: unknown, out: AnyRecord[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectVideoRenderers(item, out);
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as AnyRecord;
    if (obj["videoRenderer"]) out.push(obj["videoRenderer"] as AnyRecord);
    for (const value of Object.values(obj)) collectVideoRenderers(value, out);
  }
}

function text(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const obj = node as AnyRecord;
  if (typeof obj["simpleText"] === "string") return obj["simpleText"] as string;
  const runs = obj["runs"];
  if (Array.isArray(runs)) {
    return runs.map((r) => (r as AnyRecord)["text"] ?? "").join("");
  }
  return "";
}

/** Scrapes YouTube search results — no API key required. */
export async function searchYouTube(query: string, limit = 20): Promise<Track[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const html = await res.text();
  const match = html.match(/ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
  if (!match?.[1]) return [];

  let data: unknown;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return [];
  }

  const renderers: AnyRecord[] = [];
  collectVideoRenderers(data, renderers);

  const seen = new Set<string>();
  const tracks: Track[] = [];
  for (const r of renderers) {
    const id = r["videoId"];
    if (typeof id !== "string" || seen.has(id)) continue;
    const duration = text(r["lengthText"]);
    if (!duration) continue; // skip live streams / shorts
    const thumbs = ((r["thumbnail"] as AnyRecord | undefined)?.["thumbnails"] ?? []) as AnyRecord[];
    seen.add(id);
    tracks.push({
      id,
      title: text(r["title"]),
      artist: text(r["ownerText"]) || text(r["longBylineText"]) || "Unknown artist",
      duration,
      thumbnail:
        (thumbs[thumbs.length - 1]?.["url"] as string | undefined) ??
        `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    });
    if (tracks.length >= limit) break;
  }
  return tracks;
}
