import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { safeStorage, safeSessionStorage, SafeStorageImpl } from "./safe-storage";

describe("SafeStorage Adapter Suite", () => {
  let originalLocalStorage: any;
  let originalSessionStorage: any;

  beforeEach(() => {
    originalLocalStorage = (globalThis as any).localStorage;
    originalSessionStorage = (globalThis as any).sessionStorage;
    safeStorage.clear();
  });

  afterEach(() => {
    (globalThis as any).localStorage = originalLocalStorage;
    (globalThis as any).sessionStorage = originalSessionStorage;
    vi.restoreAllMocks();
  });

  // 1. Normal localStorage operation
  it("Scenario 1: Normal localStorage operation stores, retrieves, and clears values", () => {
    safeStorage.setItem("user.theme", "dark");
    expect(safeStorage.getItem("user.theme")).toBe("dark");

    safeStorage.removeItem("user.theme");
    expect(safeStorage.getItem("user.theme")).toBeNull();

    safeStorage.setItem("k1", "v1");
    safeStorage.setItem("k2", "v2");
    expect(safeStorage.getItem("k1")).toBe("v1");
    safeStorage.clear();
    expect(safeStorage.getItem("k1")).toBeNull();
    expect(safeStorage.getItem("k2")).toBeNull();
  });

  // 2. Accessing the localStorage property throws (e.g. Gmail/Outlook in-app browser)
  it("Scenario 2: Accessing the localStorage property throws Access Denied DOMException", () => {
    const restrictedWindow = {};
    Object.defineProperty(restrictedWindow, "localStorage", {
      configurable: true,
      get() {
        throw new Error("Failed to read the 'localStorage' property from 'Window': Access is denied for this document.");
      },
    });

    const originalWin = (globalThis as any).window;
    (globalThis as any).window = restrictedWindow;

    try {
      const storageInstance = new SafeStorageImpl("localStorage");
      expect(storageInstance.isStorageAvailable()).toBe(false);
      expect(storageInstance.isPersistent).toBe(false);

      // Verify that all methods execute safely without crashing React
      expect(() => storageInstance.setItem("offline_token", "abc123xyz")).not.toThrow();
      expect(storageInstance.getItem("offline_token")).toBe("abc123xyz");
      expect(() => storageInstance.removeItem("offline_token")).not.toThrow();
      expect(storageInstance.getItem("offline_token")).toBeNull();
    } finally {
      (globalThis as any).window = originalWin;
    }
  });

  // 3. getItem() throws
  it("Scenario 3: getItem() throws on underlying storage", () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error("SecurityError: Access is denied");
      },
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };

    (globalThis as any).localStorage = throwingStorage;
    const storageInstance = new SafeStorageImpl("localStorage");

    expect(() => storageInstance.getItem("test_key")).not.toThrow();
    expect(storageInstance.getItem("test_key")).toBeNull();
  });

  // 4. setItem() throws (e.g. QuotaExceededError or mid-session restriction)
  it("Scenario 4: setItem() throws on underlying storage", () => {
    const store = new Map<string, string>();
    const quotaStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: () => {
        throw new Error("QuotaExceededError: The quota has been exceeded");
      },
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    };

    (globalThis as any).localStorage = quotaStorage;
    const storageInstance = new SafeStorageImpl("localStorage");

    expect(() => storageInstance.setItem("large_payload", "chunk_data")).not.toThrow();
    // Falls back to in-memory store seamlessly
    expect(storageInstance.getItem("large_payload")).toBe("chunk_data");
  });

  // 5. removeItem() throws
  it("Scenario 5: removeItem() throws on underlying storage", () => {
    const throwingStorage = {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: () => {
        throw new Error("SecurityError: Operation not permitted");
      },
      clear: vi.fn(),
    };

    (globalThis as any).localStorage = throwingStorage;
    const storageInstance = new SafeStorageImpl("localStorage");

    expect(() => storageInstance.removeItem("any_key")).not.toThrow();
  });

  // 6. clear() throws
  it("Scenario 6: clear() throws on underlying storage", () => {
    const throwingStorage = {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: () => {
        throw new Error("SecurityError: Operation not permitted");
      },
    };

    (globalThis as any).localStorage = throwingStorage;
    const storageInstance = new SafeStorageImpl("localStorage");

    storageInstance.setItem("temp_key", "value");
    expect(() => storageInstance.clear()).not.toThrow();
    expect(storageInstance.getItem("temp_key")).toBeNull();
  });

  // 7. In-memory fallback
  it("Scenario 7: In-memory fallback retains values in session and manages keys and length", () => {
    (globalThis as any).localStorage = undefined;
    const memoryStorage = new SafeStorageImpl("localStorage");

    expect(memoryStorage.isStorageAvailable()).toBe(false);
    expect(memoryStorage.isPersistent).toBe(false);

    memoryStorage.setItem("session_user", "listener_42");
    memoryStorage.setItem("guest_mode", "true");

    expect(memoryStorage.getItem("session_user")).toBe("listener_42");
    expect(memoryStorage.getItem("guest_mode")).toBe("true");
    expect(memoryStorage.length).toBe(2);

    memoryStorage.removeItem("guest_mode");
    expect(memoryStorage.getItem("guest_mode")).toBeNull();
    expect(memoryStorage.length).toBe(1);

    memoryStorage.clear();
    expect(memoryStorage.length).toBe(0);
  });

  // 8. Supabase storage adapter compatibility
  it("Scenario 8: Supabase storage adapter compatibility with SupportedStorage interface", () => {
    // Supabase GoTrue expects getItem, setItem, removeItem to be callable
    const supabaseStorage = safeStorage;

    expect(typeof supabaseStorage.getItem).toBe("function");
    expect(typeof supabaseStorage.setItem).toBe("function");
    expect(typeof supabaseStorage.removeItem).toBe("function");

    supabaseStorage.setItem("sb-access-token", "jwt.token.mock");
    expect(supabaseStorage.getItem("sb-access-token")).toBe("jwt.token.mock");
    supabaseStorage.removeItem("sb-access-token");
    expect(supabaseStorage.getItem("sb-access-token")).toBeNull();
  });

  // SafeSessionStorage tests
  it("supports safeSessionStorage with in-memory fallback", () => {
    safeSessionStorage.clear();
    safeSessionStorage.setItem("chunk_recovery", "12345678");
    expect(safeSessionStorage.getItem("chunk_recovery")).toBe("12345678");
    safeSessionStorage.removeItem("chunk_recovery");
    expect(safeSessionStorage.getItem("chunk_recovery")).toBeNull();
  });
});
