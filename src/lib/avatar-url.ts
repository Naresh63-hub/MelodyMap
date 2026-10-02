/**
 * Validates avatar image URLs to prevent DOM XSS (e.g. javascript:, vbscript:, data: URIs).
 * Allows:
 * - HTTPS and HTTP image URLs
 * - Approved local app asset relative paths starting with /
 * Rejects:
 * - Dangerous schemes (javascript:, data:, file:, etc.)
 * - Protocol-relative (//example.com) URLs
 */
export function isSafeAvatarUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Safe local relative paths (e.g. /icons/icon-512.png)
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\")) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
