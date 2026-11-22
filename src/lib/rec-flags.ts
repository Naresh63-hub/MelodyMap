import { safeStorage } from "./safe-storage";

export type RecFlagName =
  | "singlePassRanking"
  | "trainOnFullTrack"
  | "leakFreeTrainingContext"
  | "languageFeature"
  | "artistRecentSkipFeature"
  | "noveltyMomentumFeature"
  | "movieTieBreaker"
  | "tasteArtistMix"
  | "languageQuotas"
  | "webAudioEq";

export interface RecFlagDef {
  name: RecFlagName;
  label: string;
  description: string;
  defaultValue: boolean;
}

export const REC_FLAG_DEFS: RecFlagDef[] = [
  {
    name: "singlePassRanking",
    label: "Single-Pass Ranking",
    description: "Rank full candidate pool once after seed collection instead of per-page",
    defaultValue: true,
  },
  {
    name: "trainOnFullTrack",
    label: "Train on Full Track",
    description: "Use full track metadata from playback cache for bandit training instead of stubs",
    defaultValue: true,
  },
  {
    name: "leakFreeTrainingContext",
    label: "Leak-Free Training Context",
    description: "Rewind predecessor track and strip post-event mutations during bandit training",
    defaultValue: false,
  },
  {
    name: "languageFeature",
    label: "Language Feature (x5)",
    description: "Pure language coherence for candidate ranking via getTrackLanguage (coordinate 5)",
    defaultValue: false,
  },
  {
    name: "artistRecentSkipFeature",
    label: "Artist Recent Skip Feature (x6)",
    description: "Artist recent skip health signal over last 10 plays (coordinate 6)",
    defaultValue: false,
  },
  {
    name: "noveltyMomentumFeature",
    label: "Novelty Momentum Feature (x7)",
    description: "Unfamiliarity interaction with session momentum (coordinate 7)",
    defaultValue: false,
  },
  {
    name: "movieTieBreaker",
    label: "Movie Preference Tie-Breaker",
    description: "Prefer movie/soundtrack tracks only within 10% of score range instead of absolute priority",
    defaultValue: false,
  },
  {
    name: "tasteArtistMix",
    label: "Taste-Artist AutoDJ Mix",
    description: "Interleave top taste-artist radio tracks into AutoDJ queue based on discovery ratio",
    defaultValue: false,
  },
  {
    name: "languageQuotas",
    label: "Language Ratio Quotas",
    description: "Scale candidate quotas proportionally to language weights using largest-remainder allocation",
    defaultValue: false,
  },
  {
    name: "webAudioEq",
    label: "Web Audio Equalizer & Crossfade",
    description: "Enable 10-band biquad filter audio graph and gain crossfading for HTML5 audio",
    defaultValue: false,
  },
];

export const DEFAULT_FLAGS: Record<RecFlagName, boolean> = REC_FLAG_DEFS.reduce(
  (acc, def) => {
    acc[def.name] = def.defaultValue;
    return acc;
  },
  {} as Record<RecFlagName, boolean>,
);

function flagStorageKey(name: RecFlagName): string {
  return `melodymap.flag.${name}`;
}

export function getRecFlag(name: RecFlagName): boolean {
  try {
    const raw = safeStorage.getItem(flagStorageKey(name));
    if (raw === "0") return false;
    if (raw === "1") return true;
    return DEFAULT_FLAGS[name];
  } catch {
    return DEFAULT_FLAGS[name];
  }
}

export const REC_CONFIG_CHANGED_AT_KEY = "melodymap.rec_config_changed_at";
export const DEV_MODE_STORAGE_KEY = "melodymap.dev_mode";

export function isDevModeEnabled(): boolean {
  try {
    return safeStorage.getItem(DEV_MODE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setDevModeEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      safeStorage.setItem(DEV_MODE_STORAGE_KEY, "1");
    } else {
      safeStorage.removeItem(DEV_MODE_STORAGE_KEY);
    }
  } catch {}
}

export function getRecConfigChangedAt(): string | null {
  try {
    return safeStorage.getItem(REC_CONFIG_CHANGED_AT_KEY);
  } catch {
    return null;
  }
}

export function touchRecConfigChangedAt(): string {
  const iso = new Date().toISOString();
  try {
    safeStorage.setItem(REC_CONFIG_CHANGED_AT_KEY, iso);
  } catch {
    // best-effort persistence
  }
  return iso;
}

export function setRecFlag(name: RecFlagName, value: boolean): void {
  const current = getRecFlag(name);
  if (current === value) return;
  try {
    safeStorage.setItem(flagStorageKey(name), value ? "1" : "0");
    touchRecConfigChangedAt();
  } catch {
    // best-effort persistence
  }
}

export function getAllRecFlags(): Record<RecFlagName, boolean> {
  const flags = {} as Record<RecFlagName, boolean>;
  for (const def of REC_FLAG_DEFS) {
    flags[def.name] = getRecFlag(def.name);
  }
  return flags;
}
