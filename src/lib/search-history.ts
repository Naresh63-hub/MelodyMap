import { useState, useEffect, useCallback } from "react";

export interface RecentSearchItem {
  query: string;
  timestamp: number;
}

export const SEARCH_HISTORY_STORAGE_KEY = "melodymap.search_history.v1";
export const MAX_RECENT_SEARCHES = 20;
export const SEARCH_HISTORY_EVENT = "melodymap:search-history-updated";

function dispatchSearchHistoryUpdate() {
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent(SEARCH_HISTORY_EVENT));
    } catch {
      // In non-standard environments, ignore event dispatch error
    }
  }
}

/**
 * Reads recent search items from localStorage.
 * Handles SSR safety, corrupt JSON, and legacy format normalization.
 */
export function getRecentSearches(): RecentSearchItem[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        if (typeof item === "string") {
          const q = item.trim();
          return q ? { query: q, timestamp: Date.now() } : null;
        }
        if (item && typeof item === "object" && typeof item.query === "string") {
          const q = item.query.trim();
          return q
            ? {
                query: q,
                timestamp: typeof item.timestamp === "number" ? item.timestamp : Date.now(),
              }
            : null;
        }
        return null;
      })
      .filter((item): item is RecentSearchItem => item !== null)
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

/**
 * Saves a search query to recent searches in localStorage.
 * - Trims query
 * - Case-insensitively deduplicates (moves the query to the front)
 * - Restricts history length to MAX_RECENT_SEARCHES
 * - Dispatches update event to synchronize UI
 */
export function saveRecentSearch(rawQuery: string): RecentSearchItem[] {
  const query = rawQuery.trim();
  if (!query) return getRecentSearches();

  if (typeof window === "undefined" || !window.localStorage) {
    return [{ query, timestamp: Date.now() }];
  }

  try {
    const existing = getRecentSearches();
    const queryLower = query.toLowerCase();

    // Remove any previous instance of this search (case-insensitive)
    const filtered = existing.filter((item) => item.query.toLowerCase() !== queryLower);

    const updated: RecentSearchItem[] = [
      { query, timestamp: Date.now() },
      ...filtered,
    ].slice(0, MAX_RECENT_SEARCHES);

    window.localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(updated));
    dispatchSearchHistoryUpdate();
    return updated;
  } catch {
    return getRecentSearches();
  }
}

/**
 * Removes a specific search query from history.
 */
export function removeRecentSearch(rawQuery: string): RecentSearchItem[] {
  const query = rawQuery.trim().toLowerCase();
  if (typeof window === "undefined" || !window.localStorage) return [];

  try {
    const existing = getRecentSearches();
    const updated = existing.filter((item) => item.query.toLowerCase() !== query);
    window.localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(updated));
    dispatchSearchHistoryUpdate();
    return updated;
  } catch {
    return getRecentSearches();
  }
}

/**
 * Clears all recent searches from localStorage.
 */
export function clearRecentSearches(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(SEARCH_HISTORY_STORAGE_KEY);
    dispatchSearchHistoryUpdate();
  } catch {}
}

/**
 * React hook to subscribe to recent search history and keep components in sync.
 */
export function useSearchHistory() {
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>(() => getRecentSearches());

  useEffect(() => {
    if (typeof window === "undefined") return;

    setRecentSearches(getRecentSearches());

    const handleUpdate = () => {
      setRecentSearches(getRecentSearches());
    };

    window.addEventListener(SEARCH_HISTORY_EVENT, handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener(SEARCH_HISTORY_EVENT, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const addSearch = useCallback((q: string) => {
    const next = saveRecentSearch(q);
    setRecentSearches(next);
  }, []);

  const removeSearch = useCallback((q: string) => {
    const next = removeRecentSearch(q);
    setRecentSearches(next);
  }, []);

  const clearHistory = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  return {
    recentSearches,
    addSearch,
    removeSearch,
    clearHistory,
  };
}
