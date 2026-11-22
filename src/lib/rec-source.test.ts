import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { clearTrackSources, getTrackSource, tagTrackSource } from "./rec-source";

describe("rec-source", () => {
  beforeEach(() => clearTrackSources());

  it("tags tracks and reads the source back", () => {
    tagTrackSource([{ id: "a" }, { id: "b" }], "autodj-radio");
    expect(getTrackSource("a")).toBe("autodj-radio");
    expect(getTrackSource("b")).toBe("autodj-radio");
  });

  it("returns undefined for untagged, empty or missing ids", () => {
    expect(getTrackSource("nope")).toBeUndefined();
    expect(getTrackSource("")).toBeUndefined();
    expect(getTrackSource(undefined)).toBeUndefined();
  });

  it("latest tag wins and tracks without ids are ignored", () => {
    tagTrackSource([{ id: "a" }, {}], "made-for-you");
    tagTrackSource([{ id: "a" }], "autodj-taste");
    expect(getTrackSource("a")).toBe("autodj-taste");
  });

  it("evicts the oldest entries beyond 1000", () => {
    const tracks = Array.from({ length: 1005 }, (_, i) => ({ id: `t${i}` }));
    tagTrackSource(tracks, "x");
    expect(getTrackSource("t0")).toBeUndefined();
    expect(getTrackSource("t4")).toBeUndefined();
    expect(getTrackSource("t5")).toBe("x");
    expect(getTrackSource("t1004")).toBe("x");
  });

  it("fails if any playSong or startQueue call site in routes/index.tsx is missing an explicit source tag", () => {
    const routeCode = readFileSync(resolve(__dirname, "../routes/index.tsx"), "utf-8");

    // All startQueue(...) call sites must pass 3 arguments: (tracks, index, source)
    const sqMatches = [...routeCode.matchAll(/startQueue\s*\(([^)]+)\)/g)];
    expect(sqMatches.length).toBeGreaterThan(0);
    for (const match of sqMatches) {
      const argString = match[1] ?? "";
      const args = argString.split(",").map((s) => s.trim());
      expect(args.length, `startQueue call missing source: ${match[0]}`).toBeGreaterThanOrEqual(3);
    }

    // All playSong(...) call sites must pass 3 arguments: (track, surroundingQueue, source)
    const psMatches = [...routeCode.matchAll(/playSong\s*\(([^)]+)\)/g)];
    expect(psMatches.length).toBeGreaterThan(0);
    for (const match of psMatches) {
      const argString = match[1] ?? "";
      const args = argString.split(",").map((s) => s.trim());
      expect(args.length, `playSong call missing source: ${match[0]}`).toBeGreaterThanOrEqual(3);
    }
  });
});
