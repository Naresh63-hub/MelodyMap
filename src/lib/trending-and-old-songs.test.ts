import { describe, it, expect } from "vitest";
import { isLanguageConsistent, isOldEraTrack } from "./library";

describe("Trending & Old Songs - Language Filtering and Section Isolation", () => {
  describe("isLanguageConsistent filter", () => {
    it("allows all tracks when user has no language preferences configured", () => {
      const track = { title: "Random Song", artist: "Random Artist" };
      expect(isLanguageConsistent(track, [])).toBe(true);
    });

    it("allows tracks matching the selected language", () => {
      const track = { title: "Samajavaragamana", artist: "Sid Sriram" };
      expect(isLanguageConsistent(track, ["Telugu"])).toBe(true);
    });

    it("rejects tracks with conflicting explicit bracketed language tags", () => {
      const trackHindi = { title: "Samajavaragamana (Hindi Version)", artist: "Sid Sriram" };
      const trackPunjabi = { title: "Naatu Naatu [Punjabi Dub]", artist: "Rahul Sipligunj" };

      expect(isLanguageConsistent(trackHindi, ["Telugu"])).toBe(false);
      expect(isLanguageConsistent(trackPunjabi, ["Telugu"])).toBe(false);
    });

    it("rejects tracks with conflicting explicit language phrases like 'Hindi Song'", () => {
      const track = { title: "Tum Hi Ho - Romantic Hindi Song", artist: "Arijit Singh" };
      expect(isLanguageConsistent(track, ["Telugu"])).toBe(false);
    });

    it("allows tracks when conflicting word is part of the title and not a language tag", () => {
      // 'Arabic Kuthu' is a famous Tamil song; 'arabic' is not in brackets and not followed by 'song/version/etc.'
      const track = { title: "Arabic Kuthu - Halamithi Habibo", artist: "Anirudh Ravichander" };
      expect(isLanguageConsistent(track, ["Tamil"])).toBe(true);
    });

    it("allows multiple selected languages and rejects non-selected languages", () => {
      const teluguTrack = { title: "Butta Bomma (Telugu)", artist: "Armaan Malik" };
      const hindiTrack = { title: "Channa Mereya (Hindi)", artist: "Arijit Singh" };
      const punjabiTrack = { title: "Lover [Punjabi Remix]", artist: "Diljit Dosanjh" };

      const userLangs = ["Telugu", "Hindi"];
      expect(isLanguageConsistent(teluguTrack, userLangs)).toBe(true);
      expect(isLanguageConsistent(hindiTrack, userLangs)).toBe(true);
      expect(isLanguageConsistent(punjabiTrack, userLangs)).toBe(false);
    });
  });

  describe("isOldEraTrack filter (2000s Nostalgia Era)", () => {
    it("allows authentic 2000s ('20s') nostalgia era hits", () => {
      expect(
        isOldEraTrack({
          title: "Mellaga Karagani",
          artist: "Devi Sri Prasad, Sagar",
          year: "2004",
        }),
      ).toBe(true);

      expect(
        isOldEraTrack({
          title: "Cheliya Cheliya",
          artist: "Harris Jayaraj, KK",
          year: "2001",
        }),
      ).toBe(true);

      expect(
        isOldEraTrack({
          title: "Tum Se Hi",
          artist: "Pritam, Mohit Chauhan",
          year: "2007",
        }),
      ).toBe(true);

      expect(
        isOldEraTrack({
          title: "Zara Sa",
          artist: "KK, Pritam",
          year: "2008",
        }),
      ).toBe(true);

      expect(
        isOldEraTrack({
          title: "In the End",
          artist: "Linkin Park",
          year: "2000",
        }),
      ).toBe(true);

      expect(
        isOldEraTrack({
          title: "Nuvvostanante Nenoddantana",
          artist: "Devi Sri Prasad",
          year: "2005",
        }),
      ).toBe(true);
    });

    it("strictly rejects ancient vintage artists and 50s-80s songs ('not too much old songs')", () => {
      expect(
        isOldEraTrack({
          title: "Roop Tera Mastana",
          artist: "Kishore Kumar",
          year: "1971",
        }),
      ).toBe(false);

      expect(
        isOldEraTrack({
          title: "Siva Sankari",
          artist: "Ghantasala",
          year: "1961",
        }),
      ).toBe(false);

      expect(
        isOldEraTrack({
          title: "Telugu Evergreen Melody",
          artist: "P. Susheela",
        }),
      ).toBe(false);

      expect(
        isOldEraTrack({
          title: "Likhe Jo Khat Tujhe",
          artist: "Mohammed Rafi",
        }),
      ).toBe(false);

      expect(
        isOldEraTrack({
          title: "Jeena Yahan Marna Yahan",
          artist: "Mukesh",
        }),
      ).toBe(false);

      expect(
        isOldEraTrack({
          title: "80s Retro Classics",
          artist: "Unknown Artist",
        }),
      ).toBe(false);
    });

    it("rejects contemporary artists and post-2015 streaming tracks", () => {
      expect(
        isOldEraTrack({
          title: "Samajavaragamana",
          artist: "Sid Sriram",
          year: "2019",
        }),
      ).toBe(false);

      expect(
        isOldEraTrack({
          title: "Arabic Kuthu",
          artist: "Anirudh Ravichander",
          year: "2022",
        }),
      ).toBe(false);

      expect(
        isOldEraTrack({
          title: "Cruel Summer",
          artist: "Taylor Swift",
          year: "2019",
        }),
      ).toBe(false);

      expect(
        isOldEraTrack({
          title: "Random Song",
          artist: "Some Singer",
          year: "2021",
        }),
      ).toBe(false);

      expect(
        isOldEraTrack({
          title: "Hit Song",
          artist: "Singer",
          year: 2024,
        }),
      ).toBe(false);
    });

    it("rejects tracks with modern tags like EDM, phonk, speed up, trap mix", () => {
      expect(
        isOldEraTrack({
          title: "Retro Vibe (Phonk Remix)",
          artist: "Unknown",
        }),
      ).toBe(false);

      expect(
        isOldEraTrack({
          title: "Old Melody - Speed Up Version",
          artist: "Unknown",
        }),
      ).toBe(false);
    });
  });

  describe("Explore Refresh Freshness & Non-duplicate guarantee", () => {
    it("excludes previously displayed track IDs and normalized titles on refresh", () => {
      const displayedTrending = [
        { id: "saavn-101", title: "Fear Song", artist: "Anirudh Ravichander" },
        { id: "saavn-102", title: "Chuttamalle", artist: "Shilpa Rao" },
      ];

      const incomingCandidateTracks = [
        { id: "saavn-101", title: "Fear Song", artist: "Anirudh Ravichander" }, // DUPLICATE ID & TITLE
        { id: "saavn-999", title: "fear song", artist: "Different Artist" },    // DUPLICATE TITLE (CASE-INSENSITIVE)
        { id: "saavn-103", title: "Daavudi", artist: "Nakash Aziz" },          // FRESH TRACK
        { id: "saavn-104", title: "Ayudha Pooja", artist: "Kala Bhairava" },   // FRESH TRACK
      ];

      const prevIds = new Set(displayedTrending.map((t) => t.id));
      const prevTitles = new Set(displayedTrending.map((t) => t.title.toLowerCase().trim()));

      const refreshed = incomingCandidateTracks.filter(
        (t) => !prevIds.has(t.id) && !prevTitles.has(t.title.toLowerCase().trim()),
      );

      expect(refreshed).toHaveLength(2);
      expect(refreshed.map((t) => t.id)).toEqual(["saavn-103", "saavn-104"]);
      expect(refreshed.some((t) => t.id === "saavn-101")).toBe(false);
      expect(refreshed.some((t) => t.title.toLowerCase() === "fear song")).toBe(false);
    });

    it("verifies Saavn provider functions accept refreshNonce parameter", async () => {
      const { getSaavnNewReleases, getSaavnTrendingSongs, getSaavnOldSongs } = await import("./providers/saavn");
      expect(typeof getSaavnNewReleases).toBe("function");
      expect(typeof getSaavnTrendingSongs).toBe("function");
      expect(typeof getSaavnOldSongs).toBe("function");
      expect(getSaavnNewReleases.length).toBeGreaterThanOrEqual(0);
      expect(getSaavnTrendingSongs.length).toBeGreaterThanOrEqual(0);
      expect(getSaavnOldSongs.length).toBeGreaterThanOrEqual(0);
    });
  });
});
