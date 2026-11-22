import { describe, expect, it } from "vitest";

import { inferLanguageFromArtists, getTrackLanguage, LANGUAGE_ARTISTS } from "./language-artists";

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

describe("getTrackLanguage", () => {
  it("returns undefined for null or undefined tracks or tracks without signals", () => {
    expect(getTrackLanguage(null)).toBeUndefined();
    expect(getTrackLanguage(undefined)).toBeUndefined();
    expect(getTrackLanguage({ title: "Random Acoustic Beat", artist: "Unknown Indie Musician" })).toBeUndefined();
  });

  it("detects language from explicit languageCode or language field (ISO and full names)", () => {
    expect(getTrackLanguage({ title: "Song", artist: "Artist", languageCode: "te" })).toBe("Telugu");
    expect(getTrackLanguage({ title: "Song", artist: "Artist", languageCode: "hi" })).toBe("Hindi");
    expect(getTrackLanguage({ title: "Song", artist: "Artist", languageCode: "ta" })).toBe("Tamil");
    expect(getTrackLanguage({ title: "Song", artist: "Artist", languageCode: "en" })).toBe("English");
    expect(getTrackLanguage({ title: "Song", artist: "Artist", languageCode: "pa" })).toBe("Punjabi");
    expect(getTrackLanguage({ title: "Song", artist: "Artist", languageCode: "telugu" })).toBe("Telugu");
    expect(getTrackLanguage({ title: "Song", artist: "Artist", language: "malayalam" })).toBe("Malayalam");
  });

  it("ignores und and zxx language codes and falls back to other signals", () => {
    expect(getTrackLanguage({ title: "Song", artist: "Anurag Kulkarni", languageCode: "und" })).toBe("Telugu");
    expect(getTrackLanguage({ title: "Song", artist: "Artist", languageCode: "und" })).toBeUndefined();
  });

  it("detects language from bracketed tags in title or album", () => {
    expect(getTrackLanguage({ title: "Samajavaragamana (Telugu)", artist: "Artist" })).toBe("Telugu");
    expect(getTrackLanguage({ title: "Kesariya [Hindi]", artist: "Artist" })).toBe("Hindi");
    expect(getTrackLanguage({ title: "Master [Tamil]", artist: "Artist" })).toBe("Tamil");
    expect(getTrackLanguage({ title: "Arabic Kuthu", album: "Beast (Tamil Version)", artist: "Artist" })).toBe("Tamil");
  });

  it("detects language from delimited tags and phrases", () => {
    expect(getTrackLanguage({ title: "Top Hit | Hindi | 2026", artist: "Artist" })).toBe("Hindi");
    expect(getTrackLanguage({ title: "Song - Punjabi - Hits", artist: "Artist" })).toBe("Punjabi");
    expect(getTrackLanguage({ title: "Romantic Song in Malayalam", artist: "Artist" })).toBe("Malayalam");
    expect(getTrackLanguage({ title: "Telugu Lyrical Video", artist: "Artist" })).toBe("Telugu");
  });

  it("detects language from industry keywords", () => {
    expect(getTrackLanguage({ title: "Tollywood Melodies 2026", artist: "Artist" })).toBe("Telugu");
    expect(getTrackLanguage({ title: "Bollywood Dhamaka", artist: "Artist" })).toBe("Hindi");
    expect(getTrackLanguage({ title: "Kollywood BGM Hits", artist: "Artist" })).toBe("Tamil");
  });

  it("detects language from Unicode scripts", () => {
    expect(getTrackLanguage({ title: "సామజవరగమన", artist: "Artist" })).toBe("Telugu");
    expect(getTrackLanguage({ title: "காதலின் தீபம்", artist: "Artist" })).toBe("Tamil");
    expect(getTrackLanguage({ title: "കാറ്റേ നീ വീശരുതിപ്പോൾ", artist: "Artist" })).toBe("Malayalam");
    expect(getTrackLanguage({ title: "ಕನ್ನಡ ಹಾಡುಗಳು", artist: "Artist" })).toBe("Kannada");
    expect(getTrackLanguage({ title: "ਗੁਰਮੁਖੀ ਗੀਤ", artist: "Artist" })).toBe("Punjabi");
    expect(getTrackLanguage({ title: "বাংলা গান", artist: "Artist" })).toBe("Bengali");
    expect(getTrackLanguage({ title: "노래", artist: "Artist" })).toBe("Korean");
    expect(getTrackLanguage({ title: "أغنية", artist: "Artist" })).toBe("Arabic");
    expect(getTrackLanguage({ title: "アイドル", artist: "Artist" })).toBe("Japanese");
    expect(getTrackLanguage({ title: "तुम ही हो", artist: "Artist" })).toBe("Hindi");
  });

  it("detects language from unambiguous artist inference", () => {
    expect(getTrackLanguage({ title: "Title Without Signals", artist: "Anurag Kulkarni" })).toBe("Telugu");
    expect(getTrackLanguage({ title: "Title Without Signals", artist: "Sushin Shyam" })).toBe("Malayalam");
    expect(getTrackLanguage({ title: "Title Without Signals", artist: "Karan Aujla" })).toBe("Punjabi");
    expect(getTrackLanguage({ title: "Title Without Signals", artist: "Yoasobi" })).toBe("Japanese");
  });
});
