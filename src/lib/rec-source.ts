/**
 * Remembers which recommendation surface produced each track so telemetry
 * events can carry `context.source` (and rec-metrics can split rates by it).
 * In-memory only and bounded; untagged tracks (search, library) read as undefined.
 */

const MAX_ENTRIES = 1000;
const sources = new Map<string, string>();

export function tagTrackSource(
  tracks: ReadonlyArray<{ id?: string | undefined }>,
  source: string,
): void {
  for (const t of tracks) {
    if (!t.id) continue;
    sources.delete(t.id); // refresh insertion order so eviction is oldest-first
    sources.set(t.id, source);
  }
  while (sources.size > MAX_ENTRIES) {
    const oldest = sources.keys().next().value;
    if (oldest === undefined) break;
    sources.delete(oldest);
  }
}

export function getTrackSource(id: string | null | undefined): string | undefined {
  return id ? sources.get(id) : undefined;
}

export function clearTrackSources(): void {
  sources.clear();
}
