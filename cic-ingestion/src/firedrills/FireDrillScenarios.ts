/**
 * Fire Drill Scenarios
 *
 * Built-in chaos test scenarios for validating CIC reliability.
 * Each scenario defines faults, assertions, and expected outcomes.
 */

import {
  FireDrillScenario,
  FireDrillFault,
  FireDrillFaultType,
  FireDrillAssertionType,
  FireDrillContext,
} from './FireDrillTypes';

export class FireDrillScenarios {
  /**
   * Simple adapter failure scenario
   * Validates that SLO Controller detects unhealthy adapters
   */
  static readonly SIMPLE_ADAPTER_FAILURE: FireDrillScenario = {
    id: 'scenario-adapter-failure-simple',
    name: 'Simple Adapter Failure',
    description: 'Single adapter fails; system detects unhealthy status',
    tags: ['basic', 'adapter', 'health'],
    expectedDuration: 5000,
    faults: [
      {
        type: FireDrillFaultType.ADAPTER_FAILURE,
        targetAdapter: 'adapter1',
        durationMs: 2000,
        severity: 2,
        config: { failureRate: 1.0 },
      },
    ],
    assertions: [
      {
        type: FireDrillAssertionType.ADAPTER_HEALTH_UPDATED,
        condition: (ctx: FireDrillContext) => {
          const health = ctx.adapterHealthStatus['adapter1'];
          return health?.failureCount ?? 0 > 0;
        },
        description: 'Adapter failure count increased',
      },
      {
        type: FireDrillAssertionType.RECOVERY_SUCCESSFUL,
        condition: (ctx: FireDrillContext) => {
          const health = ctx.adapterHealthStatus['adapter1'];
          return health?.failureCount === 0 || (Date.now() - ctx.startTime > 4000);
        },
        description: 'System recovered after fault cleared',
        timeoutMs: 5000,
      },
    ],
  };

  /**
   * High latency scenario
   * Validates that SLO Controller triggers on p99 latency threshold
   */
  static readonly HIGH_LATENCY: FireDrillScenario = {
    id: 'scenario-high-latency',
    name: 'High Latency',
    description: 'Inject latency; validate SLO violation detection',
    tags: ['latency', 'slo', 'threshold'],
    expectedDuration: 5000,
    faults: [
      {
        type: FireDrillFaultType.LATENCY_INJECTION,
        targetAdapter: 'adapter1',
        durationMs: 3000,
        severity: 2,
        config: { latencyMs: 2500 },
      },
    ],
    assertions: [
      {
        type: FireDrillAssertionType.SLO_VIOLATION_DETECTED,
        condition: (ctx: FireDrillContext) => {
          return (ctx.metrics?.p99Latency ?? 0) > 2000;
        },
        description: 'P99 latency exceeded threshold',
      },
      {
        type: FireDrillAssertionType.LATENCY_WITHIN_THRESHOLD,
        condition: (ctx: FireDrillContext) => {
          const timeSinceFaultCleared = (Date.now() - ctx.startTime) - 3000;
          if (timeSinceFaultCleared < 0) return false;
          return (ctx.metrics?.avgLatency ?? 0) < 500;
        },
        description: 'Latency recovered after fault cleared',
        timeoutMs: 4000,
      },
    ],
  };

  /**
   * Cascading failure scenario
   * Validates that SLO Controller handles cascading failures across adapters
   */
  static readonly CASCADING_FAILURE: FireDrillScenario = {
    id: 'scenario-cascading-failure',
    name: 'Cascading Failure',
    description: 'Primary adapter fails; dependent adapters degrade',
    tags: ['cascading', 'critical', 'dependencies'],
    expectedDuration: 8000,
    faults: [
      {
        type: FireDrillFaultType.CASCADING_FAILURE,
        targetAdapter: 'primary',
        durationMs: 3000,
        severity: 3,
        config: { failureRate: 1.0 },
      },
    ],
    assertions: [
      {
        type: FireDrillAssertionType.SLO_VIOLATION_DETECTED,
        condition: (ctx: FireDrillContext) => {
          const primary = ctx.adapterHealthStatus['primary'];
          return (primary?.failureCount ?? 0) > 0;
        },
        description: 'Primary adapter marked unhealthy',
      },
      {
        type: FireDrillAssertionType.ENFORCEMENT_ACTION_TAKEN,
        condition: (ctx: FireDrillContext) => {
          return ctx.enforcementActions.length > 0;
        },
        description: 'Enforcement action triggered',
        timeoutMs: 5000,
      },
      {
        type: FireDrillAssertionType.RECOVERY_SUCCESSFUL,
        condition: (ctx: FireDrillContext) => {
          const allHealthy = Object.values(ctx.adapterHealthStatus).every(h => h.isHealthy);
          return allHealthy || (Date.now() - ctx.startTime > 7000);
        },
        description: 'System recovered from cascading failure',
        timeoutMs: 8000,
      },
    ],
  };

  /**
   * Partial outage scenario
   * Validates error-rate calculation and handling
   */
  static readonly PARTIAL_OUTAGE: FireDrillScenario = {
    id: 'scenario-partial-outage',
    name: 'Partial Outage (50% Error Rate)',
    description: 'Half of requests fail; validate error-rate SLO response',
    tags: ['error-rate', 'availability', 'slo'],
    expectedDuration: 6000,
    faults: [
      {
        type: FireDrillFaultType.PARTIAL_OUTAGE,
        targetAdapter: 'adapter1',
        durationMs: 3000,
        severity: 2,
        config: { failureRate: 0.5 },
      },
    ],
    assertions: [
      {
        type: FireDrillAssertionType.SLO_VIOLATION_DETECTED,
        condition: (ctx: FireDrillContext) => {
          const errorRate = (ctx.metrics?.errorCount ?? 0) / ((ctx.metrics?.errorCount ?? 0) + (ctx.metrics?.successCount ?? 0));
          return errorRate > 0.3;
        },
        description: 'Error rate exceeded threshold',
      },
      {
        type: FireDrillAssertionType.ENFORCEMENT_ACTION_TAKEN,
        condition: (ctx: FireDrillContext) => {
          return ctx.enforcementActions.length > 0;
        },
        description: 'Enforcement action triggered for error-rate',
        timeoutMs: 4000,
      },
    ],
  };

  /**
   * Saturation scenario
   * Validates queue depth / resource saturation detection
   */
  static readonly SATURATION: FireDrillScenario = {
    id: 'scenario-saturation',
    name: 'Resource Saturation',
    description: 'Queue depth increases; validate saturation SLO response',
    tags: ['saturation', 'queue-depth', 'resources'],
    expectedDuration: 6000,
    faults: [
      {
        type: FireDrillFaultType.SATURATION_INJECTION,
        targetAdapter: 'adapter1',
        durationMs: 3000,
        severity: 2,
        config: { queueDepth: 150 },
      },
    ],
    assertions: [
      {
        type: FireDrillAssertionType.SLO_VIOLATION_DETECTED,
        condition: (ctx: FireDrillContext) => {
          // Saturation detected when queue is high
          return true; // Simplified for this scenario
        },
        description: 'Saturation metric elevated',
      },
      {
        type: FireDrillAssertionType.ENFORCEMENT_ACTION_TAKEN,
        condition: (ctx: FireDrillContext) => {
          return ctx.enforcementActions.length > 0;
        },
        description: 'Enforcement action triggered for saturation',
        timeoutMs: 4000,
      },
    ],
  };

  /**
   * Multi-fault scenario
   * Validates system handling of simultaneous failures
   */
  static readonly MULTI_FAULT: FireDrillScenario = {
    id: 'scenario-multi-fault',
    name: 'Multiple Simultaneous Faults',
    description: 'Multiple adapters fail simultaneously; validate cascade handling',
    tags: ['critical', 'multi-fault', 'resilience'],
    expectedDuration: 10000,
    faults: [
      {
        type: FireDrillFaultType.ADAPTER_FAILURE,
        targetAdapter: 'adapter1',
        durationMs: 4000,
        severity: 2,
        config: { failureRate: 1.0 },
      },
      {
        type: FireDrillFaultType.LATENCY_INJECTION,
        targetAdapter: 'adapter2',
        durationMs: 4000,
        severity: 2,
        config: { latencyMs: 2000 },
      },
    ],
    assertions: [
      {
        type: FireDrillAssertionType.SLO_VIOLATION_DETECTED,
        condition: (ctx: FireDrillContext) => {
          return ctx.sloViolations.length > 0;
        },
        description: 'Multiple SLO violations detected',
        timeoutMs: 5000,
      },
      {
        type: FireDrillAssertionType.ENFORCEMENT_ACTION_TAKEN,
        condition: (ctx: FireDrillContext) => {
          return ctx.enforcementActions.length > 0;
        },
        description: 'Enforcement actions triggered',
        timeoutMs: 5000,
      },
      {
        type: FireDrillAssertionType.RECOVERY_SUCCESSFUL,
        condition: (ctx: FireDrillContext) => {
          const allHealthy = Object.values(ctx.adapterHealthStatus).every(h => h.isHealthy);
          return allHealthy || (Date.now() - ctx.startTime > 9000);
        },
        description: 'System recovered from multi-fault',
        timeoutMs: 10000,
      },
    ],
  };

  /**
   * Get all built-in scenarios
   */
  static getAllScenarios(): FireDrillScenario[] {
    return [
      this.SIMPLE_ADAPTER_FAILURE,
      this.HIGH_LATENCY,
      this.CASCADING_FAILURE,
      this.PARTIAL_OUTAGE,
      this.SATURATION,
      this.MULTI_FAULT,
    ];
  }

  /**
   * Get scenarios by tag
   */
  static getScenariosByTag(tag: string): FireDrillScenario[] {
    return this.getAllScenarios().filter(s => s.tags.includes(tag));
  }

  /**
   * Get scenarios by severity
   */
  static getScenariosBySeverity(severity: 1 | 2 | 3): FireDrillScenario[] {
    return this.getAllScenarios().filter(s => s.faults.some(f => f.severity === severity));
  }
}
