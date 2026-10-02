import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveAiModelId } from "./ai-gateway.server";

describe("resolveAiModelId", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    delete process.env["AI_MODEL"];
    delete process.env["AI_API_BASE_URL"];
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("returns explicit AI_MODEL when provided", () => {
    process.env["AI_MODEL"] = "custom-model-123";
    expect(resolveAiModelId()).toBe("custom-model-123");
  });

  it("defaults to gpt-4o-mini when baseURL is official api.openai.com", () => {
    process.env["AI_API_BASE_URL"] = "https://api.openai.com/v1";
    expect(resolveAiModelId()).toBe("gpt-4o-mini");
  });

  it("identifies subdomains of openai.com as OpenAI host", () => {
    process.env["AI_API_BASE_URL"] = "https://custom.openai.com/v1";
    expect(resolveAiModelId()).toBe("gpt-4o-mini");
  });

  it("rejects lookalike or suffix domain attacks like evil-openai.com", () => {
    process.env["AI_API_BASE_URL"] = "https://evil-openai.com/v1";
    // Must NOT select gpt-4o-mini since evil-openai.com is not an openai.com host
    expect(resolveAiModelId()).toBe("google/gemini-3.6-flash");
  });

  it("rejects path-injection lookalikes like https://attacker.com/openai.com/v1", () => {
    process.env["AI_API_BASE_URL"] = "https://attacker.com/openai.com/v1";
    expect(resolveAiModelId()).toBe("google/gemini-3.6-flash");
  });

  it("defaults to google/gemini-3.6-flash for non-OpenAI gateways like OpenRouter", () => {
    process.env["AI_API_BASE_URL"] = "https://openrouter.ai/api/v1";
    expect(resolveAiModelId()).toBe("google/gemini-3.6-flash");
  });

  it("handles malformed URLs gracefully without throwing", () => {
    process.env["AI_API_BASE_URL"] = "not-a-valid-url";
    expect(resolveAiModelId()).toBe("gpt-4o-mini");
  });
});
