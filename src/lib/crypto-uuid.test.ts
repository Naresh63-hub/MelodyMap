import { describe, it, expect } from "vitest";

describe("Secure ID generation via crypto.randomUUID", () => {
  it("generates RFC 4122 compliant UUIDs using crypto.randomUUID", () => {
    const id = crypto.randomUUID();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("produces unique identifiers with zero collisions across 1,000 iterations", () => {
    const set = new Set<string>();
    const iterations = 1000;
    for (let i = 0; i < iterations; i++) {
      const id = crypto.randomUUID();
      expect(set.has(id)).toBe(false);
      set.add(id);
    }
    expect(set.size).toBe(iterations);
  });
});
