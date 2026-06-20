import * as fs from 'fs/promises';
import * as path from 'path';
import { performanceTracker, type AgentMetrics, type ExecutionRecord } from './performanceTracker';
import type { AgentRole } from '../orchestrator/types';

/**
 * Metrics persistence: save and load metrics to/from disk
 *
 * Enables:
 * - Metrics survival across server restarts
 * - Historical analysis over days/weeks
 * - Trend detection and capacity planning
 */

export interface MetricsSnapshot {
  timestamp: number;
  version: string;
  metrics: AgentMetrics[];
  history: ExecutionRecord[];
}

export interface HistoricalQuery {
  startTime?: number;       // Unix timestamp (ms)
  endTime?: number;         // Unix timestamp (ms)
  agentRole?: AgentRole;
  limit?: number;
}

export interface HistoricalStats {
  period: { startTime: number; endTime: number };
  agentRole?: AgentRole;
  totalExecutions: number;
  successRate: number;
  avgDuration: number;
  avgCost: number;
  totalCost: number;
  executionsByStatus: {
    success: number;
    failed: number;
    timeout: number;
    rejected: number;
  };
}

export class MetricsStore {
  private storePath: string;
  private snapshots: MetricsSnapshot[] = [];
  private maxSnapshotsKept: number = 100;  // Keep 100 snapshots (~25 hours at 15min intervals)

  constructor(storePath: string = '.cic-metrics') {
    this.storePath = storePath;
  }

  /**
   * Save current metrics to disk
   */
  async saveSnapshot(): Promise<void> {
    try {
      // Create directory if it doesn't exist
      await fs.mkdir(this.storePath, { recursive: true });

      const snapshot: MetricsSnapshot = {
        timestamp: Date.now(),
        version: '1.0.0',
        metrics: performanceTracker.getAllMetrics(),
        history: performanceTracker.getHistory(undefined, 10000)  // Get all history
      };

      // Save as timestamped JSON file
      const filename = path.join(this.storePath, `snapshot-${snapshot.timestamp}.json`);
      await fs.writeFile(filename, JSON.stringify(snapshot, null, 2));

      // Keep in-memory snapshots
      this.snapshots.push(snapshot);
      if (this.snapshots.length > this.maxSnapshotsKept) {
        this.snapshots = this.snapshots.slice(-this.maxSnapshotsKept);
      }

      // Cleanup old files (keep last 100)
      await this.cleanupOldSnapshots();

      console.log(`[MetricsStore] Saved snapshot at ${new Date(snapshot.timestamp).toISOString()}`);
    } catch (err) {
      console.error('[MetricsStore] Failed to save snapshot:', err);
    }
  }

  /**
   * Load latest snapshot from disk
   */
  async loadLatestSnapshot(): Promise<MetricsSnapshot | null> {
    try {
      // Try to load from file system
      const files = await fs.readdir(this.storePath);
      const snapshotFiles = files
        .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
        .sort()
        .reverse();

      if (snapshotFiles.length === 0) {
        return null;
      }

      const latestFile = snapshotFiles[0];
      const filepath = path.join(this.storePath, latestFile);
      const content = await fs.readFile(filepath, 'utf-8');
      const snapshot = JSON.parse(content) as MetricsSnapshot;

      console.log(`[MetricsStore] Loaded snapshot from ${new Date(snapshot.timestamp).toISOString()}`);
      return snapshot;
    } catch (err) {
      console.error('[MetricsStore] Failed to load snapshot:', err);
      return null;
    }
  }

  /**
   * Load metrics from latest snapshot
   */
  async restoreMetrics(): Promise<void> {
    const snapshot = await this.loadLatestSnapshot();
    if (!snapshot) {
      console.log('[MetricsStore] No previous snapshot found');
      return;
    }

    try {
      // Re-record all execution history to restore metrics
      for (const record of snapshot.history) {
        performanceTracker.recordExecution(
          record.taskId,
          record.agentRole,
          record.model,
          record.duration,
          record.tokensUsed,
          record.status,
          record.error
        );
      }

      console.log(`[MetricsStore] Restored ${snapshot.history.length} execution records`);
    } catch (err) {
      console.error('[MetricsStore] Failed to restore metrics:', err);
    }
  }

  /**
   * Query historical metrics
   */
  async queryHistory(query: HistoricalQuery): Promise<ExecutionRecord[]> {
    const startTime = query.startTime ?? Date.now() - 24 * 60 * 60 * 1000;  // Last 24 hours
    const endTime = query.endTime ?? Date.now();

    // Look through all snapshots
    let records: ExecutionRecord[] = [];

    for (const snapshot of this.snapshots.reverse()) {
      // Only consider snapshots in time range
      if (snapshot.timestamp < startTime || snapshot.timestamp > endTime) {
        continue;
      }

      for (const record of snapshot.history) {
        if (record.timestamp < startTime || record.timestamp > endTime) {
          continue;
        }

        if (query.agentRole && record.agentRole !== query.agentRole) {
          continue;
        }

        records.push(record);
      }
    }

    // Sort by timestamp descending, limit results
    records.sort((a, b) => b.timestamp - a.timestamp);
    return records.slice(0, query.limit ?? 1000);
  }

  /**
   * Get historical statistics for a time period
   */
  async getHistoricalStats(query: HistoricalQuery): Promise<HistoricalStats> {
    const records = await this.queryHistory(query);
    const startTime = query.startTime ?? Date.now() - 24 * 60 * 60 * 1000;
    const endTime = query.endTime ?? Date.now();

    const stats: HistoricalStats = {
      period: { startTime, endTime },
      agentRole: query.agentRole,
      totalExecutions: records.length,
      successRate: 0,
      avgDuration: 0,
      avgCost: 0,
      totalCost: 0,
      executionsByStatus: {
        success: 0,
        failed: 0,
        timeout: 0,
        rejected: 0
      }
    };

    if (records.length === 0) {
      return stats;
    }

    let totalDuration = 0;

    for (const record of records) {
      stats.totalCost += record.estimatedCost;
      totalDuration += record.duration;

      switch (record.status) {
        case 'success':
          stats.executionsByStatus.success++;
          break;
        case 'failed':
          stats.executionsByStatus.failed++;
          break;
        case 'timeout':
          stats.executionsByStatus.timeout++;
          break;
        case 'rejected':
          stats.executionsByStatus.rejected++;
          break;
      }
    }

    stats.successRate = (stats.executionsByStatus.success / records.length) * 100;
    stats.avgDuration = totalDuration / records.length;
    stats.avgCost = stats.totalCost / records.length;

    return stats;
  }

  /**
   * Export metrics to CSV for analysis
   */
  async exportToCSV(query: HistoricalQuery): Promise<string> {
    const records = await this.queryHistory(query);

    if (records.length === 0) {
      return 'taskId,agentRole,model,timestamp,duration,tokensUsed,status,estimatedCost\n';
    }

    const lines = [
      'taskId,agentRole,model,timestamp,duration,tokensUsed,status,estimatedCost'
    ];

    for (const record of records) {
      lines.push(
        `"${record.taskId}","${record.agentRole}","${record.model}",${record.timestamp},${record.duration},${record.tokensUsed},"${record.status}",${record.estimatedCost}`
      );
    }

    return lines.join('\n');
  }

  /**
   * Detect performance trends
   */
  async analyzeTrend(
    agentRole: AgentRole,
    windowMs: number = 60 * 60 * 1000  // 1 hour
  ): Promise<{
    current: HistoricalStats;
    previous: HistoricalStats;
    trend: 'improving' | 'degrading' | 'stable';
    successRateChange: number;
    durationChange: number;
    costChange: number;
  }> {
    const now = Date.now();

    const current = await this.getHistoricalStats({
      agentRole,
      startTime: now - windowMs,
      endTime: now
    });

    const previous = await this.getHistoricalStats({
      agentRole,
      startTime: now - windowMs * 2,
      endTime: now - windowMs
    });

    const successRateChange = current.successRate - previous.successRate;
    const durationChange = current.avgDuration - previous.avgDuration;
    const costChange = current.avgCost - previous.avgCost;

    let trend: 'improving' | 'degrading' | 'stable';
    if (successRateChange > 5 || (successRateChange >= 0 && durationChange < 0 && costChange < 0)) {
      trend = 'improving';
    } else if (successRateChange < -5 || (successRateChange <= 0 && durationChange > 0 && costChange > 0)) {
      trend = 'degrading';
    } else {
      trend = 'stable';
    }

    return {
      current,
      previous,
      trend,
      successRateChange,
      durationChange,
      costChange
    };
  }

  // ==================== Private Helpers ====================

  private async cleanupOldSnapshots(): Promise<void> {
    try {
      const files = await fs.readdir(this.storePath);
      const snapshotFiles = files
        .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
        .sort()
        .reverse();

      // Keep only the latest 100
      const toDelete = snapshotFiles.slice(100);

      for (const file of toDelete) {
        await fs.unlink(path.join(this.storePath, file));
      }

      if (toDelete.length > 0) {
        console.log(`[MetricsStore] Cleaned up ${toDelete.length} old snapshots`);
      }
    } catch (err) {
      console.error('[MetricsStore] Failed to cleanup snapshots:', err);
    }
  }
}

// Singleton instance
let metricsStore: MetricsStore | null = null;

export function getMetricsStore(): MetricsStore {
  if (!metricsStore) {
    metricsStore = new MetricsStore('.cic-metrics');
  }
  return metricsStore;
}

export async function initializeMetricsStore(storePath?: string): Promise<MetricsStore> {
  if (!metricsStore) {
    metricsStore = new MetricsStore(storePath ?? '.cic-metrics');
    await metricsStore.restoreMetrics();
  }
  return metricsStore;
}

/**
 * Background periodic snapshots
 */
export function startMetricsSnapshot(intervalMs: number = 15 * 60 * 1000): NodeJS.Timeout {
  return setInterval(async () => {
    const store = getMetricsStore();
    await store.saveSnapshot();
  }, intervalMs);
}
