/**
 * Generic, memory-bounded Least-Recently-Used (LRU) Cache with TTL support.
 */
export interface LruCache<T> {
  get(key: string): T | null;
  set(key: string, data: T): void;
  delete(key: string): void;
  clear(): void;
  size(): number;
}

export function createLruCache<T>(maxSize = 200, ttlMs = 25 * 60 * 1000): LruCache<T> {
  const map = new Map<string, { data: T; at: number }>();

  return {
    get(key: string): T | null {
      const entry = map.get(key);
      if (!entry) return null;
      if (Date.now() - entry.at > ttlMs) {
        map.delete(key);
        return null;
      }
      // Refresh position in Map (LRU order)
      map.delete(key);
      map.set(key, entry);
      return entry.data;
    },

    set(key: string, data: T): void {
      while (map.size >= maxSize) {
        const oldestKey = map.keys().next().value;
        if (oldestKey) map.delete(oldestKey);
        else break;
      }
      map.set(key, { data, at: Date.now() });
    },

    delete(key: string): void {
      map.delete(key);
    },

    clear(): void {
      map.clear();
    },

    size(): number {
      return map.size;
    },
  };
}
