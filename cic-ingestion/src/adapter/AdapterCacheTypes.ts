export enum CacheEvictionPolicy {
  LRU = "lru",
  LFU = "lfu",
  TTL = "ttl",
  FIFO = "fifo",
}

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expiresAt: number;
  accessCount: number;
  lastAccessTime: number;
  size: number;
}

export interface AdapterResponse {
  status: "success" | "error";
  data?: unknown;
  error?: string;
  timestamp: number;
  adapterId: string;
}

export interface CacheConfig {
  maxSize: number;
  maxEntries: number;
  ttlMs: number;
  evictionPolicy: CacheEvictionPolicy;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  currentSize: number;
  currentEntries: number;
  hitRate: number;
}

export interface AdapterHealthStatus {
  adapterId: string;
  isHealthy: boolean;
  lastCheck: number;
  failureCount: number;
  successCount: number;
}
