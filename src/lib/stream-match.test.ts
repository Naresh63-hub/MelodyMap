import { describe, expect, it } from "vitest";

import { scoreAudiusCandidate } from "./stream.server";

/**
 * The Audius fallback must prefer the ORIGINAL artist's own upload over
 * covers/karaoke/re-recordings, and refuse the swap entirely when the pool
 * only holds unrelated recordings (score < threshold ⇒ caller falls through).
 */
describe("scoreAudiusCandidate", () => {
  const target = { title: "Butta Bomma", artist: "Armaan Malik", durationSeconds: 233 };

  it("scores the original artist's own upload highest", () => {
    const original = { title: "Butta Bomma", artist: "Armaan Malik - Topic", durationSeconds: 235 };
    const cover = { title: "Butta Bomma (cover)", artist: "Random Covers Channel", durationSeconds: 210 };
    expect(scoreAudiusCandidate(original, target)).toBeGreaterThan(scoreAudiusCandidate(cover, target));
  });

  it("penalizes a different artist with a different length (cover profile)", () => {
    const cover = { title: "Butta Bomma", artist: "Some Other Singer", durationSeconds: 180 };
    // 2.0 title + 0 artist + small duration credit — must stay below typical
    // original-artist scores so covers never outrank the real recording.
    expect(scoreAudiusCandidate(cover, target)).toBeLessThan(2.5);
  });

  it("rewards duration proximity only as a tiebreaker", () => {
    const exactLen = { title: "Butta Bomma", artist: "Unknown Indie", durationSeconds: 233 };
    const wrongLen = { title: "Butta Bomma", artist: "Unknown Indie", durationSeconds: 95 };
    expect(scoreAudiusCandidate(exactLen, target)).toBeGreaterThan(scoreAudiusCandidate(wrongLen, target));
  });

  it("scores unrelated recordings near zero", () => {
    const unrelated = { title: "Weekend Vibes Mix", artist: "DJ Anything", durationSeconds: 3600 };
    expect(scoreAudiusCandidate(unrelated, target)).toBeLessThan(1);
  });

  it("handles empty/missing fields without crashing", () => {
    expect(scoreAudiusCandidate({}, { title: "", artist: "", durationSeconds: null })).toBe(0);
    expect(scoreAudiusCandidate({ title: "X" }, { title: "X", artist: "Y", durationSeconds: 0 })).toBeGreaterThan(0);
  });
});
