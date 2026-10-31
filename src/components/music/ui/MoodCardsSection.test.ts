import { describe, it, expect } from "vitest";
import {
  MOOD_ITEMS,
  getTimeOfDayMoodContext,
} from "./MoodCardsSection";

describe("Time-of-Day Dynamic Moods", () => {
  it("curated MOOD_ITEMS list remains complete and valid", () => {
    expect(MOOD_ITEMS.length).toBeGreaterThanOrEqual(8);
    const keys = MOOD_ITEMS.map((m) => m.key);
    expect(keys).toContain("chill");
    expect(keys).toContain("romantic");
    expect(keys).toContain("upbeat workout");
    expect(keys).toContain("party");
    expect(keys).toContain("sad hours");
    expect(keys).toContain("focus");
    expect(keys).toContain("late night");
    expect(keys).toContain("devotional");
  });

  it("identifies Morning context (05:00 - 11:59)", () => {
    const morningDate = new Date(2026, 9, 31, 8, 30);
    const context = getTimeOfDayMoodContext(morningDate);
    expect(context.period).toBe("morning");
    expect(context.badgeLabel).toBe("Morning");
    expect(context.recommendedKeys).toContain("devotional");
    expect(context.recommendedKeys).toContain("chill");
    expect(context.recommendedKeys).toContain("focus");

    // All recommended keys must exist in MOOD_ITEMS
    const allKeys = new Set(MOOD_ITEMS.map((m) => m.key));
    for (const key of context.recommendedKeys) {
      expect(allKeys.has(key)).toBe(true);
    }
  });

  it("identifies Afternoon context (12:00 - 16:59)", () => {
    const afternoonDate = new Date(2026, 9, 31, 14, 0);
    const context = getTimeOfDayMoodContext(afternoonDate);
    expect(context.period).toBe("afternoon");
    expect(context.badgeLabel).toBe("Afternoon");
    expect(context.recommendedKeys).toContain("focus");
    expect(context.recommendedKeys).toContain("upbeat workout");
    expect(context.recommendedKeys).toContain("chill");
  });

  it("identifies Evening context (17:00 - 21:59)", () => {
    const eveningDate = new Date(2026, 9, 31, 19, 45);
    const context = getTimeOfDayMoodContext(eveningDate);
    expect(context.period).toBe("evening");
    expect(context.badgeLabel).toBe("Evening");
    expect(context.recommendedKeys).toContain("romantic");
    expect(context.recommendedKeys).toContain("party");
  });

  it("identifies Late Night context (22:00 - 04:59)", () => {
    const lateNightDate = new Date(2026, 9, 31, 23, 15);
    const context = getTimeOfDayMoodContext(lateNightDate);
    expect(context.period).toBe("night");
    expect(context.badgeLabel).toBe("Late Night");
    expect(context.recommendedKeys).toContain("late night");
    expect(context.recommendedKeys).toContain("sad hours");

    const earlyHoursDate = new Date(2026, 9, 31, 3, 0);
    const earlyContext = getTimeOfDayMoodContext(earlyHoursDate);
    expect(earlyContext.period).toBe("night");
    expect(earlyContext.badgeLabel).toBe("Late Night");
  });

  it("handles boundary hours precisely", () => {
    expect(getTimeOfDayMoodContext(new Date(2026, 9, 31, 5, 0)).period).toBe("morning");
    expect(getTimeOfDayMoodContext(new Date(2026, 9, 31, 11, 59)).period).toBe("morning");
    expect(getTimeOfDayMoodContext(new Date(2026, 9, 31, 12, 0)).period).toBe("afternoon");
    expect(getTimeOfDayMoodContext(new Date(2026, 9, 31, 16, 59)).period).toBe("afternoon");
    expect(getTimeOfDayMoodContext(new Date(2026, 9, 31, 17, 0)).period).toBe("evening");
    expect(getTimeOfDayMoodContext(new Date(2026, 9, 31, 21, 59)).period).toBe("evening");
    expect(getTimeOfDayMoodContext(new Date(2026, 9, 31, 22, 0)).period).toBe("night");
    expect(getTimeOfDayMoodContext(new Date(2026, 9, 31, 4, 59)).period).toBe("night");
  });
});
