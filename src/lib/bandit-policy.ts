import type { TrackLike } from "./track-dedup";
import {
  detectTrackEnergy,
  calculateEnergyCompatibility,
  getTemporalContext,
  type TrackEnergy,
} from "./context-engine";
import {
  calculateTelemetryReward,
  type PlaybackTelemetryEvent,
} from "./telemetry";

export interface SessionContext {
  currentTrack?: TrackLike | null | undefined;
  hourOfDay?: number | undefined; // 0-23
  discoveryPercent?: number | undefined; // 0-100
  recentHistory?: TrackLike[] | undefined;
  stats?: Record<string, { plays?: number; skips?: number; completions?: number; track?: any }> | undefined;
  sessionCompletions?: number | undefined;
  sessionSkips?: number | undefined;
  familiarArtists?: Set<string> | undefined;
}

export interface BanditModelState {
  version: number;
  dimension: number;
  B: number[][]; // d x d precision matrix
  B_inv: number[][]; // d x d covariance/inverse matrix
  f: number[]; // d-dimensional accumulated reward vector
  mu: number[]; // d-dimensional estimated mean parameter vector
  totalUpdates: number;
  lastUpdated: number;
  [key: string]: unknown;
}

export interface RecommendationPolicy {
  selectNextTrack<T extends TrackLike>(candidates: T[], context: SessionContext): T | null;
  rankCandidates<T extends TrackLike>(candidates: T[], context: SessionContext): T[];
  recordFeedback(event: PlaybackTelemetryEvent, context?: SessionContext): void;
  getModelState(): BanditModelState;
  setModelState(state: BanditModelState): void;
}

const FEATURE_DIM = 6;
const BANDIT_STORAGE_KEY = "melodymap.bandit_state.v1";
const REGULARIZATION_LAMBDA = 1.0;
const EXPLORATION_VARIANCE_V = 0.5;

/** Box-Muller transform for standard Gaussian random variate N(0, 1) */
function standardNormal(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/** Cholesky decomposition for symmetric positive-definite matrix A = L L^T */
function choleskyDecomposition(A: number[][]): number[][] | null {
  const n = A.length;
  const L: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i]![k]! * L[j]![k]!;
      }
      if (i === j) {
        const val = A[i]![i]! - sum;
        if (val <= 1e-9) {
          // Add gentle jitter to maintain positive definiteness
          L[i]![j] = Math.sqrt(Math.max(1e-6, val + 1e-4));
        } else {
          L[i]![j] = Math.sqrt(val);
        }
      } else {
        const diag = L[j]![j]!;
        L[i]![j] = diag > 1e-9 ? (A[i]![j]! - sum) / diag : 0;
      }
    }
  }
  return L;
}

/** Inverts a positive-definite d x d matrix using Gauss-Jordan with partial pivoting */
function invertMatrix(matrix: number[][]): number[][] {
  const n = matrix.length;
  const A = matrix.map((row) => [...row]);
  const I: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1.0 : 0.0)),
  );

  for (let i = 0; i < n; i++) {
    let pivotRow = i;
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(A[r]![i]!) > Math.abs(A[pivotRow]![i]!)) {
        pivotRow = r;
      }
    }

    if (pivotRow !== i) {
      const tempA = A[i]!;
      A[i] = A[pivotRow]!;
      A[pivotRow] = tempA;

      const tempI = I[i]!;
      I[i] = I[pivotRow]!;
      I[pivotRow] = tempI;
    }

    const pivotVal = A[i]![i]!;
    const safePivot = Math.abs(pivotVal) < 1e-9 ? 1e-4 : pivotVal;

    for (let j = 0; j < n; j++) {
      A[i]![j] = A[i]![j]! / safePivot;
      I[i]![j] = I[i]![j]! / safePivot;
    }

    for (let r = 0; r < n; r++) {
      if (r !== i) {
        const factor = A[r]![i]!;
        for (let j = 0; j < n; j++) {
          A[r]![j] = A[r]![j]! - factor * A[i]![j]!;
          I[r]![j] = I[r]![j]! - factor * I[i]![j]!;
        }
      }
    }
  }

  return I;
}

/** Vector dot product */
function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i]! * b[i]!;
  }
  return sum;
}

/** Matrix-vector product M * v */
function matVecMul(M: number[][], v: number[]): number[] {
  return M.map((row) => dot(row, v));
}

const PRIOR_MU: number[] = [0.1, 0.5, 0.5, 0.5, 0.2, 0.3];

/**
 * Contextual Thompson Sampling Recommender Policy.
 * Learns user preferences dynamically via Bayesian linear regression without hand-crafted weight formulas.
 */
export class ThompsonSamplingPolicy implements RecommendationPolicy {
  private dimension = FEATURE_DIM;
  private B: number[][]; // Precision matrix
  private B_inv: number[][]; // Covariance matrix
  private f: number[]; // Reward-weighted feature sum
  private mu: number[]; // Estimated feature parameter mean
  private totalUpdates = 0;
  private lastUpdated = Date.now();

  constructor() {
    this.B = Array.from({ length: this.dimension }, (_, i) =>
      Array.from({ length: this.dimension }, (_, j) => (i === j ? REGULARIZATION_LAMBDA : 0.0)),
    );
    this.B_inv = Array.from({ length: this.dimension }, (_, i) =>
      Array.from({ length: this.dimension }, (_, j) => (i === j ? 1.0 / REGULARIZATION_LAMBDA : 0.0)),
    );
    this.f = PRIOR_MU.map((m) => m * REGULARIZATION_LAMBDA);
    this.mu = [...PRIOR_MU];

    this.loadFromStorage();
  }

  /**
   * Extract normalized 6-dimensional context feature vector x in [0, 1]^6 for candidate track.
   * x0: Intercept / base engagement
   * x1: Circadian alignment (behavioral temporal fit)
   * x2: Energy continuity flow from current track
   * x3: Artist historical affinity derived from raw completions and plays
   * x4: Discovery / Novelty preference
   * x5: Session state / momentum
   */
  public extractFeatureVector(candidate: TrackLike, context: SessionContext): number[] {
    const x: number[] = new Array(this.dimension);

    // x0: Intercept
    x[0] = 1.0;

    // x1: Circadian alignment
    const hour = context.hourOfDay ?? new Date().getHours();
    const tempCtx = getTemporalContext(hour);
    const candidateEnergy = detectTrackEnergy(candidate);
    let circadianScore = 0.5;
    if (tempCtx.energy === "gentle" || tempCtx.energy === "low") {
      circadianScore = candidateEnergy === "chill" ? 1.0 : candidateEnergy === "medium" ? 0.6 : 0.2;
    } else if (tempCtx.energy === "high") {
      circadianScore = candidateEnergy === "high" ? 1.0 : candidateEnergy === "medium" ? 0.7 : 0.3;
    } else {
      circadianScore = candidateEnergy === "medium" ? 0.9 : candidateEnergy === "chill" ? 0.6 : 0.6;
    }
    x[1] = Math.max(0.0, Math.min(1.0, circadianScore));

    // x2: Energy continuity flow from current playing track
    if (context.currentTrack) {
      const currentEnergy = detectTrackEnergy(context.currentTrack);
      const compat = calculateEnergyCompatibility(currentEnergy, candidateEnergy); // range: -0.30 to +0.30
      // Map [-0.30, 0.30] -> [0.0, 1.0]
      x[2] = Math.max(0.0, Math.min(1.0, (compat + 0.3) / 0.6));
    } else {
      x[2] = 0.5; // neutral when no current track
    }

    // x3: Artist historical affinity derived from raw behavior
    const artist = (candidate.artist || "").toLowerCase().trim();
    if (artist && context.stats) {
      let totalPlays = 0;
      let completions = 0;
      let skips = 0;

      for (const item of Object.values(context.stats)) {
        const itemArtist = (item.track?.artist || "").toLowerCase().trim();
        if (itemArtist === artist) {
          totalPlays += item.plays || 0;
          completions += item.completions || 0;
          skips += item.skips || 0;
        }
      }

      // Raw behavioral ratio: completions / (totalPlays + skips + 1)
      if (totalPlays > 0 || skips > 0) {
        const ratio = (completions * 1.5) / (totalPlays + skips + 1);
        x[3] = Math.max(0.0, Math.min(1.0, ratio));
      } else {
        x[3] = 0.3; // neutral prior for unplayed artist
      }
    } else {
      x[3] = 0.3;
    }

    // x4: Discovery / Novelty preference
    const discoveryRatio = (context.discoveryPercent ?? 40) / 100;
    const isFamiliar = context.familiarArtists
      ? context.familiarArtists.has(artist)
      : (x[3] ?? 0) > 0.4;
    // If user wants high discovery (ratio -> 1), unfamiliar artists get higher x4;
    // If user wants low discovery (ratio -> 0), familiar artists get higher x4
    const noveltyVal = isFamiliar ? 0.0 : 1.0;
    x[4] = Math.max(0.0, Math.min(1.0, noveltyVal * discoveryRatio + (1.0 - noveltyVal) * (1.0 - discoveryRatio)));

    // x5: Session state / momentum (recent completions ratio in session)
    const sessionComp = context.sessionCompletions ?? 0;
    const sessionSkips = context.sessionSkips ?? 0;
    const totalSessionActions = sessionComp + sessionSkips;
    x[5] = totalSessionActions > 0 ? sessionComp / (totalSessionActions + 1) : 0.5;

    return x;
  }

  /**
   * Sample parameter vector w* ~ N(mu, v^2 B^-1) via Cholesky decomposition.
   */
  public sampleWeights(varianceScale = EXPLORATION_VARIANCE_V): number[] {
    const L = choleskyDecomposition(this.B_inv);
    const z = Array.from({ length: this.dimension }, () => standardNormal());

    if (!L) {
      // Fallback: independent Gaussian noise around mean
      return this.mu.map((m, i) => m + varianceScale * Math.sqrt(Math.max(1e-4, this.B_inv[i]![i]!)) * z[i]!);
    }

    // w* = mu + v * L * z
    const Lz = matVecMul(L, z);
    return this.mu.map((m, i) => m + varianceScale * Lz[i]!);
  }

  /**
   * Rank candidate tracks descending by their Thompson-sampled expected reward.
   */
  public rankCandidates<T extends TrackLike>(candidates: T[], context: SessionContext): T[] {
    if (candidates.length <= 1) return candidates;

    // Draw parameter sample w* from posterior
    const sampledW = this.sampleWeights();

    const scored = candidates.map((track, originalIndex) => {
      const x = this.extractFeatureVector(track, context);
      const predictedReward = dot(sampledW, x);
      return { track, score: predictedReward, originalIndex };
    });

    // Sort descending by sampled score (exact ties randomly split)
    scored.sort((a, b) => {
      const diff = b.score - a.score;
      if (Math.abs(diff) > 1e-7) return diff;
      return Math.random() - 0.5;
    });
    return scored.map((s) => s.track);
  }

  /**
   * Select a single top candidate from candidate pool.
   */
  public selectNextTrack<T extends TrackLike>(candidates: T[], context: SessionContext): T | null {
    if (candidates.length === 0) return null;
    const ranked = this.rankCandidates(candidates, context);
    return ranked[0] ?? null;
  }

  /**
   * Online Bayesian update given a playback telemetry event.
   */
  public recordFeedback(event: PlaybackTelemetryEvent, context?: SessionContext): void {
    const reward = calculateTelemetryReward(event);
    if (reward === 0.0 && event.eventType === "PLAY_START") {
      return; // Neutral baseline
    }

    const dummyTrack: TrackLike = {
      id: event.trackId,
      title: event.title,
      artist: event.artist,
    };

    const ctx = context ?? {
      hourOfDay: event.context?.hourOfDay ?? new Date().getHours(),
      discoveryPercent: event.context?.discoverySetting ?? 40,
    };

    const x = this.extractFeatureVector(dummyTrack, ctx);

    // Online Bayesian Linear Regression:
    // B <- B + x * x^T
    // f <- f + r * x
    const n = this.dimension;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        this.B[i]![j] = this.B[i]![j]! + x[i]! * x[j]!;
      }
      this.f[i] = this.f[i]! + reward * x[i]!;
    }

    // Update B_inv and mu = B_inv * f
    this.B_inv = invertMatrix(this.B);
    this.mu = matVecMul(this.B_inv, this.f);

    this.totalUpdates += 1;
    this.lastUpdated = Date.now();

    this.saveToStorage();
  }

  public getModelState(): BanditModelState {
    return {
      version: 1,
      dimension: this.dimension,
      B: this.B.map((r) => [...r]),
      B_inv: this.B_inv.map((r) => [...r]),
      f: [...this.f],
      mu: [...this.mu],
      totalUpdates: this.totalUpdates,
      lastUpdated: this.lastUpdated,
    };
  }

  public setModelState(state: BanditModelState): void {
    if (!state || state.dimension !== this.dimension) return;
    this.B = state.B.map((r) => [...r]);
    this.B_inv = state.B_inv.map((r) => [...r]);
    this.f = [...state.f];
    this.mu = [...state.mu];
    this.totalUpdates = state.totalUpdates || 0;
    this.lastUpdated = state.lastUpdated || Date.now();
    this.saveToStorage();
  }

  public resetModel(): void {
    this.B = Array.from({ length: this.dimension }, (_, i) =>
      Array.from({ length: this.dimension }, (_, j) => (i === j ? REGULARIZATION_LAMBDA : 0.0)),
    );
    this.B_inv = Array.from({ length: this.dimension }, (_, i) =>
      Array.from({ length: this.dimension }, (_, j) => (i === j ? 1.0 / REGULARIZATION_LAMBDA : 0.0)),
    );
    this.f = PRIOR_MU.map((m) => m * REGULARIZATION_LAMBDA);
    this.mu = [...PRIOR_MU];
    this.totalUpdates = 0;
    this.lastUpdated = Date.now();
    this.saveToStorage();
  }

  /**
   * Benchmarks ranking execution time in milliseconds for N candidate tracks.
   */
  public benchmarkRanking(candidateCount = 50): { durationMs: number; count: number } {
    const dummyCandidates: TrackLike[] = Array.from({ length: candidateCount }, (_, i) => ({
      id: `test-track-${i}`,
      title: `Song ${i} Party Remix`,
      artist: `Artist ${i % 10}`,
    }));

    const dummyContext: SessionContext = {
      hourOfDay: 14,
      discoveryPercent: 40,
    };

    const start = typeof performance !== "undefined" ? performance.now() : Date.now();
    this.rankCandidates(dummyCandidates, dummyContext);
    const end = typeof performance !== "undefined" ? performance.now() : Date.now();

    return {
      durationMs: end - start,
      count: candidateCount,
    };
  }

  private loadFromStorage(): void {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(BANDIT_STORAGE_KEY);
      if (!raw) return;
      const state = JSON.parse(raw) as BanditModelState;
      if (state && state.dimension === this.dimension && Array.isArray(state.B)) {
        this.setModelState(state);
      }
    } catch {}
  }

  private saveToStorage(): void {
    if (typeof window === "undefined") return;
    try {
      const state = this.getModelState();
      localStorage.setItem(BANDIT_STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }
}

export const thompsonSamplingPolicy = new ThompsonSamplingPolicy();
