/**
 * Fire Drill Engine Tests
 *
 * Tests for chaos testing scenarios and assertion validation.
 */

import { FireDrillEngine } from '../FireDrillEngine';
import { FireDrillScenarios } from '../FireDrillScenarios';
import {
  FireDrillFaultType,
  FireDrillAssertionType,
  FireDrillScenario,
  FireDrillContext,
} from '../FireDrillTypes';

describe('FireDrillEngine', () => {
  let engine: FireDrillEngine;

  beforeEach(() => {
    engine = new FireDrillEngine({ verbose: false, timeoutMs: 5000 });
  });

  describe('scenario execution', () => {
    it('runs a simple fire drill scenario', async () => {
      const result = await engine.runScenario(FireDrillScenarios.SIMPLE_ADAPTER_FAILURE);

      expect(result.scenarioId).toBe(FireDrillScenarios.SIMPLE_ADAPTER_FAILURE.id);
      expect(result.faultsInjected).toBe(1);
      expect(result.startTime).toBeGreaterThan(0);
      expect(result.endTime).toBeGreaterThan(result.startTime);
      expect(result.durationMs).toBeGreaterThan(0);
    });

    it('records fault injection count', async () => {
      const result = await engine.runScenario(FireDrillScenarios.SIMPLE_ADAPTER_FAILURE);
      expect(result.faultsInjected).toBe(1);
    });

    it('records assertion results', async () => {
      const result = await engine.runScenario(FireDrillScenarios.SIMPLE_ADAPTER_FAILURE);

      expect(result.assertionsPassed + result.assertionsFailed).toBeGreaterThan(0);
      expect(result.assertionsPassed).toBeGreaterThanOrEqual(0);
      expect(result.assertionsFailed).toBeGreaterThanOrEqual(0);
    });

    it('marks scenario as passed when all assertions pass', async () => {
      const scenario: FireDrillScenario = {
        id: 'test-pass',
        name: 'Test Pass',
        description: 'Always passing scenario',
        tags: ['test'],
        expectedDuration: 1000,
        faults: [],
        assertions: [
          {
            type: FireDrillAssertionType.SLO_VIOLATION_DETECTED,
            condition: () => true,
            description: 'Always true',
          },
        ],
      };

      const result = await engine.runScenario(scenario);
      expect(result.passed).toBe(true);
      expect(result.assertionsPassed).toBe(1);
      expect(result.assertionsFailed).toBe(0);
    });

    it('marks scenario as failed when assertions fail', async () => {
      const scenario: FireDrillScenario = {
        id: 'test-fail',
        name: 'Test Fail',
        description: 'Always failing scenario',
        tags: ['test'],
        expectedDuration: 1000,
        faults: [],
        assertions: [
          {
            type: FireDrillAssertionType.SLO_VIOLATION_DETECTED,
            condition: () => false,
            description: 'Always false',
            timeoutMs: 100,
          },
        ],
      };

      const result = await engine.runScenario(scenario);
      expect(result.passed).toBe(false);
      expect(result.assertionsFailed).toBeGreaterThan(0);
    });
  });

  describe('fault injection', () => {
    it('injects adapter failure faults', async () => {
      const scenario: FireDrillScenario = {
        id: 'test-adapter-failure',
        name: 'Test Adapter Failure',
        description: 'Test adapter failure',
        tags: ['test'],
        expectedDuration: 2000,
        faults: [
          {
            type: FireDrillFaultType.ADAPTER_FAILURE,
            targetAdapter: 'test-adapter',
            durationMs: 1000,
            severity: 2,
            config: { failureRate: 1.0 },
          },
        ],
        assertions: [
          {
            type: FireDrillAssertionType.ADAPTER_HEALTH_UPDATED,
            condition: (ctx: FireDrillContext) => {
              const health = ctx.adapterHealthStatus['test-adapter'];
              return (health?.failureCount ?? 0) > 0;
            },
            description: 'Adapter health updated',
          },
        ],
      };

      const result = await engine.runScenario(scenario);
      expect(result.faultsInjected).toBe(1);
    });

    it('injects latency faults', async () => {
      const scenario: FireDrillScenario = {
        id: 'test-latency',
        name: 'Test Latency',
        description: 'Test latency injection',
        tags: ['test'],
        expectedDuration: 2000,
        faults: [
          {
            type: FireDrillFaultType.LATENCY_INJECTION,
            targetAdapter: 'test-adapter',
            durationMs: 1000,
            severity: 2,
            config: { latencyMs: 500 },
          },
        ],
        assertions: [
          {
            type: FireDrillAssertionType.SLO_VIOLATION_DETECTED,
            condition: (ctx: FireDrillContext) => {
              return (ctx.metrics?.p99Latency ?? 0) > 0;
            },
            description: 'Latency recorded',
          },
        ],
      };

      const result = await engine.runScenario(scenario);
      expect(result.faultsInjected).toBe(1);
    });

    it('injects saturation faults', async () => {
      const scenario: FireDrillScenario = {
        id: 'test-saturation',
        name: 'Test Saturation',
        description: 'Test saturation injection',
        tags: ['test'],
        expectedDuration: 2000,
        faults: [
          {
            type: FireDrillFaultType.SATURATION_INJECTION,
            targetAdapter: 'test-adapter',
            durationMs: 1000,
            severity: 2,
            config: { queueDepth: 100 },
          },
        ],
        assertions: [],
      };

      const result = await engine.runScenario(scenario);
      expect(result.faultsInjected).toBe(1);
    });

    it('injects partial outage faults', async () => {
      const scenario: FireDrillScenario = {
        id: 'test-partial-outage',
        name: 'Test Partial Outage',
        description: 'Test partial outage',
        tags: ['test'],
        expectedDuration: 2000,
        faults: [
          {
            type: FireDrillFaultType.PARTIAL_OUTAGE,
            targetAdapter: 'test-adapter',
            durationMs: 1000,
            severity: 2,
            config: { failureRate: 0.5 },
          },
        ],
        assertions: [
          {
            type: FireDrillAssertionType.SLO_VIOLATION_DETECTED,
            condition: (ctx: FireDrillContext) => {
              return (ctx.metrics?.errorCount ?? 0) > 0;
            },
            description: 'Errors recorded',
          },
        ],
      };

      const result = await engine.runScenario(scenario);
      expect(result.faultsInjected).toBe(1);
    });

    it('injects cascading failure faults', async () => {
      const scenario: FireDrillScenario = {
        id: 'test-cascading',
        name: 'Test Cascading Failure',
        description: 'Test cascading failure',
        tags: ['test'],
        expectedDuration: 2000,
        faults: [
          {
            type: FireDrillFaultType.CASCADING_FAILURE,
            targetAdapter: 'primary',
            durationMs: 1000,
            severity: 3,
            config: { failureRate: 1.0 },
          },
        ],
        assertions: [],
      };

      const result = await engine.runScenario(scenario);
      expect(result.faultsInjected).toBe(1);
    });
  });

  describe('assertion handling', () => {
    it('waits for assertion condition to become true', async () => {
      const scenario: FireDrillScenario = {
        id: 'test-delayed-assertion',
        name: 'Test Delayed Assertion',
        description: 'Test delayed assertion',
        tags: ['test'],
        expectedDuration: 2000,
        faults: [],
        assertions: [
          {
            type: FireDrillAssertionType.RECOVERY_SUCCESSFUL,
            condition: (ctx: FireDrillContext) => {
              return (Date.now() - ctx.startTime) > 500;
            },
            description: 'Time passed',
            timeoutMs: 2000,
          },
        ],
      };

      const result = await engine.runScenario(scenario);
      expect(result.assertionsPassed).toBeGreaterThan(0);
    });

    it('fails assertion on timeout', async () => {
      const scenario: FireDrillScenario = {
        id: 'test-timeout',
        name: 'Test Timeout',
        description: 'Test timeout',
        tags: ['test'],
        expectedDuration: 1000,
        faults: [],
        assertions: [
          {
            type: FireDrillAssertionType.RECOVERY_SUCCESSFUL,
            condition: () => false,
            description: 'Never true',
            timeoutMs: 100,
          },
        ],
      };

      const result = await engine.runScenario(scenario);
      expect(result.assertionsFailed).toBeGreaterThan(0);
    });

    it('tracks multiple assertions', async () => {
      const scenario: FireDrillScenario = {
        id: 'test-multiple',
        name: 'Test Multiple',
        description: 'Test multiple assertions',
        tags: ['test'],
        expectedDuration: 2000,
        faults: [],
        assertions: [
          {
            type: FireDrillAssertionType.SLO_VIOLATION_DETECTED,
            condition: () => true,
            description: 'First assertion',
          },
          {
            type: FireDrillAssertionType.RECOVERY_SUCCESSFUL,
            condition: () => true,
            description: 'Second assertion',
          },
          {
            type: FireDrillAssertionType.ADAPTER_HEALTH_UPDATED,
            condition: () => true,
            description: 'Third assertion',
          },
        ],
      };

      const result = await engine.runScenario(scenario);
      expect(result.assertionsPassed).toBe(3);
      expect(result.assertionsFailed).toBe(0);
    });
  });

  describe('results and metrics', () => {
    it('collects all results', async () => {
      await engine.runScenario(FireDrillScenarios.SIMPLE_ADAPTER_FAILURE);
      await engine.runScenario(FireDrillScenarios.HIGH_LATENCY);

      const results = engine.getResults();
      expect(results).toHaveLength(2);
    });

    it('calculates summary statistics', async () => {
      await engine.runScenario(FireDrillScenarios.SIMPLE_ADAPTER_FAILURE);
      await engine.runScenario(FireDrillScenarios.HIGH_LATENCY);

      const summary = engine.getSummary();
      expect(summary.totalRuns).toBe(2);
      expect(summary.passed).toBeGreaterThanOrEqual(0);
      expect(summary.failed).toBeGreaterThanOrEqual(0);
      expect(summary.passed + summary.failed).toBe(2);
      expect(summary.passRate).toBeGreaterThanOrEqual(0);
      expect(summary.passRate).toBeLessThanOrEqual(1);
      expect(summary.avgDuration).toBeGreaterThan(0);
      expect(summary.totalFaultsInjected).toBeGreaterThan(0);
    });

    it('records metrics per scenario', async () => {
      const result = await engine.runScenario(FireDrillScenarios.HIGH_LATENCY);

      expect(result.metrics.totalLatencySamples).toBeGreaterThanOrEqual(0);
      expect(result.metrics.avgLatency).toBeGreaterThanOrEqual(0);
      expect(result.metrics.p50Latency).toBeGreaterThanOrEqual(0);
      expect(result.metrics.p99Latency).toBeGreaterThanOrEqual(0);
      expect(result.metrics.errorCount).toBeGreaterThanOrEqual(0);
      expect(result.metrics.errorRate).toBeGreaterThanOrEqual(0);
    });

    it('records scenario duration', async () => {
      const result = await engine.runScenario(FireDrillScenarios.SIMPLE_ADAPTER_FAILURE);

      expect(result.durationMs).toBeGreaterThanOrEqual(
        FireDrillScenarios.SIMPLE_ADAPTER_FAILURE.faults[0].durationMs
      );
    });
  });

  describe('built-in scenarios', () => {
    it('executes all built-in scenarios', async () => {
      const scenarios = FireDrillScenarios.getAllScenarios();
      expect(scenarios.length).toBeGreaterThan(0);

      for (const scenario of scenarios) {
        const result = await engine.runScenario(scenario);
        expect(result.scenarioId).toBe(scenario.id);
      }
    });

    it('filters scenarios by tag', () => {
      const latencyScenarios = FireDrillScenarios.getScenariosByTag('latency');
      expect(latencyScenarios.length).toBeGreaterThan(0);
      expect(latencyScenarios.every(s => s.tags.includes('latency'))).toBe(true);
    });

    it('filters scenarios by severity', () => {
      const criticalScenarios = FireDrillScenarios.getScenariosBySeverity(3);
      expect(criticalScenarios.length).toBeGreaterThan(0);
      expect(criticalScenarios.every(s => s.faults.some(f => f.severity === 3))).toBe(true);
    });
  });

  describe('error handling', () => {
    it('handles empty fault list', async () => {
      const scenario: FireDrillScenario = {
        id: 'test-no-faults',
        name: 'No Faults',
        description: 'Scenario with no faults',
        tags: ['test'],
        expectedDuration: 1000,
        faults: [],
        assertions: [],
      };

      const result = await engine.runScenario(scenario);
      expect(result.faultsInjected).toBe(0);
      expect(result.passed).toBe(true);
    });

    it('handles empty assertion list', async () => {
      const scenario: FireDrillScenario = {
        id: 'test-no-assertions',
        name: 'No Assertions',
        description: 'Scenario with no assertions',
        tags: ['test'],
        expectedDuration: 1000,
        faults: [
          {
            type: FireDrillFaultType.ADAPTER_FAILURE,
            targetAdapter: 'test',
            durationMs: 500,
            severity: 1,
          },
        ],
        assertions: [],
      };

      const result = await engine.runScenario(scenario);
      expect(result.faultsInjected).toBe(1);
      expect(result.assertionsPassed).toBe(0);
      expect(result.assertionsFailed).toBe(0);
      expect(result.passed).toBe(true);
    });
  });

  describe('concurrent limits', () => {
    it('enforces concurrent drill limit', async () => {
      const limitedEngine = new FireDrillEngine({ maxConcurrentDrills: 1 });

      const scenario: FireDrillScenario = {
        id: 'test-concurrent',
        name: 'Test Concurrent',
        description: 'Test concurrent limit',
        tags: ['test'],
        expectedDuration: 1000,
        faults: [
          {
            type: FireDrillFaultType.ADAPTER_FAILURE,
            targetAdapter: 'test',
            durationMs: 500,
            severity: 1,
          },
        ],
        assertions: [],
      };

      const promise1 = limitedEngine.runScenario(scenario);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Second call should throw since limit is 1 and one drill is active
      let threwError = false;
      try {
        await limitedEngine.runScenario(scenario);
      } catch (err) {
        threwError = true;
      }

      expect(threwError).toBe(true);

      await promise1;
    });
  });
});
