import type { TrackLike } from "./track-dedup";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

export interface TemporalContext {
  timeOfDay: TimeOfDay;
  label: string;
  energy: "gentle" | "medium" | "high" | "low";
  suggestedMoods: string[];
  suggestedGenres: string[];
}

/**
 * Determine the temporal listening context based on the current hour.
 */
export function getTemporalContext(now: Date = new Date()): TemporalContext {
  const hour = now.getHours();

  if (hour >= 5 && hour < 12) {
    return {
      timeOfDay: "morning",
      label: "Morning Awakening",
      energy: "gentle",
      suggestedMoods: ["Chill", "Acoustic", "Feel Good", "Upbeat"],
      suggestedGenres: ["Acoustic", "Indie Pop", "Morning Lo-Fi", "Classical", "Pop"],
    };
  }
  if (hour >= 12 && hour < 17) {
    return {
      timeOfDay: "afternoon",
      label: "Afternoon Focus & Energy",
      energy: "high",
      suggestedMoods: ["Focus", "Energizing", "Workout", "Pop Hits"],
      suggestedGenres: ["Deep House", "Lo-Fi Beats", "Pop", "Synthwave", "Rock"],
    };
  }
  if (hour >= 17 && hour < 22) {
    return {
      timeOfDay: "evening",
      label: "Evening Unwind",
      energy: "medium",
      suggestedMoods: ["Chill", "Party", "Romance", "Sunset"],
      suggestedGenres: ["R&B", "Indie Rock", "Pop Hits", "Electronic", "Hip Hop"],
    };
  }
  return {
    timeOfDay: "night",
    label: "Late Night Deep Dive",
    energy: "low",
    suggestedMoods: ["Sleep", "Midnight Chill", "Ambient", "Melancholy"],
    suggestedGenres: ["Ambient", "Slow R&B", "Night Lo-Fi", "Acoustic", "Dream Pop"],
  };
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

const STORAGE_KEY = "melodymap.context_engine.v1";

export class ContextEngineSession {
  private skips: SkipRecord[] = [];
  private completions: CompletionRecord[] = [];
  private transitionMatrix = new Map<string, Map<string, number>>();

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

  /** Record when a user skips a track early (< 25s) */
  recordSkip(track: TrackLike) {
    if (!track.artist) return;
    this.skips.push({
      artist: track.artist.toLowerCase().trim(),
      title: track.title.toLowerCase().trim(),
      timestamp: Date.now(),
    });
    if (this.skips.length > 50) this.skips.shift();
    this.saveToStorage();
  }

  /** Record when a user completes a track (> 85% played) */
  recordCompletion(track: TrackLike, previousTrack?: TrackLike | null) {
    if (!track.artist) return;
    const normArtist = track.artist.toLowerCase().trim();
    this.completions.push({
      artist: normArtist,
      title: track.title.toLowerCase().trim(),
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
   * Calculate dynamic affinity score for a track (higher is better).
   * - Recent skips within 30 min penalize score by up to -0.7.
   * - Hard skip filter: 2+ recent skips drops score to 0.05 (near zero).
   * - Recent completions boost score by +0.35.
   * - Transition flow affinity from the previous track adds up to +0.45.
   */
  calculateAffinityScore(track: TrackLike, currentTrack?: TrackLike | null): number {
    let score = 1.0;
    const normArtist = (track.artist || "").toLowerCase().trim();
    const normTitle = (track.title || "").toLowerCase().trim();
    const now = Date.now();
    const HALF_HOUR_MS = 30 * 60 * 1000;

    // 1. Skip penalty with temporal decay & hard negative threshold
    const recentSkips = this.skips.filter(
      (s) => (s.artist === normArtist || s.title === normTitle) && now - s.timestamp < HALF_HOUR_MS,
    );
    if (recentSkips.length >= 2) {
      return 0.05; // Hard drop for repeatedly skipped songs/artists
    }
    if (recentSkips.length > 0) {
      score -= Math.min(0.7, recentSkips.length * 0.35);
    }

    // 2. Completion reward
    const recentCompletions = this.completions.filter(
      (c) => c.artist === normArtist && now - c.timestamp < HALF_HOUR_MS,
    );
    if (recentCompletions.length > 0) {
      score += Math.min(0.45, recentCompletions.length * 0.15);
    }

    // 3. Sequence transition probability from current playing track
    if (currentTrack && currentTrack.artist) {
      const prevArtist = currentTrack.artist.toLowerCase().trim();
      const row = this.transitionMatrix.get(prevArtist);
      if (row) {
        const transCount = row.get(normArtist) || 0;
        if (transCount > 0) {
          score += Math.min(0.45, transCount * 0.12);
        }
      }
    }

    return Math.max(0.05, score);
  }

  /**
   * Re-rank a list of candidate tracks based on context, temporal relevance, and learned affinity.
   */
  rankTracks<T extends TrackLike>(
    tracks: T[],
    currentTrack?: TrackLike | null,
    temporalCtx?: TemporalContext,
  ): T[] {
    if (tracks.length <= 1) return tracks;
    const ctx = temporalCtx || getTemporalContext();

    const scored = tracks.map((track, originalIndex) => {
      let score = this.calculateAffinityScore(track, currentTrack);

      // Temporal genre/mood boost
      const titleLower = (track.title || "").toLowerCase();
      const artistLower = (track.artist || "").toLowerCase();

      for (const mood of ctx.suggestedMoods) {
        if (titleLower.includes(mood.toLowerCase())) score += 0.15;
      }
      for (const genre of ctx.suggestedGenres) {
        if (titleLower.includes(genre.toLowerCase()) || artistLower.includes(genre.toLowerCase())) {
          score += 0.2;
        }
      }

      return { track, score, originalIndex };
    });

    // Sort descending by score while preserving relative order for ties
    scored.sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex);
    return scored.map((s) => s.track);
  }
}

export const contextEngine = new ContextEngineSession();
