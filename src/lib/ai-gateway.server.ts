import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Creates an OpenAI-compatible provider for AI-powered music recommendations.
 *
 * Set the following environment variables:
 *   AI_API_BASE_URL — Base URL of your OpenAI-compatible API (e.g. https://api.openai.com/v1)
 *   AI_API_KEY      — Your API key for that provider
 *   AI_MODEL        — Model id to request (optional; see resolveAiModelId)
 *
 * If AI_API_BASE_URL is not set, defaults to OpenAI's API.
 */
export function createAiGatewayProvider(apiKey: string) {
  const baseURL =
    process.env["AI_API_BASE_URL"] || "https://api.openai.com/v1";
  return createOpenAICompatible({
    name: "melodymap-ai",
    baseURL,
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

/**
 * Resolves which model id to request from the gateway.
 *
 * The default base URL points at OpenAI, where Gemini-style ids like
 * "google/gemini-3.6-flash" do not exist — that combination silently failed
 * every AI call before falling back. Pick a sane default per provider and
 * always allow an explicit AI_MODEL override.
 */
export function resolveAiModelId(): string {
  const explicit = process.env["AI_MODEL"]?.trim();
  if (explicit) return explicit;
  const baseURL = process.env["AI_API_BASE_URL"] || "https://api.openai.com/v1";
  return baseURL.includes("openai.com") ? "gpt-4o-mini" : "google/gemini-3.6-flash";
}
