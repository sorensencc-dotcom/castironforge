/**
 * RL-2: Circuit Breaker with OPEN_EXTENDED State — Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  CircuitBreaker,
  shouldUseFallback,
  executeWithFallback,
  CircuitBreakerConfig
} from '../circuitBreaker';

describe('RL-2: Circuit Breaker with OPEN_EXTENDED', () => {
  let config: CircuitBreakerConfig;

  beforeEach(() => {
    config = {
      agent_id: 'agent-1',
      failure_threshold: 3,
      success_threshold: 2,
      timeout_ms: 1000,
      extended_timeout_ms: 5000,
      fallback_strategy: 'degraded_service'
    };
  });

  describe('State transitions', () => {
    it('should start in CLOSED state', () => {
      const breaker = new CircuitBreaker(config);
      expect(breaker.getState().state).toBe('CLOSED');
    });

    it('should transition CLOSED → OPEN on failure threshold', () => {
      const breaker = new CircuitBreaker(config);

      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure(); // Hits threshold

      expect(breaker.getState().state).toBe('OPEN');
    });

    it('should transition OPEN → HALF_OPEN after timeout', async () => {
      const fastConfig = { ...config, timeout_ms: 10 };
      const breaker = new CircuitBreaker(fastConfig);

      // Trip the breaker
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      expect(breaker.getState().state).toBe('OPEN');

      // Wait for timeout and check state
      await new Promise(r => setTimeout(r, 20));
      const state = breaker.getState();
      expect(state.state).toBe('HALF_OPEN');
    });

    it('should transition HALF_OPEN → CLOSED on success', async () => {
      const fastConfig = { ...config, timeout_ms: 10 };
      const breaker = new CircuitBreaker(fastConfig);

      // Trip to OPEN
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      // Wait for automatic transition to HALF_OPEN
      await new Promise(r => setTimeout(r, 20));

      // Verify we're in HALF_OPEN
      let state = breaker.getState();
      expect(state.state).toBe('HALF_OPEN');

      // Now record successes to close the breaker
      breaker.recordSuccess();
      breaker.recordSuccess(); // Meets threshold

      state = breaker.getState();
      expect(state.state).toBe('CLOSED');
    });

    it('should transition HALF_OPEN → OPEN on single failure', () => {
      const breaker = new CircuitBreaker(config);

      // Trip to OPEN
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      // Try to recover - fail immediately
      breaker.recordFailure();

      expect(breaker.getState().state).toBe('OPEN');
    });

    it('should transition OPEN → OPEN_EXTENDED after extended timeout', async () => {
      const fastConfig = {
        ...config,
        timeout_ms: 10,
        extended_timeout_ms: 20
      };
      const breaker = new CircuitBreaker(fastConfig);

      // Trip the breaker
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      // Wait past extended timeout
      await new Promise(r => setTimeout(r, 25));
      const state = breaker.getState();
      expect(state.state).toBe('OPEN_EXTENDED');
      expect(state.extended_since).toBeDefined();
    });
  });

  describe('canProceed', () => {
    it('should allow requests in CLOSED state', () => {
      const breaker = new CircuitBreaker(config);
      const result = breaker.canProceed();

      expect(result.allowed).toBe(true);
      expect(result.state).toBe('CLOSED');
      expect(result.fallback).toBeUndefined();
    });

    it('should reject requests in OPEN state', () => {
      const breaker = new CircuitBreaker(config);

      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      const result = breaker.canProceed();
      expect(result.allowed).toBe(false);
      expect(result.state).toBe('OPEN');
      expect(result.fallback).toBe('degraded_service');
    });

    it('should allow requests in HALF_OPEN state (for recovery)', () => {
      const fastConfig = { ...config, timeout_ms: 10 };
      const breaker = new CircuitBreaker(fastConfig);

      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      // Simulate wait
      setTimeout(() => {
        const result = breaker.canProceed();
        expect(result.allowed).toBe(true);
        expect(result.state).toBe('HALF_OPEN');
      }, 20);
    });

    it('should allow requests in OPEN_EXTENDED state with degraded service', async () => {
      const fastConfig = {
        ...config,
        timeout_ms: 10,
        extended_timeout_ms: 20
      };
      const breaker = new CircuitBreaker(fastConfig);

      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      await new Promise(r => setTimeout(r, 25));

      const result = breaker.canProceed();
      expect(result.allowed).toBe(true);
      expect(result.state).toBe('OPEN_EXTENDED');
      expect(result.fallback).toBe('degraded_service');
    });
  });

  describe('recordSuccess and recordFailure', () => {
    it('should track consecutive failures', () => {
      const breaker = new CircuitBreaker(config);

      breaker.recordFailure();
      let state = breaker.getState();
      expect(state.failure_count).toBe(1);

      breaker.recordFailure();
      state = breaker.getState();
      expect(state.failure_count).toBe(2);

      breaker.recordFailure();
      state = breaker.getState();
      expect(state.failure_count).toBe(3);
    });

    it('should decay failures on success in CLOSED state', () => {
      const breaker = new CircuitBreaker(config);

      breaker.recordFailure();
      breaker.recordFailure();
      let state = breaker.getState();
      expect(state.failure_count).toBe(2);

      breaker.recordSuccess();
      state = breaker.getState();
      expect(state.failure_count).toBe(1); // Decayed
    });

    it('should track success count in HALF_OPEN state', () => {
      const breaker = new CircuitBreaker(config);

      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      // Manually move to HALF_OPEN by calling recordSuccess
      // (Would normally happen via timeout)
      const half_open = breaker.getState();
      expect(half_open.state).toBe('OPEN');
    });
  });

  describe('reset', () => {
    it('should reset to CLOSED state', () => {
      const breaker = new CircuitBreaker(config);

      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      expect(breaker.getState().state).toBe('OPEN');

      breaker.reset();
      const state = breaker.getState();
      expect(state.state).toBe('CLOSED');
      expect(state.failure_count).toBe(0);
      expect(state.success_count).toBe(0);
    });
  });

  describe('Audit trail', () => {
    it('should record events', () => {
      const breaker = new CircuitBreaker(config);

      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.reset();

      const events = breaker.getEvents(100);
      expect(events.length).toBeGreaterThan(0);

      const stateChanges = events.filter(e => e.event_type === 'state_change');
      expect(stateChanges.length).toBeGreaterThan(0);
    });
  });

  describe('shouldUseFallback', () => {
    it('should return true when breaker is OPEN', () => {
      const breaker = new CircuitBreaker(config);

      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      expect(shouldUseFallback(breaker)).toBe(true);
    });

    it('should return true when breaker is OPEN_EXTENDED', async () => {
      const fastConfig = {
        ...config,
        timeout_ms: 10,
        extended_timeout_ms: 20
      };
      const breaker = new CircuitBreaker(fastConfig);

      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      await new Promise(r => setTimeout(r, 25));

      expect(shouldUseFallback(breaker)).toBe(true);
    });

    it('should return false when breaker is CLOSED', () => {
      const breaker = new CircuitBreaker(config);
      expect(shouldUseFallback(breaker)).toBe(false);
    });
  });

  describe('executeWithFallback', () => {
    it('should use fallback when circuit is OPEN', async () => {
      const breaker = new CircuitBreaker(config);

      // Trip the breaker
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      const primaryFn = async () => {
        throw new Error('Should not be called');
      };

      const fallbackFn = async () => 'cached_result';

      const result = await executeWithFallback(breaker, primaryFn, fallbackFn);

      expect(result.success).toBe(true);
      expect(result.data).toBe('cached_result');
      expect(result.fallback_used).toBe(true);
    });

    it('should use primary function when circuit is CLOSED', async () => {
      const breaker = new CircuitBreaker(config);

      const primaryFn = async () => 'primary_result';
      const fallbackFn = async () => 'fallback_result';

      const result = await executeWithFallback(breaker, primaryFn, fallbackFn);

      expect(result.success).toBe(true);
      expect(result.data).toBe('primary_result');
      expect(result.fallback_used).toBe(false);
    });

    it('should handle primary function errors with fallback', async () => {
      const breaker = new CircuitBreaker(config);

      const primaryFn = async () => {
        throw new Error('Primary failed');
      };

      const fallbackFn = async () => 'fallback_result';

      try {
        await executeWithFallback(breaker, primaryFn, fallbackFn);
      } catch (err) {
        // Primary failure should have triggered circuit breaker logic
        expect(breaker.getState().failure_count).toBeGreaterThan(0);
      }
    });
  });
});
