import { beforeEach, describe, expect, it } from "vitest";
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
});
