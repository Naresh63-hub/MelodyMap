import { describe, it, expect, beforeEach } from "vitest";
import {
  ThompsonSamplingPolicy,
  setBanditRngSource,
} from "./bandit-policy";
import { setRecFlag, type RecFlagName } from "./rec-flags";
import goldenData from "./__fixtures__/main-ranking-golden.json";

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
});
