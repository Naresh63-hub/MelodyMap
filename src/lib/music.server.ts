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

/** YouTube "Music" category filter — keeps results to songs, not vlogs/interviews. */
const MUSIC_FILTER = "EgWKAQIYAWoKEAoQAxAEEAkQBQ%253D%253D";
const VIDEO_FILTER = "EgIQAQ%253D%253D";

const NON_MUSIC = [
  "interview",
  "podcast",
  "reaction",
  "review",
  "vlog",
  "trailer",
  "teaser",
  "full movie",
  "episode",
  "behind the scenes",
  "making of",
  "tutorial",
  "gameplay",
  "news",
  "shorts",
  "speech",
  "documentary",
];

function durationSeconds(text: string): number {
  const parts = text.split(":").map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

function looksLikeMusic(title: string, seconds: number): boolean {
  const t = title.toLowerCase();
  if (NON_MUSIC.some((word) => t.includes(word))) return false;
  // Songs are usually 45s–15min; allow longer for jukeboxes/mixes only.
  if (seconds > 0 && seconds < 45) return false;
  return true;
}

/** Autocomplete suggestions straight from YouTube's suggest service. */
export async function suggestQueries(query: string): Promise<string[]> {
  const url = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&hl=en&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) return [];
  const body = await res.text();
  const json = body.slice(body.indexOf("(") + 1, body.lastIndexOf(")"));
  try {
    const parsed = JSON.parse(json) as [string, Array<[string, ...unknown[]]>];
    return (parsed[1] ?? []).map((entry) => entry[0]).filter(Boolean).slice(0, 8);
  } catch {
    return [];
  }
}

/** Scrapes YouTube search results — no API key required. */
export async function searchYouTube(
  query: string,
  limit = 20,
  musicOnly = true,
): Promise<Track[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=${musicOnly ? MUSIC_FILTER : VIDEO_FILTER}`;
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
    const title = text(r["title"]);
    if (musicOnly && !looksLikeMusic(title, durationSeconds(duration))) continue;
    const thumbs = ((r["thumbnail"] as AnyRecord | undefined)?.["thumbnails"] ?? []) as AnyRecord[];
    seen.add(id);

    tracks.push({
      id,
      title,
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
