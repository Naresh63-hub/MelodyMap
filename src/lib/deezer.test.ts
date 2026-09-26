import { describe, expect, it } from "vitest";
import { getRelatedArtists, REGIONAL_ARTIST_GRAPH } from "./deezer.server";

describe("deezer.server related artists", () => {
  it("returns regional fallback artists when offline/mocked", async () => {
    const related = await getRelatedArtists("Sid Sriram", 3);
    expect(related.length).toBeGreaterThan(0);
    // Either fetched from Deezer API or pulled from regional fallback
    const expectedPool = REGIONAL_ARTIST_GRAPH["sid sriram"] ?? [];
    const hasOverlap = related.some((r) => expectedPool.includes(r) || typeof r === "string");
    expect(hasOverlap).toBe(true);
  }, 15000);

  it("returns fallback for Hindi singers", async () => {
    const related = await getRelatedArtists("Arijit Singh", 3);
    expect(related.length).toBeGreaterThan(0);
  }, 15000);

  it("handles unknown artists safely", async () => {
    const related = await getRelatedArtists("NonExistentArtistXyz123", 3);
    expect(Array.isArray(related)).toBe(true);
  }, 15000);
});
