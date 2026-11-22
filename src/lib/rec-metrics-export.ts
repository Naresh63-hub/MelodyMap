import { summarizeMetrics, getLanguageFeatureStd, type SourceSummary, type LanguageFeatureStdSummary } from "./rec-metrics";
import { getDiscountGamma } from "./bandit-policy";
import { getAllRecFlags, getRecConfigChangedAt, type RecFlagName } from "./rec-flags";
import { CURRENT_APP_VERSION } from "./app-update";

export interface MetricsExportPayload {
  exportedAt: string;
  appVersion: string;
  discountGamma: number;
  flags: Record<RecFlagName, boolean>;
  configChangedAt: string | null;
  summary7: Record<string, SourceSummary>;
  summary30: Record<string, SourceSummary>;
  languageFeatureStd: LanguageFeatureStdSummary;
}

export interface BuildMetricsExportOptions {
  now?: string | Date | undefined;
  appVersion?: string | undefined;
  discountGamma?: number | undefined;
  flags?: Record<RecFlagName, boolean> | undefined;
  configChangedAt?: string | null | undefined;
  summary7?: Record<string, SourceSummary> | undefined;
  summary30?: Record<string, SourceSummary> | undefined;
  languageFeatureStd?: LanguageFeatureStdSummary | undefined;
}

/**
 * Builds a pure, testable recommendation metrics export payload.
 * Aggregate counts only: strictly contains no titles, artists, or track IDs.
 */
export function buildMetricsExport(options: BuildMetricsExportOptions = {}): MetricsExportPayload {
  const exportedAt =
    typeof options.now === "string"
      ? options.now
      : options.now instanceof Date
        ? options.now.toISOString()
        : new Date().toISOString();

  const appVersion = options.appVersion ?? CURRENT_APP_VERSION;
  const discountGamma = options.discountGamma ?? getDiscountGamma();
  const flags = options.flags ?? getAllRecFlags();
  const configChangedAt = options.configChangedAt !== undefined ? options.configChangedAt : getRecConfigChangedAt();
  const summary7 = options.summary7 ?? summarizeMetrics(7);
  const summary30 = options.summary30 ?? summarizeMetrics(30);
  const languageFeatureStd = options.languageFeatureStd ?? getLanguageFeatureStd();

  return {
    exportedAt,
    appVersion,
    discountGamma,
    flags,
    configChangedAt,
    summary7,
    summary30,
    languageFeatureStd,
  };
}
