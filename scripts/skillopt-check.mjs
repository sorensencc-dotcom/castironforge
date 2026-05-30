// File: src/scripts/skillopt-check.mjs | Date: 2026-05-30 | v1.0.0
import { readMetricsState, isHealthy } from '../skillopt/metricsState.mjs';
import { SkillOptTelemetry } from '../skillopt/telemetry.mjs';
import fs from 'node:fs';
import path from 'node:path';

const ALERTS_PATH = path.join(process.cwd(), 'skillopt', 'alerts.json');

function calculateRuntimeAlerts(telemetryData, thresholds) {
  const alerts = [];
  if (telemetryData.length === 0) return alerts;

  const latencies = telemetryData.map(t => t.runtimeLatencyMs || 0);
  latencies.sort((a, b) => a - b);
  const p95Latency = latencies.length > 0 ? latencies[Math.floor(0.95 * latencies.length)] : 0;

  // Assuming a budget for P95 latency (e.g., from thresholds or a separate config)
  const p95LatencyBudget = 500; // Example: 500ms P95 latency budget
  if (p95Latency > p95LatencyBudget) {
    alerts.push({ type: 'Latency Alert', message: `P95 latency (${p95Latency}ms) exceeds budget (${p95LatencyBudget}ms).` });
  }

  // Example: simple error rate check
  const errors = telemetryData.filter(t => t.status === 'error').length;
  const errorRate = (errors / telemetryData.length) * 100;
  const maxErrorRate = 5; // Example: Max 5% error rate
  if (errorRate > maxErrorRate) {
    alerts.push({ type: 'Error Rate Alert', message: `Error rate (${errorRate.toFixed(2)}%) exceeds maximum allowed (${maxErrorRate}%).` });
  }

  return alerts;
}

async function main() {
  const metricsState = readMetricsState();
  const alerts = [];
  let exitCode = 0;

  // Hard alerts based on validation thresholds
  const { lastValidation, thresholds } = metricsState;
  for (const metric of ['structural', 'heuristic', 'accessibility', 'determinism']) {
    if (lastValidation[metric] < thresholds[metric]) {
      alerts.push({
        type: 'Hard Alert',
        metric: metric,
        message: `Metric '${metric}' (${lastValidation[metric]}) is below hard threshold (${thresholds[metric]}).`
      });
      exitCode = 1; // Indicate failure for CI gate
    }
  }

  // Soft alerts (example: performance or voice trend down > X% over N runs)
  // This would require historical validation data, which is not in metrics-state.json yet.
  // For now, a simplified check:
  if (lastValidation.performance < 0.6 || lastValidation.voice < 0.6) { // Arbitrary soft thresholds
    alerts.push({
      type: 'Soft Alert',
      message: 'Performance or brand voice metrics are low, review needed.'
    });
  }

  // Runtime performance alerts (from telemetry)
  const telemetryData = SkillOptTelemetry.readAll();
  const runtimeAlerts = calculateRuntimeAlerts(telemetryData, thresholds);
  alerts.push(...runtimeAlerts);

  // Write alerts to file
  fs.writeFileSync(ALERTS_PATH, JSON.stringify(alerts, null, 2), 'utf8');

  if (alerts.length > 0) {
    console.log(`[SkillOpt] Found ${alerts.length} alerts. See ${ALERTS_PATH}`);
    console.log(JSON.stringify(alerts, null, 2));
  } else {
    console.log('[SkillOpt] No alerts detected. System is healthy.');
  }

  process.exit(exitCode);
}

main().catch(console.error);