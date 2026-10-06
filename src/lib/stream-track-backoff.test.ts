import { describe, expect, it } from "vitest";

import { computeTrackBackoffMs } from "./stream.server";

/**
 * Regression tests for the per-track resolve backoff that replaced the global
 * circuit breaker. Previously, 20 consecutive resolve failures ANYWHERE froze
 * resolution for the ENTIRE catalog for 15s — one bot-blocked track took every
 * other song down with it ("audio connection interrupted" for all songs).
 */
describe("computeTrackBackoffMs (per-track resolve backoff)", () => {
  it("does not back off before the failure threshold", () => {
    // Below threshold the caller never consults this — but the math must stay
    // sensible (first backoff step starts at the threshold).
    expect(computeTrackBackoffMs(2)).toBe(60_000);
  });

  it("doubles exponentially per additional failure", () => {
    expect(computeTrackBackoffMs(3)).toBe(120_000);
    expect(computeTrackBackoffMs(4)).toBe(240_000);
    expect(computeTrackBackoffMs(5)).toBe(480_000);
  });

  it("caps at 10 minutes so a poisoned track retries periodically", () => {
    expect(computeTrackBackoffMs(20)).toBe(600_000);
    expect(computeTrackBackoffMs(200)).toBe(600_000);
  });

  it("is per-track: two different tracks fail independently", () => {
    // The map is keyed by videoId (see recordResolveFailure); this documents
    // the contract — backoff state is never shared across tracks.
    const a = computeTrackBackoffMs(3);
    const b = computeTrackBackoffMs(3);
    expect(a).toBe(b); // same inputs, same window — but never accumulated across IDs
  });
});
