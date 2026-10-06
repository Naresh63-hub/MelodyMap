import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveWithInnerTubePlayer } from "./stream.server";

/**
 * Regression tests for the full-length-only stream fallback chain.
 *
 * The last-resort fallback previously served a 30-second Deezer catalog
 * preview, so songs that YouTube blocked and Audius could not match cut off
 * at 0:30. The chain now resolves a full-length Jamendo stream instead and
 * returns null (per-track backoff → auto-skip) when nothing full-length
 * exists — a 30-second preview must never be served again.
 */

const OE_TITLE = "Garuda Gamana Tava | Sri Mallikarjuna - Full Song";
const OE_AUTHOR = "MS Music - Topic";
const JAMENDO_MP3 = "https://mp3d.jamendo.com/download/track/99/mp32";
const DEEZER_PREVIEW = "https://cdns-preview-d.dzcdn.net/stream/30s.mp3";

const calls: string[] = [];

function jsonRes(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

const JAMENDO_MATCH = {
  id: 99,
  name: "Garuda Gamana Tava",
  duration: 284,
  artist_name: "MS Music",
  audio: JAMENDO_MP3,
};

function installFetchMock(opts: {
  jamendoResults?: unknown[];
  probeStatus?: number;
  deezerResults?: unknown[];
}) {
  const fetchMock = vi.fn(async (input: unknown) => {
    const url =
      typeof input === "string" ? input : String((input as { url?: string })?.url ?? input);
    calls.push(url);

    if (url.includes("youtubei/v1/player")) return jsonRes({}, 404);
    if (url.includes("youtube.com/oembed")) {
      return jsonRes({ title: OE_TITLE, author_name: OE_AUTHOR });
    }
    if (url.includes("audius.co")) return jsonRes({ data: [] });
    if (url.includes("api.jamendo.com")) {
      return jsonRes({
        headers: { status: "success", code: 0, results_count: opts.jamendoResults?.length ?? 0 },
        results: opts.jamendoResults ?? [],
      });
    }
    if (url.includes("api.deezer.com")) return jsonRes({ data: opts.deezerResults ?? [] });

    // Media byte-range probes (Jamendo MP3s, etc.)
    const status = opts.probeStatus ?? 206;
    return {
      ok: status >= 200 && status < 300,
      status,
      arrayBuffer: async () => new ArrayBuffer(8),
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("resolveWithInnerTubePlayer (full-length-only fallback chain)", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("resolves a full-length Jamendo stream when YouTube and Audius fail", async () => {
    installFetchMock({ jamendoResults: [JAMENDO_MATCH] });

    const meta = await resolveWithInnerTubePlayer("dQw4w9WgXcQ");

    expect(meta).not.toBeNull();
    expect(meta!.source).toBe("jamendo");
    expect(meta!.url).toBe(JAMENDO_MP3);
    expect(meta!.mimeType).toBe("audio/mpeg");
  });

  it("never serves the 30-second Deezer preview, even when Deezer answers", async () => {
    installFetchMock({
      jamendoResults: [],
      deezerResults: [
        {
          id: 123,
          title: "Garuda Gamana Tava",
          duration: 200,
          artist: { name: "MS Music" },
          preview: DEEZER_PREVIEW,
        },
      ],
    });

    const meta = await resolveWithInnerTubePlayer("dQw4w9WgXcQ");

    // No full-length source → nothing is served (per-track backoff → skip);
    // the old code would have returned the 30-second dzcdn preview here.
    expect(meta).toBeNull();
    expect(calls.some((u) => u.includes("api.deezer.com"))).toBe(false);
    expect(calls.some((u) => u.includes("dzcdn.net"))).toBe(false);
  });

  it("falls through when the Jamendo match fails its byte probe", async () => {
    installFetchMock({ jamendoResults: [JAMENDO_MATCH], probeStatus: 500 });

    const meta = await resolveWithInnerTubePlayer("dQw4w9WgXcQ");

    expect(meta).toBeNull();
  });
});
