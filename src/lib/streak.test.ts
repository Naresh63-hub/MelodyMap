import { describe, it, expect, beforeEach } from "vitest";
import {
  recordListeningSession,
  getStreakData,
  getTopListenerPercentile,
  evaluateUserBadges,
  getStreakBadge,
} from "./streak";
import { safeStorage } from "./safe-storage";

describe("streak and listener badges engine", () => {
  beforeEach(() => {
    safeStorage.clear();
  });

  it("returns initial zero streak data when fresh", () => {
    const data = getStreakData();
    expect(data.currentStreak).toBe(0);
    expect(data.totalMinutes).toBe(0);
    expect(data.totalTracks).toBe(0);
  });

  it("accumulates listening minutes and tracks", () => {
    recordListeningSession(25, 4);
    const data = getStreakData();
    expect(data.totalMinutes).toBe(25);
    expect(data.totalTracks).toBe(4);
    expect(data.currentStreak).toBe(1);
  });

  it("calculates Top 1% Listener percentile when engagement thresholds are met", () => {
    // Under threshold -> Top 25% or 50%
    recordListeningSession(10, 2);
    let rank = getTopListenerPercentile(getStreakData());
    expect(rank.percentile).toBe(50);

    // Meets Top 1% threshold (>=180 mins)
    recordListeningSession(200, 30);
    rank = getTopListenerPercentile(getStreakData());
    expect(rank.percentile).toBe(1);
    expect(rank.label).toBe("Top 1% Listener");
  });

  it("evaluates badges and unlocks Top 1% Listener badge appropriately", () => {
    recordListeningSession(190, 20, { isStory: true, usedEqualizer: true });
    const badges = evaluateUserBadges();

    const top1 = badges.find((b) => b.id === "top-1-percent");
    expect(top1).toBeDefined();
    expect(top1?.unlocked).toBe(true);
    expect(top1?.tier).toBe("legendary");

    const audiophile = badges.find((b) => b.id === "studio-audiophile");
    expect(audiophile?.unlocked).toBe(true);

    const story = badges.find((b) => b.id === "soulful-devotee");
    expect(story?.unlocked).toBe(true);
  });

  it("provides streak badge metadata with label", () => {
    recordListeningSession(30, 5);
    const badge = getStreakBadge();
    expect(badge).not.toBeNull();
    expect(badge?.badge).toBe("Fire");
    expect(badge?.label).toContain("1d Streak");
  });
});
