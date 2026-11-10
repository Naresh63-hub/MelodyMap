import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  shouldPromptFeedback,
  markFeedbackDismissed,
  markFeedbackSubmitted,
  submitAppFeedback,
  FEEDBACK_CATEGORIES,
} from "./feedback";
import { safeStorage } from "./safe-storage";
import { supabase } from "./supabase";

vi.mock("./supabase", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}));

describe("Feedback System Rules & Storage", () => {
  beforeEach(() => {
    vi.useRealTimers();
    safeStorage.clear();
    if (typeof localStorage !== "undefined") {
      try { localStorage.clear(); } catch {}
    }
    vi.clearAllMocks();
  });

  it("exposes sensible improvement categories", () => {
    expect(FEEDBACK_CATEGORIES).toContain("Sound Quality");
    expect(FEEDBACK_CATEGORIES).toContain("Song Recommendations");
    expect(FEEDBACK_CATEGORIES).toContain("Search & Discovery");
  });

  it("should not prompt feedback for brand new user with 0 songs and under 90s session", () => {
    const shouldPrompt = shouldPromptFeedback({
      historyCount: 0,
      sessionDurationSeconds: 15,
    });
    expect(shouldPrompt).toBe(false);
  });

  it("prompts feedback once user has listened to at least one song", () => {
    const shouldPrompt = shouldPromptFeedback({
      historyCount: 1,
      sessionDurationSeconds: 10,
    });
    expect(shouldPrompt).toBe(true);
  });

  it("prompts feedback if user has spent at least 90s in meaningful app usage", () => {
    const shouldPrompt = shouldPromptFeedback({
      historyCount: 0,
      sessionDurationSeconds: 95,
    });
    expect(shouldPrompt).toBe(true);
  });

  it("never prompts again once user dismissed the prompt", () => {
    markFeedbackDismissed();
    const shouldPrompt = shouldPromptFeedback({
      historyCount: 5,
      sessionDurationSeconds: 300,
    });
    expect(shouldPrompt).toBe(false);
  });

  it("never prompts again once user submitted feedback", () => {
    markFeedbackSubmitted();
    const shouldPrompt = shouldPromptFeedback({
      historyCount: 5,
      sessionDurationSeconds: 300,
    });
    expect(shouldPrompt).toBe(false);
  });

  it("submits feedback cleanly for guest users without throwing", async () => {
    const res = await submitAppFeedback({
      rating: 5,
      categories: ["Sound Quality"],
      comment: "Great first impression!",
      isGuest: true,
      platform: "web",
    });
    expect(res.success).toBe(true);
    expect(safeStorage.getItem("melodymap.feedback_status")).toBe("submitted");
    expect(safeStorage.getItem("melodymap.last_feedback")).toContain("Great first impression!");
    expect(supabase?.from).toHaveBeenCalledWith("app_feedback");
  });

  it("submits feedback cleanly for authenticated users", async () => {
    const res = await submitAppFeedback({
      rating: 4,
      categories: ["Design & Layout"],
      comment: "Nice purple theme",
      userId: "user-123",
      isGuest: false,
      platform: "android",
    });
    expect(res.success).toBe(true);
    expect(safeStorage.getItem("melodymap.feedback_status")).toBe("submitted");
    expect(supabase?.from).toHaveBeenCalledWith("app_feedback");
  });
});
