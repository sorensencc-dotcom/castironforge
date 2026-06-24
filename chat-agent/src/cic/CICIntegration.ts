/**
 * CIC Integration Service
 *
 * Bridges chat-agent with the CIC (Chat Iron Ingestion) subsystem.
 * Optional and non-blocking - chat-agent continues normally if CIC is unavailable.
 *
 * Features:
 * - SLO monitoring for chat-agent operations
 * - Adapter gateway for external service orchestration
 * - Health status reporting
 * - Metrics export to Prometheus
 */

interface CICIntegrationConfig {
  enabled: boolean;
  sloThresholds?: {
    latencyP99Ms?: number;
    errorRatePercent?: number;
    saturationPercent?: number;
  };
}

interface CICHealthStatus {
  cicAvailable: boolean;
  sloController?: {
    isHealthy: boolean;
    lastViolation?: string;
  };
  adapterGateway?: {
    healthyAdapters: string[];
    totalAdapters: number;
  };
}

class CICIntegration {
  private config: CICIntegrationConfig;
  private sloController: any;
  private adapterGateway: any;
  private isInitialized = false;

  constructor(config: CICIntegrationConfig = { enabled: false }) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      console.log('[CIC] Integration disabled');
      return;
    }

    try {
      // Dynamically import CIC modules
      const { SLOController } = await import('../../../cic-ingestion/dist/src/slo/SLOController');
      const { AdapterGateway } = await import('../../../cic-ingestion/dist/src/adapter/AdapterGateway');

      // Initialize SLO Controller
      this.sloController = new SLOController({
        latencyThresholds: {
          p50: this.config.sloThresholds?.latencyP99Ms ?? 500,
          p90: this.config.sloThresholds?.latencyP99Ms ?? 1000,
          p99: this.config.sloThresholds?.latencyP99Ms ?? 2000,
        },
        errorRateThreshold: this.config.sloThresholds?.errorRatePercent ?? 5,
        saturationThreshold: this.config.sloThresholds?.saturationPercent ?? 80,
      });

      // Initialize Adapter Gateway
      this.adapterGateway = new AdapterGateway({
        maxSize: 1024 * 1024 * 10, // 10MB
        maxEntries: 1000,
        ttlMs: 300000, // 5 minutes
      });

      this.isInitialized = true;
      console.log('[CIC] Integration initialized successfully');
    } catch (err) {
      console.warn('[CIC] Failed to initialize integration:', err instanceof Error ? err.message : String(err));
      console.warn('[CIC] Chat-agent will continue without CIC monitoring');
      this.isInitialized = false;
    }
  }

  /**
   * Record an operation for SLO tracking
   */
  recordOperation(
    adapterId: string,
    operationName: string,
    durationMs: number,
    success: boolean
  ): void {
    if (!this.isInitialized || !this.sloController) {
      return;
    }

    try {
      // Record as latency sample
      this.sloController.addLatencySample({
        adapterId,
        operationName,
        latencyMs: durationMs,
      });

      // Record as success or failure
      if (success) {
        this.sloController.recordSuccess(adapterId);
      } else {
        this.sloController.recordFailure(adapterId);
      }
    } catch (err) {
      console.warn('[CIC] Failed to record operation:', err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * Get current health status
   */
  getHealthStatus(): CICHealthStatus {
    return {
      cicAvailable: this.isInitialized,
      sloController: this.isInitialized && this.sloController ? {
        isHealthy: this.sloController.getAllStatus?.()?.every((s: any) => s.isHealthy) ?? true,
        lastViolation: this.sloController.getLastViolation?.()?.toString(),
      } : undefined,
      adapterGateway: this.isInitialized && this.adapterGateway ? {
        healthyAdapters: this.adapterGateway.getHealthyAdapters?.() ?? [],
        totalAdapters: this.adapterGateway.getAllAdapterHealth?.()?.length ?? 0,
      } : undefined,
    };
  }

  /**
   * Export CIC metrics for Prometheus
   */
  exportMetrics(): string {
    if (!this.isInitialized) {
      return '';
    }

    const lines: string[] = [];

    // SLO Controller metrics
    if (this.sloController) {
      try {
        const allStatus = this.sloController.getAllStatus?.() ?? [];
        for (const status of allStatus) {
          lines.push(`# TYPE cic_slo_violations_total counter`);
          lines.push(`cic_slo_violations_total{adapter="${status.adapterId}"} ${status.failureCount}`);
          lines.push(`# TYPE cic_slo_successes_total counter`);
          lines.push(`cic_slo_successes_total{adapter="${status.adapterId}"} ${status.successCount}`);
          lines.push(`# TYPE cic_adapter_healthy gauge`);
          lines.push(`cic_adapter_healthy{adapter="${status.adapterId}"} ${status.isHealthy ? 1 : 0}`);
        }
      } catch (err) {
        console.warn('[CIC] Failed to export SLO metrics:', err instanceof Error ? err.message : String(err));
      }
    }

    // Adapter Gateway metrics
    if (this.adapterGateway) {
      try {
        const metrics = this.adapterGateway.getCacheMetrics?.();
        if (metrics) {
          lines.push(`# TYPE cic_cache_hits_total counter`);
          lines.push(`cic_cache_hits_total ${metrics.hits}`);
          lines.push(`# TYPE cic_cache_misses_total counter`);
          lines.push(`cic_cache_misses_total ${metrics.misses}`);
          lines.push(`# TYPE cic_cache_evictions_total counter`);
          lines.push(`cic_cache_evictions_total ${metrics.evictions}`);
          lines.push(`# TYPE cic_cache_entries gauge`);
          lines.push(`cic_cache_entries ${metrics.currentEntries}`);
          lines.push(`# TYPE cic_cache_size_bytes gauge`);
          lines.push(`cic_cache_size_bytes ${metrics.currentSize}`);
          lines.push(`# TYPE cic_cache_hit_rate gauge`);
          lines.push(`cic_cache_hit_rate ${metrics.hitRate ?? 0}`);
        }
      } catch (err) {
        console.warn('[CIC] Failed to export cache metrics:', err instanceof Error ? err.message : String(err));
      }
    }

    return lines.join('\n');
  }

  isAvailable(): boolean {
    return this.isInitialized;
  }
}

// Singleton instance
let instance: CICIntegration | null = null;

export function initializeCIC(config?: CICIntegrationConfig): CICIntegration {
  if (!instance) {
    instance = new CICIntegration(config);
  }
  return instance;
}

export function getCICIntegration(): CICIntegration {
  if (!instance) {
    instance = new CICIntegration({ enabled: false });
  }
  return instance;
}

export type { CICHealthStatus, CICIntegrationConfig };
