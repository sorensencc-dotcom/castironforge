/**
 * ExclusionAgent Integration
 *
 * Initializes and manages the Balanced Exclusion Profile System
 * for CIC Phase 26 TorqueQuery integration.
 */

import ExclusionAgent from '../../../profiles/exclusion-agent';
import type { AgentHealth, TorqueQueryConfig, IngestionTimelineEntry } from '../../../profiles/exclusion-agent';

let exclusionAgent: ExclusionAgent | null = null;
let initialized = false;

/**
 * Initialize the ExclusionAgent on server startup.
 */
export async function initializeExclusionAgent(): Promise<ExclusionAgent> {
  if (initialized) {
    if (!exclusionAgent) throw new Error('ExclusionAgent initialization failed');
    return exclusionAgent;
  }

  const rootDir = process.cwd();
  const torqueUrl = process.env.TORQUE_URL || 'http://localhost:9000';

  console.log('[ExclusionAgent] Initializing...');
  console.log(`  Root dir: ${rootDir}`);
  console.log(`  TorqueQuery endpoint: ${torqueUrl}`);

  try {
    exclusionAgent = new ExclusionAgent(rootDir, torqueUrl);

    // Wire up event listeners for logging/monitoring
    exclusionAgent.on('started', () => {
      console.log('[ExclusionAgent] Started');
    });

    exclusionAgent.on('manifest_updated', (data) => {
      console.log(`[ExclusionAgent] Manifest updated: ${data.profile} (${data.filterCount} filters)`);
      if (data.delta) {
        console.log(`  Delta: +${data.delta.added} -${data.delta.removed}`);
      }
    });

    exclusionAgent.on('drift_detected', (drift) => {
      console.log(`[ExclusionAgent] Drift detected: ${drift.length} changes`);
    });

    exclusionAgent.on('error', (err) => {
      console.error('[ExclusionAgent] Error:', err.message);
    });

    await exclusionAgent.start();
    initialized = true;

    console.log('[ExclusionAgent] Initialization complete');
    return exclusionAgent;
  } catch (error) {
    console.error('[ExclusionAgent] Initialization failed:', error);
    initialized = true; // Mark as attempted to prevent retry loops
    throw error;
  }
}

/**
 * Get the initialized ExclusionAgent instance.
 */
export function getExclusionAgent(): ExclusionAgent | null {
  return exclusionAgent;
}

/**
 * Check if ExclusionAgent is ready.
 */
export function isExclusionAgentReady(): boolean {
  return initialized && exclusionAgent !== null;
}

/**
 * Get health status of ExclusionAgent.
 */
export function getExclusionHealth(): AgentHealth | null {
  if (!exclusionAgent) return null;
  return exclusionAgent.getHealth();
}

/**
 * Get current TorqueQuery filters.
 */
export function getExclusionFilters(): TorqueQueryConfig | null {
  if (!exclusionAgent) return null;
  return exclusionAgent.getTorqueQueryConfig();
}

/**
 * Get ingestion timeline.
 */
export function getExclusionTimeline(limit: number = 50): IngestionTimelineEntry[] {
  if (!exclusionAgent) return [];
  return exclusionAgent.getTimeline(limit);
}

/**
 * Get diagnostics report.
 */
export function getExclusionDiagnostics(): object | null {
  if (!exclusionAgent) return null;
  return exclusionAgent.getDiagnostics();
}

/**
 * Gracefully shutdown ExclusionAgent.
 */
export function shutdownExclusionAgent(): void {
  if (exclusionAgent) {
    console.log('[ExclusionAgent] Shutting down...');
    exclusionAgent.stop();
    console.log('[ExclusionAgent] Shutdown complete');
  }
}
