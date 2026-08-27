import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Creates an OpenAI-compatible provider for AI-powered music recommendations.
 *
 * Set the following environment variables:
 *   AI_API_BASE_URL — Base URL of your OpenAI-compatible API (e.g. https://api.openai.com/v1)
 *   AI_API_KEY      — Your API key for that provider
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
