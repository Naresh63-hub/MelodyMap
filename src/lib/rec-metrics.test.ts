import { beforeEach, describe, expect, it, vi } from "vitest";

const memory = vi.hoisted(() => new Map<string, string>());

vi.mock("./safe-storage", () => ({
  safeStorage: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memory.set(k, v);
    },
    removeItem: (k: string) => {
      memory.delete(k);
    },
  },
}));

import {
  recordMetricsEvent,
  summarizeMetrics,
  resetRecMetrics,
  recordLanguageFeatureStd,
  getLanguageFeatureStd,
  computeBatchLanguageStd,
} from "./rec-metrics";
import type { PlaybackTelemetryEvent, TelemetryEventType } from "./telemetry";

function ev(
  eventType: TelemetryEventType,
  positionSeconds: number,
  source?: string,
): PlaybackTelemetryEvent {
  return {
    id: `${eventType}-${positionSeconds}-${Math.random()}`,
    trackId: "t1",
    artist: "A",
    title: "T",
    eventType,
    positionSeconds,
    durationSeconds: 200,
    fractionPlayed: positionSeconds / 200,
    timestamp: Date.now(),
    context: source ? { source } : undefined,
  };
}

describe("rec-metrics", () => {
  const now = new Date(2026, 10, 22);

  beforeEach(() => memory.clear());

  it("counts starts, early skips (<10s), completions and likes per source", () => {
    recordMetricsEvent(ev("PLAY_START", 0, "taste-artist"), now);
    recordMetricsEvent(ev("PLAY_START", 0, "taste-artist"), now);
    recordMetricsEvent(ev("SKIPPED", 3, "taste-artist"), now); // early
    recordMetricsEvent(ev("SKIPPED", 15, "taste-artist"), now); // not early
    recordMetricsEvent(ev("COMPLETED", 200, "taste-artist"), now);
    recordMetricsEvent(ev("PLAY_START", 0), now); // no source

    const summary = summarizeMetrics(7, now);
    expect(summary["taste-artist"]).toMatchObject({
      starts: 2,
      earlySkips: 1,
      completions: 1,
      earlySkipRate: 0.5,
      completionRate: 0.5,
    });
    expect(summary["unknown"]?.starts).toBe(1);
  });

  it("ignores milestone events and returns 0 rates when there are no starts", () => {
    recordMetricsEvent(ev("PLAY_25S", 25, "similar"), now);
    expect(summarizeMetrics(7, now)["similar"]).toBeUndefined();

    recordMetricsEvent(ev("LIKED", 5, "similar"), now);
    expect(summarizeMetrics(7, now)["similar"]).toMatchObject({
      likes: 1,
      earlySkipRate: 0,
      completionRate: 0,
    });
  });

  it("keeps only the most recent 30 days", () => {
    let last = now;
    for (let i = 0; i < 35; i++) {
      last = new Date(2026, 0, 1 + i);
      recordMetricsEvent(ev("PLAY_START", 0, "x"), last);
    }
    expect(summarizeMetrics(365, last)["x"]?.starts).toBe(30);
  });

  it("windows by days requested", () => {
    recordMetricsEvent(ev("PLAY_START", 0, "x"), new Date(2026, 10, 10));
    recordMetricsEvent(ev("PLAY_START", 0, "x"), now);
    expect(summarizeMetrics(7, now)["x"]?.starts).toBe(1);
    expect(summarizeMetrics(30, now)["x"]?.starts).toBe(2);
  });

  it("resets metrics via resetRecMetrics", () => {
    recordMetricsEvent(ev("PLAY_START", 0, "taste-artist"), now);
    recordLanguageFeatureStd(0.25);
    expect(summarizeMetrics(7, now)["taste-artist"]?.starts).toBe(1);
    expect(getLanguageFeatureStd().batches).toBe(1);

    resetRecMetrics();
    expect(summarizeMetrics(7, now)).toEqual({});
    expect(getLanguageFeatureStd()).toEqual({ batches: 0, mean: 0 });
  });

  it("accumulates languageFeatureStd running mean across batches", () => {
    expect(getLanguageFeatureStd()).toEqual({ batches: 0, mean: 0 });

    recordLanguageFeatureStd(0.1);
    expect(getLanguageFeatureStd()).toEqual({ batches: 1, mean: 0.1 });

    recordLanguageFeatureStd(0.3);
    const summary = getLanguageFeatureStd();
    expect(summary.batches).toBe(2);
    expect(summary.mean).toBeCloseTo(0.2, 5);
  });

  it("computes batch language standard deviation correctly", () => {
    const mockPolicy = {
      extractFeatureVector: (c: { langVal: number }) => [1, 0, 0, 0, 0, c.langVal],
    };

    // All identical language values -> std = 0
    const uniformCandidates = [{ langVal: 0.5 }, { langVal: 0.5 }, { langVal: 0.5 }];
    expect(computeBatchLanguageStd(uniformCandidates, {}, mockPolicy as any)).toBe(0);

    // Varied candidates -> std > 0
    const variedCandidates = [{ langVal: 0.2 }, { langVal: 0.8 }];
    const std = computeBatchLanguageStd(variedCandidates, {}, mockPolicy as any);
    expect(std).toBeCloseTo(0.3, 5);

    // Empty list -> 0
    expect(computeBatchLanguageStd([], {}, mockPolicy as any)).toBe(0);
  });
});
