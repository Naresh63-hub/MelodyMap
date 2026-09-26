import type { Track } from "./library";

export type TelemetryEventType =
  | "PLAY_START"
  | "PLAY_10S"
  | "PLAY_25S"
  | "PLAY_50_PERCENT"
  | "PLAY_85_PERCENT"
  | "COMPLETED"
  | "SKIPPED"
  | "LIKED"
  | "DISLIKED"
  | "REPLAYED"
  | "ADDED_TO_LIBRARY";

export interface PlaybackTelemetryEvent {
  id: string; // unique event id
  trackId: string;
  artist: string;
  title: string;
  eventType: TelemetryEventType;
  positionSeconds: number;
  durationSeconds: number;
  fractionPlayed: number; // 0.0 to 1.0
  timestamp: number;
  context?: {
    hourOfDay?: number | undefined;
    discoverySetting?: number | undefined;
    source?: string | undefined;
  } | undefined;
}

export interface TelemetryRewardConfig {
  fastSkip: number; // < 10s
  midSkip: number; // 10s - 25s
  lateSkip: number; // > 50%
  milestone10s: number;
  milestone25s: number;
  milestone50p: number;
  milestone85p: number;
  completed: number;
  liked: number;
  disliked: number;
  replayed: number;
  addedToLibrary: number;
}

export const DEFAULT_REWARD_CONFIG: TelemetryRewardConfig = {
  fastSkip: -1.2,
  midSkip: -0.6,
  lateSkip: 0.1, // late skip after >50% duration still shows engagement
  milestone10s: 0.1,
  milestone25s: 0.2,
  milestone50p: 0.4,
  milestone85p: 0.7,
  completed: 1.0,
  liked: 2.0,
  disliked: -2.5,
  replayed: 1.5,
  addedToLibrary: 1.8,
};

/**
 * Maps a discrete telemetry event to a scalar reward for reinforcement learning / bandit update.
 */
export function calculateTelemetryReward(
  event: PlaybackTelemetryEvent,
  config: TelemetryRewardConfig = DEFAULT_REWARD_CONFIG,
): number {
  switch (event.eventType) {
    case "SKIPPED":
      if (event.positionSeconds < 10) return config.fastSkip;
      if (event.positionSeconds < 25) return config.midSkip;
      if (event.fractionPlayed >= 0.5) return config.lateSkip;
      return -0.3;

    case "COMPLETED":
      return config.completed;

    case "LIKED":
      return config.liked;

    case "DISLIKED":
      return config.disliked;

    case "REPLAYED":
      return config.replayed;

    case "ADDED_TO_LIBRARY":
      return config.addedToLibrary;

    case "PLAY_85_PERCENT":
      return config.milestone85p;

    case "PLAY_50_PERCENT":
      return config.milestone50p;

    case "PLAY_25S":
      return config.milestone25s;

    case "PLAY_10S":
      return config.milestone10s;

    case "PLAY_START":
    default:
      return 0.0;
  }
}

const TELEMETRY_STORAGE_KEY = "melodymap.telemetry_buffer.v1";
const MAX_LOCAL_EVENTS = 100;

/**
 * Tracks milestone emission for a single track listening session to prevent duplicate events.
 */
export class TrackProgressTracker {
  private currentTrackId: string | null = null;
  private emittedMilestones = new Set<string>();

  reset(trackId: string | null = null) {
    this.currentTrackId = trackId;
    this.emittedMilestones.clear();
  }

  getTrackId(): string | null {
    return this.currentTrackId;
  }

  /**
   * Check if a milestone should fire given current playback position and duration.
   * Returns event types to emit for this step.
   */
  checkProgress(
    track: Track,
    position: number,
    duration: number,
  ): TelemetryEventType[] {
    if (!track.id) return [];
    if (this.currentTrackId !== track.id) {
      this.reset(track.id);
    }

    const events: TelemetryEventType[] = [];

    if (!this.emittedMilestones.has("PLAY_START") && position >= 0) {
      this.emittedMilestones.add("PLAY_START");
      events.push("PLAY_START");
    }

    if (!this.emittedMilestones.has("PLAY_10S") && position >= 10) {
      this.emittedMilestones.add("PLAY_10S");
      events.push("PLAY_10S");
    }

    if (!this.emittedMilestones.has("PLAY_25S") && position >= 25) {
      this.emittedMilestones.add("PLAY_25S");
      events.push("PLAY_25S");
    }

    if (duration > 0) {
      const frac = position / duration;
      if (!this.emittedMilestones.has("PLAY_50_PERCENT") && frac >= 0.5) {
        this.emittedMilestones.add("PLAY_50_PERCENT");
        events.push("PLAY_50_PERCENT");
      }
      if (!this.emittedMilestones.has("PLAY_85_PERCENT") && frac >= 0.85) {
        this.emittedMilestones.add("PLAY_85_PERCENT");
        events.push("PLAY_85_PERCENT");
      }
    }

    return events;
  }
}

/**
 * Bounded telemetry manager storing recent interactions in localStorage
 * and flushing batches to Supabase or telemetry endpoints.
 */
export class TelemetryManager {
  private buffer: PlaybackTelemetryEvent[] = [];
  private listeners: ((event: PlaybackTelemetryEvent) => void)[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(TELEMETRY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.buffer = parsed.slice(-MAX_LOCAL_EVENTS);
      }
    } catch {}
  }

  private saveToStorage() {
    if (typeof window === "undefined") return;
    try {
      // Keep strictly bounded to MAX_LOCAL_EVENTS
      if (this.buffer.length > MAX_LOCAL_EVENTS) {
        this.buffer = this.buffer.slice(-MAX_LOCAL_EVENTS);
      }
      localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(this.buffer));
    } catch {}
  }

  subscribe(listener: (event: PlaybackTelemetryEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  logEvent(event: Omit<PlaybackTelemetryEvent, "id">): PlaybackTelemetryEvent {
    const fullEvent: PlaybackTelemetryEvent = {
      ...event,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };

    this.buffer.push(fullEvent);
    this.saveToStorage();

    for (const listener of this.listeners) {
      try {
        listener(fullEvent);
      } catch (err) {
        console.warn("[Telemetry] Listener error:", err);
      }
    }

    return fullEvent;
  }

  getBufferedEvents(): PlaybackTelemetryEvent[] {
    return [...this.buffer];
  }

  clearBuffer() {
    this.buffer = [];
    this.saveToStorage();
  }

  /**
   * Drain up to count events for cloud sync.
   */
  drainEvents(count = 50): PlaybackTelemetryEvent[] {
    const drained = this.buffer.slice(0, count);
    this.buffer = this.buffer.slice(count);
    this.saveToStorage();
    return drained;
  }
}

export const telemetry = new TelemetryManager();
