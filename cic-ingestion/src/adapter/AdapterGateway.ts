import { AdapterCache } from "./AdapterCache";
import {
  CacheConfig,
  CacheEvictionPolicy,
  AdapterResponse,
  AdapterHealthStatus,
} from "./AdapterCacheTypes";

export interface AdapterClient {
  id: string;
  execute(request: unknown): Promise<AdapterResponse>;
}

export class AdapterGateway {
  private cache: AdapterCache;
  private adapters: Map<string, AdapterClient>;
  private healthStatus: Map<string, AdapterHealthStatus>;
  private defaultCacheConfig: CacheConfig;

  constructor(cacheConfig?: Partial<CacheConfig>) {
    this.defaultCacheConfig = {
      maxSize: cacheConfig?.maxSize ?? 1024 * 1024,
      maxEntries: cacheConfig?.maxEntries ?? 10000,
      ttlMs: cacheConfig?.ttlMs ?? 300000,
      evictionPolicy: cacheConfig?.evictionPolicy ?? CacheEvictionPolicy.LRU,
    };
    this.cache = new AdapterCache(this.defaultCacheConfig);
    this.adapters = new Map();
    this.healthStatus = new Map();
  }

  registerAdapter(adapter: AdapterClient): void {
    this.adapters.set(adapter.id, adapter);
    this.healthStatus.set(adapter.id, {
      adapterId: adapter.id,
      isHealthy: true,
      lastCheck: Date.now(),
      failureCount: 0,
      successCount: 0,
    });
  }

  unregisterAdapter(adapterId: string): void {
    this.adapters.delete(adapterId);
    this.invalidateAdapterCache(adapterId);
  }

  async execute(
    adapterId: string,
    request: unknown,
    useCache: boolean = true,
    now: number = Date.now()
  ): Promise<AdapterResponse | null> {
    const adapter = this.adapters.get(adapterId);
    if (!adapter) {
      return null;
    }

    const cacheKey = this.generateCacheKey(adapterId, request);

    if (useCache) {
      const cached = this.cache.get(cacheKey, now);
      if (cached) {
        this.updateHealthSuccess(adapterId);
        return cached;
      }
    }

    try {
      const response = await adapter.execute(request);
      this.cache.set(cacheKey, response, now);
      this.updateHealthSuccess(adapterId);
      return response;
    } catch (error) {
      this.updateHealthFailure(adapterId);
      return {
        status: "error",
        error: String(error),
        timestamp: now,
        adapterId,
      };
    }
  }

  invalidateAdapterCache(adapterId: string): number {
    return this.cache.invalidateByPrefix(`${adapterId}:`);
  }

  invalidateCacheEntry(adapterId: string, request: unknown): boolean {
    const cacheKey = this.generateCacheKey(adapterId, request);
    return this.cache.invalidate(cacheKey);
  }

  clearCache(): void {
    this.cache.clear();
  }

  pruneExpiredEntries(now: number = Date.now()): number {
    return this.cache.prune(now);
  }

  getAdapterHealth(adapterId: string): AdapterHealthStatus | null {
    return this.healthStatus.get(adapterId) || null;
  }

  getAllAdapterHealth(): AdapterHealthStatus[] {
    return Array.from(this.healthStatus.values());
  }

  getHealthyAdapters(): string[] {
    return Array.from(this.healthStatus.values())
      .filter(status => status.isHealthy)
      .map(status => status.adapterId);
  }

  getCacheMetrics() {
    return this.cache.getMetrics();
  }

  private generateCacheKey(adapterId: string, request: unknown): string {
    return `${adapterId}:${JSON.stringify(request)}`;
  }

  private updateHealthSuccess(adapterId: string): void {
    const health = this.healthStatus.get(adapterId);
    if (health) {
      health.successCount++;
      health.lastCheck = Date.now();
      health.isHealthy = health.failureCount < 3;
    }
  }

  private updateHealthFailure(adapterId: string): void {
    const health = this.healthStatus.get(adapterId);
    if (health) {
      health.failureCount++;
      health.lastCheck = Date.now();
      health.isHealthy = health.failureCount < 3;
    }
  }
}
