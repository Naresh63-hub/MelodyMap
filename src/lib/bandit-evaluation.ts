import type { TrackLike } from "./track-dedup";
import {
  ThompsonSamplingPolicy,
  setBanditRngSource,
  type SessionContext,
  type RecommendationPolicy,
  type BanditModelState,
} from "./bandit-policy";
import type { PlaybackTelemetryEvent } from "./telemetry";

/** Ground-truth simulation user with true latent preference weights */
export interface UserPreferenceProfile {
  name: string;
  trueWeights: number[]; // Dimension = 6
  rewardNoiseStd?: number;
}

/** Configuration for an offline evaluation simulation run */
export interface BanditSimulationConfig {
  rounds: number; // Horizon T (e.g., 200 or 500)
  candidatePoolSize: number; // Number of tracks presented per round (e.g., 10)
  epsilon: number; // For Epsilon-Greedy (e.g., 0.1)
  explorationVariance?: number; // For Thompson Sampling (v parameter)
  seed?: number; // Pseudorandom seed
}

/** Step record in the trajectory */
export interface EvaluationStep {
  round: number;
  reward: number;
  cumulativeReward: number;
  instantaneousRegret: number;
  cumulativeRegret: number;
}

/** Evaluation summary report for a single policy */
export interface PolicyEvaluationResult {
  policyName: string;
  totalRounds: number;
  cumulativeReward: number;
  averageReward: number;
  cumulativeRegret: number;
  averageRegret: number;
  uniqueArtistsCount: number;
  artistDiversityRatio: number; // unique artists / total selections
  trajectory: EvaluationStep[];
}

/** Comparative simulation outcome comparing all policies */
export interface SimulationReport {
  userProfile: UserPreferenceProfile;
  config: BanditSimulationConfig;
  results: {
    thompson: PolicyEvaluationResult;
    epsilonGreedy: PolicyEvaluationResult;
    random: PolicyEvaluationResult;
    oracle: PolicyEvaluationResult;
  };
  summary: {
    thompsonVsRandomImprovement: number; // percentage
    thompsonVsEpsilonImprovement: number; // percentage
    thompsonRegretReductionVsRandom: number; // percentage
  };
}

/** Simple reproducible Linear Congruential Generator for reproducible simulations */
function createPrng(seed = 42) {
  let state = seed;
  return function next(): number {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** Standard normal sample via Box-Muller transform */
function sampleNormal(rng: () => number, std = 1.0, mean = 0.0): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const z0 = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z0 * std;
}

/** Vector dot product */
function dot(a: number[], b: number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    sum += a[i]! * b[i]!;
  }
  return sum;
}

/**
 * Baseline: Uniformly Random Policy.
 * Randomly picks from the candidate pool to establish lower performance bound.
 */
export class RandomPolicy implements RecommendationPolicy {
  private rng: () => number;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
  }

  public selectNextTrack<T extends TrackLike>(candidates: T[], _context: SessionContext): T | null {
    if (candidates.length === 0) return null;
    const index = Math.floor(this.rng() * candidates.length);
    return candidates[index] ?? null;
  }

  public rankCandidates<T extends TrackLike>(candidates: T[], _context: SessionContext): T[] {
    const copy = [...candidates];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      const temp = copy[i]!;
      copy[i] = copy[j]!;
      copy[j] = temp;
    }
    return copy;
  }

  public recordFeedback(_event: PlaybackTelemetryEvent, _context?: SessionContext): void {}

  public getModelState(): BanditModelState {
    return {
      version: 1,
      dimension: 6,
      B: [],
      B_inv: [],
      f: [],
      mu: [],
      totalUpdates: 0,
      lastUpdated: Date.now(),
    };
  }

  public setModelState(_state: BanditModelState): void {}
}

/**
 * Baseline: Contextual Epsilon-Greedy Policy.
 * Exploits the current Ridge Regression point estimate theta_hat with probability (1 - eps),
 * and explores uniformly at random with probability eps.
 */
export class EpsilonGreedyPolicy implements RecommendationPolicy {
  private epsilon: number;
  private rng: () => number;
  private tsDelegate: ThompsonSamplingPolicy;

  constructor(epsilon = 0.1, rng: () => number = Math.random) {
    this.epsilon = epsilon;
    this.rng = rng;
    this.tsDelegate = new ThompsonSamplingPolicy();
    this.tsDelegate.resetModel();
  }

  public selectNextTrack<T extends TrackLike>(candidates: T[], context: SessionContext): T | null {
    if (candidates.length === 0) return null;

    // Explore with probability epsilon
    if (this.rng() < this.epsilon) {
      const randIdx = Math.floor(this.rng() * candidates.length);
      return candidates[randIdx] ?? null;
    }

    // Exploit with probability (1 - epsilon) using point estimate mu
    const state = this.tsDelegate.getModelState();
    const mu = state.mu;

    let bestTrack: T | null = candidates[0] ?? null;
    let bestScore = -Infinity;

    for (const track of candidates) {
      const x = this.tsDelegate.extractFeatureVector(track, context);
      const score = dot(mu, x);
      if (score > bestScore) {
        bestScore = score;
        bestTrack = track;
      }
    }

    return bestTrack;
  }

  public rankCandidates<T extends TrackLike>(candidates: T[], context: SessionContext): T[] {
    const state = this.tsDelegate.getModelState();
    const mu = state.mu;
    return [...candidates].sort((a, b) => {
      const xA = this.tsDelegate.extractFeatureVector(a, context);
      const xB = this.tsDelegate.extractFeatureVector(b, context);
      return dot(mu, xB) - dot(mu, xA);
    });
  }

  public recordFeedback(event: PlaybackTelemetryEvent, context?: SessionContext): void {
    this.tsDelegate.recordFeedback(event, context);
  }

  public getModelState(): BanditModelState {
    return this.tsDelegate.getModelState();
  }

  public setModelState(state: BanditModelState): void {
    this.tsDelegate.setModelState(state);
  }

  public resetModel(): void {
    this.tsDelegate.resetModel();
  }
}

/**
 * Benchmark Oracle Policy.
 * Knows the true latent user preference weights theta* and selects the optimal arm.
 */
export class OraclePolicy implements RecommendationPolicy {
  private trueWeights: number[];
  private tsDelegate: ThompsonSamplingPolicy;

  constructor(trueWeights: number[]) {
    this.trueWeights = trueWeights;
    this.tsDelegate = new ThompsonSamplingPolicy();
  }

  public selectNextTrack<T extends TrackLike>(candidates: T[], context: SessionContext): T | null {
    if (candidates.length === 0) return null;
    let bestTrack: T | null = candidates[0] ?? null;
    let bestScore = -Infinity;

    for (const track of candidates) {
      const x = this.tsDelegate.extractFeatureVector(track, context);
      const score = dot(this.trueWeights, x);
      if (score > bestScore) {
        bestScore = score;
        bestTrack = track;
      }
    }
    return bestTrack;
  }

  public rankCandidates<T extends TrackLike>(candidates: T[], context: SessionContext): T[] {
    return [...candidates].sort((a, b) => {
      const xA = this.tsDelegate.extractFeatureVector(a, context);
      const xB = this.tsDelegate.extractFeatureVector(b, context);
      return dot(this.trueWeights, xB) - dot(this.trueWeights, xA);
    });
  }

  public recordFeedback(_event: PlaybackTelemetryEvent, _context?: SessionContext): void {}

  public getModelState(): BanditModelState {
    return this.tsDelegate.getModelState();
  }

  public setModelState(_state: BanditModelState): void {}
}

/** Synthetic Candidate Pool Generator */
const SYNTHETIC_ARTISTS = [
  "Acoustic Haven",
  "Midnight Lo-Fi Collective",
  "Electronic Pulse",
  "Indie Horizon",
  "Deep Bass DJ",
  "Chillwave Station",
  "Classical Echoes",
  "Pop Aurora",
  "Retro Funk Project",
  "Ambient Solitude",
];

const SYNTHETIC_ENERGY_PREFIXES = [
  "Chill Peaceful Morning",
  "Midnight Soft Ambient",
  "Workout High Energy Beat",
  "Deep Focus Study",
  "Sunset Relaxing Melody",
  "Intense Rhythm Dance",
];

export function generateCandidatePool(poolSize = 10, roundIndex = 0): TrackLike[] {
  const candidates: TrackLike[] = [];
  for (let i = 0; i < poolSize; i++) {
    const artist = SYNTHETIC_ARTISTS[(roundIndex + i) % SYNTHETIC_ARTISTS.length]!;
    const prefix = SYNTHETIC_ENERGY_PREFIXES[(roundIndex * 3 + i) % SYNTHETIC_ENERGY_PREFIXES.length]!;
    candidates.push({
      id: `track-${roundIndex}-${i}`,
      title: `${prefix} #${i + 1}`,
      artist,
    });
  }
  return candidates;
}

/** Default Realistic User Profile */
export const DEFAULT_USER_PROFILE: UserPreferenceProfile = {
  name: "Diverse Focus & Evening Chill Listener",
  // x0: Intercept (0.2), x1: Circadian (0.4), x2: Energy continuity (0.3), x3: Artist affinity (0.5), x4: Discovery (0.1), x5: Momentum (0.2)
  trueWeights: [0.2, 0.45, 0.35, 0.5, 0.15, 0.25],
  rewardNoiseStd: 0.05,
};

/** Default Simulation Parameters */
export const DEFAULT_SIM_CONFIG: BanditSimulationConfig = {
  rounds: 250,
  candidatePoolSize: 10,
  epsilon: 0.1,
  seed: 1337,
};

/**
 * Runs an offline multi-armed contextual bandit simulation comparing:
 * 1. Linear Contextual Thompson Sampling (LinTS)
 * 2. Epsilon-Greedy (eps=0.1)
 * 3. Uniform Random Policy
 * 4. Theoretical Oracle
 */
export function runBanditSimulation(
  userProfile = DEFAULT_USER_PROFILE,
  config: Partial<BanditSimulationConfig> = {},
): SimulationReport {
  const mergedConfig: BanditSimulationConfig = { ...DEFAULT_SIM_CONFIG, ...config };
  const rng = createPrng(mergedConfig.seed ?? 42);

  // Initialize all 4 policies
  const tsPolicy = new ThompsonSamplingPolicy();
  tsPolicy.resetModel();

  const egPolicy = new EpsilonGreedyPolicy(mergedConfig.epsilon, rng);
  const randPolicy = new RandomPolicy(rng);
  const oraclePolicy = new OraclePolicy(userProfile.trueWeights);

  // Feature vector helper
  const featureHelper = new ThompsonSamplingPolicy();

  // Metrics trackers
  interface PolicyTracker {
    policy: RecommendationPolicy;
    name: string;
    cumulativeReward: number;
    cumulativeRegret: number;
    selectedArtists: string[];
    trajectory: EvaluationStep[];
  }

  const trackers: Record<"thompson" | "epsilonGreedy" | "random" | "oracle", PolicyTracker> = {
    thompson: {
      policy: tsPolicy,
      name: "Thompson Sampling (LinTS)",
      cumulativeReward: 0,
      cumulativeRegret: 0,
      selectedArtists: [],
      trajectory: [],
    },
    epsilonGreedy: {
      policy: egPolicy,
      name: `Epsilon-Greedy (ε=${mergedConfig.epsilon})`,
      cumulativeReward: 0,
      cumulativeRegret: 0,
      selectedArtists: [],
      trajectory: [],
    },
    random: {
      policy: randPolicy,
      name: "Random Baseline",
      cumulativeReward: 0,
      cumulativeRegret: 0,
      selectedArtists: [],
      trajectory: [],
    },
    oracle: {
      policy: oraclePolicy,
      name: "Oracle (Optimal)",
      cumulativeReward: 0,
      cumulativeRegret: 0,
      selectedArtists: [],
      trajectory: [],
    },
  };

  // Thompson Sampling draws posterior samples via an injectable RNG source;
  // wiring the seeded PRNG in makes the whole simulation deterministic.
  setBanditRngSource(rng);
  try {
  // Run simulation over T rounds
  for (let t = 1; t <= mergedConfig.rounds; t++) {
    // Generate context for round t
    const hourOfDay = (8 + Math.floor((t / mergedConfig.rounds) * 16)) % 24; // Simulated day progression
    const candidates = generateCandidatePool(mergedConfig.candidatePoolSize, t);

    const context: SessionContext = {
      hourOfDay,
      discoveryPercent: 40,
      sessionCompletions: Math.floor(t * 0.7),
      sessionSkips: Math.floor(t * 0.2),
    };

    // Calculate true optimal reward under Oracle
    const oracleSelection = oraclePolicy.selectNextTrack(candidates, context);
    const optimalFeature = oracleSelection ? featureHelper.extractFeatureVector(oracleSelection, context) : [];
    const optimalExpectedReward = optimalFeature.length > 0 ? dot(userProfile.trueWeights, optimalFeature) : 0;

    // Evaluate each policy on the exact same round & candidates
    for (const key of ["oracle", "thompson", "epsilonGreedy", "random"] as const) {
      const tracker = trackers[key];
      const chosenTrack = tracker.policy.selectNextTrack(candidates, context);

      if (!chosenTrack) continue;

      tracker.selectedArtists.push(chosenTrack.artist || "Unknown");

      // Calculate realized reward = true expected reward + observation noise
      const x = featureHelper.extractFeatureVector(chosenTrack, context);
      const expectedReward = dot(userProfile.trueWeights, x);
      const noise = sampleNormal(rng, userProfile.rewardNoiseStd ?? 0.05);
      // Normalized reward in [-1.0, 1.0]
      const realizedReward = Math.max(-1.0, Math.min(1.0, expectedReward + noise));

      // Calculate instantaneous regret: r* - r_expected
      const instantaneousRegret = Math.max(0, optimalExpectedReward - expectedReward);

      tracker.cumulativeReward += realizedReward;
      tracker.cumulativeRegret += instantaneousRegret;

      // Sample trajectory at step intervals or on final step
      if (t % 10 === 0 || t === mergedConfig.rounds) {
        tracker.trajectory.push({
          round: t,
          reward: Number(realizedReward.toFixed(4)),
          cumulativeReward: Number(tracker.cumulativeReward.toFixed(2)),
          instantaneousRegret: Number(instantaneousRegret.toFixed(4)),
          cumulativeRegret: Number(tracker.cumulativeRegret.toFixed(2)),
        });
      }

      // Record feedback telemetry event for online updating.
      // The mapping MUST be monotone in realizedReward: the previous version gave
      // mediocre arms (0 < r <= 0.3) LIKED (+2.0) while great arms (> 0.3) only got
      // COMPLETED (+1.0), so Thompson correctly learned to prefer mediocre tracks
      // and late regret EXCEEDED random. Milestone events now act as graded
      // listening depth; LIKED/REPLAYED remain reserved for genuine user actions
      // and are never simulated.
      const mappedEvent =
        realizedReward <= -0.5
          ? { eventType: "SKIPPED" as const, positionSeconds: 5 } // fastSkip -1.2
          : realizedReward <= 0
            ? { eventType: "SKIPPED" as const, positionSeconds: 15 } // midSkip -0.6
            : realizedReward <= 0.15
              ? { eventType: "PLAY_10S" as const, positionSeconds: 10 } // +0.1
              : realizedReward <= 0.35
                ? { eventType: "PLAY_25S" as const, positionSeconds: 25 } // +0.2
                : realizedReward <= 0.55
                  ? { eventType: "PLAY_50_PERCENT" as const, positionSeconds: 90 } // +0.4
                  : realizedReward <= 0.8
                    ? { eventType: "PLAY_85_PERCENT" as const, positionSeconds: 153 } // +0.7
                    : { eventType: "COMPLETED" as const, positionSeconds: 180 }; // +1.0

      const feedbackEvent: PlaybackTelemetryEvent = {
        id: `sim-ev-${key}-${t}`,
        trackId: chosenTrack.id,
        artist: chosenTrack.artist || "",
        title: chosenTrack.title || "",
        eventType: mappedEvent.eventType,
        positionSeconds: mappedEvent.positionSeconds,
        durationSeconds: 180,
        fractionPlayed: Math.max(0.1, Math.min(1.0, (realizedReward + 1) / 2)),
        timestamp: Date.now(),
        context: { hourOfDay },
      };

      tracker.policy.recordFeedback(feedbackEvent, context);
    }
  }
  } finally {
    setBanditRngSource(null); // restore Math.random() for production behavior
  }

  // Format report
  const formatResult = (key: keyof typeof trackers): PolicyEvaluationResult => {
    const tracker = trackers[key];
    const totalRounds = mergedConfig.rounds;
    const uniqueArtists = new Set(tracker.selectedArtists).size;
    return {
      policyName: tracker.name,
      totalRounds,
      cumulativeReward: Number(tracker.cumulativeReward.toFixed(2)),
      averageReward: Number((tracker.cumulativeReward / totalRounds).toFixed(4)),
      cumulativeRegret: Number(tracker.cumulativeRegret.toFixed(2)),
      averageRegret: Number((tracker.cumulativeRegret / totalRounds).toFixed(4)),
      uniqueArtistsCount: uniqueArtists,
      artistDiversityRatio: Number((uniqueArtists / tracker.selectedArtists.length).toFixed(3)),
      trajectory: tracker.trajectory,
    };
  };

  const tsResult = formatResult("thompson");
  const egResult = formatResult("epsilonGreedy");
  const randResult = formatResult("random");
  const orResult = formatResult("oracle");

  const tsVsRandReward = randResult.cumulativeReward > 0
    ? ((tsResult.cumulativeReward - randResult.cumulativeReward) / randResult.cumulativeReward) * 100
    : 0;

  const tsVsEgReward = egResult.cumulativeReward > 0
    ? ((tsResult.cumulativeReward - egResult.cumulativeReward) / egResult.cumulativeReward) * 100
    : 0;

  const tsVsRandRegret = randResult.cumulativeRegret > 0
    ? ((randResult.cumulativeRegret - tsResult.cumulativeRegret) / randResult.cumulativeRegret) * 100
    : 0;

  return {
    userProfile,
    config: mergedConfig,
    results: {
      thompson: tsResult,
      epsilonGreedy: egResult,
      random: randResult,
      oracle: orResult,
    },
    summary: {
      thompsonVsRandomImprovement: Number(tsVsRandReward.toFixed(1)),
      thompsonVsEpsilonImprovement: Number(tsVsEgReward.toFixed(1)),
      thompsonRegretReductionVsRandom: Number(tsVsRandRegret.toFixed(1)),
    },
  };
}
