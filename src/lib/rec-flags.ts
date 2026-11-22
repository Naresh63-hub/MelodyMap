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

export function setRecFlag(name: RecFlagName, value: boolean): void {
  try {
    safeStorage.setItem(flagStorageKey(name), value ? "1" : "0");
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
