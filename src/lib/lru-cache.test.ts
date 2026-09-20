import { describe, expect, it } from "vitest";

import { createLruCache } from "./lru-cache";

describe("createLruCache", () => {
  it("stores and retrieves values", () => {
    const cache = createLruCache<number>(3);
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
    expect(cache.get("missing")).toBeNull();
  });

  it("evicts the least-recently-used entry at capacity", () => {
    const cache = createLruCache<number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a"); // refresh a
    cache.set("c", 3); // evicts b
    expect(cache.get("b")).toBeNull();
    expect(cache.get("a")).toBe(1);
    expect(cache.get("c")).toBe(3);
  });

  it("reports size, delete, and clear", () => {
    const cache = createLruCache<number>(3);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.size()).toBe(2);
    cache.delete("a");
    expect(cache.size()).toBe(1);
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get("b")).toBeNull();
  });
});
