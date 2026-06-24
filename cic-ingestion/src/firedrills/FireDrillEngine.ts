/**
 * Fire Drill Engine
 *
 * Orchestrates automated chaos testing scenarios.
 * Injects faults, verifies SLO violations, and validates enforcement actions.
 */

import {
  FireDrillScenario,
  FireDrillResult,
  FireDrillContext,
  FireDrillFault,
  FireDrillMetrics,
  FireDrillLogEntry,
  FireDrillViolation,
  FireDrillFaultType,
  FireDrillOptions,
} from './FireDrillTypes';

export class FireDrillEngine {
  private options: FireDrillOptions;
  private activeScenarios: Map<string, FireDrillContext> = new Map();
  private results: FireDrillResult[] = [];
  private log: FireDrillLogEntry[] = [];

  constructor(options: Partial<FireDrillOptions> = {}) {
    this.options = {
      maxConcurrentDrills: options.maxConcurrentDrills ?? 5,
      timeoutMs: options.timeoutMs ?? 60000,
      verbose: options.verbose ?? false,
      recordMetrics: options.recordMetrics ?? true,
    };
  }

  /**
   * Run a fire drill scenario
   */
  async runScenario(scenario: FireDrillScenario): Promise<FireDrillResult> {
    if (this.activeScenarios.size >= this.options.maxConcurrentDrills) {
      throw new Error(`Maximum concurrent drills (${this.options.maxConcurrentDrills}) reached`);
    }

    const context: FireDrillContext = {
      scenarioId: scenario.id,
      startTime: Date.now(),
      currentTime: Date.now(),
      faultsActive: [],
      sloViolations: [],
      enforcementActions: [],
      adapterHealthStatus: {},
      metrics: {
        totalLatencySamples: 0,
        avgLatency: 0,
        p50Latency: 0,
        p99Latency: 0,
        errorCount: 0,
        errorRate: 0,
        successCount: 0,
        faultInjectionSuccessRate: 0,
        recoveryTime: 0,
      },
    };

    this.activeScenarios.set(scenario.id, context);
    this.log_info(`Starting fire drill: ${scenario.name}`);

    const result: FireDrillResult = {
      scenarioId: scenario.id,
      startTime: context.startTime,
      endTime: 0,
      durationMs: 0,
      passed: false,
      faultsInjected: 0,
      assertionsPassed: 0,
      assertionsFailed: 0,
      violations: [],
      metrics: {
        totalLatencySamples: 0,
        avgLatency: 0,
        p50Latency: 0,
        p99Latency: 0,
        errorCount: 0,
        errorRate: 0,
        successCount: 0,
        faultInjectionSuccessRate: 0,
        recoveryTime: 0,
      },
      log: [],
    };

    try {
      // Inject faults
      for (const fault of scenario.faults) {
        await this.injectFault(fault, context);
        result.faultsInjected++;
      }

      // Run assertions
      for (const assertion of scenario.assertions) {
        const assertionPassed = await this.runAssertion(assertion, context);
        if (assertionPassed) {
          result.assertionsPassed++;
        } else {
          result.assertionsFailed++;
          result.violations.push({
            timestamp: context.currentTime,
            assertionType: assertion.type,
            description: assertion.description,
            expected: true,
            actual: false,
          });
        }
      }

      // Wait for recovery
      await this.waitForRecovery(scenario, context);

      result.passed = result.assertionsFailed === 0;
      result.metrics = (context.metrics as unknown as FireDrillMetrics);
    } catch (err) {
      this.log_error(`Fire drill failed: ${err instanceof Error ? err.message : String(err)}`);
      result.passed = false;
    } finally {
      result.endTime = Date.now();
      result.durationMs = result.endTime - result.startTime;
      result.log = this.log.slice();
      this.results.push(result);
      this.activeScenarios.delete(scenario.id);
      this.log_info(`Fire drill completed: ${scenario.name} (${result.passed ? 'PASS' : 'FAIL'})`);
    }

    return result;
  }

  /**
   * Inject a fault into the system
   */
  private async injectFault(fault: FireDrillFault, context: FireDrillContext): Promise<void> {
    this.log_info(`Injecting fault: ${fault.type} on ${fault.targetAdapter}`);
    context.faultsActive.push(fault);

    switch (fault.type) {
      case FireDrillFaultType.ADAPTER_FAILURE:
        await this.simulateAdapterFailure(fault, context);
        break;
      case FireDrillFaultType.LATENCY_INJECTION:
        await this.simulateLatencyInjection(fault, context);
        break;
      case FireDrillFaultType.SATURATION_INJECTION:
        await this.simulateSaturationInjection(fault, context);
        break;
      case FireDrillFaultType.PARTIAL_OUTAGE:
        await this.simulatePartialOutage(fault, context);
        break;
      case FireDrillFaultType.CASCADING_FAILURE:
        await this.simulateCascadingFailure(fault, context);
        break;
    }

    // Wait for fault duration
    await new Promise(resolve => setTimeout(resolve, fault.durationMs));
    context.faultsActive = context.faultsActive.filter(f => f !== fault);
    this.log_info(`Fault cleared: ${fault.type} on ${fault.targetAdapter}`);
  }

  /**
   * Simulate adapter failure
   */
  private async simulateAdapterFailure(fault: FireDrillFault, context: FireDrillContext): Promise<void> {
    const failureRate = fault.config?.failureRate ?? 1.0;
    context.adapterHealthStatus[fault.targetAdapter] = {
      isHealthy: false,
      failureCount: Math.ceil(3 * failureRate),
    };

    // Record errors
    for (let i = 0; i < Math.ceil(5 * failureRate); i++) {
      if (context.metrics?.errorCount !== undefined) {
        context.metrics.errorCount++;
      }
    }
  }

  /**
   * Simulate latency injection
   */
  private async simulateLatencyInjection(fault: FireDrillFault, context: FireDrillContext): Promise<void> {
    const baseLatency = fault.config?.latencyMs ?? 1000;
    const samples = 10;

    for (let i = 0; i < samples; i++) {
      const latency = baseLatency + Math.random() * baseLatency * 0.2;
      if (context.metrics) {
        context.metrics.totalLatencySamples = (context.metrics.totalLatencySamples ?? 0) + 1;
        context.metrics.avgLatency = (context.metrics.avgLatency ?? 0) + latency / samples;
        context.metrics.p99Latency = Math.max(context.metrics.p99Latency ?? 0, latency);
      }
    }
  }

  /**
   * Simulate saturation injection
   */
  private async simulateSaturationInjection(fault: FireDrillFault, context: FireDrillContext): Promise<void> {
    const queueDepth = fault.config?.queueDepth ?? 100;
    this.log_info(`Queue depth increased to ${queueDepth} for ${fault.targetAdapter}`);
    // In a real implementation, this would affect the SLO Controller's saturation metrics
  }

  /**
   * Simulate partial outage (some requests fail)
   */
  private async simulatePartialOutage(fault: FireDrillFault, context: FireDrillContext): Promise<void> {
    const failureRate = fault.config?.failureRate ?? 0.5;
    for (let i = 0; i < 10; i++) {
      if (Math.random() < failureRate) {
        if (context.metrics?.errorCount !== undefined) {
          context.metrics.errorCount++;
        }
      } else {
        if (context.metrics?.successCount !== undefined) {
          context.metrics.successCount++;
        }
      }
    }
  }

  /**
   * Simulate cascading failure (affects multiple adapters)
   */
  private async simulateCascadingFailure(fault: FireDrillFault, context: FireDrillContext): Promise<void> {
    // Mark primary adapter as unhealthy
    context.adapterHealthStatus[fault.targetAdapter] = {
      isHealthy: false,
      failureCount: 5,
    };

    // Mark dependent adapters as degraded
    const dependentAdapters = this.getAdapterDependencies(fault.targetAdapter);
    for (const adapter of dependentAdapters) {
      context.adapterHealthStatus[adapter] = {
        isHealthy: true,
        failureCount: 1, // Degraded but not unhealthy
      };
    }

    this.log_warn(`Cascading failure: ${fault.targetAdapter} → ${dependentAdapters.join(', ')}`);
  }

  /**
   * Run an assertion
   */
  private async runAssertion(
    assertion: any,
    context: FireDrillContext
  ): Promise<boolean> {
    const timeout = assertion.timeoutMs ?? this.options.timeoutMs;
    const startTime = Date.now();

    return new Promise(resolve => {
      const interval = setInterval(() => {
        context.currentTime = Date.now();
        if (assertion.condition(context)) {
          clearInterval(interval);
          this.log_info(`✓ Assertion passed: ${assertion.description}`);
          resolve(true);
        } else if (Date.now() - startTime > timeout) {
          clearInterval(interval);
          this.log_error(`✗ Assertion failed: ${assertion.description}`);
          resolve(false);
        }
      }, 100);
    });
  }

  /**
   * Wait for system recovery
   */
  private async waitForRecovery(scenario: FireDrillScenario, context: FireDrillContext): Promise<void> {
    const recoveryDeadline = context.startTime + scenario.expectedDuration + 5000;
    const startRecoveryTime = Date.now();

    while (Date.now() < recoveryDeadline) {
      const allHealthy = Object.values(context.adapterHealthStatus).every(h => h.isHealthy);
      if (allHealthy && context.faultsActive.length === 0) {
        if (context.metrics) {
          context.metrics.recoveryTime = Date.now() - startRecoveryTime;
        }
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.log_warn('Recovery timeout: system did not fully recover');
  }

  /**
   * Get results of all runs
   */
  getResults(): FireDrillResult[] {
    return this.results;
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalRuns: number;
    passed: number;
    failed: number;
    passRate: number;
    avgDuration: number;
    totalFaultsInjected: number;
  } {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.durationMs, 0);
    const totalFaults = this.results.reduce((sum, r) => sum + r.faultsInjected, 0);

    return {
      totalRuns: this.results.length,
      passed,
      failed,
      passRate: this.results.length > 0 ? passed / this.results.length : 0,
      avgDuration: this.results.length > 0 ? totalDuration / this.results.length : 0,
      totalFaultsInjected: totalFaults,
    };
  }

  /**
   * Get adapter dependencies (stub)
   */
  private getAdapterDependencies(adapterId: string): string[] {
    // In a real implementation, this would query a dependency graph
    const dependencies: Record<string, string[]> = {
      'primary': ['secondary1', 'secondary2'],
      'secondary1': ['cache'],
      'secondary2': ['cache'],
    };
    return dependencies[adapterId] ?? [];
  }

  private log_info(message: string, context?: Record<string, unknown>): void {
    const entry: FireDrillLogEntry = {
      timestamp: Date.now(),
      level: 'INFO',
      message,
      context,
    };
    this.log.push(entry);
    if (this.options.verbose) {
      console.log(`[FireDrill] ${message}`);
    }
  }

  private log_warn(message: string, context?: Record<string, unknown>): void {
    const entry: FireDrillLogEntry = {
      timestamp: Date.now(),
      level: 'WARN',
      message,
      context,
    };
    this.log.push(entry);
    if (this.options.verbose) {
      console.warn(`[FireDrill] ${message}`);
    }
  }

  private log_error(message: string, context?: Record<string, unknown>): void {
    const entry: FireDrillLogEntry = {
      timestamp: Date.now(),
      level: 'ERROR',
      message,
      context,
    };
    this.log.push(entry);
    console.error(`[FireDrill] ${message}`);
  }
}
