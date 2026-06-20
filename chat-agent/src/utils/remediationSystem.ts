import { performanceTracker } from './performanceTracker';
import { adaptiveRouter } from './agentSelector';
import type { AgentRole } from '../orchestrator/types';

/**
 * Automated remediation: circuit breaker, fallback routing, rate limiting
 *
 * Detects unhealthy agents and automatically:
 * - Breaks circuit to prevent cascade failures
 * - Routes to healthy alternatives
 * - Applies rate limiting to struggling agents
 * - Re-enables after cool-down period
 */

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface RemediationConfig {
  failureThreshold?: number;           // Default: 5 consecutive failures
  successThreshold?: number;           // Default: 3 consecutive successes
  circuitOpenTimeoutMs?: number;       // Default: 60 seconds
  rateLimit?: number;                  // Default: 10 requests/second
  minExecutionsForDecision?: number;   // Default: 5 executions before action
}

export interface CircuitBreaker {
  agentRole: AgentRole;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  openedAt?: number;
  nextRetryTime?: number;
  totalBreaks: number;
}

export interface RemediationAction {
  timestamp: number;
  agentRole: AgentRole;
  actionType: 'circuit-open' | 'circuit-close' | 'rate-limit' | 'fallback-suggested';
  reason: string;
  previousState: CircuitState;
  newState?: CircuitState;
  suggestedFallback?: AgentRole;
}

export class RemediationSystem {
  private config: RemediationConfig;
  private circuitBreakers: Map<AgentRole, CircuitBreaker> = new Map();
  private rateLimitCounters: Map<AgentRole, { count: number; resetTime: number }> = new Map();
  private actions: RemediationAction[] = [];
  private maxActionsSize: number = 1000;
  private checkInterval?: NodeJS.Timeout;

  constructor(config?: RemediationConfig) {
    this.config = {
      failureThreshold: 5,
      successThreshold: 3,
      circuitOpenTimeoutMs: 60000,  // 1 minute
      rateLimit: 10,                 // Per second
      minExecutionsForDecision: 5,
      ...config
    };
  }

  /**
   * Start background health checks
   */
  start(): void {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(() => {
      this.checkAndRemedy();
    }, 30000);  // Check every 30 seconds

    console.log(`[RemediationSystem] Started with config:`, this.config);
  }

  /**
   * Stop background checks
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
      console.log('[RemediationSystem] Stopped');
    }
  }

  /**
   * Record task result (called by orchestrator after task completion)
   */
  recordResult(agentRole: AgentRole, status: 'success' | 'failed' | 'timeout' | 'rejected'): void {
    let breaker = this.circuitBreakers.get(agentRole);
    if (!breaker) {
      breaker = {
        agentRole,
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        totalBreaks: 0
      };
      this.circuitBreakers.set(agentRole, breaker);
    }

    // Update counts
    if (status === 'success') {
      breaker.successCount++;
      breaker.failureCount = 0;  // Reset failure count
      breaker.lastSuccessTime = Date.now();

      // Potential recovery: close circuit if in half-open
      if (breaker.state === 'half-open' && breaker.successCount >= this.config.successThreshold!) {
        this.closeCircuit(breaker);
      }
    } else {
      breaker.failureCount++;
      breaker.successCount = 0;  // Reset success count
      breaker.lastFailureTime = Date.now();

      // Open circuit if too many failures
      if (breaker.state === 'closed' && breaker.failureCount >= this.config.failureThreshold!) {
        this.openCircuit(breaker);
      }
    }
  }

  /**
   * Check if agent can proceed (circuit breaker + rate limit)
   */
  canProceed(agentRole: AgentRole): { allowed: boolean; reason?: string } {
    const breaker = this.circuitBreakers.get(agentRole);

    // Check circuit state
    if (breaker?.state === 'open') {
      const now = Date.now();
      const openedAt = breaker.openedAt ?? now;

      // Check if timeout expired for half-open retry
      if (now - openedAt > this.config.circuitOpenTimeoutMs!) {
        breaker.state = 'half-open';
        breaker.nextRetryTime = now;
        console.log(`[RemediationSystem] Circuit for ${agentRole} entering half-open (retry)`);
      } else {
        return {
          allowed: false,
          reason: `Agent '${agentRole}' circuit is open (${((this.config.circuitOpenTimeoutMs! - (now - openedAt)) / 1000).toFixed(1)}s remaining)`
        };
      }
    }

    // Check rate limit
    if (!this.checkRateLimit(agentRole)) {
      return {
        allowed: false,
        reason: `Agent '${agentRole}' rate limit exceeded`
      };
    }

    return { allowed: true };
  }

  /**
   * Get fallback agent when primary fails
   */
  suggestFallback(primaryAgent: AgentRole, candidates: AgentRole[]): AgentRole | null {
    // Filter to agents that are not open
    const healthy = candidates.filter(agent => {
      const breaker = this.circuitBreakers.get(agent);
      return !breaker || breaker.state !== 'open';
    });

    if (healthy.length === 0) {
      return null;
    }

    // Sort by success rate and return best
    const sorted = healthy.sort((a, b) => {
      const metricsA = performanceTracker.getMetrics(a);
      const metricsB = performanceTracker.getMetrics(b);
      return (metricsB?.successRate ?? 0) - (metricsA?.successRate ?? 0);
    });

    return sorted[0];
  }

  /**
   * Get circuit breaker status for agent
   */
  getCircuitStatus(agentRole: AgentRole): CircuitBreaker | null {
    return this.circuitBreakers.get(agentRole) ?? null;
  }

  /**
   * Get all circuit breakers
   */
  getAllCircuits(): CircuitBreaker[] {
    return Array.from(this.circuitBreakers.values());
  }

  /**
   * Manually open circuit (operator action)
   */
  manuallyOpenCircuit(agentRole: AgentRole, reason: string): void {
    let breaker = this.circuitBreakers.get(agentRole);
    if (!breaker) {
      breaker = {
        agentRole,
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        totalBreaks: 0
      };
      this.circuitBreakers.set(agentRole, breaker);
    }

    const previousState = breaker.state;
    breaker.state = 'open';
    breaker.openedAt = Date.now();
    breaker.totalBreaks++;
    breaker.failureCount = 0;
    breaker.successCount = 0;

    this.recordAction({
      timestamp: Date.now(),
      agentRole,
      actionType: 'circuit-open',
      reason: `Manual: ${reason}`,
      previousState
    });
  }

  /**
   * Manually close circuit (operator action)
   */
  manuallyCloseCircuit(agentRole: AgentRole): void {
    const breaker = this.circuitBreakers.get(agentRole);
    if (!breaker) {
      return;
    }

    const previousState = breaker.state;
    breaker.state = 'closed';
    breaker.failureCount = 0;
    breaker.successCount = 0;
    breaker.openedAt = undefined;

    this.recordAction({
      timestamp: Date.now(),
      agentRole,
      actionType: 'circuit-close',
      reason: 'Manual operator reset',
      previousState
    });
  }

  /**
   * Get remediation actions
   */
  getActions(limit?: number): RemediationAction[] {
    return this.actions.slice(-(limit ?? 100)).reverse();
  }

  /**
   * Get health report
   */
  getHealthReport(): {
    healthy: AgentRole[];
    degraded: AgentRole[];
    broken: AgentRole[];
    stats: { closed: number; halfOpen: number; open: number };
  } {
    const healthy: AgentRole[] = [];
    const degraded: AgentRole[] = [];
    const broken: AgentRole[] = [];

    for (const breaker of this.circuitBreakers.values()) {
      if (breaker.state === 'closed') {
        healthy.push(breaker.agentRole);
      } else if (breaker.state === 'half-open') {
        degraded.push(breaker.agentRole);
      } else {
        broken.push(breaker.agentRole);
      }
    }

    return {
      healthy,
      degraded,
      broken,
      stats: {
        closed: healthy.length,
        halfOpen: degraded.length,
        open: broken.length
      }
    };
  }

  // ==================== Private Helpers ====================

  private openCircuit(breaker: CircuitBreaker): void {
    const previousState = breaker.state;
    breaker.state = 'open';
    breaker.openedAt = Date.now();
    breaker.totalBreaks++;

    const metrics = performanceTracker.getMetrics(breaker.agentRole);
    const reason = `Failure rate exceeded threshold: ${breaker.failureCount} consecutive failures, actual rate: ${metrics?.failureRate.toFixed(1)}%`;

    this.recordAction({
      timestamp: Date.now(),
      agentRole: breaker.agentRole,
      actionType: 'circuit-open',
      reason,
      previousState
    });

    console.log(`[RemediationSystem] Circuit OPEN for ${breaker.agentRole}: ${reason}`);
  }

  private closeCircuit(breaker: CircuitBreaker): void {
    const previousState = breaker.state;
    breaker.state = 'closed';
    breaker.failureCount = 0;
    breaker.successCount = 0;
    breaker.openedAt = undefined;

    this.recordAction({
      timestamp: Date.now(),
      agentRole: breaker.agentRole,
      actionType: 'circuit-close',
      reason: `Recovery: ${breaker.successCount} consecutive successes`,
      previousState
    });

    console.log(`[RemediationSystem] Circuit CLOSED for ${breaker.agentRole}: Recovery successful`);
  }

  private checkRateLimit(agentRole: AgentRole): boolean {
    const now = Date.now();
    let counter = this.rateLimitCounters.get(agentRole);

    if (!counter || now > counter.resetTime) {
      // Reset counter
      counter = { count: 1, resetTime: now + 1000 };
      this.rateLimitCounters.set(agentRole, counter);
      return true;
    }

    counter.count++;
    return counter.count <= this.config.rateLimit!;
  }

  private checkAndRemedy(): void {
    for (const breaker of this.circuitBreakers.values()) {
      const metrics = performanceTracker.getMetrics(breaker.agentRole);
      if (!metrics || metrics.totalExecutions < this.config.minExecutionsForDecision!) {
        continue;
      }

      // If circuit is closed but metrics show high failure rate, open it
      if (
        breaker.state === 'closed' &&
        metrics.failureRate > 30 &&
        metrics.totalExecutions >= this.config.minExecutionsForDecision!
      ) {
        this.openCircuit(breaker);
      }

      // If circuit is open and metrics show recovery, suggest half-open
      if (breaker.state === 'open' && metrics.successRate > 80) {
        const now = Date.now();
        if (!breaker.nextRetryTime || now > breaker.nextRetryTime) {
          breaker.state = 'half-open';
          breaker.nextRetryTime = now + 30000;  // Next check in 30s
          console.log(`[RemediationSystem] ${breaker.agentRole}: Circuit entering half-open (metrics recovery)`);
        }
      }
    }
  }

  private recordAction(action: RemediationAction): void {
    this.actions.push(action);

    // Keep bounded
    if (this.actions.length > this.maxActionsSize) {
      this.actions = this.actions.slice(-this.maxActionsSize);
    }
  }
}

// Singleton instance
let remediationSystem: RemediationSystem | null = null;

export function getRemediationSystem(): RemediationSystem {
  if (!remediationSystem) {
    remediationSystem = new RemediationSystem();
  }
  return remediationSystem;
}

export function initializeRemediationSystem(config?: RemediationConfig): RemediationSystem {
  if (!remediationSystem) {
    remediationSystem = new RemediationSystem(config);
    remediationSystem.start();
  }
  return remediationSystem;
}
