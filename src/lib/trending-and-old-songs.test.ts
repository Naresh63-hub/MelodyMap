import { describe, it, expect } from "vitest";
import { isLanguageConsistent } from "./library";

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
});
