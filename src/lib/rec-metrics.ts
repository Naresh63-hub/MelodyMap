import { safeStorage } from "./safe-storage";
import { telemetry, type PlaybackTelemetryEvent } from "./telemetry";

/**
 * Lightweight on-device outcome counters, bucketed by day and by recommendation
 * source (context.source on the telemetry event). Unlike the telemetry buffer
 * (100 events, drained on sync), this keeps 30 days of aggregates, so you can
 * compare early-skip and completion rates before and after each change.
 */

export interface SourceCounters {
  starts: number;
  earlySkips: number;
  completions: number;
  likes: number;
}

export interface SourceSummary extends SourceCounters {
  earlySkipRate: number;
  completionRate: number;
}

type DayBucket = Record<string, SourceCounters>;
type MetricsStore = Record<string, DayBucket>;

const STORAGE_KEY = "melodymap.rec_metrics.v1";
const MAX_DAYS = 30;
const EARLY_SKIP_SECONDS = 10; // keep in sync with calculateTelemetryReward
const UNKNOWN_SOURCE = "unknown";

function emptyCounters(): SourceCounters {
  return { starts: 0, earlySkips: 0, completions: 0, likes: 0 };
}

export function dayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function load(): MetricsStore {
  try {
    const raw = safeStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as MetricsStore;
    }
    return {};
  } catch {
    return {};
  }
}

function save(store: MetricsStore): void {
  try {
    const days = Object.keys(store).sort();
    const excess = Math.max(0, days.length - MAX_DAYS);
    for (const day of days.slice(0, excess)) delete store[day];
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // storage full or unavailable: metrics are best-effort
  }
}

export function recordMetricsEvent(
  event: PlaybackTelemetryEvent,
  now: Date = new Date(),
): void {
  let field: keyof SourceCounters | null = null;
  if (event.eventType === "PLAY_START") field = "starts";
  else if (event.eventType === "COMPLETED") field = "completions";
  else if (event.eventType === "LIKED") field = "likes";
  else if (
    event.eventType === "SKIPPED" &&
    event.positionSeconds < EARLY_SKIP_SECONDS
  ) {
    field = "earlySkips";
  }
  if (!field) return;

  const store = load();
  const bucket = (store[dayKey(now)] ??= {});
  const source = event.context?.source || UNKNOWN_SOURCE;
  const counters = (bucket[source] ??= emptyCounters());
  counters[field] += 1;
  save(store);
}

/** Totals per source over the last `days` days (including today). */
export function summarizeMetrics(
  days = 7,
  now: Date = new Date(),
): Record<string, SourceSummary> {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const cutoffKey = dayKey(cutoff);

  const totals: Record<string, SourceCounters> = {};
  for (const [day, bucket] of Object.entries(load())) {
    if (day < cutoffKey) continue; // YYYY-MM-DD sorts lexicographically
    for (const [source, c] of Object.entries(bucket)) {
      const t = (totals[source] ??= emptyCounters());
      t.starts += c.starts;
      t.earlySkips += c.earlySkips;
      t.completions += c.completions;
      t.likes += c.likes;
    }
  }

  const out: Record<string, SourceSummary> = {};
  for (const [source, t] of Object.entries(totals)) {
    out[source] = {
      ...t,
      earlySkipRate: t.starts ? t.earlySkips / t.starts : 0,
      completionRate: t.starts ? t.completions / t.starts : 0,
    };
  }
  return out;
}

let unsubscribe: (() => void) | null = null;

/** Call once at app start. Safe to call again (e.g. HMR); returns a stop function. */
export function initRecMetrics(): () => void {
  if (!unsubscribe) {
    unsubscribe = telemetry.subscribe((e) => recordMetricsEvent(e));
  }
  return () => {
    unsubscribe?.();
    unsubscribe = null;
  };
}
