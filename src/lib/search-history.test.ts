import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getRecentSearches,
  saveRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
  SEARCH_HISTORY_STORAGE_KEY,
  MAX_RECENT_SEARCHES,
  SEARCH_HISTORY_EVENT,
} from "./search-history";

describe("Search History Local Storage", () => {
  let storage: Map<string, string>;
  let listeners: Map<string, Set<(e: Event) => void>>;

  beforeEach(() => {
    storage = new Map<string, string>();
    listeners = new Map();

    const mockLocalStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, String(value));
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    };

    const mockWindow = {
      localStorage: mockLocalStorage,
      addEventListener: (type: string, listener: (e: Event) => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(listener);
      },
      removeEventListener: (type: string, listener: (e: Event) => void) => {
        listeners.get(type)?.delete(listener);
      },
      dispatchEvent: (event: Event) => {
        listeners.get(event.type)?.forEach((fn) => fn(event));
        return true;
      },
    };

    // Polyfill CustomEvent if not in Node
    type CustomEventConstructor = new (type: string, params?: { detail?: unknown }) => Event & { detail?: unknown };
    const globalWithCustomEvent = globalThis as unknown as { CustomEvent?: CustomEventConstructor };
    if (typeof globalWithCustomEvent.CustomEvent === "undefined") {
      globalWithCustomEvent.CustomEvent = class CustomEvent extends Event {
        detail: unknown;
        constructor(type: string, params?: { detail?: unknown }) {
          super(type);
          this.detail = params?.detail;
        }
      };
    }

    vi.stubGlobal("window", mockWindow);
    vi.stubGlobal("localStorage", mockLocalStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns an empty array when no history exists", () => {
    expect(getRecentSearches()).toEqual([]);
  });

  it("saves a valid search query and stores it in localStorage", () => {
    const updated = saveRecentSearch("Coldplay");
    expect(updated).toHaveLength(1);
    expect(updated[0]?.query).toBe("Coldplay");
    expect(typeof updated[0]?.timestamp).toBe("number");

    const raw = storage.get(SEARCH_HISTORY_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed[0].query).toBe("Coldplay");
  });

  it("trims whitespace from queries and ignores empty or blank queries", () => {
    saveRecentSearch("  Dua Lipa  ");
    expect(getRecentSearches()[0]?.query).toBe("Dua Lipa");

    const before = getRecentSearches();
    saveRecentSearch("   ");
    expect(getRecentSearches()).toEqual(before);
  });

  it("case-insensitively deduplicates and moves repeated queries to the top", () => {
    saveRecentSearch("Drake");
    saveRecentSearch("The Weeknd");
    saveRecentSearch("drake");

    const history = getRecentSearches();
    expect(history).toHaveLength(2);
    expect(history[0]?.query).toBe("drake");
    expect(history[1]?.query).toBe("The Weeknd");
  });

  it("caps maximum history length to MAX_RECENT_SEARCHES", () => {
    for (let i = 1; i <= MAX_RECENT_SEARCHES + 10; i++) {
      saveRecentSearch(`Artist ${i}`);
    }

    const history = getRecentSearches();
    expect(history).toHaveLength(MAX_RECENT_SEARCHES);
    expect(history[0]?.query).toBe(`Artist ${MAX_RECENT_SEARCHES + 10}`);
  });

  it("removes an individual query from history case-insensitively", () => {
    saveRecentSearch("Queen");
    saveRecentSearch("Abba");
    saveRecentSearch("Beatles");

    removeRecentSearch("abba");

    const history = getRecentSearches();
    expect(history.map((h) => h.query)).toEqual(["Beatles", "Queen"]);
  });

  it("clears all recent searches", () => {
    saveRecentSearch("Adele");
    saveRecentSearch("Eminem");
    expect(getRecentSearches()).toHaveLength(2);

    clearRecentSearches();
    expect(getRecentSearches()).toEqual([]);
    expect(storage.get(SEARCH_HISTORY_STORAGE_KEY)).toBeUndefined();
  });

  it("gracefully handles corrupt JSON in localStorage", () => {
    storage.set(SEARCH_HISTORY_STORAGE_KEY, "invalid-json{{}");
    expect(getRecentSearches()).toEqual([]);
  });

  it("backwards-compatible: correctly parses legacy string-array format", () => {
    storage.set(
      SEARCH_HISTORY_STORAGE_KEY,
      JSON.stringify(["Kendrick Lamar", "J. Cole", "Travis Scott"]),
    );

    const history = getRecentSearches();
    expect(history).toHaveLength(3);
    expect(history[0]?.query).toBe("Kendrick Lamar");
    expect(typeof history[0]?.timestamp).toBe("number");
  });

  it("dispatches custom event on save, remove, and clear", () => {
    const listener = vi.fn();
    window.addEventListener(SEARCH_HISTORY_EVENT, listener);

    saveRecentSearch("Rihanna");
    expect(listener).toHaveBeenCalledTimes(1);

    removeRecentSearch("Rihanna");
    expect(listener).toHaveBeenCalledTimes(2);

    clearRecentSearches();
    expect(listener).toHaveBeenCalledTimes(3);

    window.removeEventListener(SEARCH_HISTORY_EVENT, listener);
  });
});
