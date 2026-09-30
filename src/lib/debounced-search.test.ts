import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDebouncedSearch } from "./debounced-search";

interface MockTrack {
  id: string;
  title: string;
}

describe("Debounced Search Controller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Test A: Typing a query automatically triggers search after debounce", async () => {
    const searchFn = vi.fn(async (query: string) => {
      return [{ id: "1", title: `Song for ${query}` }];
    });
    const onResults = vi.fn();
    const onSearchingChange = vi.fn();

    const controller = createDebouncedSearch<MockTrack>({
      debounceMs: 450,
      searchFn,
      onResults,
      onSearchingChange,
    });

    // User types "arijit"
    controller.setQuery("arijit");

    // Before debounce fires: searchFn has not been called yet
    expect(searchFn).not.toHaveBeenCalled();
    expect(onResults).not.toHaveBeenCalled();

    // Advance time by 449ms: still not called
    vi.advanceTimersByTime(449);
    expect(searchFn).not.toHaveBeenCalled();

    // Advance time past 450ms
    vi.advanceTimersByTime(1);
    await Promise.resolve(); // flush microtasks

    expect(searchFn).toHaveBeenCalledTimes(1);
    expect(searchFn).toHaveBeenCalledWith("arijit", expect.any(Object));
    expect(onResults).toHaveBeenCalledWith(
      [{ id: "1", title: "Song for arijit" }],
      "arijit",
      expect.objectContaining({ continuation: undefined, error: null }),
    );
  });

  it("Test B: Typing does not trigger one API request per character", async () => {
    const searchFn = vi.fn(async (query: string) => {
      return [{ id: "1", title: query }];
    });

    const controller = createDebouncedSearch<MockTrack>({
      debounceMs: 450,
      searchFn,
    });

    // User rapidly types: "a" -> "ar" -> "ari" -> "arij" -> "arijit" (100ms between each)
    controller.setQuery("a");
    vi.advanceTimersByTime(100);

    controller.setQuery("ar");
    vi.advanceTimersByTime(100);

    controller.setQuery("ari");
    vi.advanceTimersByTime(100);

    controller.setQuery("arij");
    vi.advanceTimersByTime(100);

    controller.setQuery("arijit");

    // Total elapsed: 400ms, but each keystroke reset the 450ms timer
    expect(searchFn).not.toHaveBeenCalled();

    // Now user stops typing. Advance 450ms.
    vi.advanceTimersByTime(450);
    await Promise.resolve();

    // Exactly 1 call was made for the final string, NOT 5 calls!
    expect(searchFn).toHaveBeenCalledTimes(1);
    expect(searchFn).toHaveBeenCalledWith("arijit", expect.any(Object));
  });

  it("Test C: Empty input does not trigger search", async () => {
    const searchFn = vi.fn(async () => []);
    const onClear = vi.fn();

    const controller = createDebouncedSearch<MockTrack>({
      debounceMs: 450,
      searchFn,
      onClear,
    });

    // User inputs empty string or spaces
    controller.setQuery("");
    vi.advanceTimersByTime(1000);
    expect(searchFn).not.toHaveBeenCalled();
    expect(onClear).toHaveBeenCalled();

    controller.setQuery("     ");
    vi.advanceTimersByTime(1000);
    expect(searchFn).not.toHaveBeenCalled();

    // If a user types something, then clears it:
    controller.setQuery("arijit");
    expect(searchFn).not.toHaveBeenCalled();
    controller.setQuery("");
    vi.advanceTimersByTime(1000);

    expect(searchFn).not.toHaveBeenCalled();
  });

  it("Test D: Rapid query changes only produce results for the latest query (cancels/discards stale requests)", async () => {
    let resolveFirstSearch: ((value: MockTrack[]) => void) | null = null;
    let resolveSecondSearch: ((value: MockTrack[]) => void) | null = null;

    const searchFn = vi.fn((query: string) => {
      if (query === "arijit") {
        return new Promise<MockTrack[]>((resolve) => {
          resolveFirstSearch = resolve;
        });
      }
      return new Promise<MockTrack[]>((resolve) => {
        resolveSecondSearch = resolve;
      });
    });

    const onResults = vi.fn();

    const controller = createDebouncedSearch<MockTrack>({
      debounceMs: 450,
      searchFn,
      onResults,
    });

    // 1. User types "arijit"
    controller.setQuery("arijit");
    vi.advanceTimersByTime(450);
    expect(searchFn).toHaveBeenCalledTimes(1);
    expect(searchFn).toHaveBeenCalledWith("arijit", expect.any(Object));

    // Request 1 is in-flight...
    // 2. User now quickly updates query to "arijit singh"
    controller.setQuery("arijit singh");
    vi.advanceTimersByTime(450);
    expect(searchFn).toHaveBeenCalledTimes(2);
    expect(searchFn).toHaveBeenCalledWith("arijit singh", expect.any(Object));

    // 3. Suppose Request 1 ("arijit") resolves NOW (stale!)
    resolveFirstSearch!([{ id: "old_1", title: "Tum Hi Ho (arijit)" }]);
    await Promise.resolve();

    // onResults must NOT be called with the stale "arijit" results!
    expect(onResults).not.toHaveBeenCalled();

    // 4. Request 2 ("arijit singh") resolves
    resolveSecondSearch!([{ id: "new_1", title: "Kesariya (arijit singh)" }]);
    await Promise.resolve();

    // onResults called ONLY with the latest query's results!
    expect(onResults).toHaveBeenCalledTimes(1);
    expect(onResults).toHaveBeenCalledWith(
      [{ id: "new_1", title: "Kesariya (arijit singh)" }],
      "arijit singh",
      expect.any(Object),
    );
  });

  it("Test E: Search button still works as an optional manual trigger", async () => {
    const searchFn = vi.fn(async (query: string) => {
      return [{ id: "instant", title: `Instant result for ${query}` }];
    });
    const onResults = vi.fn();

    const controller = createDebouncedSearch<MockTrack>({
      debounceMs: 450,
      searchFn,
      onResults,
    });

    // User types "arijit"
    controller.setQuery("arijit");
    expect(searchFn).not.toHaveBeenCalled();

    // User clicks the Search button immediately (before debounce expires)
    await controller.searchImmediately();

    // Search triggered immediately!
    expect(searchFn).toHaveBeenCalledTimes(1);
    expect(searchFn).toHaveBeenCalledWith("arijit", expect.any(Object));
    expect(onResults).toHaveBeenCalledWith(
      [{ id: "instant", title: "Instant result for arijit" }],
      "arijit",
      expect.any(Object),
    );

    // After 500ms, the previous debounce timer should NOT trigger a redundant second call
    vi.advanceTimersByTime(500);
    await Promise.resolve();
    expect(searchFn).toHaveBeenCalledTimes(1);
  });
});
