import {
  CacheEntry,
  CacheConfig,
  CacheEvictionPolicy,
  CacheMetrics,
  AdapterResponse,
} from "./AdapterCacheTypes";

export class AdapterCache {
  private cache: Map<string, CacheEntry<AdapterResponse>>;
  private config: CacheConfig;
  private metrics: CacheMetrics;

  constructor(config: CacheConfig) {
    this.cache = new Map();
    this.config = config;
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      currentSize: 0,
      currentEntries: 0,
      hitRate: 0,
    };
  }

  get(key: string, now: number = Date.now()): AdapterResponse | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.metrics.misses++;
      this.updateHitRate();
      return null;
    }

    if (now > entry.expiresAt) {
      this.cache.delete(key);
      this.metrics.currentSize -= entry.size;
      this.metrics.currentEntries--;
      this.metrics.misses++;
      this.updateHitRate();
      return null;
    }

    entry.accessCount++;
    entry.lastAccessTime = now;
    this.metrics.hits++;
    this.updateHitRate();
    return entry.value;
  }

  set(key: string, value: AdapterResponse, now: number = Date.now()): void {
    const size = JSON.stringify(value).length;

    if (size > this.config.maxSize) {
      return;
    }

    const expiresAt = now + this.config.ttlMs;

    const newEntry: CacheEntry<AdapterResponse> = {
      value,
      timestamp: now,
      expiresAt,
      accessCount: 1,
      lastAccessTime: now,
      size,
    };

    const existingEntry = this.cache.get(key);
    if (existingEntry) {
      this.metrics.currentSize -= existingEntry.size;
    } else {
      this.metrics.currentEntries++;
    }

    this.cache.set(key, newEntry);
    this.metrics.currentSize += size;

    while (
      this.metrics.currentSize > this.config.maxSize ||
      this.metrics.currentEntries > this.config.maxEntries
    ) {
      this.evictOne();
    }
  }

  invalidate(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.metrics.currentSize -= entry.size;
      this.metrics.currentEntries--;
      this.cache.delete(key);
      return true;
    }
    return false;
  }

  invalidateByPrefix(prefix: string): number {
    let count = 0;
    for (const [key, entry] of this.cache) {
      if (key.startsWith(prefix)) {
        this.metrics.currentSize -= entry.size;
        this.metrics.currentEntries--;
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.cache.clear();
    this.metrics.currentSize = 0;
    this.metrics.currentEntries = 0;
  }

  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  prune(now: number = Date.now()): number {
    let pruned = 0;
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.metrics.currentSize -= entry.size;
        this.metrics.currentEntries--;
        this.cache.delete(key);
        pruned++;
      }
    }
    return pruned;
  }

  private evictOne(): void {
    if (this.cache.size === 0) return;

    const key = this.selectEvictionTarget();
    if (key) {
      const entry = this.cache.get(key);
      if (entry) {
        this.metrics.currentSize -= entry.size;
        this.metrics.currentEntries--;
        this.metrics.evictions++;
      }
      this.cache.delete(key);
    }
  }

  private selectEvictionTarget(): string | null {
    if (this.cache.size === 0) return null;

    switch (this.config.evictionPolicy) {
      case CacheEvictionPolicy.LRU:
        return this.selectLRU();
      case CacheEvictionPolicy.LFU:
        return this.selectLFU();
      case CacheEvictionPolicy.FIFO:
        return this.selectFIFO();
      case CacheEvictionPolicy.TTL:
        return this.selectTTL();
      default:
        return this.cache.keys().next().value;
    }
  }

  private selectLRU(): string | null {
    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessTime < lruTime) {
        lruTime = entry.lastAccessTime;
        lruKey = key;
      }
    }

    return lruKey;
  }

  private selectLFU(): string | null {
    let lfuKey: string | null = null;
    let lfuCount = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.accessCount < lfuCount) {
        lfuCount = entry.accessCount;
        lfuKey = key;
      }
    }

    return lfuKey;
  }

  private selectFIFO(): string | null {
    let fifoKey: string | null = null;
    let fifoTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < fifoTime) {
        fifoTime = entry.timestamp;
        fifoKey = key;
      }
    }

    return fifoKey;
  }

  private selectTTL(): string | null {
    let ttlKey: string | null = null;
    let ttlTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.expiresAt < ttlTime) {
        ttlTime = entry.expiresAt;
        ttlKey = key;
      }
    }

    return ttlKey;
  }

  private updateHitRate(): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total === 0 ? 0 : this.metrics.hits / total;
  }
}
