import { AdapterCache } from "../AdapterCache";
import { CacheEvictionPolicy, AdapterResponse } from "../AdapterCacheTypes";

describe("AdapterCache", () => {
  let cache: AdapterCache;
  const defaultConfig = {
    maxSize: 10000,
    maxEntries: 100,
    ttlMs: 60000,
    evictionPolicy: CacheEvictionPolicy.LRU,
  };

  const createResponse = (adapterId: string, data: unknown = {}): AdapterResponse => ({
    status: "success",
    data,
    timestamp: Date.now(),
    adapterId,
  });

  beforeEach(() => {
    cache = new AdapterCache(defaultConfig);
  });

  describe("basic cache operations", () => {
    it("stores and retrieves cached entries", () => {
      const response = createResponse("adapter1", { value: "test" });
      cache.set("key1", response);

      const retrieved = cache.get("key1");
      expect(retrieved).toEqual(response);
    });

    it("returns null for missing keys", () => {
      const retrieved = cache.get("nonexistent");
      expect(retrieved).toBeNull();
    });

    it("invalidates cache entries", () => {
      const response = createResponse("adapter1", { value: "test" });
      cache.set("key1", response);

      const invalidated = cache.invalidate("key1");
      expect(invalidated).toBe(true);

      const retrieved = cache.get("key1");
      expect(retrieved).toBeNull();
    });

    it("returns false when invalidating nonexistent key", () => {
      const invalidated = cache.invalidate("nonexistent");
      expect(invalidated).toBe(false);
    });
  });

  describe("expiration and TTL", () => {
    it("respects TTL and returns null for expired entries", () => {
      const now = Date.now();
      const response = createResponse("adapter1", { value: "test" });
      cache.set("key1", response, now);

      const retrieved = cache.get("key1", now + 61000);
      expect(retrieved).toBeNull();
    });

    it("returns valid entries before expiration", () => {
      const now = Date.now();
      const response = createResponse("adapter1", { value: "test" });
      cache.set("key1", response, now);

      const retrieved = cache.get("key1", now + 30000);
      expect(retrieved).toEqual(response);
    });

    it("prunes expired entries", () => {
      const now = Date.now();
      cache.set("key1", createResponse("adapter1"), now);
      cache.set("key2", createResponse("adapter2"), now);

      const pruned = cache.prune(now + 61000);
      expect(pruned).toBe(2);

      expect(cache.get("key1", now + 61000)).toBeNull();
      expect(cache.get("key2", now + 61000)).toBeNull();
    });
  });

  describe("prefix invalidation", () => {
    it("invalidates all entries matching prefix", () => {
      cache.set("adapter1:key1", createResponse("adapter1"));
      cache.set("adapter1:key2", createResponse("adapter1"));
      cache.set("adapter2:key1", createResponse("adapter2"));

      const invalidated = cache.invalidateByPrefix("adapter1:");
      expect(invalidated).toBe(2);

      expect(cache.get("adapter1:key1")).toBeNull();
      expect(cache.get("adapter1:key2")).toBeNull();
      expect(cache.get("adapter2:key1")).not.toBeNull();
    });

    it("returns 0 when no entries match prefix", () => {
      const invalidated = cache.invalidateByPrefix("nonexistent:");
      expect(invalidated).toBe(0);
    });
  });

  describe("cache metrics", () => {
    it("tracks hit count", () => {
      cache.set("key1", createResponse("adapter1"));
      cache.get("key1");
      cache.get("key1");

      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(2);
    });

    it("tracks miss count", () => {
      cache.get("key1");
      cache.get("key2");

      const metrics = cache.getMetrics();
      expect(metrics.misses).toBe(2);
    });

    it("calculates hit rate correctly", () => {
      cache.set("key1", createResponse("adapter1"));
      cache.get("key1");
      cache.get("key1");
      cache.get("nonexistent");

      const metrics = cache.getMetrics();
      expect(metrics.hitRate).toBe(2 / 3);
    });

    it("tracks current size and entries", () => {
      cache.set("key1", createResponse("adapter1", { data: "test" }));
      cache.set("key2", createResponse("adapter2", { data: "test2" }));

      const metrics = cache.getMetrics();
      expect(metrics.currentEntries).toBe(2);
      expect(metrics.currentSize).toBeGreaterThan(0);
    });

    it("tracks eviction count", () => {
      const smallCache = new AdapterCache({
        maxSize: 100,
        maxEntries: 2,
        ttlMs: 60000,
        evictionPolicy: CacheEvictionPolicy.LRU,
      });

      smallCache.set("key1", createResponse("adapter1", { data: "a" }));
      smallCache.set("key2", createResponse("adapter2", { data: "b" }));
      smallCache.set("key3", createResponse("adapter3", { data: "c" }));

      const metrics = smallCache.getMetrics();
      expect(metrics.evictions).toBeGreaterThan(0);
    });
  });

  describe("eviction policies", () => {
    it("evicts least recently used (LRU)", () => {
      const lruCache = new AdapterCache({
        maxSize: 10000,
        maxEntries: 2,
        ttlMs: 60000,
        evictionPolicy: CacheEvictionPolicy.LRU,
      });

      lruCache.set("key1", createResponse("adapter1", { data: "1" }));
      lruCache.set("key2", createResponse("adapter2", { data: "2" }));
      lruCache.get("key1");

      lruCache.set("key3", createResponse("adapter3", { data: "3" }));

      expect(lruCache.get("key1")).not.toBeNull();
      expect(lruCache.get("key2")).toBeNull();
      expect(lruCache.get("key3")).not.toBeNull();
    });

    it("evicts least frequently used (LFU)", () => {
      const lfuCache = new AdapterCache({
        maxSize: 10000,
        maxEntries: 2,
        ttlMs: 60000,
        evictionPolicy: CacheEvictionPolicy.LFU,
      });

      lfuCache.set("key1", createResponse("adapter1", { data: "1" }));
      lfuCache.set("key2", createResponse("adapter2", { data: "2" }));
      lfuCache.get("key1");
      lfuCache.get("key1");

      lfuCache.set("key3", createResponse("adapter3", { data: "3" }));

      expect(lfuCache.get("key1")).not.toBeNull();
      expect(lfuCache.get("key2")).toBeNull();
      expect(lfuCache.get("key3")).not.toBeNull();
    });

    it("evicts first in first out (FIFO)", () => {
      const fifoCache = new AdapterCache({
        maxSize: 10000,
        maxEntries: 2,
        ttlMs: 60000,
        evictionPolicy: CacheEvictionPolicy.FIFO,
      });

      const now = Date.now();
      fifoCache.set("key1", createResponse("adapter1", { data: "1" }), now);
      fifoCache.set("key2", createResponse("adapter2", { data: "2" }), now + 1000);

      fifoCache.set("key3", createResponse("adapter3", { data: "3" }), now + 2000);

      expect(fifoCache.get("key1")).toBeNull();
      expect(fifoCache.get("key2")).not.toBeNull();
      expect(fifoCache.get("key3")).not.toBeNull();
    });

    it("evicts entries closest to expiration (TTL)", () => {
      const ttlCache = new AdapterCache({
        maxSize: 10000,
        maxEntries: 2,
        ttlMs: 1000,
        evictionPolicy: CacheEvictionPolicy.TTL,
      });

      ttlCache.set("key1", createResponse("adapter1", { data: "1" }), 0);
      ttlCache.set("key2", createResponse("adapter2", { data: "2" }), 100);

      ttlCache.set("key3", createResponse("adapter3", { data: "3" }), 100);

      expect(ttlCache.get("key1")).toBeNull();
      expect(ttlCache.get("key2")).not.toBeNull();
      expect(ttlCache.get("key3")).not.toBeNull();
    });
  });

  describe("cache size limits", () => {
    it("respects max size limit", () => {
      const smallCache = new AdapterCache({
        maxSize: 200,
        maxEntries: 1000,
        ttlMs: 60000,
        evictionPolicy: CacheEvictionPolicy.LRU,
      });

      smallCache.set("key1", createResponse("adapter1", { data: "x".repeat(100) }));
      smallCache.set("key2", createResponse("adapter2", { data: "y".repeat(100) }));

      const metrics = smallCache.getMetrics();
      expect(metrics.currentSize).toBeLessThanOrEqual(smallCache["config"].maxSize);
    });

    it("respects max entries limit", () => {
      const limitedCache = new AdapterCache({
        maxSize: 1000000,
        maxEntries: 5,
        ttlMs: 60000,
        evictionPolicy: CacheEvictionPolicy.LRU,
      });

      for (let i = 0; i < 10; i++) {
        limitedCache.set(`key${i}`, createResponse(`adapter${i}`));
      }

      const metrics = limitedCache.getMetrics();
      expect(metrics.currentEntries).toBeLessThanOrEqual(5);
    });

    it("rejects entries larger than max size", () => {
      const strictCache = new AdapterCache({
        maxSize: 100,
        maxEntries: 1000,
        ttlMs: 60000,
        evictionPolicy: CacheEvictionPolicy.LRU,
      });

      const largeResponse = createResponse("adapter", { data: "x".repeat(200) });
      strictCache.set("key1", largeResponse);

      expect(strictCache.get("key1")).toBeNull();
    });
  });

  describe("clear operation", () => {
    it("clears all cache entries", () => {
      cache.set("key1", createResponse("adapter1"));
      cache.set("key2", createResponse("adapter2"));
      cache.set("key3", createResponse("adapter3"));

      cache.clear();

      expect(cache.get("key1")).toBeNull();
      expect(cache.get("key2")).toBeNull();
      expect(cache.get("key3")).toBeNull();

      const metrics = cache.getMetrics();
      expect(metrics.currentEntries).toBe(0);
      expect(metrics.currentSize).toBe(0);
    });
  });

  describe("access count and timestamps", () => {
    it("tracks access count for entries", () => {
      const now = Date.now();
      const response = createResponse("adapter1", { value: "test" });
      cache.set("key1", response, now);

      cache.get("key1", now);
      cache.get("key1", now);
      cache.get("key1", now);

      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(3);
    });

    it("updates last access time on retrieval", () => {
      const now = Date.now();
      const response = createResponse("adapter1", { value: "test" });
      cache.set("key1", response, now);

      cache.get("key1", now);
      cache.get("key1", now + 1000);

      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(2);
    });
  });
});
