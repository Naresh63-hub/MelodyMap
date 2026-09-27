import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getRelatedArtists, searchDeezer, REGIONAL_ARTIST_GRAPH } from "./deezer.server";

describe("deezer.server hermetic tests (mocked network)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns related artists from mocked Deezer API when available", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/search/artist")) {
        return new Response(JSON.stringify({ data: [{ id: 456, name: "The Weeknd" }] }), { status: 200 });
      }
      if (url.includes("/artist/456/related")) {
        return new Response(
          JSON.stringify({
            data: [{ name: "Post Malone" }, { name: "Bruno Mars" }, { name: "Dua Lipa" }],
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    });

    const related = await getRelatedArtists("The Weeknd", 3);
    expect(related).toEqual(["Post Malone", "Bruno Mars", "Dua Lipa"]);
  });

  it("seamlessly falls back to curated regional graph when Deezer API fails/offline", async () => {
    // Simulate network error / offline
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network offline"));

    const related = await getRelatedArtists("Sid Sriram", 3);
    expect(related.length).toBeGreaterThan(0);

    const expectedPool = REGIONAL_ARTIST_GRAPH["sid sriram"] ?? [];
    const hasOverlap = related.some((r) => expectedPool.includes(r));
    expect(hasOverlap).toBe(true);
  });

  it("returns regional fallback for Hindi artists when API is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("503 Service Unavailable"));

    const related = await getRelatedArtists("Arijit Singh", 3);
    expect(related.length).toBeGreaterThan(0);
    const expectedPool = REGIONAL_ARTIST_GRAPH["arijit singh"] ?? [];
    const hasOverlap = related.some((r) => expectedPool.includes(r));
    expect(hasOverlap).toBe(true);
  });

  it("handles unknown artists safely when offline without throwing exceptions", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("API Timeout"));

    const related = await getRelatedArtists("NonExistentArtistXyz123", 3);
    expect(Array.isArray(related)).toBe(true);
    expect(related).toHaveLength(0);
  });

  it("parses searchDeezer tracks into MelodyMap Track objects correctly", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 9999,
              title: "Mock Song",
              artist: { name: "Mock Artist" },
              album: { title: "Mock Album", cover_medium: "https://example.com/cover.jpg", cover_big: "" },
              preview: "https://cdns-preview.dzcdn.net/stream/mock.mp3",
              duration: 215,
            },
          ],
          total: 1,
        }),
        { status: 200 },
      ),
    );

    const results = await searchDeezer("Mock Song", 5);
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("deezer:9999");
    expect(results[0]?.title).toBe("Mock Song");
    expect(results[0]?.artist).toBe("Mock Artist");
    expect(results[0]?.previewUrl).toBe("https://cdns-preview.dzcdn.net/stream/mock.mp3");
    expect(results[0]?.duration).toBe("3:35");
  });
});
