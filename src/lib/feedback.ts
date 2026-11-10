import { Capacitor } from "@capacitor/core";
import { supabase } from "./supabase";
import { safeStorage } from "./safe-storage";

export const FEEDBACK_CATEGORIES = [
  "Sound Quality",
  "Song Recommendations",
  "Search & Discovery",
  "App Speed & Smoothness",
  "Design & Layout",
  "Lyrics & Player",
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export interface AppFeedbackPayload {
  rating: number; // 1 - 5
  categories?: string[] | undefined;
  comment?: string | undefined;
  userId?: string | null | undefined;
  isGuest?: boolean | undefined;
  platform?: "android" | "web" | "desktop" | undefined;
  metadata?: Record<string, unknown> | undefined;
}

const STORAGE_KEY_STATUS = "melodymap.feedback_status";
const STORAGE_KEY_DISMISSED_AT = "melodymap.feedback_dismissed_at";
const STORAGE_KEY_SUBMITTED_AT = "melodymap.feedback_submitted_at";
const STORAGE_KEY_BACKUP = "melodymap.last_feedback";

/**
 * Checks whether the user is eligible for the first-experience feedback prompt:
 * - Has not already submitted or dismissed the prompt
 * - Has listened to at least 1 song OR spent >= 90s in meaningful app usage
 */
export function shouldPromptFeedback({
  historyCount = 0,
  sessionDurationSeconds = 0,
}: {
  historyCount?: number;
  sessionDurationSeconds?: number;
}): boolean {
  const currentStatus = safeStorage.getItem(STORAGE_KEY_STATUS);
  if (currentStatus === "submitted" || currentStatus === "dismissed") {
    return false;
  }

  const hasPlayedSong = historyCount >= 1;
  const hasMeaningfulTime = sessionDurationSeconds >= 90;

  return hasPlayedSong || hasMeaningfulTime;
}

/**
 * Records that the user dismissed or skipped feedback, preventing re-prompting.
 */
export function markFeedbackDismissed(): void {
  safeStorage.setItem(STORAGE_KEY_STATUS, "dismissed");
  safeStorage.setItem(STORAGE_KEY_DISMISSED_AT, String(Date.now()));
}

/**
 * Records that the user completed feedback.
 */
export function markFeedbackSubmitted(): void {
  safeStorage.setItem(STORAGE_KEY_STATUS, "submitted");
  safeStorage.setItem(STORAGE_KEY_SUBMITTED_AT, String(Date.now()));
}

/**
 * Returns detected platform ("android", "web", or "desktop").
 */
export function getAppPlatform(): "android" | "web" | "desktop" {
  if (Capacitor.isNativePlatform()) {
    const platform = Capacitor.getPlatform();
    if (platform === "android") return "android";
    if (platform === "ios") return "android";
  }
  if (typeof window !== "undefined") {
    const ua = navigator.userAgent.toLowerCase();
    if (/android|iphone|ipad|ipod|windows phone/i.test(ua)) {
      return "android";
    }
  }
  return "web";
}

/**
 * Submits feedback to Supabase app_feedback table with fast, non-blocking local backup.
 */
export async function submitAppFeedback(
  payload: AppFeedbackPayload
): Promise<{ success: boolean; error?: string }> {
  markFeedbackSubmitted();

  const finalPlatform = payload.platform || getAppPlatform();
  const cleanPayload = {
    rating: Math.max(1, Math.min(5, Math.round(payload.rating))),
    categories: Array.isArray(payload.categories) ? payload.categories : [],
    comment: payload.comment?.trim() || null,
    user_id: payload.userId || null,
    is_guest: Boolean(payload.isGuest),
    platform: finalPlatform,
    metadata: {
      timestamp: Date.now(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      ...payload.metadata,
    },
  };

  // Always save local backup
  try {
    safeStorage.setItem(STORAGE_KEY_BACKUP, JSON.stringify(cleanPayload));
  } catch {}

  try {
    if (supabase) {
      // Fire-and-forget or fast timeout so exit is never held up
      const insertPromise = supabase.from("app_feedback").insert(cleanPayload);
      const timeoutPromise = new Promise<{ error: Error }>((resolve) =>
        setTimeout(() => resolve({ error: new Error("Supabase insert timeout") }), 3000)
      );

      const res = await Promise.race([insertPromise, timeoutPromise]);
      if ((res as any)?.error) {
        console.warn("[Feedback] Supabase feedback insert notice:", (res as any).error.message);
      }
    }
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn("[Feedback] Submission network issue:", errorMsg);
    return { success: true };
  }
}
