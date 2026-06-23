import { LedgerMetrics } from '../schema/types';

interface MetricRecorder {
  writesTotal: number;
  writeFailuresTotal: number;
  writeLatencies: number[];
  readLatencies: number[];
  driftTotal: number;
  budgetExhaustionEventsTotal: number;
  governanceAbortTotal: number;
  governanceWarningTotal: number;
}

const metrics: MetricRecorder = {
  writesTotal: 0,
  writeFailuresTotal: 0,
  writeLatencies: [],
  readLatencies: [],
  driftTotal: 0,
  budgetExhaustionEventsTotal: 0,
  governanceAbortTotal: 0,
  governanceWarningTotal: 0,
};

interface WriteMetricPayload {
  status: 'success' | 'failure' | 'duplicate';
  latencyMs: number;
}

export function recordWriteMetric(payload: WriteMetricPayload): void {
  metrics.writesTotal++;

  if (payload.status === 'failure') {
    metrics.writeFailuresTotal++;
  }

  metrics.writeLatencies.push(payload.latencyMs);

  if (metrics.writeLatencies.length > 10000) {
    metrics.writeLatencies = metrics.writeLatencies.slice(-5000);
  }
}

export function recordReadMetric(latencyMs: number): void {
  metrics.readLatencies.push(latencyMs);

  if (metrics.readLatencies.length > 10000) {
    metrics.readLatencies = metrics.readLatencies.slice(-5000);
  }
}

export function recordGovernanceEvent(
  eventType: 'governance_abort' | 'governance_warning'
): void {
  if (eventType === 'governance_abort') {
    metrics.governanceAbortTotal++;
    metrics.budgetExhaustionEventsTotal++;
  } else if (eventType === 'governance_warning') {
    metrics.governanceWarningTotal++;
  }
}

export function recordDrift(amount: number): void {
  metrics.driftTotal += amount;
}

export function getMetrics(): LedgerMetrics {
  const writeLatencies = [...metrics.writeLatencies].sort((a, b) => a - b);
  const readLatencies = [...metrics.readLatencies].sort((a, b) => a - b);

  const writeLatencyP95Ms = percentile(writeLatencies, 0.95);
  const writeLatencyP99Ms = percentile(writeLatencies, 0.99);
  const readLatencyP95Ms = percentile(readLatencies, 0.95);
  const readLatencyP99Ms = percentile(readLatencies, 0.99);

  return {
    writesTotal: metrics.writesTotal,
    writeFailuresTotal: metrics.writeFailuresTotal,
    writeLatencyP95Ms,
    writeLatencyP99Ms,
    readLatencyP95Ms,
    readLatencyP99Ms,
    driftTotal: metrics.driftTotal,
    budgetExhaustionEventsTotal: metrics.budgetExhaustionEventsTotal,
    governanceAbortTotal: metrics.governanceAbortTotal,
    governanceWarningTotal: metrics.governanceWarningTotal,
  };
}

export function resetMetrics(): void {
  metrics.writesTotal = 0;
  metrics.writeFailuresTotal = 0;
  metrics.writeLatencies = [];
  metrics.readLatencies = [];
  metrics.driftTotal = 0;
  metrics.budgetExhaustionEventsTotal = 0;
  metrics.governanceAbortTotal = 0;
  metrics.governanceWarningTotal = 0;
}

export function getPrometheusMetrics(): string {
  const m = getMetrics();

  const lines = [
    `# HELP ledger_writes_total Total ledger writes`,
    `# TYPE ledger_writes_total counter`,
    `ledger_writes_total ${m.writesTotal}`,
    '',
    `# HELP ledger_write_failures_total Total ledger write failures`,
    `# TYPE ledger_write_failures_total counter`,
    `ledger_write_failures_total ${m.writeFailuresTotal}`,
    '',
    `# HELP ledger_write_latency_p95_ms Write latency at 95th percentile`,
    `# TYPE ledger_write_latency_p95_ms gauge`,
    `ledger_write_latency_p95_ms ${m.writeLatencyP95Ms}`,
    '',
    `# HELP ledger_write_latency_p99_ms Write latency at 99th percentile`,
    `# TYPE ledger_write_latency_p99_ms gauge`,
    `ledger_write_latency_p99_ms ${m.writeLatencyP99Ms}`,
    '',
    `# HELP ledger_read_latency_p95_ms Read latency at 95th percentile`,
    `# TYPE ledger_read_latency_p95_ms gauge`,
    `ledger_read_latency_p95_ms ${m.readLatencyP95Ms}`,
    '',
    `# HELP ledger_read_latency_p99_ms Read latency at 99th percentile`,
    `# TYPE ledger_read_latency_p99_ms gauge`,
    `ledger_read_latency_p99_ms ${m.readLatencyP99Ms}`,
    '',
    `# HELP ledger_drift_total Total drift across all entries`,
    `# TYPE ledger_drift_total counter`,
    `ledger_drift_total ${m.driftTotal}`,
    '',
    `# HELP ledger_budget_exhaustion_events_total Total budget exhaustion events`,
    `# TYPE ledger_budget_exhaustion_events_total counter`,
    `ledger_budget_exhaustion_events_total ${m.budgetExhaustionEventsTotal}`,
    '',
    `# HELP ledger_governance_abort_total Total governance abort events`,
    `# TYPE ledger_governance_abort_total counter`,
    `ledger_governance_abort_total ${m.governanceAbortTotal}`,
    '',
    `# HELP ledger_governance_warning_total Total governance warning events`,
    `# TYPE ledger_governance_warning_total counter`,
    `ledger_governance_warning_total ${m.governanceWarningTotal}`,
  ];

  return lines.join('\n');
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, index)];
}
