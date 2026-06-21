import { AutonomousOrchestrator } from './AutonomousOrchestrator';
import { AutonomousConfig } from './types';

// Phase 29 Configuration
export const PHASE_29_CONFIG: AutonomousConfig = {
  autonomyLevel: 'trusted', // Can be: 'recommended', 'trusted', 'autonomous'
  maxConcurrentWorkflows: 5,
  checkIntervalMs: 60000, // Run maintenance checks every 60 seconds
  retryBackoffMs: 5000,
  maxRetries: 3,
  enableAutoReindex: true,
  enableAutoReembed: true,
  enableAutoMetadataFix: true,
  enableAutoExpand: false // Requires approval
};

// Initialize Phase 29 Autonomous System
export async function initializePhase29(embeddingService: any): Promise<AutonomousOrchestrator> {
  const orchestrator = new AutonomousOrchestrator(PHASE_29_CONFIG, embeddingService);
  await orchestrator.start();
  return orchestrator;
}

// Configuration templates for different autonomy levels

export const RECOMMENDED_CONFIG: AutonomousConfig = {
  ...PHASE_29_CONFIG,
  autonomyLevel: 'recommended',
  enableAutoReindex: false,
  enableAutoReembed: false,
  enableAutoMetadataFix: false,
  enableAutoExpand: false
};

export const TRUSTED_CONFIG: AutonomousConfig = {
  ...PHASE_29_CONFIG,
  autonomyLevel: 'trusted',
  enableAutoReindex: true,
  enableAutoReembed: true,
  enableAutoMetadataFix: true,
  enableAutoExpand: false
};

export const AUTONOMOUS_CONFIG: AutonomousConfig = {
  ...PHASE_29_CONFIG,
  autonomyLevel: 'autonomous',
  enableAutoReindex: true,
  enableAutoReembed: true,
  enableAutoMetadataFix: true,
  enableAutoExpand: true,
  maxConcurrentWorkflows: 10
};
