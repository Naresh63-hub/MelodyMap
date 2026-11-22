import { safeStorage } from "./safe-storage";

export type RecFlagName = "singlePassRanking" | "trainOnFullTrack";

export const DEFAULT_FLAGS: Record<RecFlagName, boolean> = {
  singlePassRanking: true,
  trainOnFullTrack: true,
};

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
  return {
    singlePassRanking: getRecFlag("singlePassRanking"),
    trainOnFullTrack: getRecFlag("trainOnFullTrack"),
  };
}
