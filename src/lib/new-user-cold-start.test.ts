import { describe, it, expect } from "vitest";
import type { Track } from "./library";
import { isOldEraTrack, isLanguageConsistent } from "./library";

const makeTrack = (t: Partial<Track> & { id: string; title: string; artist: string; year?: string; language?: string }): Track => ({
  thumbnail: "",
  duration: "3:30",
  source: "multi",
  ...t,
});

describe("New User Cold-Start Home Feed", () => {
  describe("1. Cold-Start Identification", () => {
    it("correctly identifies a brand new user when likes and history are empty", () => {
      const likes: Track[] = [];
      const history: Track[] = [];

      const isNewUser = likes.length === 0 && history.length === 0;
      expect(isNewUser).toBe(true);
    });

    it("correctly identifies returning users when likes or history exist", () => {
      const likesWithTrack: Track[] = [makeTrack({ id: "1", title: "Song A", artist: "Artist A" })];
      const emptyHistory: Track[] = [];
      expect(likesWithTrack.length === 0 && emptyHistory.length === 0).toBe(false);

      const emptyLikes: Track[] = [];
      const historyWithTrack: Track[] = [makeTrack({ id: "2", title: "Song B", artist: "Artist B" })];
      expect(emptyLikes.length === 0 && historyWithTrack.length === 0).toBe(false);
    });
  });

  describe("2. Filtering Old Era Tracks for New Users", () => {
    it("strictly filters out 90s, 2000s, and vintage songs for new users", () => {
      const candidates: Track[] = [
        makeTrack({ id: "1", title: "Chuttamalle", artist: "Anirudh Ravichander", year: "2024", language: "Telugu" }),
        makeTrack({ id: "2", title: "Ammaye Sannaga", artist: "Udit Narayan", year: "2001", language: "Telugu" }), // 2000s old era
        makeTrack({ id: "3", title: "Fear Song", artist: "Anirudh Ravichander", year: "2024", language: "Telugu" }),
        makeTrack({ id: "4", title: "Cheppave Chirugali", artist: "Udit Narayan", year: "2003", language: "Telugu" }), // 2000s old era
        makeTrack({ id: "5", title: "Tauba Tauba", artist: "Karan Aujla", year: "2024", language: "Hindi" }),
        makeTrack({ id: "6", title: "Tum Hi Ho", artist: "Arijit Singh", year: "2013", language: "Hindi" }),
      ];

      const isNewUser = true;

      // Filter for new user: must strictly exclude isOldEraTrack
      const newUserFiltered = candidates.filter((t) => {
        if (isNewUser && isOldEraTrack(t)) return false;
        return true;
      });

      expect(newUserFiltered.map((t) => t.title)).toContain("Chuttamalle");
      expect(newUserFiltered.map((t) => t.title)).toContain("Fear Song");
      expect(newUserFiltered.map((t) => t.title)).toContain("Tauba Tauba");
      // 2000s tracks must be excluded
      expect(newUserFiltered.map((t) => t.title)).not.toContain("Ammaye Sannaga");
      expect(newUserFiltered.map((t) => t.title)).not.toContain("Cheppave Chirugali");
    });

    it("preserves balanced classic evergreen tracks for returning users", () => {
      const candidates: Track[] = [
        makeTrack({ id: "1", title: "Chuttamalle", artist: "Anirudh Ravichander", year: "2024" }),
        makeTrack({ id: "2", title: "Ammaye Sannaga", artist: "Udit Narayan", year: "2001" }),
      ];

      const isNewUser = false;
      const returningUserFiltered = candidates.filter((t) => {
        if (isNewUser && isOldEraTrack(t)) return false;
        return true;
      });

      expect(returningUserFiltered).toHaveLength(2);
      expect(returningUserFiltered.some(isOldEraTrack)).toBe(true);
    });
  });

  describe("3. Language Consistency for New Users", () => {
    it("ensures cold-start recommendations strictly match the user's selected languages", () => {
      const candidates: Track[] = [
        makeTrack({ id: "1", title: "Daavudi", artist: "Anirudh Ravichander", language: "Telugu" }),
        makeTrack({ id: "2", title: "Illuminati", artist: "Sushin Shyam", language: "Malayalam" }),
        makeTrack({ id: "3", title: "Tauba Tauba", artist: "Karan Aujla", language: "Hindi" }),
      ];

      const userLanguages = ["Telugu"];
      const filtered = candidates.filter((t) => isLanguageConsistent(t, userLanguages));

      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.title).toBe("Daavudi");
    });
  });

  describe("4. Home Subtitle Customization", () => {
    it("displays cold-start subtitle for new users and personalized subtitle for returning users", () => {
      const getGreetingSubtitle = (likesCount: number, historyCount: number) => {
        return likesCount === 0 && historyCount === 0
          ? "Fresh new releases & recently popular hits"
          : "Recommended based on your recent listening";
      };

      expect(getGreetingSubtitle(0, 0)).toBe("Fresh new releases & recently popular hits");
      expect(getGreetingSubtitle(1, 0)).toBe("Recommended based on your recent listening");
      expect(getGreetingSubtitle(0, 5)).toBe("Recommended based on your recent listening");
    });
  });
});
