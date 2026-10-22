/**
 * MelodyMap Jam Session Playback Synchronization & Voting Engine
 *
 * Provides pure mathematical calculations for:
 * 1. Host-authoritative drift alignment with latency compensation.
 * 2. 2.0s drift threshold to avoid micro-stuttering and continuous seeking.
 * 3. Skip voting threshold calculation based on active participant count.
 * 4. Stale event rejection via monotonic sequence tracking.
 * 5. Host disconnection grace period evaluation.
 */

import type { JamPlaybackState } from "./jam-types";

const CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // excludes ambiguous 0, O, 1, I

/** Generate a high-entropy 10-character uppercase invitation code formatted as JAM-XXXXXX (481M combinations) */
export function generateJamCode(): string {
  let suffix = "";
  const cryptoObj = typeof window !== "undefined" ? window.crypto : undefined;
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    const bytes = new Uint8Array(6);
    cryptoObj.getRandomValues(bytes);
    for (let i = 0; i < 6; i++) {
      suffix += CODE_CHARS[bytes[i]! % CODE_CHARS.length];
    }
  } else {
    for (let i = 0; i < 6; i++) {
      suffix += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
  }
  return `JAM-${suffix}`;
}

export interface PlaybackSyncCalculationInput {
  localCurrentTime: number;
  isLocalPlaying: boolean;
  hostPosition: number;
  hostPlaybackState: JamPlaybackState;
  hostUpdatedAtMs: number;
  latencyEstimateMs?: number;
  driftThresholdSeconds?: number;
}

export interface PlaybackSyncCalculationResult {
  shouldSeek: boolean;
  targetPosition: number;
  shouldPlay: boolean;
  shouldPause: boolean;
  driftSeconds: number;
}

/**
 * Calculates drift and required alignment for a participant's local player.
 * Enforces a default 2.0s drift threshold: micro-drifts <= 2.0s do NOT seek,
 * guaranteeing stutter-free audio listening while keeping friends in sync.
 */
export function calculatePlaybackSync(
  input: PlaybackSyncCalculationInput,
): PlaybackSyncCalculationResult {
  const now = Date.now();
  const latencySec = Math.max(0, (input.latencyEstimateMs ?? 150) / 1000);
  const timeSinceUpdateSec = Math.max(0, (now - input.hostUpdatedAtMs) / 1000);
  const driftThreshold = input.driftThresholdSeconds ?? 2.0;

  let targetPosition = Math.max(0, input.hostPosition);
  if (input.hostPlaybackState === "playing") {
    targetPosition += timeSinceUpdateSec + latencySec;
  }

  const driftSeconds = Math.abs(input.localCurrentTime - targetPosition);
  const shouldSeek = driftSeconds > driftThreshold;
  const shouldPlay = input.hostPlaybackState === "playing" && !input.isLocalPlaying;
  const shouldPause = input.hostPlaybackState === "paused" && input.isLocalPlaying;

  return {
    shouldSeek,
    targetPosition,
    shouldPlay,
    shouldPause,
    driftSeconds,
  };
}

/**
 * Skip vote threshold: majority of active participants.
 * e.g.
 * 1 participant -> 1 vote (100%)
 * 2 participants -> 2 votes (100%)
 * 3 participants -> 2 votes (majority)
 * 4 participants -> 3 votes (majority)
 * 5 participants -> 3 votes (majority)
 */
export function calculateSkipVoteThreshold(activeParticipantCount: number): number {
  if (activeParticipantCount <= 1) return 1;
  if (activeParticipantCount === 2) return 2;
  return Math.floor(activeParticipantCount / 2) + 1;
}

/** 
 * Reject out-of-order or duplicate broadcast messages.
 * Supports host reconnection epochs: if incomingEpoch > lastEpoch,
 * the host restarted/reconnected, so the event is fresh even if sequence reset to 1.
 */
export function isStaleSyncEvent(
  lastSequence: number,
  incomingSequence: number,
  lastEpoch?: number,
  incomingEpoch?: number,
): boolean {
  if (incomingEpoch !== undefined && lastEpoch !== undefined) {
    if (incomingEpoch > lastEpoch) return false;
    if (incomingEpoch < lastEpoch) return true;
  }
  return incomingSequence <= lastSequence;
}

/** Evaluates whether the 60-second host disconnection grace timer has elapsed */
export function isHostGraceExpired(disconnectedAtMs: number, gracePeriodMs = 60000): boolean {
  if (disconnectedAtMs <= 0) return false;
  return Date.now() - disconnectedAtMs >= gracePeriodMs;
}
