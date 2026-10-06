import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateServerEnvironment, logServerEnvironmentDiagnostics } from "./env.server";

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

    const status = validateServerEnvironment();
    expect(status.hasAiKey).toBe(false);
    expect(status.aiBaseUrl).toBe("https://api.openai.com/v1");
    expect(status.hasYouTubeKey).toBe(false);
    expect(status.isCloudSyncConfigured).toBe(true);
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

  it("never returns raw credential values in status object", () => {
    process.env["AI_API_KEY"] = "sk-super-secret-key-99999";
    process.env["YOUTUBE_API_KEY"] = "AIzaSySecretApiKey77777";

    const status = validateServerEnvironment() as unknown as Record<string, unknown>;
    for (const val of Object.values(status)) {
      expect(val).not.toContain("sk-super-secret-key-99999");
      expect(val).not.toContain("AIzaSySecretApiKey77777");
    }
  });

  it("ensures diagnostics log does not print secret credential values", () => {
    const logs: string[] = [];
    const origInfo = console.info;
    console.info = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };

    try {
      const origNodeEnv = process.env["NODE_ENV"];
      delete process.env["NODE_ENV"];
      process.env["AI_API_KEY"] = "sk-super-secret-key-99999";
      process.env["YOUTUBE_API_KEY"] = "AIzaSySecretApiKey77777";

      logServerEnvironmentDiagnostics();

      const combinedLogs = logs.join(" ");
      expect(combinedLogs).not.toContain("sk-super-secret-key-99999");
      expect(combinedLogs).not.toContain("AIzaSySecretApiKey77777");
      expect(combinedLogs).toContain("ENABLED");
      expect(combinedLogs).toContain("CONFIGURED");
      process.env["NODE_ENV"] = origNodeEnv;
    } finally {
      console.info = origInfo;
    }
  });
});
