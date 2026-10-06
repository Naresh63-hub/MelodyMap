import { describe, expect, it } from "vitest";

import { inferLanguageFromArtists, LANGUAGE_ARTISTS } from "./language-artists";

/**
 * Artist-based language inference backs the feed language filter
 * (isLanguageConsistent in library.ts). Romanized titles carry no script and
 * no language tag, so the artist map is the only reliable signal.
 */
describe("inferLanguageFromArtists", () => {
  it("detects a language from an unambiguous artist", () => {
    expect(inferLanguageFromArtists("Anurag Kulkarni")).toBe("Telugu");
    expect(inferLanguageFromArtists("Devi Sri Prasad")).toBe("Telugu");
    expect(inferLanguageFromArtists("Yuvan Shankar Raja")).toBe("Tamil");
    expect(inferLanguageFromArtists("Harris Jayaraj")).toBe("Tamil");
    expect(inferLanguageFromArtists("Karan Aujla")).toBe("Punjabi");
    expect(inferLanguageFromArtists("Sushin Shyam")).toBe("Malayalam");
    expect(inferLanguageFromArtists("Anupam Roy")).toBe("Bengali");
    expect(inferLanguageFromArtists("Pawan Singh")).toBe("Bhojpuri");
    expect(inferLanguageFromArtists("Kenshi Yonezu")).toBe("Japanese");
  });

  it("returns null for multi-industry artists listed under several languages", () => {
    // Anirudh composes for both Telugu and Tamil; "Karthik" sings in both.
    // No single verdict — the filter must not reject their songs on a guess.
    expect(inferLanguageFromArtists("Anirudh Ravichander")).toBeNull();
    expect(inferLanguageFromArtists("Karthik")).toBeNull();
  });

  it("matches artists inside multi-artist credit strings", () => {
    expect(inferLanguageFromArtists("D. Imman, Sean Roldan")).toBe("Tamil");
  });

  it("returns null when credited artists disagree on language", () => {
    expect(inferLanguageFromArtists("Anurag Kulkarni, Anupam Roy")).toBeNull();
  });

  it("is case-insensitive and whitespace-tolerant", () => {
    expect(inferLanguageFromArtists("  anurag kulkarni ")).toBe("Telugu");
  });

  it("returns null for unknown artists", () => {
    expect(inferLanguageFromArtists("Unknown Indie Band")).toBeNull();
    expect(inferLanguageFromArtists("")).toBeNull();
    expect(inferLanguageFromArtists(null)).toBeNull();
    expect(inferLanguageFromArtists(undefined)).toBeNull();
  });

  it("returns null for prolific multi-language singers (no wrong verdict)", () => {
    // Shreya Ghoshal sings across Telugu, Hindi, Tamil, Kannada, Malayalam,
    // Bengali — the helper must NOT claim a single language.
    expect(inferLanguageFromArtists("Shreya Ghoshal")).toBeNull();
    expect(inferLanguageFromArtists("Arijit Singh")).toBeNull();
    expect(inferLanguageFromArtists("SP Balasubrahmanyam")).toBeNull();
  });

  it("extends the picker with the missing languages", () => {
    for (const lang of ["Bengali", "Marathi", "Gujarati", "Bhojpuri", "Urdu", "Japanese"]) {
      expect(LANGUAGE_ARTISTS[lang]?.length).toBeGreaterThan(0);
    }
  });
});
