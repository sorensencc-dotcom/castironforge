import { DistributedMinIOClient } from './DistributedMinIOClient';
import { ReplicationEngine } from './ReplicationEngine';
import { FailoverManager } from './FailoverManager';

export interface DistributedMetrics {
  timestamp: number;
  activeDC: string;
  datacenters: Array<{
    id: string;
    healthy: boolean;
    latencyMs: number;
    failureCount: number;
  }>;
  replication: {
    pendingEvents: number;
    syncStatus: Array<{
      source: string;
      target: string;
      lastSyncMs: number;
      syncLagMs: number;
    }>;
  };
}

export class DistributedMetricsCollector {
  private metrics: DistributedMetrics[] = [];
  private metricsInterval: NodeJS.Timer | null = null;

  constructor(
    private minioClient: DistributedMinIOClient,
    private replicationEngine: ReplicationEngine,
    private failoverManager: FailoverManager,
    private collectionIntervalMs: number = 5000
  ) {}

  start(): void {
    if (this.metricsInterval) return;

    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, this.collectionIntervalMs);

    console.log(`[DistributedMetricsCollector] Started with ${this.collectionIntervalMs}ms interval`);
  }

  stop(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
      console.log('[DistributedMetricsCollector] Stopped');
    }
  }

  private collectMetrics(): void {
    const health = this.minioClient.getHealthStatus();
    const syncStatus = this.replicationEngine.getSyncStatus();
    const pendingEvents = this.replicationEngine.getPendingEventCount();

    const metrics: DistributedMetrics = {
      timestamp: Date.now(),
      activeDC: this.minioClient.getActiveDC(),
      datacenters: health.map(h => ({
        id: h.id,
        healthy: h.healthy,
        latencyMs: h.latencyMs,
        failureCount: h.failureCount
      })),
      replication: {
        pendingEvents,
        syncStatus: syncStatus.map(s => ({
          source: s.sourceDC,
          target: s.targetDC,
          lastSyncMs: s.lastSyncTime,
          syncLagMs: s.syncLagMs
        }))
      }
    };

    this.metrics.push(metrics);

    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }
  }

  getLatestMetrics(): DistributedMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  getMetricsHistory(limit: number = 20): DistributedMetrics[] {
    return this.metrics.slice(-limit);
  }

  export(): Record<string, any> {
    const latest = this.getLatestMetrics();
    if (!latest) return {};

    return {
      timestamp: latest.timestamp,
      active_dc: latest.activeDC,
      datacenter_health: latest.datacenters,
      replication: latest.replication,
      failover_status: this.failoverManager.getStatus()
    };
  }
}
