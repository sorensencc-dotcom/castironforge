import { AdapterGateway, AdapterClient } from "../AdapterGateway";
import { AdapterResponse } from "../AdapterCacheTypes";

describe("AdapterGateway", () => {
  let gateway: AdapterGateway;
  let mockAdapter1: AdapterClient;
  let mockAdapter2: AdapterClient;

  const createMockAdapter = (id: string, delayMs: number = 0): AdapterClient => ({
    id,
    execute: jest.fn(async (request: unknown): Promise<AdapterResponse> => {
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      return {
        status: "success",
        data: { adapterId: id, request },
        timestamp: Date.now(),
        adapterId: id,
      };
    }),
  });

  beforeEach(() => {
    gateway = new AdapterGateway({
      maxSize: 10000,
      maxEntries: 100,
      ttlMs: 60000,
    });
    mockAdapter1 = createMockAdapter("adapter1");
    mockAdapter2 = createMockAdapter("adapter2");
  });

  describe("adapter registration", () => {
    it("registers and executes adapter", async () => {
      gateway.registerAdapter(mockAdapter1);
      const result = await gateway.execute("adapter1", { test: "request" });

      expect(result).not.toBeNull();
      expect(result!.adapterId).toBe("adapter1");
      expect(mockAdapter1.execute).toHaveBeenCalled();
    });

    it("returns null for unregistered adapter", async () => {
      const result = await gateway.execute("nonexistent", { test: "request" });
      expect(result).toBeNull();
    });

    it("registers multiple adapters", async () => {
      gateway.registerAdapter(mockAdapter1);
      gateway.registerAdapter(mockAdapter2);

      const result1 = await gateway.execute("adapter1", {});
      const result2 = await gateway.execute("adapter2", {});

      expect(result1!.adapterId).toBe("adapter1");
      expect(result2!.adapterId).toBe("adapter2");
    });

    it("unregisters adapter", async () => {
      gateway.registerAdapter(mockAdapter1);
      gateway.unregisterAdapter("adapter1");

      const result = await gateway.execute("adapter1", {});
      expect(result).toBeNull();
    });
  });

  describe("caching behavior", () => {
    it("caches successful responses", async () => {
      gateway.registerAdapter(mockAdapter1);
      const request = { test: "data" };

      await gateway.execute("adapter1", request);
      await gateway.execute("adapter1", request);

      expect(mockAdapter1.execute).toHaveBeenCalledTimes(1);
    });

    it("returns cached response on second execution", async () => {
      gateway.registerAdapter(mockAdapter1);
      const request = { test: "data" };

      const result1 = await gateway.execute("adapter1", request);
      const result2 = await gateway.execute("adapter1", request);

      expect(result1).toEqual(result2);
      expect(result1!.timestamp).toBe(result2!.timestamp);
    });

    it("respects useCache parameter", async () => {
      gateway.registerAdapter(mockAdapter1);
      const request = { test: "data" };

      await gateway.execute("adapter1", request, true);
      await gateway.execute("adapter1", request, false);

      expect(mockAdapter1.execute).toHaveBeenCalledTimes(2);
    });

    it("caches different requests separately", async () => {
      gateway.registerAdapter(mockAdapter1);

      await gateway.execute("adapter1", { id: 1 });
      await gateway.execute("adapter1", { id: 2 });
      await gateway.execute("adapter1", { id: 1 });

      expect(mockAdapter1.execute).toHaveBeenCalledTimes(2);
    });
  });

  describe("error handling", () => {
    it("handles adapter execution errors", async () => {
      const failingAdapter: AdapterClient = {
        id: "failingAdapter",
        execute: jest.fn(async () => {
          throw new Error("Adapter error");
        }),
      };

      gateway.registerAdapter(failingAdapter);
      const result = await gateway.execute("failingAdapter", {});

      expect(result).not.toBeNull();
      expect(result!.status).toBe("error");
      expect(result!.error).toContain("Adapter error");
    });

    it("does not cache error responses", async () => {
      const failingAdapter: AdapterClient = {
        id: "failingAdapter",
        execute: jest.fn(async () => {
          throw new Error("Error");
        }),
      };

      gateway.registerAdapter(failingAdapter);
      await gateway.execute("failingAdapter", {});
      await gateway.execute("failingAdapter", {});

      expect(failingAdapter.execute).toHaveBeenCalledTimes(2);
    });
  });

  describe("cache invalidation", () => {
    it("invalidates all entries for adapter", async () => {
      gateway.registerAdapter(mockAdapter1);

      await gateway.execute("adapter1", { id: 1 });
      await gateway.execute("adapter1", { id: 2 });

      const invalidated = gateway.invalidateAdapterCache("adapter1");
      expect(invalidated).toBe(2);

      await gateway.execute("adapter1", { id: 1 });
      expect(mockAdapter1.execute).toHaveBeenCalledTimes(2);
    });

    it("invalidates specific cache entry", async () => {
      gateway.registerAdapter(mockAdapter1);
      const request = { id: 1 };

      await gateway.execute("adapter1", request);
      const invalidated = gateway.invalidateCacheEntry("adapter1", request);

      expect(invalidated).toBe(true);

      await gateway.execute("adapter1", request);
      expect(mockAdapter1.execute).toHaveBeenCalledTimes(2);
    });

    it("clears entire cache", async () => {
      gateway.registerAdapter(mockAdapter1);
      gateway.registerAdapter(mockAdapter2);

      await gateway.execute("adapter1", { id: 1 });
      await gateway.execute("adapter2", { id: 2 });

      gateway.clearCache();

      await gateway.execute("adapter1", { id: 1 });
      await gateway.execute("adapter2", { id: 2 });

      expect(mockAdapter1.execute).toHaveBeenCalledTimes(2);
      expect(mockAdapter2.execute).toHaveBeenCalledTimes(2);
    });
  });

  describe("adapter health tracking", () => {
    it("tracks successful executions", async () => {
      gateway.registerAdapter(mockAdapter1);
      await gateway.execute("adapter1", {});

      const health = gateway.getAdapterHealth("adapter1");
      expect(health).not.toBeNull();
      expect(health!.successCount).toBe(1);
      expect(health!.failureCount).toBe(0);
      expect(health!.isHealthy).toBe(true);
    });

    it("marks adapter unhealthy after failures", async () => {
      const failingAdapter: AdapterClient = {
        id: "failingAdapter",
        execute: jest.fn(async () => {
          throw new Error("Error");
        }),
      };

      gateway.registerAdapter(failingAdapter);

      for (let i = 0; i < 3; i++) {
        await gateway.execute("failingAdapter", {});
      }

      const health = gateway.getAdapterHealth("failingAdapter");
      expect(health!.isHealthy).toBe(false);
      expect(health!.failureCount).toBe(3);
    });

    it("returns healthy adapters list", async () => {
      gateway.registerAdapter(mockAdapter1);
      gateway.registerAdapter(mockAdapter2);

      const failingAdapter: AdapterClient = {
        id: "failing",
        execute: jest.fn(async () => {
          throw new Error("Error");
        }),
      };
      gateway.registerAdapter(failingAdapter);

      await gateway.execute("adapter1", {});
      await gateway.execute("adapter2", {});
      for (let i = 0; i < 3; i++) {
        await gateway.execute("failing", {});
      }

      const healthy = gateway.getHealthyAdapters();
      expect(healthy).toContain("adapter1");
      expect(healthy).toContain("adapter2");
      expect(healthy).not.toContain("failing");
    });

    it("returns all adapter health status", async () => {
      gateway.registerAdapter(mockAdapter1);
      gateway.registerAdapter(mockAdapter2);

      await gateway.execute("adapter1", {});

      const allHealth = gateway.getAllAdapterHealth();
      expect(allHealth).toHaveLength(2);
      expect(allHealth.map(h => h.adapterId)).toContain("adapter1");
      expect(allHealth.map(h => h.adapterId)).toContain("adapter2");
    });
  });

  describe("cache metrics", () => {
    it("provides cache metrics", async () => {
      gateway.registerAdapter(mockAdapter1);

      await gateway.execute("adapter1", { id: 1 });
      await gateway.execute("adapter1", { id: 1 });
      await gateway.execute("adapter1", { id: 2 });

      const metrics = gateway.getCacheMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
      expect(metrics.currentEntries).toBe(2);
    });
  });

  describe("cache pruning", () => {
    it("prunes expired entries", async () => {
      gateway = new AdapterGateway({
        maxSize: 10000,
        maxEntries: 100,
        ttlMs: 1000,
      });

      gateway.registerAdapter(mockAdapter1);
      const now = Date.now();

      await gateway.execute("adapter1", { id: 1 }, true, now);
      await gateway.execute("adapter1", { id: 2 }, true, now);

      const pruned = gateway.pruneExpiredEntries(now + 2000);
      expect(pruned).toBe(2);
    });
  });

  describe("concurrent operations", () => {
    it("handles concurrent execute requests", async () => {
      gateway.registerAdapter(mockAdapter1);

      const promises = [
        gateway.execute("adapter1", { id: 1 }),
        gateway.execute("adapter1", { id: 2 }),
        gateway.execute("adapter1", { id: 3 }),
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
      expect(results.every(r => r !== null)).toBe(true);
    });

    it("caches response from concurrent requests", async () => {
      const slowAdapter = createMockAdapter("slow", 100);
      gateway.registerAdapter(slowAdapter);

      const promises = [
        gateway.execute("slow", { id: 1 }),
        gateway.execute("slow", { id: 1 }),
      ];

      await Promise.all(promises);

      expect(slowAdapter.execute).toHaveBeenCalledTimes(2);
    });
  });

  describe("cache invalidation on registration changes", () => {
    it("invalidates cache when adapter is unregistered", async () => {
      gateway.registerAdapter(mockAdapter1);
      await gateway.execute("adapter1", { id: 1 });

      gateway.unregisterAdapter("adapter1");

      const metrics = gateway.getCacheMetrics();
      expect(metrics.currentEntries).toBe(0);
    });
  });

  describe("multiple adapters with cache", () => {
    it("maintains separate caches per adapter", async () => {
      gateway.registerAdapter(mockAdapter1);
      gateway.registerAdapter(mockAdapter2);

      const request = { id: 1 };
      await gateway.execute("adapter1", request);
      await gateway.execute("adapter2", request);
      await gateway.execute("adapter1", request);
      await gateway.execute("adapter2", request);

      expect(mockAdapter1.execute).toHaveBeenCalledTimes(1);
      expect(mockAdapter2.execute).toHaveBeenCalledTimes(1);
    });
  });
});
