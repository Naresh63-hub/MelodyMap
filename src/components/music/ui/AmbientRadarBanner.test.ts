import { describe, it, expect } from "vitest";
import { getTemporalContext } from "@/lib/context-engine";

describe("AmbientRadarBanner context mapping", () => {
  it("determines morning context between 5am and 12pm", () => {
    const morning = getTemporalContext(8);
    expect(morning.timeOfDay).toBe("morning");
    expect(morning.label).toContain("Morning");
    expect(morning.energy).toBe("gentle");
    expect(morning.suggestedMoods).toContain("Chill");
  });

  it("determines afternoon context between 12pm and 5pm", () => {
    const afternoon = getTemporalContext(14);
    expect(afternoon.timeOfDay).toBe("afternoon");
    expect(afternoon.label).toContain("Afternoon");
    expect(afternoon.energy).toBe("high");
    expect(afternoon.suggestedMoods).toContain("Focus");
  });

  it("determines evening context between 5pm and 10pm", () => {
    const evening = getTemporalContext(19);
    expect(evening.timeOfDay).toBe("evening");
    expect(evening.label).toContain("Evening");
    expect(evening.energy).toBe("medium");
    expect(evening.suggestedMoods).toContain("Chill");
  });

  it("determines night context after 10pm and before 5am", () => {
    const midnight = getTemporalContext(23);
    expect(midnight.timeOfDay).toBe("night");
    expect(midnight.label).toContain("Night");
    expect(midnight.energy).toBe("low");
    expect(midnight.suggestedMoods).toContain("Sleep");

    const earlyMorning = getTemporalContext(3);
    expect(earlyMorning.timeOfDay).toBe("night");
  });
});
