/**
 * Fetches YouTube's built-in song radio for a video ("RD" playlist —
 * the same engine behind "Start radio from a song" / the Up Next panel).
 * The similarity — same artist, same genre, same mood/feel — is decided
 * by YouTube's own recommendation algorithm, so no AI is needed.
 */

import type { Track } from "./music.server";

type UnknownRecord = Record<string, unknown>;

const WEB_CLIENT = { clientName: "WEB", clientVersion: "2.20240801.00.00" };

function rendererText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const obj = node as UnknownRecord;
  if (typeof obj["simpleText"] === "string") return obj["simpleText"] as string;
  const runs = obj["runs"];
  if (Array.isArray(runs)) {
    return runs.map((r) => (r as UnknownRecord)["text"] ?? "").join("");
  }
  return "";
}

export async function getRadioTracks(
  videoId: string,
  limit = 25,
  continuation?: string,
): Promise<{ tracks: Track[]; continuation?: string }> {
  let res: Response;
  const bodyPayload: Record<string, unknown> = {
    context: { client: WEB_CLIENT },
  };
  if (continuation) {
    bodyPayload["continuation"] = continuation;
  } else {
    bodyPayload["videoId"] = videoId;
    bodyPayload["playlistId"] = `RD${videoId}`;
  }

  try {
    res = await fetch("https://www.youtube.com/youtubei/v1/next?prettyPrint=false", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { tracks: [] };
  }
  if (!res.ok) return { tracks: [] };

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { tracks: [] };
  }

  const contents = (data as UnknownRecord)?.["contents"] as UnknownRecord | undefined;
  const twoColumn = contents?.["twoColumnWatchNextResults"] as UnknownRecord | undefined;
  const playlist = twoColumn?.["playlist"] as UnknownRecord | undefined;
  const panel = (playlist?.["playlist"] as UnknownRecord | undefined)?.["contents"] as
    | unknown[]
    | undefined;
  const single = (contents?.["singleColumnWatchNextResults"] as UnknownRecord | undefined)?.[
    "results"
  ] as UnknownRecord | undefined;
  const singlePanel = (single?.["results"] as UnknownRecord | undefined)?.["contents"] as
    | unknown[]
    | undefined;
  const items = panel ?? singlePanel ?? [];

  const out: Track[] = [];
  const seen = new Set<string>([videoId]);
  let nextContinuation: string | undefined;

  for (const entry of items) {
    const entryObj = entry as UnknownRecord;
    // Check for continuation token
    const contRenderer = entryObj?.["continuationItemRenderer"] as UnknownRecord | undefined;
    if (contRenderer) {
      const command = (contRenderer["continuationEndpoint"] as UnknownRecord | undefined)?.[
        "continuationCommand"
      ] as UnknownRecord | undefined;
      if (typeof command?.["token"] === "string") {
        nextContinuation = command["token"];
      }
      continue;
    }

    const r = (entryObj?.["playlistPanelVideoRenderer"] ??
      entryObj?.["compactVideoRenderer"]) as UnknownRecord | undefined;
    if (!r) continue;
    const id = r["videoId"];
    if (typeof id !== "string" || seen.has(id)) continue;
    const duration = rendererText(r["lengthText"]);
    if (!duration) continue; // skip live streams / shorts
    const thumbs = (r["thumbnail"] as UnknownRecord | undefined)?.["thumbnails"] as
      | UnknownRecord[]
      | undefined;
    seen.add(id);
    out.push({
      id,
      title: rendererText(r["title"]),
      artist: rendererText(r["longBylineText"]) || "Unknown artist",
      duration,
      thumbnail:
        (thumbs?.[thumbs.length - 1]?.["url"] as string | undefined) ??
        `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    });
    if (out.length >= limit) break;
  }
  return nextContinuation !== undefined
    ? { tracks: out, continuation: nextContinuation }
    : { tracks: out };
}
