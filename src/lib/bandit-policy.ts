import type { TrackLike } from "./track-dedup";
import { normalizeArtistAlias, areSameTrack } from "./track-dedup";
import { safeStorage } from "./safe-storage";
import { getRecFlag, touchRecConfigChangedAt } from "./rec-flags";
import { getTrackLanguage } from "./language-artists";
import { getArtistRecentSkipHealth } from "./artist-recent";
import {
  detectTrackEnergy,
  calculateEnergyCompatibility,
  calculateMoodCompatibility,
  getTemporalContext,
  contextEngine,
  type TrackEnergy,
} from "./context-engine";
import {
  calculateTelemetryReward,
  type PlaybackTelemetryEvent,
} from "./telemetry";

export interface SessionContext {
  currentTrack?: TrackLike | null | undefined;
  predecessorTrack?: TrackLike | null | undefined;
  hourOfDay?: number | undefined; // 0-23
  discoveryPercent?: number | undefined; // 0-100
  recentHistory?: TrackLike[] | undefined;
  stats?: Record<string, { plays?: number; skips?: number; completions?: number; track?: any }> | undefined;
  sessionCompletions?: number | undefined;
  sessionSkips?: number | undefined;
  familiarArtists?: Set<string> | undefined;
  activeMood?: string | null | undefined;
  transitionAffinity?: number | ((from?: string, to?: string) => number) | undefined;
  downloadedTracks?: TrackLike[] | undefined;
  downloadedIds?: Set<string> | ReadonlySet<string> | undefined;
  likedTracks?: TrackLike[] | undefined;
  likedIds?: Set<string> | ReadonlySet<string> | undefined;
  dislikedTracks?: TrackLike[] | undefined;
  dislikedIds?: Set<string> | ReadonlySet<string> | undefined;
  penalizedArtists?: Set<string> | string[] | undefined;
  preferredLanguages?: string[] | undefined;
  primaryLanguage?: string | undefined;
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

export const FEATURE_DIM = 8;
export const BANDIT_STORAGE_KEY = "melodymap.bandit_state.v1";
export const BANDIT_BACKUP6_STORAGE_KEY = "melodymap.bandit_state.v1.backup6";
export const DISCOUNT_GAMMA_STORAGE_KEY = "melodymap.discount_gamma";
export const X5_RESET_KEY = "melodymap.rec_x5_reset_done.v1";
const REGULARIZATION_LAMBDA = 1.0;
const EXPLORATION_VARIANCE_V = 0.5;
/** Per-update forgetting factor. Effective memory is about 1/(1-γ) updates (0.99 -> ~100). */
export const DEFAULT_DISCOUNT_GAMMA = 0.99;
export const DISCOUNT_GAMMA = DEFAULT_DISCOUNT_GAMMA;

function initDiscountGamma(): number {
  if (typeof window === "undefined") return DEFAULT_DISCOUNT_GAMMA;
  try {
    const raw = safeStorage.getItem(DISCOUNT_GAMMA_STORAGE_KEY);
    if (raw) {
      const val = parseFloat(raw);
      if (!Number.isNaN(val) && val >= 0.5 && val <= 1.0) {
        return val;
      }
    }
  } catch {}
  return DEFAULT_DISCOUNT_GAMMA;
}

let activeDiscountGamma = initDiscountGamma();

export function setDiscountGamma(gamma: number): void {
  const clamped = Math.max(0.5, Math.min(1.0, gamma));
  if (clamped === activeDiscountGamma) return;
  activeDiscountGamma = clamped;
  if (typeof window !== "undefined") {
    try {
      safeStorage.setItem(DISCOUNT_GAMMA_STORAGE_KEY, String(activeDiscountGamma));
    } catch {}
  }
  touchRecConfigChangedAt();
}

export function getDiscountGamma(): number {
  return activeDiscountGamma;
}

/**
 * Swappable RNG source for the bandit's stochastic steps (posterior sampling and
 * exact-tie splitting). Defaults to Math.random() for production; offline
 * evaluation injects a seeded PRNG via setBanditRngSource() so simulations are
 * fully deterministic and CI never flakes.
 */
let rngSource: () => number = Math.random;
export function setBanditRngSource(rng: (() => number) | null): void {
  rngSource = rng ?? Math.random;
}

/** Box-Muller transform for standard Gaussian random variate N(0, 1) */
function standardNormal(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rngSource();
  while (v === 0) v = rngSource();
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

const PRIOR_MU: number[] = [0.1, 0.5, 0.5, 0.5, 0.2, 0.3, 0.3, 0.2];

/**
 * Strips post-event mutations and rewinds `currentTrack` to the predecessor track
 * so bandit training features match what the ranker evaluated before the event.
 */
export function buildTrainingContext(
  event: PlaybackTelemetryEvent,
  ctx: SessionContext
): SessionContext {
  const result: SessionContext = { ...ctx };

  // 1. Resolve predecessor track for currentTrack
  if (ctx.currentTrack && ctx.currentTrack.id === event.trackId) {
    if (ctx.predecessorTrack && ctx.predecessorTrack.id !== event.trackId) {
      result.currentTrack = ctx.predecessorTrack;
    } else if (ctx.recentHistory && ctx.recentHistory.length > 0) {
      const prev = ctx.recentHistory.find((t) => t.id && t.id !== event.trackId);
      result.currentTrack = prev ?? null;
    } else {
      result.currentTrack = null;
    }
  }

  // 2. Remove event track from liked sets if LIKED
  if (event.eventType === "LIKED") {
    if (result.likedIds) {
      const nextLiked = new Set(result.likedIds);
      nextLiked.delete(event.trackId);
      result.likedIds = nextLiked;
    }
    if (result.likedTracks) {
      result.likedTracks = result.likedTracks.filter((t) => t.id !== event.trackId);
    }
  }

  // 3. Remove event track from disliked sets if DISLIKED
  if (event.eventType === "DISLIKED") {
    if (result.dislikedIds) {
      const nextDisliked = new Set(result.dislikedIds);
      nextDisliked.delete(event.trackId);
      result.dislikedIds = nextDisliked;
    }
    if (result.dislikedTracks) {
      result.dislikedTracks = result.dislikedTracks.filter((t) => t.id !== event.trackId);
    }
  }

  // 4. Remove event track from downloaded sets if DOWNLOADED
  if (event.eventType === "DOWNLOADED") {
    if (result.downloadedIds) {
      const nextDownloaded = new Set(result.downloadedIds);
      nextDownloaded.delete(event.trackId);
      result.downloadedIds = nextDownloaded;
    }
    if (result.downloadedTracks) {
      result.downloadedTracks = result.downloadedTracks.filter((t) => t.id !== event.trackId);
    }
  }

  // 5. Clean event track's stats entry of this event's contribution
  if (result.stats && result.stats[event.trackId]) {
    const existing = result.stats[event.trackId];
    const newEntry = { ...existing };
    if (event.eventType === "COMPLETED") {
      newEntry.plays = Math.max(0, (newEntry.plays ?? 1) - 1);
      newEntry.completions = Math.max(0, (newEntry.completions ?? 1) - 1);
    } else if (event.eventType === "SKIPPED") {
      newEntry.skips = Math.max(0, (newEntry.skips ?? 1) - 1);
    }
    result.stats = {
      ...result.stats,
      [event.trackId]: newEntry,
    };
  }

  return result;
}

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
  private trainedEventIds = new Set<string>();

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

    // x1: Circadian & Mood Anchor Alignment
    const candidateEnergy = detectTrackEnergy(candidate);
    let alignmentScore: number;

    if (context.activeMood) {
      // Anchored Mood Locking: evaluate candidate against chosen mood envelope
      const candidateText = `${candidate.title || ""} ${candidate.artist || ""}`;
      alignmentScore = calculateMoodCompatibility(context.activeMood, candidateEnergy, candidateText);
    } else {
      // Circadian alignment fallback
      const hour = context.hourOfDay ?? new Date().getHours();
      const tempCtx = getTemporalContext(hour);
      if (tempCtx.energy === "gentle" || tempCtx.energy === "low") {
        alignmentScore = candidateEnergy === "chill" ? 1.0 : candidateEnergy === "medium" ? 0.6 : 0.2;
      } else if (tempCtx.energy === "high") {
        alignmentScore = candidateEnergy === "high" ? 1.0 : candidateEnergy === "medium" ? 0.7 : 0.3;
      } else {
        alignmentScore = candidateEnergy === "medium" ? 0.9 : 0.6;
      }
    }
    x[1] = Math.max(0.0, Math.min(1.0, alignmentScore));

    // x2: Energy continuity flow & Markov sequence transition affinity
    if (context.currentTrack) {
      const currentEnergy = detectTrackEnergy(context.currentTrack);
      const compat = calculateEnergyCompatibility(currentEnergy, candidateEnergy); // range: -0.30 to +0.30
      // Map [-0.30, 0.30] -> [0.0, 1.0]
      const energyScore = Math.max(0.0, Math.min(1.0, (compat + 0.3) / 0.6));

      // Markov sequence transition affinity
      let transScore = 0.5;
      if (typeof context.transitionAffinity === "function") {
        transScore = context.transitionAffinity(context.currentTrack.artist, candidate.artist);
      } else if (typeof context.transitionAffinity === "number") {
        transScore = context.transitionAffinity;
      } else if (contextEngine) {
        transScore = contextEngine.getTransitionAffinity(context.currentTrack.artist, candidate.artist);
      }

      // Blend energy continuity (60%) and Markov transition (40%)
      x[2] = Math.max(0.0, Math.min(1.0, 0.6 * energyScore + 0.4 * transScore));
    } else {
      x[2] = 0.5; // neutral when no current track
    }

    // x3: User Taste & Artist historical affinity derived from behavior, likes, downloads & penalties
    const rawArtist = (candidate.artist || "").trim();
    const normArtist = normalizeArtistAlias(rawArtist);
    const candidateId = candidate.id || "";

    // Check strict dislike penalty
    const isDisliked = context.dislikedIds?.has(candidateId) ||
      (context.dislikedTracks && context.dislikedTracks.some((d) => areSameTrack(d, candidate)));
    const isPenalized = context.penalizedArtists && (
      context.penalizedArtists instanceof Set
        ? context.penalizedArtists.has(normArtist) || context.penalizedArtists.has(rawArtist.toLowerCase())
        : Array.isArray(context.penalizedArtists) && context.penalizedArtists.some((p) => normalizeArtistAlias(p) === normArtist)
    );

    if (isDisliked || isPenalized) {
      x[3] = 0.02; // Severely penalized: strong negative preference
    } else {
      // Check liked and downloaded status for artist affinity boost
      const isLikedArtist = context.likedTracks
        ? context.likedTracks.some((l) => normalizeArtistAlias(l.artist) === normArtist)
        : false;
      const isDownloadedArtist = context.downloadedTracks
        ? context.downloadedTracks.some((d) => normalizeArtistAlias(d.artist) === normArtist)
        : false;

      let totalPlays = 0;
      let completions = 0;
      let skips = 0;
      let replays = 0;

      if (context.stats) {
        for (const item of Object.values(context.stats)) {
          const itemNormArtist = normalizeArtistAlias(item.track?.artist);
          if (itemNormArtist === normArtist) {
            const ply = item.plays || 0;
            const comp = item.completions || 0;
            const skp = item.skips || 0;
            totalPlays += ply;
            completions += comp;
            skips += skp;
            // A replay is a repeated completed or successful play, never an early skip
            const successfulPlays = Math.max(comp, Math.max(0, ply - skp));
            if (successfulPlays > 1) {
              replays += (successfulPlays - 1);
            }
          }
        }
      }

      if (totalPlays > 0 || skips > 0) {
        // Behavioral affinity incorporating completions, replays, likes, downloads and skips
        const positiveMass = completions * 1.5 + replays * 2.0 + (isLikedArtist ? 1.0 : 0) + (isDownloadedArtist ? 1.5 : 0);
        const negativeMass = totalPlays + skips * 2.0 + 1;
        const ratio = positiveMass / negativeMass;
        // If the artist has repeated skips and zero completions, damp ratio heavily
        const skipDampening = (skips >= 2 && completions === 0) ? Math.max(0.01, 1.0 / (skips + 1)) : 1.0;
        x[3] = Math.max(0.0, Math.min(1.0, ratio * skipDampening));
      } else if (isDownloadedArtist) {
        x[3] = 0.75; // Downloaded artist prior: strong positive
      } else if (isLikedArtist) {
        x[3] = 0.70; // Liked artist prior: strong positive
      } else {
        x[3] = 0.35; // Neutral unplayed prior
      }
    }

    // x4: Discovery / Novelty preference
    const discoveryRatio = (context.discoveryPercent ?? 40) / 100;
    const isFamiliar = context.familiarArtists
      ? context.familiarArtists.has(normArtist) || context.familiarArtists.has(rawArtist.toLowerCase())
      : (x[3] ?? 0) > 0.45;
    // If user wants high discovery (ratio -> 1), unfamiliar artists get higher x4;
    // If user wants low discovery (ratio -> 0), familiar artists get higher x4
    const noveltyVal = isFamiliar ? 0.0 : 1.0;
    x[4] = Math.max(0.0, Math.min(1.0, noveltyVal * discoveryRatio + (1.0 - noveltyVal) * (1.0 - discoveryRatio)));

    const sessionComp = context.sessionCompletions ?? 0;
    const sessionSkips = context.sessionSkips ?? 0;
    const totalSessionActions = sessionComp + sessionSkips;
    const momentum = totalSessionActions > 0 ? sessionComp / (totalSessionActions + 1) : 0.5;

    // x5: Language coherence
    if (getRecFlag("languageFeature")) {
      this.checkLanguageFeatureCoordinateReset();
      let langScore = 1.0;
      if (context.preferredLanguages && context.preferredLanguages.length > 0) {
        const detected = getTrackLanguage(candidate);
        if (!detected) {
          langScore = 0.5;
        } else {
          const prefMatch = context.preferredLanguages.some(
            (pl) => pl.toLowerCase().trim() === detected.toLowerCase().trim(),
          );
          const primaryMatch =
            context.primaryLanguage &&
            context.primaryLanguage.toLowerCase().trim() === detected.toLowerCase().trim();
          langScore = prefMatch || primaryMatch ? 1.0 : 0.05;
        }
      }
      x[5] = langScore;
    } else {
      // Flags OFF formula: 0.7 * momentum + 0.3 * langCoherence
      let langCoherence = 1.0;
      if (context.preferredLanguages && context.preferredLanguages.length > 0) {
        const candidateLang = (
          (candidate as any).language ||
          (candidate as any).languageCode ||
          ""
        ).toLowerCase().trim();
        if (candidateLang) {
          const matches = context.preferredLanguages.some(
            (pl) => pl.toLowerCase().trim() === candidateLang,
          );
          langCoherence = matches ? 1.0 : 0.25;
        }
      }
      x[5] = Math.max(0.0, Math.min(1.0, 0.7 * momentum + 0.3 * langCoherence));
    }

    // x6: Artist recent skip health
    if (getRecFlag("artistRecentSkipFeature")) {
      x[6] = getArtistRecentSkipHealth(candidate.artist);
    } else {
      x[6] = 0.0;
    }

    // x7: Novelty-momentum interaction
    if (getRecFlag("noveltyMomentumFeature")) {
      const isUnfamiliar = isFamiliar ? 0.0 : 1.0;
      x[7] = Math.max(0.0, Math.min(1.0, isUnfamiliar * momentum));
    } else {
      x[7] = 0.0;
    }

    return x;
  }

  /**
   * Sample parameter vector w* ~ N(mu, v^2 B^-1) via Cholesky decomposition.
   * Dimensions whose feature flag is OFF are not sampled (set to 0.0) so the draw
   * order and RNG variates remain 100% identical to main for the first 6 dimensions.
   */
  public sampleWeights(varianceScale = EXPLORATION_VARIANCE_V): number[] {
    const L = choleskyDecomposition(this.B_inv);
    const z = new Array<number>(this.dimension);

    // First 6 dimensions (0..5) are always active, matching main
    for (let i = 0; i < 6; i++) {
      z[i] = standardNormal();
    }

    // Coordinate 6 is active only when artistRecentSkipFeature is on
    z[6] = getRecFlag("artistRecentSkipFeature") ? standardNormal() : 0.0;

    // Coordinate 7 is active only when noveltyMomentumFeature is on
    z[7] = getRecFlag("noveltyMomentumFeature") ? standardNormal() : 0.0;

    if (!L) {
      // Fallback: independent Gaussian noise around mean
      return this.mu.map((m, i) => m + varianceScale * Math.sqrt(Math.max(1e-4, this.B_inv[i]![i]!)) * z[i]!);
    }

    // w* = mu + v * L * z
    const Lz = matVecMul(L, z);
    return this.mu.map((m, i) => m + varianceScale * Lz[i]!);
  }

  /**
   * Rank candidate tracks descending by their Thompson-sampled expected reward,
   * returning each candidate paired with its sampled score.
   */
  public rankCandidatesWithScores<T extends TrackLike>(
    candidates: T[],
    context: SessionContext,
  ): { track: T; score: number }[] {
    if (candidates.length === 0) return [];
    if (candidates.length === 1) return [{ track: candidates[0]!, score: 0 }];

    // Draw single parameter sample w* from posterior
    const sampledW = this.sampleWeights();

    const scored = candidates.map((track, originalIndex) => {
      const x = this.extractFeatureVector(track, context);
      const predictedReward = dot(sampledW, x);
      return { track, score: predictedReward, originalIndex };
    });

    // Sort descending by sampled score (exact ties split via the RNG source)
    scored.sort((a, b) => {
      const diff = b.score - a.score;
      if (Math.abs(diff) > 1e-7) return diff;
      return rngSource() - 0.5;
    });

    return scored.map((s) => ({ track: s.track, score: s.score }));
  }

  /**
   * Rank candidate tracks descending by their Thompson-sampled expected reward.
   */
  public rankCandidates<T extends TrackLike>(candidates: T[], context: SessionContext): T[] {
    return this.rankCandidatesWithScores(candidates, context).map((s) => s.track);
  }

  /**

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
   * Ensures deliberate terminal actions update the model and prevents
   * duplicate events from training multiple times.
   */
  public recordFeedback(event: PlaybackTelemetryEvent, context?: SessionContext): void {
    if (!event || !event.eventType) return;

    // Prevent duplicate event training
    if (event.id) {
      if (this.trainedEventIds.has(event.id)) {
        return;
      }
      this.trainedEventIds.add(event.id);
      if (this.trainedEventIds.size > 1000) {
        // Evict oldest entries
        const iterator = this.trainedEventIds.values();
        for (let i = 0; i < 200; i++) {
          const val = iterator.next().value;
          if (val) this.trainedEventIds.delete(val);
        }
      }
    }

    // Progress milestones are telemetry observation points; only terminal/deliberate actions update LinTS
    const terminalEventTypes = new Set([
      "COMPLETED",
      "SKIPPED",
      "LIKED",
      "DISLIKED",
      "REPLAYED",
      "ADDED_TO_LIBRARY",
      "DOWNLOADED",
    ]);
    if (!terminalEventTypes.has(event.eventType)) {
      return;
    }

    const reward = calculateTelemetryReward(event);
    if (reward === 0.0) {
      return;
    }

    const dummyTrack: TrackLike = {
      id: event.trackId,
      title: event.title,
      artist: event.artist,
    };

    const rawCtx = context ?? {
      hourOfDay: event.context?.hourOfDay ?? new Date().getHours(),
      discoveryPercent: event.context?.discoverySetting ?? 40,
    };

    const ctx = getRecFlag("leakFreeTrainingContext")
      ? buildTrainingContext(event, rawCtx)
      : rawCtx;

    // stats holds the full Track (language, album, ...). The stub only has id/title/artist.
    const useFullTrack = getRecFlag("trainOnFullTrack");
    const fullTrack = useFullTrack
      ? (ctx.stats?.[event.trackId]?.track as TrackLike | undefined)
      : undefined;
    const x = this.extractFeatureVector(fullTrack ?? dummyTrack, ctx);

    // Discounted Bayesian linear regression, decaying toward the prior (not toward zero):
    // B <- γB + (1-γ)λI + x x^T      f <- γf + (1-γ)λμ0 + r x
    // With no data this is a fixed point, and B stays >= λI, so it is always invertible.
    const n = this.dimension;
    const g = activeDiscountGamma;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const prior = i === j ? REGULARIZATION_LAMBDA : 0.0;
        this.B[i]![j] = g * this.B[i]![j]! + (1 - g) * prior + x[i]! * x[j]!;
      }
      this.f[i] =
        g * this.f[i]! + (1 - g) * REGULARIZATION_LAMBDA * PRIOR_MU[i]! + reward * x[i]!;
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
      version: 2,
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
    if (!state || !Array.isArray(state.B)) return;

    // Dimension 6 -> 8 migration:
    if (state.dimension === 6) {
      try {
        const existingBackup = safeStorage.getItem(BANDIT_BACKUP6_STORAGE_KEY);
        if (!existingBackup) {
          safeStorage.setItem(BANDIT_BACKUP6_STORAGE_KEY, JSON.stringify(state));
        }
      } catch {}

      const migratedB: number[][] = Array.from({ length: FEATURE_DIM }, (_, i) =>
        Array.from({ length: FEATURE_DIM }, (_, j) => {
          if (i < 6 && j < 6) return state.B[i]?.[j] ?? (i === j ? REGULARIZATION_LAMBDA : 0.0);
          return i === j ? REGULARIZATION_LAMBDA : 0.0;
        }),
      );
      const migratedF: number[] = Array.from({ length: FEATURE_DIM }, (_, i) => {
        if (i < 6) return state.f[i] ?? REGULARIZATION_LAMBDA * PRIOR_MU[i]!;
        return REGULARIZATION_LAMBDA * PRIOR_MU[i]!;
      });
      const migratedB_inv = invertMatrix(migratedB);
      const migratedMu = matVecMul(migratedB_inv, migratedF);

      this.dimension = FEATURE_DIM;
      this.B = migratedB;
      this.B_inv = migratedB_inv;
      this.f = migratedF;
      this.mu = migratedMu;
      this.totalUpdates = state.totalUpdates || 0;
      this.lastUpdated = state.lastUpdated || Date.now();
      this.saveToStorage();
      return;
    }

    if (state.dimension !== this.dimension) return;
    this.B = state.B.map((r) => [...r]);
    this.B_inv = state.B_inv.map((r) => [...r]);
    this.f = [...state.f];
    this.mu = [...state.mu];
    this.totalUpdates = state.totalUpdates || 0;
    this.lastUpdated = state.lastUpdated || Date.now();
    this.saveToStorage();
  }

  public checkLanguageFeatureCoordinateReset(): void {
    if (!getRecFlag("languageFeature")) return;
    try {
      const marker = safeStorage.getItem(X5_RESET_KEY);
      if (marker === "true") return;
    } catch {}

    for (let j = 0; j < this.dimension; j++) {
      this.B[5]![j] = j === 5 ? REGULARIZATION_LAMBDA : 0.0;
      this.B[j]![5] = j === 5 ? REGULARIZATION_LAMBDA : 0.0;
    }
    this.f[5] = REGULARIZATION_LAMBDA * PRIOR_MU[5]!;
    this.B_inv = invertMatrix(this.B);
    this.mu = matVecMul(this.B_inv, this.f);
    this.saveToStorage();
    try {
      safeStorage.setItem(X5_RESET_KEY, "true");
    } catch {}
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

  public loadFromStorage(force = false): void {
    if (typeof window === "undefined" && !force) return;
    try {
      const raw = safeStorage.getItem(BANDIT_STORAGE_KEY);
      if (!raw) return;
      const state = JSON.parse(raw) as BanditModelState;
      if (state && (state.dimension === this.dimension || state.dimension === 6) && Array.isArray(state.B)) {
        if (state.dimension === 6) {
          try {
            const existingBackup = safeStorage.getItem(BANDIT_BACKUP6_STORAGE_KEY);
            if (!existingBackup) {
              safeStorage.setItem(BANDIT_BACKUP6_STORAGE_KEY, raw);
            }
          } catch {}
        }
        this.setModelState(state);
      }
      if (getRecFlag("languageFeature")) {
        this.checkLanguageFeatureCoordinateReset();
      }
    } catch {}
  }

  public saveToStorage(force = false): void {
    if (typeof window === "undefined" && !force) return;
    try {
      const state = this.getModelState();
      safeStorage.setItem(BANDIT_STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }
}

export const thompsonSamplingPolicy = new ThompsonSamplingPolicy();

/**
 * Restores the raw pre-migration 6-dimension bandit model state from the backup
 * storage key into the active bandit model storage key.
 * Returns the exact original 6-dimension state, or null if no backup exists.
 */
export function restoreBackup6(): BanditModelState | null {
  try {
    const raw = safeStorage.getItem(BANDIT_BACKUP6_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BanditModelState;
    if (!parsed || !Array.isArray(parsed.B)) return null;
    safeStorage.setItem(BANDIT_STORAGE_KEY, raw);
    try {
      safeStorage.removeItem(X5_RESET_KEY);
    } catch {}
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Sort candidates by score, using movie/soundtrack album presence as a tie-breaker
 * ONLY for candidates whose scores are within 10% of the batch's score range.
 */
export function sortByScoreWithMovieTieBreaker<T extends TrackLike>(
  scored: { track: T; score: number }[],
  isMovieFn: (track: T) => boolean,
): T[] {
  if (scored.length <= 1) return scored.map((s) => s.track);

  let minScore = Infinity;
  let maxScore = -Infinity;
  for (const s of scored) {
    if (s.score < minScore) minScore = s.score;
    if (s.score > maxScore) maxScore = s.score;
  }
  const scoreRange = maxScore - minScore;
  const threshold = scoreRange > 1e-7 ? 0.1 * scoreRange : 0;

  const withBoost = scored.map((item) => {
    const isMovie = isMovieFn(item.track);
    return {
      ...item,
      isMovie,
      effectiveScore: item.score + (isMovie ? threshold : 0),
    };
  });

  withBoost.sort((a, b) => {
    const diff = b.effectiveScore - a.effectiveScore;
    if (Math.abs(diff) > 1e-7) return diff;
    if (a.isMovie !== b.isMovie) return a.isMovie ? -1 : 1;
    return b.score - a.score;
  });

  return withBoost.map((item) => item.track);
}
