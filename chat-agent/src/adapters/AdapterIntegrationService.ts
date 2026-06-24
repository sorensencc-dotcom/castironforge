/**
 * Adapter Integration Service
 *
 * Orchestrates adapter operations with caching via AdapterGateway.
 * Provides a unified interface for executing external service calls
 * with automatic response caching and health tracking.
 */

import { AdapterGateway, AdapterClient } from '../../cic-ingestion/src/adapter/AdapterGateway';
import { AdapterResponse } from '../../cic-ingestion/src/adapter/AdapterCacheTypes';

export interface AdapterConfig {
  id: string;
  name: string;
  url?: string;
  timeout?: number;
  retries?: number;
  tags?: string[];
}

export interface AdapterExecutionOptions {
  useCache?: boolean;
  timeout?: number;
  retryOnFailure?: boolean;
}

export interface ExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  cached: boolean;
  executionTime: number;
  adapterId: string;
}

export class AdapterIntegrationService {
  private gateway: AdapterGateway;
  private adapters: Map<string, AdapterConfig> = new Map();
  private executionHistory: ExecutionResult[] = [];

  constructor(cacheConfig?: {
    maxSize?: number;
    maxEntries?: number;
    ttlMs?: number;
  }) {
    this.gateway = new AdapterGateway({
      maxSize: cacheConfig?.maxSize ?? 10 * 1024 * 1024, // 10MB
      maxEntries: cacheConfig?.maxEntries ?? 5000,
      ttlMs: cacheConfig?.ttlMs ?? 300000, // 5 minutes
    });
  }

  /**
   * Register an adapter for use
   */
  registerAdapter(config: AdapterConfig, client: AdapterClient): void {
    this.adapters.set(config.id, config);
    this.gateway.registerAdapter(client);
  }

  /**
   * Execute an operation via an adapter with caching
   */
  async execute(
    adapterId: string,
    request: unknown,
    options: AdapterExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const useCache = options.useCache ?? true;

    try {
      const response = await this.gateway.execute(adapterId, request, useCache);

      if (!response) {
        return {
          success: false,
          error: `Adapter ${adapterId} not found`,
          cached: false,
          executionTime: Date.now() - startTime,
          adapterId,
        };
      }

      const result: ExecutionResult = {
        success: response.status === 'success',
        data: response.data,
        error: response.error,
        cached: false, // This would need tracking in AdapterGateway
        executionTime: Date.now() - startTime,
        adapterId,
      };

      this.executionHistory.push(result);
      return result;
    } catch (err) {
      const result: ExecutionResult = {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        cached: false,
        executionTime: Date.now() - startTime,
        adapterId,
      };

      this.executionHistory.push(result);
      return result;
    }
  }

  /**
   * Execute multiple adapter calls in parallel
   */
  async executeMultiple(
    requests: Array<{ adapterId: string; request: unknown; options?: AdapterExecutionOptions }>
  ): Promise<ExecutionResult[]> {
    return Promise.all(
      requests.map(req => this.execute(req.adapterId, req.request, req.options))
    );
  }

  /**
   * Get adapter health status
   */
  getAdapterHealth(adapterId: string) {
    return this.gateway.getAdapterHealth(adapterId);
  }

  /**
   * Get all healthy adapters
   */
  getHealthyAdapters(): string[] {
    return this.gateway.getHealthyAdapters();
  }

  /**
   * Get cache metrics
   */
  getCacheMetrics() {
    return this.gateway.getCacheMetrics();
  }

  /**
   * Invalidate cache for an adapter
   */
  invalidateAdapterCache(adapterId: string): number {
    return this.gateway.invalidateAdapterCache(adapterId);
  }

  /**
   * Get execution history
   */
  getExecutionHistory(adapterId?: string, limit: number = 100): ExecutionResult[] {
    if (adapterId) {
      return this.executionHistory
        .filter(r => r.adapterId === adapterId)
        .slice(-limit);
    }
    return this.executionHistory.slice(-limit);
  }

  /**
   * Get statistics for adapter operations
   */
  getStatistics(adapterId?: string) {
    const history = adapterId
      ? this.executionHistory.filter(r => r.adapterId === adapterId)
      : this.executionHistory;

    const successful = history.filter(r => r.success).length;
    const failed = history.filter(r => !r.success).length;
    const avgTime = history.length > 0
      ? history.reduce((sum, r) => sum + r.executionTime, 0) / history.length
      : 0;

    return {
      total: history.length,
      successful,
      failed,
      successRate: history.length > 0 ? successful / history.length : 0,
      avgExecutionTime: avgTime,
      adapters: adapterId ? [adapterId] : Array.from(this.adapters.keys()),
    };
  }

  /**
   * Clear cache and history
   */
  clear(): void {
    this.gateway.clearCache();
    this.executionHistory = [];
  }
}

// Singleton instance
let instance: AdapterIntegrationService | null = null;

export function initializeAdapterIntegration(config?: {
  maxSize?: number;
  maxEntries?: number;
  ttlMs?: number;
}): AdapterIntegrationService {
  if (!instance) {
    instance = new AdapterIntegrationService(config);
  }
  return instance;
}

export function getAdapterIntegration(): AdapterIntegrationService {
  if (!instance) {
    instance = new AdapterIntegrationService();
  }
  return instance;
}
