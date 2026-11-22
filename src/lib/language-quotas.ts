import { getTrackLanguage } from "./language-artists";
import type { TrackLike } from "./track-dedup";
import { getRecFlag } from "./rec-flags";

export interface QuotaAllocationResult {
  [language: string]: number;
}

/**
 * Largest-remainder quota allocation algorithm (Hare-Niemeyer method with minimum-1 guarantee).
 *
 * Rules:
 * - If weights are missing, empty, or all-zero: weights are equal across all given languages.
 * - If a language has weight === 0, its quota is 0 (it is excluded from positive allocation).
 * - Total slots are allocated exactly to sum to `totalSlots`.
 * - If totalSlots >= number of languages with positive weight, every language with weight > 0
 *   is guaranteed at least 1 slot.
 */
export function allocateLanguageQuotas(
  languages: string[],
  weights?: Record<string, number> | null,
  totalSlots: number = 24,
): QuotaAllocationResult {
  if (totalSlots <= 0 || languages.length === 0) return {};

  const cleanLangs = Array.from(new Set(languages.map((l) => l.trim()).filter(Boolean)));
  if (cleanLangs.length === 0) return {};

  // Check if any positive weights exist
  let hasPositiveWeight = false;
  if (weights) {
    for (const l of cleanLangs) {
      if ((weights[l] ?? 0) > 0) {
        hasPositiveWeight = true;
        break;
      }
    }
  }

  // Active languages: if positive weights exist, only languages with weight > 0.
  // Otherwise, all cleanLangs are active with equal weight.
  const activeLangs = cleanLangs.filter((l) =>
    hasPositiveWeight ? (weights?.[l] ?? 0) > 0 : true,
  );

  const result: QuotaAllocationResult = {};
  for (const l of cleanLangs) {
    result[l] = 0;
  }

  if (activeLangs.length === 0) return result;

  const totalWeight = activeLangs.reduce(
    (sum, l) => sum + (hasPositiveWeight ? (weights?.[l] ?? 0) : 1),
    0,
  );

  if (totalWeight <= 0) return result;

  // Largest-remainder allocation
  const quotas: { lang: string; floor: number; rem: number; weight: number }[] = [];
  let sumFloors = 0;

  for (const lang of activeLangs) {
    const w = hasPositiveWeight ? (weights?.[lang] ?? 0) : 1;
    const exact = (totalSlots * w) / totalWeight;
    const floor = Math.floor(exact);
    const rem = exact - floor;
    quotas.push({ lang, floor, rem, weight: w });
    sumFloors += floor;
  }

  const leftover = totalSlots - sumFloors;
  // Sort by remainder descending, tie-break by higher weight, then lang
  quotas.sort((a, b) => b.rem - a.rem || b.weight - a.weight || a.lang.localeCompare(b.lang));

  for (let i = 0; i < leftover && i < quotas.length; i++) {
    quotas[i]!.floor += 1;
  }

  // Guarantee: Any language with weight > 0 gets at least 1 slot when totalSlots >= activeLangs.length
  if (totalSlots >= activeLangs.length) {
    for (const item of quotas) {
      if (item.floor === 0) {
        // Find donor with highest floor > 1
        let donor = quotas[0]!;
        for (const candidate of quotas) {
          if (candidate.floor > donor.floor) {
            donor = candidate;
          }
        }
        if (donor.floor > 1) {
          donor.floor -= 1;
          item.floor = 1;
        }
      }
    }
  }

  for (const q of quotas) {
    result[q.lang] = q.floor;
  }

  return result;
}

/**
 * Filters and selects candidate tracks to fulfill language quotas.
 * - Over-fetches up to ~1.5x before dedup/freshness.
 * - Distributes candidates into language buckets according to quotas.
 * - If any language runs short of candidates, refills from other languages that have spare candidates.
 */
export function enforceLanguageQuotas<T extends TrackLike>(
  candidates: T[],
  quotas: QuotaAllocationResult,
  targetCount: number,
): T[] {
  if (candidates.length <= targetCount && Object.keys(quotas).length === 0) {
    return candidates.slice(0, targetCount);
  }

  const activeLanguages = Object.keys(quotas).filter((l) => (quotas[l] ?? 0) > 0);
  if (activeLanguages.length === 0) {
    return candidates.slice(0, targetCount);
  }

  // Group candidates by language
  const buckets: Record<string, T[]> = {};
  for (const lang of activeLanguages) {
    buckets[lang] = [];
  }
  const leftoverCandidates: T[] = [];

  for (const track of candidates) {
    const lang = getTrackLanguage(track);
    const matchedLang = lang
      ? activeLanguages.find((l) => l.toLowerCase() === lang.toLowerCase())
      : undefined;

    if (matchedLang && buckets[matchedLang]) {
      buckets[matchedLang]!.push(track);
    } else {
      leftoverCandidates.push(track);
    }
  }

  const selected: T[] = [];
  const spares: T[] = [];
  let neededRefills = 0;

  // First pass: satisfy each language's quota
  for (const lang of activeLanguages) {
    const quota = quotas[lang] ?? 0;
    const pool = buckets[lang] || [];
    const taken = pool.slice(0, quota);
    selected.push(...taken);
    if (pool.length > quota) {
      spares.push(...pool.slice(quota));
    }
    if (taken.length < quota) {
      neededRefills += quota - taken.length;
    }
  }

  // Second pass: refill shortages from spares of other languages
  if (neededRefills > 0 && spares.length > 0) {
    const refill = spares.slice(0, neededRefills);
    selected.push(...refill);
    spares.splice(0, refill.length);
  }

  // Third pass: if still under targetCount, fill with remaining spares and leftover candidates
  if (selected.length < targetCount) {
    const remaining = [...spares, ...leftoverCandidates];
    const fill = remaining.slice(0, targetCount - selected.length);
    selected.push(...fill);
  }

  return selected.slice(0, targetCount);
}

/**
 * Applies language quotas to candidate tracks if and only if enabled.
 * If languageQuotas is absent (undefined) or false, returns candidates.slice(0, count),
 * maintaining strict parity with main.
 */
export function selectTracksWithLanguageQuotas<T extends TrackLike>(
  candidates: T[],
  count: number,
  languages: string[],
  languageWeights?: Record<string, number> | null,
  languageQuotas?: boolean | undefined,
): T[] {
  const isEnabled = languageQuotas ?? getRecFlag("languageQuotas");
  if (isEnabled && languageWeights && languages.length > 0) {
    const quotas = allocateLanguageQuotas(languages, languageWeights, count);
    return enforceLanguageQuotas(candidates, quotas, count);
  }
  return candidates.slice(0, count);
}

