/**
 * MelodyMap Audio Prefetch Engine
 *
 * Implements Tier 1 early URL resolution and Tier 2 network-aware initial chunk pre-buffering.
 * Prevents inter-track delay gaps without allocating secondary audio elements or violating provider terms.
 */

import { isLowNetworkModeEnabled } from "./network-mode";
import { hasFullLengthDirectSource } from "./track-stream-policy";
import type { NextTrackInfo } from "./use-audio-player";

export interface PrewarmedEntry {
  trackId: string;
  url: string;
  isDirect: boolean;
  resolvedAt: number;
}

export type PrefetchQuality = "saver" | "standard" | "high";

/** Expiration time for prewarmed URLs (10 minutes) */
const PREWARM_CACHE_TTL_MS = 10 * 60 * 1000;

export class AudioPrefetchManager {
  private cache = new Map<string, PrewarmedEntry>();
  private activeAbortController: AbortController | null = null;
  private activeTrackId: string | null = null;
  private activeSessionId = 0;

  /**
   * Determine target initial chunk size based on format / bitrate quality.
   * Saver (96 kbps) ~96KB, Standard (160 kbps) ~160KB, High (320 kbps) ~256KB.
   */
  public getTargetChunkSizeBytes(quality: PrefetchQuality): number {
    switch (quality) {
      case "saver":
        return 96 * 1024; // 96 KB
      case "standard":
        return 160 * 1024; // 160 KB
      case "high":
      default:
        return 256 * 1024; // 256 KB
    }
  }

  /**
   * Check if conditions are met to trigger prefetch:
   * 1. Track is actively playing with valid duration
   * 2. Has played at least 10 seconds (verifies user is actually listening, not skimming)
   * 3. Has <= 20 seconds remaining (or >= 85% complete for short tracks)
   */
  public shouldTriggerPrefetch(
    currentTime: number,
    duration: number,
  ): boolean {
    if (!Number.isFinite(duration) || duration <= 0) return false;
    if (currentTime < 10 && duration > 15) return false;
    const remaining = duration - currentTime;
    return remaining <= 20 || (duration > 0 && currentTime / duration >= 0.85);
  }

  /**
   * Prepares the next track in the queue:
   * Tier 1: Resolves playable URL early and caches it.
   * Tier 2: Fetches initial audio chunk into HTTP cache if on broadband (suppressed in Data Saver).
   */
  public async prefetchNextTrack(options: {
    nextTrack: NextTrackInfo | undefined | null;
    quality?: PrefetchQuality | undefined;
    sessionId: number;
    streamUrlResolver: (id: string, quality?: string, title?: string, artist?: string) => string;
  }): Promise<{ url: string | null; prebuffered: boolean; reason?: string }> {
    const { nextTrack, quality = "high", sessionId, streamUrlResolver } = options;
    if (!nextTrack || !nextTrack.id) {
      return { url: null, prebuffered: false, reason: "no_track" };
    }

    // Deduplication: if already actively prefetching or cached freshly for this track
    const existing = this.getPrewarmedUrl(nextTrack.id);
    if (existing) {
      return { url: existing, prebuffered: true, reason: "already_cached" };
    }

    if (this.activeTrackId === nextTrack.id && this.activeSessionId === sessionId) {
      return { url: null, prebuffered: false, reason: "already_in_flight" };
    }

    // Cancel any previous in-flight prefetch
    this.abort();

    const controller = new AbortController();
    this.activeAbortController = controller;
    this.activeTrackId = nextTrack.id;
    this.activeSessionId = sessionId;

    try {
      // ─── TIER 1: Playable URL Pre-Resolution ─────────────────────────────
      let targetUrl: string;
      const isDirect = Boolean(nextTrack.previewUrl && hasFullLengthDirectSource(nextTrack.id));

      if (isDirect && nextTrack.previewUrl) {
        targetUrl = nextTrack.previewUrl;
      } else {
        // Construct canonical streaming proxy URL
        targetUrl = streamUrlResolver(nextTrack.id, quality, nextTrack.title, nextTrack.artist);
      }

      // Check if session changed or was aborted while resolving
      if (controller.signal.aborted || this.activeSessionId !== sessionId) {
        return { url: null, prebuffered: false, reason: "aborted" };
      }

      // Cache the pre-resolved URL
      this.cache.set(nextTrack.id, {
        trackId: nextTrack.id,
        url: targetUrl,
        isDirect,
        resolvedAt: Date.now(),
      });

      // ─── TIER 2: Intelligent Initial-Chunk Prebuffering ──────────────────
      // If Low Network Mode / Data Saver is enabled, suppress all byte downloading
      if (isLowNetworkModeEnabled() || quality === "saver") {
        return { url: targetUrl, prebuffered: false, reason: "data_saver_enabled" };
      }

      // For same-origin proxy streams, fetch initial format-aware audio bytes
      if (typeof fetch !== "undefined" && targetUrl.startsWith("/api/stream/")) {
        const chunkSize = this.getTargetChunkSizeBytes(quality);
        const rangeHeader = `bytes=0-${chunkSize - 1}`;

        try {
          const res = await fetch(targetUrl, {
            headers: { Range: rangeHeader },
            signal: controller.signal,
          });

          if (res.ok || res.status === 206) {
            // Consume reader so bytes hit the browser HTTP/socket cache, then close
            const reader = res.body?.getReader();
            if (reader) {
              await reader.read().catch(() => {});
              try {
                await reader.cancel();
              } catch {}
            }

            if (controller.signal.aborted || this.activeSessionId !== sessionId) {
              this.cache.delete(nextTrack.id);
              return { url: null, prebuffered: false, reason: "aborted" };
            }

            return { url: targetUrl, prebuffered: true };
          }
        } catch {
          // Non-fatal if partial range fetch fails
        }
      }

      if (controller.signal.aborted || this.activeSessionId !== sessionId) {
        this.cache.delete(nextTrack.id);
        return { url: null, prebuffered: false, reason: "aborted" };
      }

      return { url: targetUrl, prebuffered: false };
    } catch (err: any) {
      if (controller.signal.aborted || err?.name === "AbortError") {
        this.cache.delete(nextTrack.id);
        return { url: null, prebuffered: false, reason: "aborted" };
      }
      return { url: null, prebuffered: false, reason: "error" };
    } finally {
      if (this.activeAbortController === controller) {
        this.activeAbortController = null;
        this.activeTrackId = null;
      }
    }
  }

  /**
   * Retrieves a pre-resolved URL if available and fresh (< 10 minutes old).
   */
  public getPrewarmedUrl(trackId: string): string | null {
    const entry = this.cache.get(trackId);
    if (!entry) return null;
    if (Date.now() - entry.resolvedAt > PREWARM_CACHE_TTL_MS) {
      this.cache.delete(trackId);
      return null;
    }
    return entry.url;
  }

  /**
   * Immediately aborts any in-flight prefetch network requests.
   */
  public abort(): void {
    if (this.activeAbortController) {
      try {
        this.activeAbortController.abort();
      } catch {}
      this.activeAbortController = null;
    }
    this.activeTrackId = null;
  }

  /**
   * Clears the entire prewarm cache and aborts in-flight work.
   */
  public clear(): void {
    this.abort();
    this.cache.clear();
  }
}

export const audioPrefetchManager = new AudioPrefetchManager();
