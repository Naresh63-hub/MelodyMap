import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

describe("Feedback UI Components & Supabase Migration Verification", () => {
  const bottomSheetSource = readFileSync(
    resolve(__dirname, "./FeedbackBottomSheet.tsx"),
    "utf-8"
  );
  const webPromptSource = readFileSync(
    resolve(__dirname, "./WebFeedbackPrompt.tsx"),
    "utf-8"
  );
  const migrationPath = resolve(
    __dirname,
    "../../../../supabase/migrations/20261109000000_app_feedback.sql"
  );

  it("FeedbackBottomSheet provides the 3 required user actions", () => {
    // 1. Submit Feedback
    expect(bottomSheetSource).toContain("Submit Feedback");
    // 2. Skip & Exit
    expect(bottomSheetSource).toContain("Skip & Exit");
    // 3. Continue Listening
    expect(bottomSheetSource).toContain("Continue Listening");
  });

  it("FeedbackBottomSheet renders 5-level emoji rating scale with lavender theme styling", () => {
    expect(bottomSheetSource).toContain("😡");
    expect(bottomSheetSource).toContain("😕");
    expect(bottomSheetSource).toContain("😐");
    expect(bottomSheetSource).toContain("😊");
    expect(bottomSheetSource).toContain("😍");
    expect(bottomSheetSource).toContain("rounded-t-[32px]");
  });

  it("WebFeedbackPrompt renders a lightweight, non-blocking floating card", () => {
    // Non-blocking floating layout (fixed, pointer-events-auto, dismiss button)
    expect(webPromptSource).toContain("fixed bottom-24 right-4");
    expect(webPromptSource).toContain("Enjoying MelodyMap?");
    expect(webPromptSource).toContain("Maybe later");
    expect(webPromptSource).toContain("Send");
  });

  it("Supabase migration exists and configures app_feedback with proper RLS", () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, "utf-8");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.app_feedback");
    expect(sql).toContain("ALTER TABLE public.app_feedback ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain("CREATE POLICY \"app_feedback_insert_all\"");
    expect(sql).toContain("CREATE POLICY \"app_feedback_select_own\"");
    expect(sql).toContain("rating INTEGER NOT NULL");
    expect(sql).toContain("is_guest BOOLEAN NOT NULL");
    expect(sql).toContain("platform TEXT NOT NULL");
  });
});
