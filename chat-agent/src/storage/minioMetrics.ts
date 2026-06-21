/**
 * MinIO metrics collection for observability
 */

export interface MinIOMetrics {
  putLatencies: number[];
  getLatencies: number[];
  deleteLatencies: number[];
  errorCount: number;
  successCount: number;
  totalBytesIngested: number;
  totalBytesRetrieved: number;
  bucketCounts: Record<string, number>;
  lastErrorMessage?: string;
  lastErrorTime?: number;
}

class MinIOMetricsCollector {
  private metrics: MinIOMetrics = {
    putLatencies: [],
    getLatencies: [],
    deleteLatencies: [],
    errorCount: 0,
    successCount: 0,
    totalBytesIngested: 0,
    totalBytesRetrieved: 0,
    bucketCounts: {},
  };

  private maxLatencyHistorySize = 1000;

  recordPutOperation(latencyMs: number, bytesWritten: number): void {
    this.metrics.putLatencies.push(latencyMs);
    this.metrics.totalBytesIngested += bytesWritten;
    this.metrics.successCount++;
    this.pruneLatencyHistory();
  }

  recordGetOperation(latencyMs: number, bytesRead: number): void {
    this.metrics.getLatencies.push(latencyMs);
    this.metrics.totalBytesRetrieved += bytesRead;
    this.metrics.successCount++;
    this.pruneLatencyHistory();
  }

  recordDeleteOperation(latencyMs: number): void {
    this.metrics.deleteLatencies.push(latencyMs);
    this.metrics.successCount++;
    this.pruneLatencyHistory();
  }

  recordError(error: Error | string): void {
    this.metrics.errorCount++;
    this.metrics.lastErrorMessage = error instanceof Error ? error.message : error;
    this.metrics.lastErrorTime = Date.now();
  }

  recordBucketOperation(bucket: string, increment: number = 1): void {
    this.metrics.bucketCounts[bucket] ??= 0;
    this.metrics.bucketCounts[bucket] += increment;
  }

  private pruneLatencyHistory(): void {
    if (this.metrics.putLatencies.length > this.maxLatencyHistorySize) {
      this.metrics.putLatencies = this.metrics.putLatencies.slice(-this.maxLatencyHistorySize);
    }
    if (this.metrics.getLatencies.length > this.maxLatencyHistorySize) {
      this.metrics.getLatencies = this.metrics.getLatencies.slice(-this.maxLatencyHistorySize);
    }
    if (this.metrics.deleteLatencies.length > this.maxLatencyHistorySize) {
      this.metrics.deleteLatencies = this.metrics.deleteLatencies.slice(-this.maxLatencyHistorySize);
    }
  }

  getMetrics(): MinIOMetrics {
    return {
      ...this.metrics,
      putLatencies: [...this.metrics.putLatencies],
      getLatencies: [...this.metrics.getLatencies],
      deleteLatencies: [...this.metrics.deleteLatencies],
    };
  }

  getAggregateMetrics() {
    const avgLatency = (latencies: number[]) =>
      latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

    return {
      avgPutLatencyMs: avgLatency(this.metrics.putLatencies),
      avgGetLatencyMs: avgLatency(this.metrics.getLatencies),
      avgDeleteLatencyMs: avgLatency(this.metrics.deleteLatencies),
      p95PutLatencyMs: this.percentile(this.metrics.putLatencies, 0.95),
      p95GetLatencyMs: this.percentile(this.metrics.getLatencies, 0.95),
      errorCount: this.metrics.errorCount,
      successCount: this.metrics.successCount,
      totalBytesIngested: this.metrics.totalBytesIngested,
      totalBytesRetrieved: this.metrics.totalBytesRetrieved,
      bucketCounts: this.metrics.bucketCounts,
    };
  }

  private percentile(latencies: number[], p: number): number {
    if (latencies.length === 0) return 0;
    const sorted = [...latencies].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  reset(): void {
    this.metrics = {
      putLatencies: [],
      getLatencies: [],
      deleteLatencies: [],
      errorCount: 0,
      successCount: 0,
      totalBytesIngested: 0,
      totalBytesRetrieved: 0,
      bucketCounts: {},
    };
  }
}

export const minioMetricsCollector = new MinIOMetricsCollector();
