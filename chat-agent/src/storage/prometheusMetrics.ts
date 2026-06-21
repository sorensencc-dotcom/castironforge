/**
 * Prometheus metrics export for MinIO storage layer
 *
 * Exports:
 * - Operation latencies (put/get/delete)
 * - Throughput (bytes/sec)
 * - Error rates
 * - Bucket sizes
 * - Backup status
 */

import { minioMetricsCollector } from './minioMetrics';
import { listBucketObjects, getBucketStats } from './listOperations';
import { CIC_BUCKETS } from './MinioClient';

export interface PrometheusMetrics {
  timestamp: number;
  metrics: string;
}

class PrometheusExporter {
  private readonly namespace = 'cic_storage';

  /**
   * Generate Prometheus metrics in text format
   */
  async generateMetrics(): Promise<PrometheusMetrics> {
    const lines: string[] = [];
    const timestamp = Date.now();

    // MinIO operation metrics
    const minioMetrics = minioMetricsCollector.getAggregateMetrics();

    // Operation latencies
    lines.push(this.gauge(`${this.namespace}_put_latency_ms`, minioMetrics.avgPutLatencyMs, { quantile: 'avg' }));
    lines.push(this.gauge(`${this.namespace}_put_latency_p95_ms`, minioMetrics.p95PutLatencyMs, { quantile: 'p95' }));
    lines.push(this.gauge(`${this.namespace}_get_latency_ms`, minioMetrics.avgGetLatencyMs, { quantile: 'avg' }));
    lines.push(this.gauge(`${this.namespace}_get_latency_p95_ms`, minioMetrics.p95GetLatencyMs, { quantile: 'p95' }));
    lines.push(this.gauge(`${this.namespace}_delete_latency_ms`, minioMetrics.avgDeleteLatencyMs));

    // Operation counts
    lines.push(this.counter(`${this.namespace}_operations_total`, minioMetrics.successCount, { status: 'success' }));
    lines.push(this.counter(`${this.namespace}_operations_total`, minioMetrics.errorCount, { status: 'error' }));

    // Throughput
    const uptimeSeconds = Math.max(1, Math.floor(timestamp / 1000)); // Approximate uptime
    const putThroughput = (minioMetrics.totalBytesIngested / (1024 * 1024)) / (uptimeSeconds / 3600); // MB/h
    const getThroughput = (minioMetrics.totalBytesRetrieved / (1024 * 1024)) / (uptimeSeconds / 3600); // MB/h

    lines.push(this.gauge(`${this.namespace}_put_throughput_mbh`, Math.round(putThroughput)));
    lines.push(this.gauge(`${this.namespace}_get_throughput_mbh`, Math.round(getThroughput)));

    // Bucket-specific metrics
    for (const bucket of Object.values(CIC_BUCKETS)) {
      try {
        const stats = await getBucketStats(bucket);
        lines.push(this.gauge(`${this.namespace}_bucket_objects_total`, stats.objectCount, { bucket }));
        lines.push(this.gauge(`${this.namespace}_bucket_bytes_total`, stats.totalSize, { bucket }));
      } catch (error) {
        console.warn(`Failed to get stats for bucket ${bucket}:`, error);
      }
    }

    // Error metrics
    if (minioMetrics.lastErrorTime) {
      const secondsSinceLastError = Math.floor((timestamp - minioMetrics.lastErrorTime) / 1000);
      lines.push(this.gauge(`${this.namespace}_last_error_seconds_ago`, secondsSinceLastError));
    }

    // Helper metrics
    lines.push('');
    lines.push('# HELP cic_storage_info Information about CIC storage system');
    lines.push('# TYPE cic_storage_info gauge');
    lines.push(`cic_storage_info{version="3.0.0",buckets="${Object.keys(CIC_BUCKETS).length}"} 1`);

    return {
      timestamp,
      metrics: lines.filter(Boolean).join('\n'),
    };
  }

  /**
   * Format gauge metric
   */
  private gauge(
    metricName: string,
    value: number,
    labels?: Record<string, string | number>
  ): string {
    const labelStr = this.formatLabels(labels);
    return `${metricName}${labelStr} ${value}`;
  }

  /**
   * Format counter metric
   */
  private counter(
    metricName: string,
    value: number,
    labels?: Record<string, string | number>
  ): string {
    const labelStr = this.formatLabels(labels);
    return `${metricName}${labelStr} ${value}`;
  }

  /**
   * Format labels for Prometheus
   */
  private formatLabels(labels?: Record<string, string | number>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return '';
    }

    const labelPairs = Object.entries(labels)
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');

    return `{${labelPairs}}`;
  }
}

export const prometheusExporter = new PrometheusExporter();

/**
 * Middleware function to expose /metrics endpoint
 */
export async function metricsHandler(): Promise<string> {
  try {
    const result = await prometheusExporter.generateMetrics();
    return result.metrics;
  } catch (error) {
    console.error('Failed to generate Prometheus metrics:', error);
    return 'cic_storage_error 1\n';
  }
}
