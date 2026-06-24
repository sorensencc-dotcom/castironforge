/**
 * Fire Drill Types
 *
 * Defines scenarios, results, and assertions for automated reliability testing.
 * Fire drills simulate failures to validate SLO Controller enforcement actions.
 */

export enum FireDrillFaultType {
  ADAPTER_FAILURE = 'ADAPTER_FAILURE',
  LATENCY_INJECTION = 'LATENCY_INJECTION',
  SATURATION_INJECTION = 'SATURATION_INJECTION',
  PARTIAL_OUTAGE = 'PARTIAL_OUTAGE',
  CASCADING_FAILURE = 'CASCADING_FAILURE',
}

export enum FireDrillAssertionType {
  SLO_VIOLATION_DETECTED = 'SLO_VIOLATION_DETECTED',
  ENFORCEMENT_ACTION_TAKEN = 'ENFORCEMENT_ACTION_TAKEN',
  RECOVERY_SUCCESSFUL = 'RECOVERY_SUCCESSFUL',
  ADAPTER_HEALTH_UPDATED = 'ADAPTER_HEALTH_UPDATED',
  LATENCY_WITHIN_THRESHOLD = 'LATENCY_WITHIN_THRESHOLD',
}

export interface FireDrillFault {
  type: FireDrillFaultType;
  targetAdapter: string;
  durationMs: number;
  severity: 1 | 2 | 3; // 1=light, 2=moderate, 3=severe
  config?: {
    failureRate?: number; // 0-1
    latencyMs?: number;
    queueDepth?: number;
  };
}

export interface FireDrillAssertion {
  type: FireDrillAssertionType;
  condition: (context: FireDrillContext) => boolean;
  description: string;
  timeoutMs?: number;
}

export interface FireDrillScenario {
  id: string;
  name: string;
  description: string;
  faults: FireDrillFault[];
  assertions: FireDrillAssertion[];
  expectedDuration: number; // in milliseconds
  tags: string[];
}

export interface FireDrillResult {
  scenarioId: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  passed: boolean;
  faultsInjected: number;
  assertionsPassed: number;
  assertionsFailed: number;
  violations: FireDrillViolation[];
  metrics: FireDrillMetrics;
  log: FireDrillLogEntry[];
}

export interface FireDrillViolation {
  timestamp: number;
  assertionType: FireDrillAssertionType;
  description: string;
  expected: unknown;
  actual: unknown;
}

export interface FireDrillMetrics {
  totalLatencySamples: number;
  avgLatency: number;
  p50Latency: number;
  p99Latency: number;
  errorCount: number;
  errorRate: number;
  successCount: number;
  faultInjectionSuccessRate: number;
  recoveryTime: number; // milliseconds
}

export interface FireDrillLogEntry {
  timestamp: number;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  context?: Record<string, unknown>;
}

export interface FireDrillContext {
  scenarioId: string;
  startTime: number;
  currentTime: number;
  faultsActive: FireDrillFault[];
  sloViolations: Array<{ timestamp: number; domain: string; severity: number }>;
  enforcementActions: Array<{ timestamp: number; action: string }>;
  adapterHealthStatus: Record<string, { isHealthy: boolean; failureCount: number }>;
  metrics: Partial<FireDrillMetrics>;
}

export interface FireDrillOptions {
  maxConcurrentDrills: number;
  timeoutMs: number;
  verbose: boolean;
  recordMetrics: boolean;
}
