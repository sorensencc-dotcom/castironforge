// File: src/skillopt/metricsState.mjs | Date: 2026-05-30 | v1.0.0
import fs from 'node:fs';
import path from 'node:path';

const METRICS_STATE_PATH = path.join(process.cwd(), 'skillopt', 'metrics-state.json');

/**
 * @typedef {Object} SkillMetricsState
 * @property {string} currentSkillVersion
 * @property {string} lastDeployAt
 * @property {Object} lastValidation
 * @property {number} lastValidation.structural
 * @property {number} lastValidation.heuristic
 * @property {number} lastValidation.accessibility
 * @property {number} lastValidation.performance
 * @property {number} lastValidation.voice
 * @property {number} lastValidation.determinism
 * @property {Object} thresholds
 * @property {number} thresholds.structural
 * @property {number} thresholds.heuristic
 * @property {number} thresholds.accessibility
 * @property {number} thresholds.determinism
 */

/**
 * Reads the current metrics state from disk.
 * @returns {SkillMetricsState}
 */
export function readMetricsState() {
  if (!fs.existsSync(METRICS_STATE_PATH)) {
    return {
      currentSkillVersion: "0.0.0",
      lastDeployAt: new Date(0).toISOString(),
      lastValidation: {
        structural: 0,
        heuristic: 0,
        accessibility: 0,
        performance: 0,
        voice: 0,
        determinism: 0
      },
      thresholds: {
        structural: 0.9,
        heuristic: 0.7,
        accessibility: 0.7,
        determinism: 0.8
      }
    };
  }
  return JSON.parse(fs.readFileSync(METRICS_STATE_PATH, 'utf8'));
}

/**
 * Updates the metrics state and persists it to disk.
 * @param {Partial<SkillMetricsState>} updates
 */
export function updateMetricsState(updates) {
  const currentState = readMetricsState();
  const newState = { ...currentState, ...updates };
  fs.writeFileSync(METRICS_STATE_PATH, JSON.stringify(newState, null, 2), 'utf8');
}

/**
 * Checks if all hard thresholds are met.
 * @param {SkillMetricsState} state
 * @returns {boolean}
 */
export function isHealthy(state) {
  const { lastValidation, thresholds } = state;
  return (
    lastValidation.structural >= thresholds.structural &&
    lastValidation.heuristic >= thresholds.heuristic &&
    lastValidation.accessibility >= thresholds.accessibility &&
    lastValidation.determinism >= thresholds.determinism
  );
}

/**
 * Gets the status badge for the skill.
 * @param {SkillMetricsState} state
 * @returns {'Healthy' | 'Degraded' | 'Blocked'}
 */
export function getSkillStatus(state) {
  if (isHealthy(state)) {
    return 'Healthy';
  }

  // Define soft metrics criteria (example)
  const isDegraded = state.lastValidation.performance < state.thresholds.accessibility || // Using accessibility as a proxy
                     state.lastValidation.voice < 0.7; // Arbitrary soft threshold

  if (isDegraded) {
    return 'Degraded';
  }

  return 'Blocked'; // If not healthy and not degraded, it's blocked (hard threshold failed)
}
