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

  describe("isOldEraTrack filter", () => {
    it("allows authentic golden era classics", () => {
      expect(
        isOldEraTrack({
          title: "Keeravani",
          artist: "S.P. Balasubrahmanyam, S. Janaki",
          year: "1985",
        }),
      ).toBe(true);

      expect(
        isOldEraTrack({
          title: "Roop Tera Mastana",
          artist: "Kishore Kumar",
          year: "1971",
        }),
      ).toBe(true);

      expect(
        isOldEraTrack({
          title: "Bohemian Rhapsody",
          artist: "Queen",
          year: "1975",
        }),
      ).toBe(true);

      expect(
        isOldEraTrack({
          title: "Ilaiyaraaja 80s Evergreens (2024 Remastered)",
          artist: "Ilaiyaraaja",
        }),
      ).toBe(true);
    });

    it("rejects contemporary artists from modern streaming era", () => {
      expect(
        isOldEraTrack({
          title: "Samajavaragamana",
          artist: "Sid Sriram",
        }),
      ).toBe(false);

      expect(
        isOldEraTrack({
          title: "Tum Hi Ho",
          artist: "Arijit Singh",
          year: "2013",
        }),
      ).toBe(false);

      expect(
        isOldEraTrack({
          title: "Arabic Kuthu",
          artist: "Anirudh Ravichander",
        }),
      ).toBe(false);

      expect(
        isOldEraTrack({
          title: "Cruel Summer",
          artist: "Taylor Swift",
        }),
      ).toBe(false);
    });

    it("rejects tracks with modern post-2005 release years", () => {
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
          year: 2018,
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
});
