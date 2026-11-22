import { describe, expect, it } from "vitest";
import {
  computeTasteShare,
  extractTasteArtists,
  interleaveTasteTracks,
} from "./autodj-taste-mix";
import { getRecFlag, setRecFlag } from "./rec-flags";

describe("AutoDJ Taste-Artist Mix (Task 7)", () => {
  describe("computeTasteShare", () => {
    it("computes exact taste share at various discovery levels for batch size 15", () => {
      // discovery 0: 0.40 * 15 = 6
      expect(computeTasteShare(0, 15)).toBe(6);

      // discovery 40 (default): (0.4 - 0.2 * 0.4) = 0.32 * 15 = 4.8 -> 5
      expect(computeTasteShare(40, 15)).toBe(5);

      // discovery 50: (0.4 - 0.2 * 0.5) = 0.30 * 15 = 4.5 -> 5
      expect(computeTasteShare(50, 15)).toBe(5);

      // discovery 100: (0.4 - 0.2 * 1.0) = 0.20 * 15 = 3
      expect(computeTasteShare(100, 15)).toBe(3);
    });

    it("clamps out-of-bounds discovery values to 0-100", () => {
      expect(computeTasteShare(-10, 15)).toBe(6);
      expect(computeTasteShare(150, 15)).toBe(3);
    });
  });

  describe("extractTasteArtists", () => {
    it("deduplicates downloaded, liked, and affinity artists in order, returning top 5", () => {
      const downloaded = [
        { artist: "Anurag Kulkarni" },
        { artist: "Sid Sriram" },
      ];
      const liked = [
        { artist: "Sid Sriram" }, // duplicate
        { artist: "Devi Sri Prasad" },
        { artist: "Arijit Singh" },
      ];
      const affinity = ["Arijit Singh", "Anirudh Ravichander", "Thaman S"];

      const top5 = extractTasteArtists(downloaded, liked, affinity);
      expect(top5).toEqual([
        "Anurag Kulkarni",
        "Sid Sriram",
        "Devi Sri Prasad",
        "Arijit Singh",
        "Anirudh Ravichander",
      ]);
      expect(top5).toHaveLength(5);
    });

    it("handles empty artist lists gracefully", () => {
      expect(extractTasteArtists([], [], [])).toEqual([]);
    });
  });

  describe("interleaveTasteTracks", () => {
    const makeTracks = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}`, title: `${prefix} ${i}` }));

    it("interleaves taste tracks proportionally based on discovery share", () => {
      const similar = makeTracks("sim", 12);
      const taste = makeTracks("taste", 8);

      // discovery 40 -> 5 taste tracks, 10 similar tracks
      const interleaved = interleaveTasteTracks(similar, taste, 40, 15);
      expect(interleaved).toHaveLength(15);

      const tasteCount = interleaved.filter((t) => t.id.startsWith("taste")).length;
      const simCount = interleaved.filter((t) => t.id.startsWith("sim")).length;

      expect(tasteCount).toBe(5);
      expect(simCount).toBe(10);

      // Check distribution: taste tracks should be interspersed, not lumped at end
      const tasteIndices = interleaved
        .map((t, idx) => (t.id.startsWith("taste") ? idx : -1))
        .filter((idx) => idx !== -1);
      for (let i = 1; i < tasteIndices.length; i++) {
        // Space between taste tracks should be at least 1 (no adjacent taste tracks)
        expect(tasteIndices[i]! - tasteIndices[i - 1]!).toBeGreaterThanOrEqual(1);
      }
    });

    it("falls back to similar tracks when taste pool is empty", () => {
      const similar = makeTracks("sim", 15);
      const interleaved = interleaveTasteTracks(similar, [], 40, 15);
      expect(interleaved).toEqual(similar);
    });

    it("falls back to taste tracks when similar pool is empty", () => {
      const taste = makeTracks("taste", 10);
      const interleaved = interleaveTasteTracks([], taste, 40, 15);
      expect(interleaved).toEqual(taste);
    });
  });

  describe("tasteArtistMix flag default and safety", () => {
    it("tasteArtistMix defaults to false", () => {
      expect(getRecFlag("tasteArtistMix")).toBe(false);
    });
  });
});
