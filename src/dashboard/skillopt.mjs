// File: src/dashboard/skillopt.mjs | Date: 2026-05-30 | v1.0.0
import express from 'express';
import { readMetricsState, getSkillStatus } from '../skillopt/metricsState.mjs';
import { SkillOptTelemetry } from '../skillopt/telemetry.mjs'; // Assuming this provides readAll()
import { log } from '../lib/logger.js'; // Assuming logger exists

const router = express.Router();
const MODULE = 'skillopt-dashboard-api';

/**
 * Helper to calculate aggregate metrics from telemetry data.
 * @param {Array<Object>} telemetryData
 * @returns {Object}
 */
function aggregateTelemetry(telemetryData) {
  if (telemetryData.length === 0) {
    return {
      requests: 0,
      p95Latency: 0,
      meanOutputSize: 0,
      errorRate: 0
    };
  }

  const latencies = telemetryData.map(t => t.runtimeLatencyMs || 0);
  latencies.sort((a, b) => a - b);

  const p95Latency = latencies.length > 0 ? latencies[Math.floor(0.95 * latencies.length)] : 0;
  const totalOutputSize = telemetryData.reduce((sum, t) => sum + (t.outputSize || 0), 0);
  const meanOutputSize = totalOutputSize / telemetryData.length;
  const errors = telemetryData.filter(t => t.status === 'error').length; // Assuming telemetry events can have a status field
  const errorRate = (errors / telemetryData.length) * 100;

  return {
    requests: telemetryData.length,
    p95Latency: parseFloat(p95Latency.toFixed(2)),
    meanOutputSize: parseFloat(meanOutputSize.toFixed(2)),
    errorRate: parseFloat(errorRate.toFixed(2))
  };
}

/**
 * @api {get} /skillopt/state Get Skill Overview State
 * @apiName GetSkillState
 * @apiGroup SkillOpt
 * @apiDescription Retrieves the current skill version, status, last deploy/validation, and aggregated runtime summary.
 */
router.get('/state', (req, res) => {
  try {
    const metricsState = readMetricsState();
    const telemetryData = SkillOptTelemetry.readAll(); // Read all telemetry for aggregation
    const runtimeSummary = aggregateTelemetry(telemetryData);

    res.json({
      currentSkill: `RewriteLabs Redesign v${metricsState.currentSkillVersion}`,
      statusBadge: getSkillStatus(metricsState),
      lastDeploy: {
        at: metricsState.lastDeployAt,
        delta: Math.floor((new Date() - new Date(metricsState.lastDeployAt)) / (1000 * 60 * 60)) + 'h ago' // Simple delta
      },
      lastValidation: {
        at: metricsState.lastValidationAt,
        status: getSkillStatus(metricsState) === 'Blocked' ? 'Fail' : 'Pass' // Simplified Pass/Fail based on status
      },
      validationScores: metricsState.lastValidation,
      thresholds: metricsState.thresholds,
      runtimeSummary: runtimeSummary
    });
  } catch (error) {
    log('error', MODULE, 'Failed to retrieve skill state', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve skill state' });
  }
});

/**
 * @api {get} /skillopt/telemetry Get Raw Telemetry Log
 * @apiName GetTelemetryLog
 * @apiGroup SkillOpt
 * @apiDescription Retrieves the raw telemetry log entries.
 */
router.get('/telemetry', (req, res) => {
  try {
    const telemetryData = SkillOptTelemetry.readAll();
    res.json(telemetryData);
  } catch (error) {
    log('error', MODULE, 'Failed to retrieve telemetry log', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve telemetry log' });
  }
});

/**
 * @api {get} /skillopt/validation-history Get Validation History
 * @apiName GetValidationHistory
 * @apiGroup SkillOpt
 * @apiDescription Retrieves historical validation scores, potentially from telemetry logs or a dedicated validation log.
 */
router.get('/validation-history', (req, res) => {
  try {
    // For now, return a mock or simply the lastValidation from metricsState
    // In a real scenario, this would aggregate from a history of validation runs.
    const metricsState = readMetricsState();
    res.json([{
      version: metricsState.currentSkillVersion,
      metrics: metricsState.lastValidation,
      validatedAt: metricsState.lastValidationAt,
      deployedAt: metricsState.lastDeployAt
    }]);
  } catch (error) {
    log('error', MODULE, 'Failed to retrieve validation history', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve validation history' });
  }
});

export default router;
