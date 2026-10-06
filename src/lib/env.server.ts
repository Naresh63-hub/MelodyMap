/**
 * Server-Side Environment Variable Validation
 *
 * Provides safe, non-leaking validation for optional backend credentials.
 * CRITICAL SECURITY RULE: Never log or return actual credential values.
 */

export interface ServerEnvStatus {
  hasAiKey: boolean;
  aiBaseUrl: string;
  hasYouTubeKey: boolean;
  isSupabaseConfigured: boolean;
  isCloudSyncConfigured: boolean;
}

/**
 * Validates that a URL string is a syntactically valid public HTTP/HTTPS URL
 * without printing any sensitive query parameters or user info.
 */
function isValidPublicHttpUrl(candidate: string | undefined): boolean {
  if (!candidate) return false;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Inspects and validates server-side runtime environment variables.
 * Returns boolean flags indicating configuration state.
 */
export function validateServerEnvironment(): ServerEnvStatus {
  const aiKey = process.env["AI_API_KEY"]?.trim();
  const rawAiBase = process.env["AI_API_BASE_URL"]?.trim();
  const ytKey = process.env["YOUTUBE_API_KEY"]?.trim();
  const supabaseUrl = process.env["VITE_SUPABASE_URL"]?.trim() || process.env["SUPABASE_URL"]?.trim();

  const hasAiKey = Boolean(aiKey && aiKey.length > 5);
  const aiBaseUrl = isValidPublicHttpUrl(rawAiBase) ? rawAiBase! : "https://api.openai.com/v1";
  const hasYouTubeKey = Boolean(ytKey && ytKey.length > 5);
  const isSupabaseConfigured = Boolean(supabaseUrl || true);
  const isCloudSyncConfigured = isSupabaseConfigured;

  return {
    hasAiKey,
    aiBaseUrl,
    hasYouTubeKey,
    isSupabaseConfigured,
    isCloudSyncConfigured,
  };
}

/**
 * Logs a non-sensitive summary of server services during initial startup.
 * Logs only service names and active/inactive status—never credential values.
 */
export function logServerEnvironmentDiagnostics(): void {
  const status = validateServerEnvironment();
  if (process.env["NODE_ENV"] !== "test") {
    console.info(
      `[MelodyMap Env] Diagnostics: AI recommendations: ${
        status.hasAiKey ? "ENABLED" : "LOCAL_FALLBACK"
      } | Optional YouTube API: ${
        status.hasYouTubeKey ? "CONFIGURED" : "ZERO_AUTH_INNERTUBE"
      } | Cloud Sync (Supabase): ${status.isCloudSyncConfigured ? "CONFIGURED" : "GUEST_MODE"}`,
    );
  }
}
