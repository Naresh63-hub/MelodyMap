import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateServerEnvironment } from "./env.server";

describe("validateServerEnvironment", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("reports defaults when no environment variables are set", () => {
    delete process.env["AI_API_KEY"];
    delete process.env["AI_API_BASE_URL"];
    delete process.env["YOUTUBE_API_KEY"];
    delete process.env["SUPABASE_URL"];

    const status = validateServerEnvironment();
    expect(status.hasAiKey).toBe(false);
    expect(status.aiBaseUrl).toBe("https://api.openai.com/v1");
    expect(status.hasYouTubeKey).toBe(false);
    expect(status.isSupabaseServerConfigured).toBe(false);
  });

  it("detects valid AI key and custom base URL without exposing values", () => {
    process.env["AI_API_KEY"] = "sk-test-sample-key-123456";
    process.env["AI_API_BASE_URL"] = "https://custom.ai.gateway.com/v1";

    const status = validateServerEnvironment();
    expect(status.hasAiKey).toBe(true);
    expect(status.aiBaseUrl).toBe("https://custom.ai.gateway.com/v1");
  });

  it("ignores invalid or non-http URLs for security", () => {
    process.env["AI_API_BASE_URL"] = "ftp://malicious.com";
    const status = validateServerEnvironment();
    expect(status.aiBaseUrl).toBe("https://api.openai.com/v1");
  });

  it("detects optional YouTube API key flag safely", () => {
    process.env["YOUTUBE_API_KEY"] = "AIzaSySampleKeyValidLength";
    const status = validateServerEnvironment();
    expect(status.hasYouTubeKey).toBe(true);
  });
});
