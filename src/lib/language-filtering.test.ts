import { describe, expect, it } from "vitest";
import { isLanguageConsistent } from "./library";

describe("Language Filtering & Consistency (isLanguageConsistent)", () => {
  it("allows all tracks when no language is selected", () => {
    expect(
      isLanguageConsistent(
        { title: "Tum Hi Ho (Hindi)", artist: "Arijit Singh" },
        [],
      ),
    ).toBe(true);
  });

  it("permits tracks matching the selected language", () => {
    expect(
      isLanguageConsistent(
        { title: "Samajavaragamana - Telugu", artist: "Sid Sriram" },
        ["Telugu"],
      ),
    ).toBe(true);

    expect(
      isLanguageConsistent(
        { title: "Kesariya (From Brahmastra)", artist: "Arijit Singh" },
        ["Hindi"],
      ),
    ).toBe(true);
  });

  it("strictly rejects conflicting language in bracket tags", () => {
    // User selected Telugu, track has "(Hindi)" or "[Tamil]"
    expect(
      isLanguageConsistent(
        { title: "Chuttamalle (Hindi Version)", artist: "Anirudh Ravichander" },
        ["Telugu"],
      ),
    ).toBe(false);

    expect(
      isLanguageConsistent(
        { title: "Fear Song [Tamil]", artist: "Anirudh Ravichander" },
        ["Telugu"],
      ),
    ).toBe(false);
  });

  it("strictly rejects conflicting language in delimiter tags", () => {
    expect(
      isLanguageConsistent(
        { title: "Top Hit Song | Hindi | Lyrical", artist: "Arijit Singh" },
        ["Telugu"],
      ),
    ).toBe(false);

    expect(
      isLanguageConsistent(
        { title: "Super Melody - Tamil - 2026", artist: "Yuvan Shankar Raja" },
        ["Telugu"],
      ),
    ).toBe(false);
  });

  it("strictly rejects conflicting language phrases (e.g. 'Hindi Song', 'in Tamil')", () => {
    expect(
      isLanguageConsistent(
        { title: "Best Hindi Song 2026", artist: "Arijit Singh" },
        ["Telugu"],
      ),
    ).toBe(false);

    expect(
      isLanguageConsistent(
        { title: "Romantic Song in Tamil", artist: "Sid Sriram" },
        ["Telugu"],
      ),
    ).toBe(false);
  });

  it("strictly rejects conflicting cinema industries (e.g. Bollywood / Kollywood when Telugu is selected)", () => {
    expect(
      isLanguageConsistent(
        { title: "Latest Bollywood Hits 2026", artist: "Various Artists" },
        ["Telugu"],
      ),
    ).toBe(false);

    expect(
      isLanguageConsistent(
        { title: "Kollywood Chartbuster", artist: "Anirudh" },
        ["Telugu"],
      ),
    ).toBe(false);

    // But allows Tollywood when Telugu is selected
    expect(
      isLanguageConsistent(
        { title: "Tollywood Mass Anthem", artist: "Thaman S" },
        ["Telugu"],
      ),
    ).toBe(true);
  });

  it("detects and rejects conflicting Unicode scripts (Devanagari, Tamil, Malayalam)", () => {
    // User selected Telugu, but title contains Devanagari script (Hindi/Marathi)
    expect(
      isLanguageConsistent(
        { title: "तुम ही हो", artist: "Arijit Singh" },
        ["Telugu"],
      ),
    ).toBe(false);

    // User selected Telugu, but title contains Tamil script
    expect(
      isLanguageConsistent(
        { title: "காவாலா", artist: "Anirudh" },
        ["Telugu"],
      ),
    ).toBe(false);

    // User selected Telugu and title has Telugu script
    expect(
      isLanguageConsistent(
        { title: "సమాజవరగమన", artist: "Sid Sriram" },
        ["Telugu"],
      ),
    ).toBe(true);
  });

  it("allows multiple selected languages and accepts tracks from any of them", () => {
    // User selected Telugu AND Hindi
    expect(
      isLanguageConsistent(
        { title: "Samajavaragamana", artist: "Sid Sriram" },
        ["Telugu", "Hindi"],
      ),
    ).toBe(true);

    expect(
      isLanguageConsistent(
        { title: "Kesariya (Hindi)", artist: "Arijit Singh" },
        ["Telugu", "Hindi"],
      ),
    ).toBe(true);

    // Tamil is still rejected
    expect(
      isLanguageConsistent(
        { title: "Kaavaalaa (Tamil Version)", artist: "Anirudh" },
        ["Telugu", "Hindi"],
      ),
    ).toBe(false);
  });

  it("respects explicit languageCode when present", () => {
    expect(
      isLanguageConsistent(
        { title: "Generic Song Title", artist: "Artist", languageCode: "hi" },
        ["Telugu"],
      ),
    ).toBe(false);

    expect(
      isLanguageConsistent(
        { title: "Generic Song Title", artist: "Artist", languageCode: "te" },
        ["Telugu"],
      ),
    ).toBe(true);
  });
});
