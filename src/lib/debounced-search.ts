/**
 * Debounced search controller with automatic cancellation of stale requests.
 *
 * Guarantees:
 * 1. Automatic triggering after debounce delay (default 450ms: between 400-500ms).
 * 2. Typing multiple characters does NOT send one API request per character.
 * 3. Empty / whitespace-only queries do NOT trigger search and reset results.
 * 4. Stale / out-of-order responses from earlier queries are discarded.
 * 5. Manual trigger (Search button / Enter key) runs immediately and cancels pending debounce.
 */

export interface SearchResultEnvelope<T> {
  tracks?: T[] | undefined;
  continuation?: string | undefined;
  error?: string | null | undefined;
}

export interface SearchControllerOptions<T> {
  /** Debounce delay in milliseconds. Defaults to 450ms. */
  debounceMs?: number | undefined;
  /** Async search function. */
  searchFn: (
    query: string,
    signal?: AbortSignal,
  ) => Promise<T[] | SearchResultEnvelope<T>>;
  /** Callback when valid, non-stale results are returned. */
  onResults?: (
    results: T[],
    query: string,
    meta?: { continuation?: string | undefined; error?: string | null | undefined },
  ) => void;
  /** Callback when search loading state changes. */
  onSearchingChange?: (searching: boolean) => void;
  /** Callback when query is cleared. */
  onClear?: () => void;
  /** Callback on error. */
  onError?: (error: unknown, query: string) => void;
}

export interface DebouncedSearchController<T> {
  /** Update query text (triggers debounce if non-empty). */
  setQuery: (query: string) => void;
  /** Get current query text. */
  getQuery: () => string;
  /** Immediately run search for the query (or provided override), cancelling any pending timer. */
  searchImmediately: (queryOverride?: string) => Promise<void>;
  /** Cancel any pending debounce timer and invalidate any in-flight request. */
  cancel: () => void;
  /** Clear query and results. */
  clear: () => void;
  /** Returns whether a search request is currently in flight. */
  isSearching: () => boolean;
  /** Cleanup timers and controllers. */
  destroy: () => void;
}

export function createDebouncedSearch<T>(
  options: SearchControllerOptions<T>,
): DebouncedSearchController<T> {
  const debounceMs = options.debounceMs ?? 450;
  let currentQuery = "";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let searching = false;
  let currentToken = 0;
  let currentAbortController: AbortController | null = null;

  const setSearching = (val: boolean) => {
    if (searching !== val) {
      searching = val;
      options.onSearchingChange?.(val);
    }
  };

  const cancelPendingTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const abortInFlight = () => {
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
    currentToken++;
  };

  const executeSearch = async (queryToSearch: string) => {
    const trimmed = queryToSearch.trim();
    if (!trimmed) {
      cancelPendingTimer();
      abortInFlight();
      setSearching(false);
      options.onClear?.();
      return;
    }

    cancelPendingTimer();
    abortInFlight();

    const requestToken = ++currentToken;
    const abortCtrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    currentAbortController = abortCtrl;
    setSearching(true);

    try {
      const res = await options.searchFn(trimmed, abortCtrl?.signal);
      // Discard stale or superseded responses
      if (requestToken !== currentToken) {
        return;
      }

      let tracks: T[] = [];
      let continuation: string | undefined;
      let error: string | null = null;

      if (Array.isArray(res)) {
        tracks = res;
      } else if (res && typeof res === "object") {
        if (Array.isArray(res.tracks)) {
          tracks = res.tracks;
        }
        continuation = res.continuation;
        error = res.error ?? null;
      }

      options.onResults?.(tracks, trimmed, { continuation, error });
    } catch (err: unknown) {
      if (requestToken !== currentToken) {
        return;
      }
      // If error is an abort error, ignore it
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      options.onError?.(err, trimmed);
    } finally {
      if (requestToken === currentToken) {
        setSearching(false);
        currentAbortController = null;
      }
    }
  };

  return {
    setQuery(newQuery: string) {
      currentQuery = newQuery;
      cancelPendingTimer();

      const trimmed = newQuery.trim();
      if (!trimmed) {
        abortInFlight();
        setSearching(false);
        options.onClear?.();
        return;
      }

      timer = setTimeout(() => {
        timer = null;
        void executeSearch(trimmed);
      }, debounceMs);
    },

    getQuery() {
      return currentQuery;
    },

    async searchImmediately(queryOverride?: string) {
      if (queryOverride !== undefined) {
        currentQuery = queryOverride;
      }
      cancelPendingTimer();
      await executeSearch(currentQuery);
    },

    cancel() {
      cancelPendingTimer();
      abortInFlight();
      setSearching(false);
    },

    clear() {
      currentQuery = "";
      cancelPendingTimer();
      abortInFlight();
      setSearching(false);
      options.onClear?.();
    },

    isSearching() {
      return searching;
    },

    destroy() {
      cancelPendingTimer();
      abortInFlight();
      setSearching(false);
    },
  };
}
