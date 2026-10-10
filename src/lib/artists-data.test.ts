import { describe, it, expect } from "vitest";
import { getTopArtistsForLanguages, TOP_JIOSAAVN_ARTISTS } from "./artists-data";

describe("JioSaavn Artists Data", () => {
  it("contains curated artists with valid 500x500 CDN URLs", () => {
    expect(TOP_JIOSAAVN_ARTISTS.length).toBeGreaterThan(15);
    for (const artist of TOP_JIOSAAVN_ARTISTS) {
      expect(artist.id).toBeTruthy();
      expect(artist.name).toBeTruthy();
      expect(artist.image).toContain("500x500");
      expect(artist.image).toMatch(/^https:\/\/c\.saavncdn\.com\/artists\//);
      expect(artist.languages.length).toBeGreaterThan(0);
    }
  });

  it("prioritizes Telugu artists when user selected Telugu", () => {
    const artists = getTopArtistsForLanguages(["Telugu"]);
    expect(artists.length).toBeGreaterThan(0);
    const topNames = artists.slice(0, 5).map((a) => a.name);
    // Anirudh, Thaman S, Devi Sri Prasad, Sid Sriram, SPB should be in the top
    expect(topNames).toContain("Anirudh Ravichander");
    expect(topNames).toContain("Thaman S");
  });

  it("prioritizes Hindi artists when user selected Hindi", () => {
    const artists = getTopArtistsForLanguages(["Hindi"]);
    const topNames = artists.slice(0, 5).map((a) => a.name);
    expect(topNames).toContain("Arijit Singh");
    expect(topNames).toContain("Shreya Ghoshal");
  });

  it("falls back to top popular artists when no language is selected", () => {
    const artists = getTopArtistsForLanguages([]);
    expect(artists.length).toBe(16);
  });
});
