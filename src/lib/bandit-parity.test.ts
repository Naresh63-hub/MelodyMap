import { describe, it, expect, beforeEach } from "vitest";
import {
  ThompsonSamplingPolicy,
  setBanditRngSource,
  type SessionContext,
} from "./bandit-policy";
import type { PlaybackTelemetryEvent } from "./telemetry";
import { setRecFlag, type RecFlagName } from "./rec-flags";
import goldenData from "./__fixtures__/main-ranking-golden.json";
import trainedGoldenData from "./__fixtures__/main-trained-golden.json";

function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIXED_CANDIDATES = [
  { id: "cand-1", title: "Midnight City", artist: "M83", language: "english" },
  { id: "cand-2", title: "Samajavaragamana", artist: "Sid Sriram", language: "telugu" },
  { id: "cand-3", title: "Kesariya", artist: "Arijit Singh", language: "hindi" },
  { id: "cand-4", title: "Starboy", artist: "The Weeknd", language: "english" },
  { id: "cand-5", title: "Butta Bomma", artist: "Armaan Malik", language: "telugu" },
  { id: "cand-6", title: "Apna Bana Le", artist: "Arijit Singh", language: "hindi" },
  { id: "cand-7", title: "Blinding Lights", artist: "The Weeknd", language: "english" },
  { id: "cand-8", title: "Ramuloo Ramulaa", artist: "Anurag Kulkarni", language: "telugu" },
  { id: "cand-9", title: "Tum Hi Ho", artist: "Arijit Singh", language: "hindi" },
  { id: "cand-10", title: "Levitating", artist: "Dua Lipa", language: "english" },
  { id: "cand-11", title: "Inkem Inkem", artist: "Sid Sriram", language: "telugu" },
  { id: "cand-12", title: "Channa Mereya", artist: "Arijit Singh", language: "hindi" },
];

const FIXED_CONTEXTS = [
  {
    hourOfDay: 23,
    discoveryPercent: 20,
    activeMood: "Late Night Chill",
    currentTrack: { id: "curr-1", title: "Intro", artist: "M83" },
    preferredLanguages: ["english", "telugu"],
  },
  {
    hourOfDay: 14,
    discoveryPercent: 80,
    activeMood: undefined,
    currentTrack: { id: "curr-2", title: "Sunny Day", artist: "Dua Lipa" },
    preferredLanguages: ["hindi"],
    stats: {
      "cand-3": { plays: 5, completions: 4, skips: 0 },
      "cand-6": { plays: 3, completions: 0, skips: 3 },
    },
  },
  {
    hourOfDay: 8,
    discoveryPercent: 50,
    activeMood: "Morning Focus",
    currentTrack: undefined,
    preferredLanguages: ["telugu"],
    likedTracks: [{ id: "cand-2", title: "Samajavaragamana", artist: "Sid Sriram" }],
  },
];

export const FIXED_20_TERMINAL_EVENTS: PlaybackTelemetryEvent[] = [
  { id: "ev-1", trackId: "cand-1", title: "Midnight City", artist: "M83", eventType: "COMPLETED", positionSeconds: 240, durationSeconds: 240, fractionPlayed: 1.0, timestamp: 10001 },
  { id: "ev-2", trackId: "cand-2", title: "Samajavaragamana", artist: "Sid Sriram", eventType: "SKIPPED", positionSeconds: 8, durationSeconds: 210, fractionPlayed: 0.038, timestamp: 10002 },
  { id: "ev-3", trackId: "cand-3", title: "Kesariya", artist: "Arijit Singh", eventType: "LIKED", positionSeconds: 45, durationSeconds: 260, fractionPlayed: 0.17, timestamp: 10003 },
  { id: "ev-4", trackId: "cand-4", title: "Starboy", artist: "The Weeknd", eventType: "COMPLETED", positionSeconds: 230, durationSeconds: 230, fractionPlayed: 1.0, timestamp: 10004 },
  { id: "ev-5", trackId: "cand-5", title: "Butta Bomma", artist: "Armaan Malik", eventType: "SKIPPED", positionSeconds: 5, durationSeconds: 195, fractionPlayed: 0.025, timestamp: 10005 },
  { id: "ev-6", trackId: "cand-6", title: "Apna Bana Le", artist: "Arijit Singh", eventType: "COMPLETED", positionSeconds: 250, durationSeconds: 250, fractionPlayed: 1.0, timestamp: 10006 },
  { id: "ev-7", trackId: "cand-7", title: "Blinding Lights", artist: "The Weeknd", eventType: "LIKED", positionSeconds: 60, durationSeconds: 200, fractionPlayed: 0.30, timestamp: 10007 },
  { id: "ev-8", trackId: "cand-8", title: "Ramuloo Ramulaa", artist: "Anurag Kulkarni", eventType: "COMPLETED", positionSeconds: 270, durationSeconds: 270, fractionPlayed: 1.0, timestamp: 10008 },
  { id: "ev-9", trackId: "cand-9", title: "Tum Hi Ho", artist: "Arijit Singh", eventType: "SKIPPED", positionSeconds: 9, durationSeconds: 260, fractionPlayed: 0.034, timestamp: 10009 },
  { id: "ev-10", trackId: "cand-10", title: "Levitating", artist: "Dua Lipa", eventType: "COMPLETED", positionSeconds: 203, durationSeconds: 203, fractionPlayed: 1.0, timestamp: 10010 },
  { id: "ev-11", trackId: "cand-11", title: "Inkem Inkem", artist: "Sid Sriram", eventType: "LIKED", positionSeconds: 90, durationSeconds: 240, fractionPlayed: 0.375, timestamp: 10011 },
  { id: "ev-12", trackId: "cand-12", title: "Channa Mereya", artist: "Arijit Singh", eventType: "COMPLETED", positionSeconds: 289, durationSeconds: 289, fractionPlayed: 1.0, timestamp: 10012 },
  { id: "ev-13", trackId: "cand-1", title: "Midnight City", artist: "M83", eventType: "LIKED", positionSeconds: 120, durationSeconds: 240, fractionPlayed: 0.50, timestamp: 10013 },
  { id: "ev-14", trackId: "cand-2", title: "Samajavaragamana", artist: "Sid Sriram", eventType: "COMPLETED", positionSeconds: 210, durationSeconds: 210, fractionPlayed: 1.0, timestamp: 10014 },
  { id: "ev-15", trackId: "cand-3", title: "Kesariya", artist: "Arijit Singh", eventType: "SKIPPED", positionSeconds: 4, durationSeconds: 260, fractionPlayed: 0.015, timestamp: 10015 },
  { id: "ev-16", trackId: "cand-4", title: "Starboy", artist: "The Weeknd", eventType: "SKIPPED", positionSeconds: 7, durationSeconds: 230, fractionPlayed: 0.030, timestamp: 10016 },
  { id: "ev-17", trackId: "cand-5", title: "Butta Bomma", artist: "Armaan Malik", eventType: "COMPLETED", positionSeconds: 195, durationSeconds: 195, fractionPlayed: 1.0, timestamp: 10017 },
  { id: "ev-18", trackId: "cand-6", title: "Apna Bana Le", artist: "Arijit Singh", eventType: "LIKED", positionSeconds: 30, durationSeconds: 250, fractionPlayed: 0.12, timestamp: 10018 },
  { id: "ev-19", trackId: "cand-7", title: "Blinding Lights", artist: "The Weeknd", eventType: "COMPLETED", positionSeconds: 200, durationSeconds: 200, fractionPlayed: 1.0, timestamp: 10019 },
  { id: "ev-20", trackId: "cand-8", title: "Ramuloo Ramulaa", artist: "Anurag Kulkarni", eventType: "SKIPPED", positionSeconds: 6, durationSeconds: 270, fractionPlayed: 0.022, timestamp: 10020 },
];

describe("Flags-off ranking parity with main", () => {
  beforeEach(() => {
    // Ensure all new flags are OFF
    const newFlags: RecFlagName[] = [
      "leakFreeTrainingContext",
      "languageFeature",
      "artistRecentSkipFeature",
      "noveltyMomentumFeature",
      "movieTieBreaker",
      "tasteArtistMix",
      "languageQuotas",
      "webAudioEq",
    ];
    for (const flag of newFlags) {
      setRecFlag(flag, false);
    }
  });

  it("reproduces main ranking orders exactly for seeds 1..5 across 5 consecutive calls", () => {
    const golden = goldenData as Record<string, string[][]>;

    for (const seed of [1, 2, 3, 4, 5]) {
      setBanditRngSource(mulberry32(seed));
      const policy = new ThompsonSamplingPolicy();
      policy.resetModel();

      for (let call = 0; call < 5; call++) {
        const ctx = FIXED_CONTEXTS[call % FIXED_CONTEXTS.length]!;
        const ranked = policy.rankCandidates(FIXED_CANDIDATES, ctx);
        const actualIds = ranked.map((t) => t.id);
        const expectedIds = golden[String(seed)]![call]!;
        expect(actualIds).toEqual(expectedIds);
      }
    }
  });

  it("reproduces main ranking orders exactly after feeding 20 terminal events across seeds 1..5", () => {
    const trainedGolden = trainedGoldenData as Record<string, string[][]>;

    for (const seed of [1, 2, 3, 4, 5]) {
      setBanditRngSource(mulberry32(seed));
      const policy = new ThompsonSamplingPolicy();
      policy.resetModel();

      // Train on the 20 events in order
      for (let i = 0; i < FIXED_20_TERMINAL_EVENTS.length; i++) {
        const ev = FIXED_20_TERMINAL_EVENTS[i]!;
        const candidateTrack = FIXED_CANDIDATES.find((c) => c.id === ev.trackId);
        const ctx: SessionContext = {
          hourOfDay: (14 + i) % 24,
          discoveryPercent: 40,
          stats: {
            [ev.trackId]: {
              plays: 1,
              completions: ev.eventType === "COMPLETED" ? 1 : 0,
              skips: ev.eventType === "SKIPPED" ? 1 : 0,
              track: candidateTrack,
            },
          },
          likedTracks: ev.eventType === "LIKED" && candidateTrack ? [candidateTrack] : [],
        };
        policy.recordFeedback(ev, ctx);
      }

      // Assert 5 consecutive ranking calls match main exactly
      for (let call = 0; call < 5; call++) {
        const ctx = FIXED_CONTEXTS[call % FIXED_CONTEXTS.length]!;
        const ranked = policy.rankCandidates(FIXED_CANDIDATES, ctx);
        const actualIds = ranked.map((t) => t.id);
        const expectedIds = trainedGolden[String(seed)]![call]!;
        expect(actualIds).toEqual(expectedIds);
      }
    }
  });
});
