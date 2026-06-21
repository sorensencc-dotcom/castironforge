/**
 * RL-2: Circuit Breaker with OPEN_EXTENDED State
 *
 * Remediation for Gap RL-2: No per-agent circuit breaker.
 * Extends standard circuit breaker (CLOSED → OPEN → HALF_OPEN → CLOSED)
 * with OPEN_EXTENDED state: degraded service with fallback after long outage.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN' | 'OPEN_EXTENDED';

export interface CircuitBreakerConfig {
  agent_id: string;
  failure_threshold: number; // Failures before tripping (e.g., 5)
  success_threshold: number; // Successes before closing (e.g., 2)
  timeout_ms: number; // Duration before half-open (e.g., 30s)
  extended_timeout_ms: number; // Duration before OPEN_EXTENDED (e.g., 5min)
  fallback_strategy?: 'cached_result' | 'degraded_service' | 'reject';
}

export interface CircuitBreakerState {
  agent_id: string;
  state: CircuitState;
  failure_count: number;
  success_count: number;
  last_failure_timestamp?: string;
  state_change_timestamp: string;
  half_open_attempts: number; // Attempts in HALF_OPEN state
  extended_since?: string; // Timestamp when entered OPEN_EXTENDED
}

export interface CircuitBreakerEvent {
  event_type: 'failure' | 'success' | 'state_change' | 'fallback_triggered';
  agent_id: string;
  timestamp: string;
  detail?: string;
  previous_state?: CircuitState;
  new_state?: CircuitState;
}

/**
 * Circuit breaker implementation with fallback handling
 */
export class CircuitBreaker {
  private state: CircuitBreakerState;
  private config: CircuitBreakerConfig;
  private events: CircuitBreakerEvent[] = [];

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
    this.state = {
      agent_id: config.agent_id,
      state: 'CLOSED',
      failure_count: 0,
      success_count: 0,
      state_change_timestamp: new Date().toISOString(),
      half_open_attempts: 0
    };
  }

  /**
   * Check if request can proceed; may trigger state transitions
   */
  canProceed(): { allowed: boolean; state: CircuitState; fallback?: string } {
    this.checkStateTransitions();

    if (this.state.state === 'CLOSED') {
      return { allowed: true, state: 'CLOSED' };
    }

    if (this.state.state === 'HALF_OPEN') {
      return { allowed: true, state: 'HALF_OPEN' };
    }

    if (this.state.state === 'OPEN') {
      return { allowed: false, state: 'OPEN', fallback: this.config.fallback_strategy };
    }

    if (this.state.state === 'OPEN_EXTENDED') {
      // OPEN_EXTENDED allows requests with degraded service
      return { allowed: true, state: 'OPEN_EXTENDED', fallback: 'degraded_service' };
    }

    return { allowed: false, state: this.state.state };
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    this.recordEvent('success', `Agent ${this.config.agent_id} request succeeded`);

    if (this.state.state === 'HALF_OPEN') {
      this.state.success_count++;
      this.state.half_open_attempts++;

      if (this.state.success_count >= this.config.success_threshold) {
        this.transitionTo('CLOSED');
        this.state.failure_count = 0;
        this.state.success_count = 0;
      }
    } else if (this.state.state === 'CLOSED') {
      this.state.success_count++;
      this.state.failure_count = Math.max(0, this.state.failure_count - 1); // Decay failures
    } else if (this.state.state === 'OPEN_EXTENDED') {
      this.state.success_count++;
      // Allow slow recovery from OPEN_EXTENDED
      if (this.state.success_count >= this.config.success_threshold * 2) {
        this.transitionTo('HALF_OPEN');
        this.state.success_count = 0;
      }
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    this.recordEvent('failure', `Agent ${this.config.agent_id} request failed`);

    this.state.last_failure_timestamp = new Date().toISOString();
    this.state.failure_count++;

    if (this.state.state === 'CLOSED' && this.state.failure_count >= this.config.failure_threshold) {
      this.transitionTo('OPEN');
    } else if (this.state.state === 'HALF_OPEN') {
      // Single failure in HALF_OPEN resets to OPEN
      this.transitionTo('OPEN');
      this.state.success_count = 0;
      this.state.half_open_attempts++;
    }
  }

  /**
   * Check for state transitions based on time (OPEN → HALF_OPEN, OPEN → OPEN_EXTENDED)
   */
  private checkStateTransitions(): void {
    if (this.state.state === 'OPEN') {
      const timeSinceOpen = Date.now() - new Date(this.state.state_change_timestamp).getTime();

      if (timeSinceOpen > this.config.extended_timeout_ms) {
        // Long outage: transition to OPEN_EXTENDED for degraded service
        this.transitionTo('OPEN_EXTENDED');
        this.state.extended_since = new Date().toISOString();
      } else if (timeSinceOpen > this.config.timeout_ms) {
        // Try recovery
        this.transitionTo('HALF_OPEN');
        this.state.success_count = 0;
        this.state.failure_count = 0;
      }
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const previousState = this.state.state;
    this.state.state = newState;
    this.state.state_change_timestamp = new Date().toISOString();

    this.recordEvent('state_change', `Transitioned from ${previousState} to ${newState}`, {
      previous_state: previousState,
      new_state: newState
    });

    // Reset counters on significant transitions
    if (newState === 'OPEN' || newState === 'HALF_OPEN') {
      this.state.half_open_attempts = 0;
    }
  }

  /**
   * Record an event in the audit trail
   */
  private recordEvent(type: CircuitBreakerEvent['event_type'], detail: string, extra?: Partial<CircuitBreakerEvent>): void {
    const event: CircuitBreakerEvent = {
      event_type: type,
      agent_id: this.config.agent_id,
      timestamp: new Date().toISOString(),
      detail,
      ...extra
    };
    this.events.push(event);
  }

  /**
   * Get current state snapshot
   */
  getState(): CircuitBreakerState {
    this.checkStateTransitions(); // Update state before returning
    return { ...this.state };
  }

  /**
   * Get recent events (for audit trail)
   */
  getEvents(limit: number = 100): CircuitBreakerEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Reset circuit breaker (manual intervention)
   */
  reset(): void {
    this.transitionTo('CLOSED');
    this.state.failure_count = 0;
    this.state.success_count = 0;
    this.state.extended_since = undefined;
    this.recordEvent('state_change', 'Circuit breaker manually reset');
  }
}

/**
 * Helper function to determine if request should use fallback
 */
export function shouldUseFallback(breaker: CircuitBreaker): boolean {
  const { allowed, state } = breaker.canProceed();
  return !allowed || state === 'OPEN_EXTENDED';
}

/**
 * Fallback strategies
 */
export interface FallbackResult<T = any> {
  success: boolean;
  data?: T;
  fallback_used: boolean;
  fallback_type?: string;
}

export async function executeWithFallback<T>(
  breaker: CircuitBreaker,
  primaryFn: () => Promise<T>,
  fallbackFn?: () => Promise<T> | T
): Promise<FallbackResult<T>> {
  const { allowed, state } = breaker.canProceed();

  if (!allowed && state !== 'OPEN_EXTENDED') {
    if (fallbackFn) {
      try {
        const data = await Promise.resolve(fallbackFn());
        return { success: true, data, fallback_used: true, fallback_type: 'cached_result' };
      } catch (err) {
        return { success: false, fallback_used: true, fallback_type: 'cached_result' };
      }
    }
    return { success: false, fallback_used: false };
  }

  try {
    const data = await primaryFn();
    breaker.recordSuccess();
    return { success: true, data, fallback_used: false };
  } catch (err) {
    breaker.recordFailure();

    if (fallbackFn && (state === 'OPEN_EXTENDED' || state === 'HALF_OPEN')) {
      try {
        const data = await Promise.resolve(fallbackFn());
        return { success: true, data, fallback_used: true, fallback_type: 'degraded_service' };
      } catch (fallbackErr) {
        return { success: false, fallback_used: true, fallback_type: 'degraded_service' };
      }
    }

    throw err;
  }
}
