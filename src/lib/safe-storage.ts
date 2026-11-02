/**
 * MelodyMap Resilient Safe Storage Adapter
 *
 * Implements the standard Web Storage interface (getItem, setItem, removeItem, clear)
 * with robust in-memory fallback.
 *
 * Prevents fatal DOMExceptions (e.g. `SecurityError: Failed to read the 'localStorage'
 * property from 'Window': Access is denied for this document`) when MelodyMap runs
 * inside restricted environments:
 * - Mobile email in-app browsers (Gmail, Outlook, Yahoo)
 * - Privacy-restricted WebViews & sandboxed iframes
 * - Browsers with third-party storage or cookies disabled
 * - Safari strict private browsing
 */

export interface SafeStorageProvider {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  key?(index: number): string | null;
  readonly length?: number;
  isStorageAvailable(): boolean;
  readonly isPersistent: boolean;
}

type StorageType = "localStorage" | "sessionStorage";

function getGlobalStorage(type: StorageType = "localStorage"): Storage | null {
  try {
    if (typeof window !== "undefined" && window[type]) {
      return window[type];
    }
  } catch {}
  try {
    if (typeof globalThis !== "undefined" && (globalThis as any)[type]) {
      return (globalThis as any)[type];
    }
  } catch {}
  return null;
}

export class SafeStorageImpl implements SafeStorageProvider {
  private memory = new Map<string, string>();
  private tested = false;
  private available = false;
  private readonly storageType: StorageType;

  constructor(type: StorageType = "localStorage") {
    this.storageType = type;
  }

  private checkAvailability(): boolean {
    // Re-check if tested was reset or if availability is uncertain
    try {
      const storage = getGlobalStorage(this.storageType);
      if (!storage) {
        this.available = false;
        this.tested = true;
        return false;
      }
      if (this.tested) return this.available;

      const testKey = `__melodymap_storage_probe_${Math.random().toString(36).slice(2)}__`;
      storage.setItem(testKey, "1");
      const readBack = storage.getItem(testKey);
      storage.removeItem(testKey);
      this.available = readBack === "1";
      this.tested = true;
      return this.available;
    } catch {
      // Storage is denied or restricted
      this.available = false;
      this.tested = true;
      return false;
    }
  }

  public resetProbeForTest(): void {
    this.tested = false;
    this.available = false;
    this.memory.clear();
  }

  public isStorageAvailable(): boolean {
    return this.checkAvailability();
  }

  public get isPersistent(): boolean {
    return this.checkAvailability();
  }

  public getItem(key: string): string | null {
    if (this.checkAvailability()) {
      try {
        const storage = getGlobalStorage(this.storageType);
        if (storage) {
          const val = storage.getItem(key);
          if (val !== null) return val;
          return this.memory.get(key) ?? null;
        }
      } catch {
        return this.memory.get(key) ?? null;
      }
    }
    return this.memory.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    const stringVal = String(value);
    if (this.checkAvailability()) {
      try {
        const storage = getGlobalStorage(this.storageType);
        if (storage) {
          storage.setItem(key, stringVal);
          return;
        }
      } catch {
        // Quota exceeded or permission revoked
      }
    }
    this.memory.set(key, stringVal);
  }

  public removeItem(key: string): void {
    if (this.checkAvailability()) {
      try {
        const storage = getGlobalStorage(this.storageType);
        if (storage) {
          storage.removeItem(key);
        }
      } catch {}
    }
    this.memory.delete(key);
  }

  public clear(): void {
    if (this.checkAvailability()) {
      try {
        const storage = getGlobalStorage(this.storageType);
        if (storage) {
          storage.clear();
        }
      } catch {}
    }
    this.memory.clear();
  }

  public key(index: number): string | null {
    if (this.checkAvailability()) {
      try {
        const storage = getGlobalStorage(this.storageType);
        if (storage) return storage.key(index);
      } catch {
        return Array.from(this.memory.keys())[index] ?? null;
      }
    }
    return Array.from(this.memory.keys())[index] ?? null;
  }

  public get length(): number {
    if (this.checkAvailability()) {
      try {
        const storage = getGlobalStorage(this.storageType);
        if (storage) return storage.length;
      } catch {
        return this.memory.size;
      }
    }
    return this.memory.size;
  }
}

export const safeStorage = new SafeStorageImpl("localStorage");
export const safeSessionStorage = new SafeStorageImpl("sessionStorage");
