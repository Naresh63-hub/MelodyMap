import type { TrackLike } from "./track-dedup";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";
export type TrackEnergy = "chill" | "medium" | "high";

export interface TemporalContext {
  timeOfDay: TimeOfDay;
  label: string;
  energy: "gentle" | "medium" | "high" | "low";
  suggestedMoods: string[];
  suggestedGenres: string[];
  promptContext: string;
  queryThemes: string[];
}

/**
 * Determine the temporal listening context based on the current hour.
 */
export function getTemporalContext(nowOrHour: Date | number = new Date()): TemporalContext {
  const hour = typeof nowOrHour === "number" ? Math.max(0, Math.min(23, Math.floor(nowOrHour))) : nowOrHour.getHours();

  if (hour >= 5 && hour < 12) {
    return {
      timeOfDay: "morning",
      label: "Morning Awakening",
      energy: "gentle",
      suggestedMoods: ["Chill", "Acoustic", "Feel Good", "Upbeat", "Devotional"],
      suggestedGenres: ["Acoustic", "Indie Pop", "Morning Lo-Fi", "Classical", "Pop", "Melody"],
      promptContext: "Morning session: prioritize fresh morning acoustic melodies, uplifting feel-good tunes, and positive vibes to start the day.",
      queryThemes: ["morning acoustic melodies", "fresh feel good acoustic hits", "positive morning songs", "peaceful unplugged hits"],
    };
  }
  if (hour >= 12 && hour < 17) {
    return {
      timeOfDay: "afternoon",
      label: "Afternoon Focus & Energy",
      energy: "high",
      suggestedMoods: ["Focus", "Energizing", "Workout", "Pop Hits"],
      suggestedGenres: ["Deep House", "Lo-Fi Beats", "Pop", "Synthwave", "Rock", "Upbeat"],
      promptContext: "Afternoon session: prioritize steady-tempo focus tracks, modern pop hits, and energizing mid-to-high tempo songs.",
      queryThemes: ["popular trending chart hits", "upbeat workday hits", "afternoon energetic pop", "driving rhythm songs"],
    };
  }
  if (hour >= 17 && hour < 22) {
    return {
      timeOfDay: "evening",
      label: "Evening Unwind",
      energy: "medium",
      suggestedMoods: ["Chill", "Party", "Romance", "Sunset", "Mass"],
      suggestedGenres: ["R&B", "Indie Rock", "Pop Hits", "Electronic", "Hip Hop", "Dance"],
      promptContext: "Evening session: prioritize popular chartbusters, party beats, commute anthems, and lively melodic hits.",
      queryThemes: ["evening party hits", "trending chartbuster songs", "viral dance party hits", "top evening melodies"],
    };
  }
  return {
    timeOfDay: "night",
    label: "Late Night Deep Dive",
    energy: "low",
    suggestedMoods: ["Sleep", "Midnight Chill", "Ambient", "Melancholy", "Slowed"],
    suggestedGenres: ["Ambient", "Slow R&B", "Night Lo-Fi", "Acoustic", "Dream Pop", "Evergreen"],
    promptContext: "Late night session: prioritize late-night lo-fi, mellow acoustic ballads, nostalgic evergreen classics, and soothing slow melodies.",
    queryThemes: ["late night lofi acoustic songs", "slowed reverb midnight hits", "all time golden evergreen classics", "soulful soothing melodies"],
  };
}

// ─── Track Energy Detection ──────────────────────────────────────────

const CHILL_KEYWORDS = [
  "lo-fi", "lofi", "chill", "slow", "slowed", "acoustic", "unplugged", "sad",
  "sleep", "ambient", "piano", "peaceful", "calm", "soft", "midnight", "rain",
  "relax", "melody", "ballad", "soulful", "meditation", "gentle", "classical"
];

const HIGH_ENERGY_KEYWORDS = [
  "mass", "party", "dance", "remix", "edm", "dj", "club", "drill", "trap",
  "metal", "workout", "energetic", "bass boost", "beat", "rock", "hip hop",
  "banger", "fast", "hype", "drop", "celebration", "electronic", "anthem"
];

/**
 * Classify a track's vibe into chill, medium, or high energy based on title and metadata keywords.
 */
export function detectTrackEnergy(track: Partial<TrackLike> | { title?: string; artist?: string }): TrackEnergy {
  const text = `${track.title || ""} ${track.artist || ""}`.toLowerCase();

  let chillScore = 0;
  for (const kw of CHILL_KEYWORDS) {
    if (text.includes(kw)) chillScore += 1;
  }

  let highEnergyScore = 0;
  for (const kw of HIGH_ENERGY_KEYWORDS) {
    if (text.includes(kw)) highEnergyScore += 1;
  }

  if (highEnergyScore > chillScore && highEnergyScore >= 1) return "high";
  if (chillScore > highEnergyScore && chillScore >= 1) return "chill";
  return "medium";
}

/**
 * Computes energy flow bonus/penalty between the previous song and a candidate song (AutoDJ continuity).
 */
export function calculateEnergyCompatibility(
  currentEnergy: TrackEnergy | undefined,
  candidateEnergy: TrackEnergy,
): number {
  if (!currentEnergy) return 0.15;
  if (currentEnergy === candidateEnergy) return 0.30; // Perfect match

  // Adjacent transitions
  if (
    (currentEnergy === "chill" && candidateEnergy === "medium") ||
    (currentEnergy === "medium" && candidateEnergy === "chill") ||
    (currentEnergy === "medium" && candidateEnergy === "high") ||
    (currentEnergy === "high" && candidateEnergy === "medium")
  ) {
    return 0.15;
  }

  // Jarring leap between extreme chill and high energy
  return -0.30;
}

// ─── Mood Envelope Anchoring ──────────────────────────────────────

export interface MoodEnvelope {
  targetEnergy: TrackEnergy[];
  keywords: string[];
  queryThemes: string[];
}

export const MOOD_ENVELOPES: Record<string, MoodEnvelope> = {
  chill: {
    targetEnergy: ["chill"],
    keywords: ["chill", "lo-fi", "lofi", "acoustic", "relax", "calm", "soft", "peaceful", "unplugged", "ambient", "mellow"],
    queryThemes: ["acoustic chill melodies", "peaceful lofi songs", "soft acoustic unplugged hits"],
  },
  romantic: {
    targetEnergy: ["chill", "medium"],
    keywords: ["love", "romantic", "heart", "melody", "soul", "duet", "kadhal", "prema", "pyaar", "ishq", "priya"],
    queryThemes: ["romantic love melodies", "heart touching duet songs", "sweet romantic chartbusters"],
  },
  workout: {
    targetEnergy: ["high"],
    keywords: ["workout", "gym", "energetic", "motivation", "hype", "banger", "fast", "drill", "trap", "bass", "power"],
    queryThemes: ["high energy workout gym beats", "powerful motivation tracks", "fast pace hype songs"],
  },
  "upbeat workout": {
    targetEnergy: ["high"],
    keywords: ["workout", "gym", "energetic", "motivation", "hype", "banger", "fast", "drill", "trap", "bass", "power"],
    queryThemes: ["high energy workout gym beats", "powerful motivation tracks", "fast pace hype songs"],
  },
  party: {
    targetEnergy: ["high"],
    keywords: ["party", "dance", "remix", "club", "dj", "edm", "banger", "celebration", "electronic", "mass", "bhangra"],
    queryThemes: ["club dance party hits", "trending edm dance remixes", "mass banger party tracks"],
  },
  "sad hours": {
    targetEnergy: ["chill"],
    keywords: ["sad", "broken", "pain", "melancholy", "tears", "alone", "slow", "cry", "heartbreak", "dard"],
    queryThemes: ["sad emotional heartbreak songs", "deep soulful pain melodies", "slow melancholy songs"],
  },
  sad: {
    targetEnergy: ["chill"],
    keywords: ["sad", "broken", "pain", "melancholy", "tears", "alone", "slow", "cry", "heartbreak", "dard"],
    queryThemes: ["sad emotional heartbreak songs", "deep soulful pain melodies", "slow melancholy songs"],
  },
  focus: {
    targetEnergy: ["chill", "medium"],
    keywords: ["focus", "study", "instrumental", "ambient", "piano", "lo-fi", "lofi", "meditation", "calm", "peace"],
    queryThemes: ["deep focus instrumental study beats", "ambient piano melodies", "peaceful calm background music"],
  },
  "late night": {
    targetEnergy: ["chill"],
    keywords: ["night", "midnight", "slowed", "reverb", "moon", "drive", "dark", "deep", "sleep", "soothing"],
    queryThemes: ["late night slowed reverb hits", "midnight drive calm songs", "peaceful sleep ambient music"],
  },
  devotional: {
    targetEnergy: ["chill", "medium"],
    keywords: ["bhakti", "bhajan", "devotional", "prayer", "spiritual", "peace", "temple", "divine", "god", "aarti", "mantra", "shloka"],
    queryThemes: ["peaceful bhakti bhajans", "soulful spiritual prayers", "divine temple devotional songs"],
  },
};

/**
 * Computes compatibility score in [0.0, 1.0] between an active mood anchor and a candidate track.
 */
export function calculateMoodCompatibility(
  activeMood: string,
  candidateEnergy: TrackEnergy,
  candidateText = "",
): number {
  const normMood = activeMood.toLowerCase().trim();
  const envelope = MOOD_ENVELOPES[normMood];
  if (!envelope) return 0.5;

  let energyScore = 0.5;
  if (envelope.targetEnergy.includes(candidateEnergy)) {
    energyScore = 0.85;
  } else if (
    (envelope.targetEnergy.includes("chill") && candidateEnergy === "high") ||
    (envelope.targetEnergy.includes("high") && candidateEnergy === "chill")
  ) {
    energyScore = 0.15; // Severe energy mismatch with mood anchor
  } else {
    energyScore = 0.55; // Adjacent / medium energy
  }

  const text = candidateText.toLowerCase();
  let keywordBonus = 0;
  for (const kw of envelope.keywords) {
    if (text.includes(kw)) {
      keywordBonus += 0.15;
      break;
    }
  }

  return Math.max(0.0, Math.min(1.0, energyScore + keywordBonus));
}

// ─── Session Feedback & Penalty Learner ────────────────────────────

interface SkipRecord {
  artist: string;
  title: string;
  timestamp: number;
}

interface CompletionRecord {
  artist: string;
  title: string;
  timestamp: number;
}

export interface AffinityAnalysis {
  affinityArtists: string[];
  penalizedArtists: string[];
  artistScores: Record<string, number>;
}

const STORAGE_KEY = "melodymap.context_engine.v1";

export class ContextEngineSession {
  private skips: SkipRecord[] = [];
  private completions: CompletionRecord[] = [];
  private transitionMatrix = new Map<string, Map<string, number>>();
  private sessionPenalizedArtists = new Set<string>();

  constructor() {
    this.loadFromStorage();
  }

  /** Load learned state from localStorage */
  loadFromStorage(): void {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data.skips)) this.skips = data.skips.slice(-50);
      if (Array.isArray(data.completions)) this.completions = data.completions.slice(-50);
      if (data.transitions && typeof data.transitions === "object") {
        this.transitionMatrix.clear();
        for (const [fromArtist, toMap] of Object.entries(data.transitions)) {
          if (toMap && typeof toMap === "object") {
            const row = new Map<string, number>();
            for (const [toArtist, count] of Object.entries(toMap as Record<string, number>)) {
              row.set(toArtist, Number(count) || 1);
            }
            this.transitionMatrix.set(fromArtist, row);
          }
        }
      }
    } catch (err) {
      console.warn("[contextEngine] Failed to restore state:", err);
    }
  }

  /** Save learned state to localStorage */
  saveToStorage(): void {
    if (typeof window === "undefined") return;
    try {
      const transitionsObj: Record<string, Record<string, number>> = {};
      for (const [fromArtist, toMap] of this.transitionMatrix.entries()) {
        transitionsObj[fromArtist] = Object.fromEntries(toMap.entries());
      }
      const data = {
        skips: this.skips.slice(-50),
        completions: this.completions.slice(-50),
        transitions: transitionsObj,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }

  /**
   * Record when a user skips a track early (< 25s).
   * If skipped within 10 seconds, immediately dampens the artist for the active session.
   */
  recordSkip(track: TrackLike, positionSeconds?: number) {
    if (!track.artist) return;
    const rawArtist = track.artist.trim();
    const normArtist = rawArtist.toLowerCase();

    // Fast-skip (< 10s): immediate intra-session negative dampening
    if (positionSeconds !== undefined && positionSeconds >= 0 && positionSeconds < 10) {
      if (normArtist) {
        this.sessionPenalizedArtists.add(normArtist);
      }
    }

    this.skips.push({
      artist: rawArtist,
      title: (track.title || "").trim(),
      timestamp: Date.now(),
    });
    if (this.skips.length > 50) this.skips.shift();
    this.saveToStorage();
  }

  /**
   * Immediately dampens an artist for this active session (user skipped within 8-10 seconds).
   */
  recordFastSkip(track: TrackLike) {
    if (!track.artist) return;
    const norm = track.artist.toLowerCase().trim();
    if (norm) {
      this.sessionPenalizedArtists.add(norm);
    }
    this.recordSkip(track, 5);
  }

  /**
   * Returns list of artists penalized in the current in-memory listening session.
   */
  getSessionPenalizedArtists(): string[] {
    return Array.from(this.sessionPenalizedArtists);
  }

  /**
   * Clear in-memory session-only penalties (e.g. on new session or manual reset).
   */
  clearSessionPenalties(): void {
    this.sessionPenalizedArtists.clear();
  }

  /**
   * Returns the Markov sequence transition affinity between two artists in [0.0, 1.0].
   * If fromArtist and toArtist frequently transition after each other in completions,
   * returns a boosted score (> 0.5). If no data, returns a neutral prior (0.5).
   */
  getTransitionAffinity(fromArtist?: string | null, toArtist?: string | null): number {
    if (!fromArtist || !toArtist) return 0.5;
    const from = fromArtist.toLowerCase().trim();
    const to = toArtist.toLowerCase().trim();
    if (!from || !to) return 0.5;

    const row = this.transitionMatrix.get(from);
    if (!row || row.size === 0) return 0.5;

    let totalTransitions = 0;
    for (const count of row.values()) {
      totalTransitions += count;
    }
    if (totalTransitions === 0) return 0.5;

    const count = row.get(to) || 0;
    if (count > 0) {
      const prob = count / totalTransitions;
      // High transition likelihood maps to [0.65, 1.0]
      return Math.min(1.0, 0.65 + prob * 0.35);
    }

    // Has recorded transitions from `from`, but none to `to`
    return 0.4;
  }

  /**
   * Get top artists that frequently follow a given artist based on Markov transitions.
   */
  getTopTransitions(fromArtist: string, limit = 5): string[] {
    const from = fromArtist.toLowerCase().trim();
    const row = this.transitionMatrix.get(from);
    if (!row) return [];

    const sorted = Array.from(row.entries()).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, limit).map(([artist]) => artist);
  }

  /** Record when a user completes a track (> 85% played) */
  recordCompletion(track: TrackLike, previousTrack?: TrackLike | null) {
    if (!track.artist) return;
    const rawArtist = track.artist.trim();
    const normArtist = rawArtist.toLowerCase();
    this.completions.push({
      artist: rawArtist,
      title: (track.title || "").trim(),
      timestamp: Date.now(),
    });
    if (this.completions.length > 50) this.completions.shift();

    // Learn Markov sequence transition probability between previous and current track
    if (previousTrack && previousTrack.artist) {
      const prevArtist = previousTrack.artist.toLowerCase().trim();
      let row = this.transitionMatrix.get(prevArtist);
      if (!row) {
        row = new Map();
        this.transitionMatrix.set(prevArtist, row);
      }
      const count = row.get(normArtist) || 0;
      row.set(normArtist, count + 1);
    }
    this.saveToStorage();
  }

  /**
   * Calculate top positive affinity artists and heavily penalized artists from
   * session history, accumulated player stats, and fast-skips.
   */
  getAffinityWeights(
    stats?: Record<string, { plays?: number; skips?: number; completions?: number; track?: any }>,
  ): AffinityAnalysis {
    const scores: Record<string, { completions: number; skips: number; replays: number; net: number }> = {};
    const artistDisplayMap = new Map<string, string>();

    const touch = (rawName: string) => {
      const name = rawName.trim();
      const key = name.toLowerCase();
      if (!scores[key]) {
        scores[key] = { completions: 0, skips: 0, replays: 0, net: 0 };
      }
      if (!artistDisplayMap.has(key)) {
        artistDisplayMap.set(key, name);
      }
      return { key, display: artistDisplayMap.get(key) || name };
    };

    // 1. Process session completions & skips
    for (const c of this.completions) {
      if (!c.artist) continue;
      const { key } = touch(c.artist);
      scores[key]!.completions += 1;
      scores[key]!.net += 1.5;
    }
    for (const s of this.skips) {
      if (!s.artist) continue;
      const { key } = touch(s.artist);
      scores[key]!.skips += 1;
      scores[key]!.net -= 2.0;
    }

    // 2. Process persistent stats
    if (stats) {
      for (const item of Object.values(stats)) {
        const art = item.track?.artist;
        if (!art || typeof art !== "string") continue;
        const { key, display } = touch(art);
        artistDisplayMap.set(key, display);

        const comp = item.completions || 0;
        const skp = item.skips || 0;
        const ply = item.plays || 0;
        const replays = Math.max(0, ply - 1);

        scores[key]!.completions += comp;
        scores[key]!.skips += skp;
        scores[key]!.replays += replays;
        scores[key]!.net += (comp * 2.0) + (replays * 3.0) - (skp * 2.5);
      }
    }

    const affinityArtists: string[] = [];
    const penalizedArtists: string[] = [];
    const artistScores: Record<string, number> = {};

    for (const [key, val] of Object.entries(scores)) {
      const displayName = artistDisplayMap.get(key) || key;
      artistScores[displayName] = Math.round(val.net * 10) / 10;

      // Penalized: net score <= -3 or (skips >= 2 and skip rate > 60%)
      const totalActions = val.completions + val.skips;
      const skipRate = totalActions > 0 ? val.skips / totalActions : 0;
      if (val.net <= -3 || (val.skips >= 2 && skipRate >= 0.6)) {
        penalizedArtists.push(displayName);
      } else if (val.net >= 3 || (val.completions >= 2 && skipRate <= 0.3)) {
        affinityArtists.push(displayName);
      }
    }

    // 3. Fast-Skip Intra-Session Dampening: inject session-penalized artists immediately
    for (const fastSkipped of this.sessionPenalizedArtists) {
      const displayName = artistDisplayMap.get(fastSkipped) || fastSkipped;
      if (!penalizedArtists.some((a) => a.toLowerCase().trim() === fastSkipped)) {
        penalizedArtists.unshift(displayName);
      }
      const affIdx = affinityArtists.findIndex((a) => a.toLowerCase().trim() === fastSkipped);
      if (affIdx !== -1) {
        affinityArtists.splice(affIdx, 1);
      }
    }

    // Sort affinity artists descending by net score
    affinityArtists.sort((a, b) => (artistScores[b] ?? 0) - (artistScores[a] ?? 0));

    return {
      affinityArtists: affinityArtists.slice(0, 15),
      penalizedArtists: penalizedArtists.slice(0, 15),
      artistScores,
    };
  }

  /**
   * Calculate dynamic affinity score for a track (higher is better).
   * - Fast-skip dampening drops score immediately to 0.05.
   * - Recent skips within 30 min penalize score by up to -0.7.
   * - Hard skip filter: 2+ recent skips drops score to 0.05 (near zero).
   * - Recent completions boost score by +0.35.
   * - Transition flow affinity from the previous track adds up to +0.45.
   * - AutoDJ energy compatibility with current playing track adds/penalizes score.
   */
  calculateAffinityScore(track: TrackLike, currentTrack?: TrackLike | null): number {
    const normArtist = (track.artist || "").toLowerCase().trim();
    const normTitle = (track.title || "").toLowerCase().trim();

    // Intra-session fast-skip penalty: immediately suppress artists skipped < 10s ago in this session
    if (this.sessionPenalizedArtists.has(normArtist)) {
      return 0.05;
    }

    let score = 1.0;
    const now = Date.now();
    const HALF_HOUR_MS = 30 * 60 * 1000;

    // 1. Skip penalty with temporal decay & hard negative threshold
    const recentSkips = this.skips.filter(
      (s) =>
        (s.artist.toLowerCase() === normArtist || s.title.toLowerCase() === normTitle) &&
        now - s.timestamp < HALF_HOUR_MS,
    );
    if (recentSkips.length >= 2) {
      return 0.05; // Hard drop for repeatedly skipped songs/artists
    }
    if (recentSkips.length > 0) {
      score -= Math.min(0.7, recentSkips.length * 0.35);
    }

    // 2. Completion reward
    const recentCompletions = this.completions.filter(
      (c) => c.artist.toLowerCase() === normArtist && now - c.timestamp < HALF_HOUR_MS,
    );
    if (recentCompletions.length > 0) {
      score += Math.min(0.45, recentCompletions.length * 0.15);
    }

    // 3. Sequence transition probability & energy continuity from current playing track
    if (currentTrack && currentTrack.artist) {
      const transAffinity = this.getTransitionAffinity(currentTrack.artist, track.artist);
      if (transAffinity > 0.5) {
        score += (transAffinity - 0.5) * 0.9;
      }

      // AutoDJ energy continuity flow
      const currentEnergy = detectTrackEnergy(currentTrack);
      const candidateEnergy = detectTrackEnergy(track);
      score += calculateEnergyCompatibility(currentEnergy, candidateEnergy);
    }

    return Math.max(0.05, score);
  }

  /**
   * Re-rank a list of candidate tracks based on context, temporal relevance, mood anchor,
   * AutoDJ energy flow, and learned affinity.
   */
  rankTracks<T extends TrackLike>(
    tracks: T[],
    currentTrack?: TrackLike | null,
    temporalCtx?: TemporalContext,
    activeMood?: string | null,
  ): T[] {
    if (tracks.length <= 1) return tracks;
    const ctx = temporalCtx || getTemporalContext();

    const scored = tracks.map((track, originalIndex) => {
      let score = this.calculateAffinityScore(track, currentTrack);

      const titleLower = (track.title || "").toLowerCase();
      const artistLower = (track.artist || "").toLowerCase();
      const candidateText = `${titleLower} ${artistLower}`;

      // Mood Anchor Locking (if active mood is selected)
      if (activeMood) {
        const candidateEnergy = detectTrackEnergy(track);
        const moodComp = calculateMoodCompatibility(activeMood, candidateEnergy, candidateText);
        // Map compatibility to [-0.35, +0.45] adjustment
        score += (moodComp - 0.5) * 0.8;
      } else {
        // Temporal circadian genre/mood boost
        for (const mood of ctx.suggestedMoods) {
          if (titleLower.includes(mood.toLowerCase())) score += 0.15;
        }
        for (const genre of ctx.suggestedGenres) {
          if (titleLower.includes(genre.toLowerCase()) || artistLower.includes(genre.toLowerCase())) {
            score += 0.2;
          }
        }
      }

      return { track, score, originalIndex };
    });

    // Sort descending by score while preserving relative order for ties
    scored.sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex);
    return scored.map((s) => s.track);
  }
}

/**
 * Apply the 0-100% Discovery Slider distribution to partition and interleave
 * familiar favorites vs novel/exploratory recommendations.
 */
export function applyDiscoveryDistribution<T extends TrackLike>(
  tracks: T[],
  familiarArtists: string[],
  discoveryPercent = 40,
): T[] {
  if (tracks.length <= 1) return tracks;

  const familiarNormSet = new Set(familiarArtists.map((a) => a.toLowerCase().trim()).filter(Boolean));
  if (familiarNormSet.size === 0) return tracks;

  const familiar: T[] = [];
  const exploratory: T[] = [];

  for (const t of tracks) {
    const art = (t.artist || "").toLowerCase().trim();
    if (familiarNormSet.has(art)) {
      familiar.push(t);
    } else {
      exploratory.push(t);
    }
  }

  // Discovery: 0% -> 90% familiar; 50% -> 50% familiar; 100% -> 10% familiar
  const targetExploratoryRatio = Math.max(0.1, Math.min(0.9, discoveryPercent / 100));
  const total = tracks.length;
  const targetExploreCount = Math.round(total * targetExploratoryRatio);
  const targetFamiliarCount = total - targetExploreCount;

  const result: T[] = [];
  let fIdx = 0;
  let eIdx = 0;

  while (result.length < total && (fIdx < familiar.length || eIdx < exploratory.length)) {
    // Interleave according to target ratio
    if (result.length % 2 === 0) {
      if (fIdx < familiar.length && result.filter((r) => familiarNormSet.has((r.artist || "").toLowerCase().trim())).length < targetFamiliarCount) {
        result.push(familiar[fIdx++]!);
      } else if (eIdx < exploratory.length) {
        result.push(exploratory[eIdx++]!);
      } else if (fIdx < familiar.length) {
        result.push(familiar[fIdx++]!);
      }
    } else {
      if (eIdx < exploratory.length && result.filter((r) => !familiarNormSet.has((r.artist || "").toLowerCase().trim())).length < targetExploreCount) {
        result.push(exploratory[eIdx++]!);
      } else if (fIdx < familiar.length) {
        result.push(familiar[fIdx++]!);
      } else if (eIdx < exploratory.length) {
        result.push(exploratory[eIdx++]!);
      }
    }
  }

  return result.length > 0 ? result : tracks;
}

export const contextEngine = new ContextEngineSession();

export {
  thompsonSamplingPolicy,
  ThompsonSamplingPolicy,
  type RecommendationPolicy,
  type SessionContext,
  type BanditModelState,
} from "./bandit-policy";
