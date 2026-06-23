import {
  registerGovernanceHook,
  onSloControllerEvent,
  onCanaryGateEvent,
  checkGovernanceState,
  checkBudgetExhaustion,
  checkThresholdWarnings,
  checkSloViolation,
} from '../hooks';
import * as readLedger from '../../read/readLedgerEntry';
import * as logging from '../../utils/logging';
import { GovernanceConfig, GovernanceDecision } from '../hooks';

jest.mock('../../read/readLedgerEntry');
jest.mock('../../utils/logging');

describe('Governance Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerGovernanceHook', () => {
    it('should register a governance hook', () => {
      const mockHook = jest.fn().mockResolvedValue({
        shouldAbort: false,
        events: [],
      });

      expect(() => {
        registerGovernanceHook('test_hook', mockHook);
      }).not.toThrow();
    });

    it('should log hook registration', () => {
      const mockHook = jest.fn().mockResolvedValue({
        shouldAbort: false,
        events: [],
      });

      registerGovernanceHook('test_hook', mockHook);

      expect(logging.createStructuredLog).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'governance_hook_registered',
          hook_name: 'test_hook',
        })
      );
    });
  });

  describe('event callbacks', () => {
    it('should register SLO controller callback', () => {
      const callback = jest.fn();
      expect(() => {
        onSloControllerEvent(callback);
      }).not.toThrow();
    });

    it('should register canary gate callback', () => {
      const callback = jest.fn();
      expect(() => {
        onCanaryGateEvent(callback);
      }).not.toThrow();
    });
  });

  describe('checkGovernanceState', () => {
    it('should call all registered hooks', async () => {
      const mockHook1 = jest.fn().mockResolvedValue({
        shouldAbort: false,
        events: [],
      });
      const mockHook2 = jest.fn().mockResolvedValue({
        shouldAbort: false,
        events: [],
      });

      registerGovernanceHook('hook1', mockHook1);
      registerGovernanceHook('hook2', mockHook2);

      const config: GovernanceConfig = {};
      await checkGovernanceState('agent-1', 'session-1', config);

      expect(mockHook1).toHaveBeenCalledWith('agent-1', 'session-1', config);
      expect(mockHook2).toHaveBeenCalledWith('agent-1', 'session-1', config);
    });

    it('should return abort decision from hooks', async () => {
      const mockHook = jest.fn().mockResolvedValue({
        shouldAbort: true,
        reason: 'Budget exhausted',
        events: [],
      });

      registerGovernanceHook('abort_hook', mockHook);

      const result: GovernanceDecision = await checkGovernanceState(
        'agent-1',
        'session-1',
        {}
      );

      expect(result.shouldAbort).toBe(true);
      expect(result.reason).toBe('Budget exhausted');
    });

    it('should aggregate events from multiple hooks', async () => {
      const event1 = {
        eventId: 'event-1',
        eventType: 'governance_warning' as const,
        reason: 'cost_threshold_exceeded' as const,
        agentId: 'agent-1',
        sessionId: 'session-1',
        ledgerEntryId: 'entry-1',
        cumulativeTokens: 100,
        cumulativeCostUsd: 0.5,
        projectedCostUsd: 1.0,
        timestamp: new Date(),
        latencyMs: 10,
      };

      const mockHook = jest.fn().mockResolvedValue({
        shouldAbort: false,
        events: [event1],
      });

      registerGovernanceHook('event_hook', mockHook);

      const result = await checkGovernanceState('agent-1', 'session-1', {});

      expect(result.events).toContain(event1);
    });

    it('should handle hook errors gracefully', async () => {
      const mockHook = jest.fn().mockRejectedValue(new Error('Hook failed'));

      registerGovernanceHook('failing_hook', mockHook);

      const result = await checkGovernanceState('agent-1', 'session-1', {});

      expect(result).toBeDefined();
      expect(logging.logError).toHaveBeenCalled();
    });
  });

  describe('checkBudgetExhaustion', () => {
    it('should detect token budget exhaustion', async () => {
      (readLedger.readCumulative as jest.Mock).mockResolvedValue({
        agentId: 'agent-1',
        sessionId: 'session-1',
        cumulativeTokens: 11000,
        cumulativeCostUsd: 1.0,
        projectedCostUsd: 2.0,
        entryCount: 10,
      });

      const config: GovernanceConfig = { maxTokens: 10000 };
      const result = await checkBudgetExhaustion('agent-1', 'session-1', config);

      expect(result.shouldAbort).toBe(true);
      expect(result.reason).toContain('Token budget');
    });

    it('should detect cost budget exhaustion', async () => {
      (readLedger.readCumulative as jest.Mock).mockResolvedValue({
        agentId: 'agent-1',
        sessionId: 'session-1',
        cumulativeTokens: 1000,
        cumulativeCostUsd: 50.0,
        projectedCostUsd: 101.0, // This triggers the projected cost check first
        entryCount: 10,
      });

      const config: GovernanceConfig = { maxCostUsd: 100 };
      const result = await checkBudgetExhaustion('agent-1', 'session-1', config);

      expect(result.shouldAbort).toBe(true);
      expect(result.reason).toMatch(/budget|cost/i);
    });

    it('should detect projected cost exhaustion', async () => {
      (readLedger.readCumulative as jest.Mock).mockResolvedValue({
        agentId: 'agent-1',
        sessionId: 'session-1',
        cumulativeTokens: 1000,
        cumulativeCostUsd: 50.0,
        projectedCostUsd: 101.0,
        entryCount: 10,
      });

      const config: GovernanceConfig = { maxCostUsd: 100 };
      const result = await checkBudgetExhaustion('agent-1', 'session-1', config);

      expect(result.shouldAbort).toBe(true);
      expect(result.reason).toContain('Projected cost');
    });

    it('should not abort when under budget', async () => {
      (readLedger.readCumulative as jest.Mock).mockResolvedValue({
        agentId: 'agent-1',
        sessionId: 'session-1',
        cumulativeTokens: 5000,
        cumulativeCostUsd: 50.0,
        projectedCostUsd: 80.0,
        entryCount: 10,
      });

      const config: GovernanceConfig = {
        maxTokens: 10000,
        maxCostUsd: 100,
      };
      const result = await checkBudgetExhaustion('agent-1', 'session-1', config);

      expect(result.shouldAbort).toBe(false);
    });

    it('should log budget exhaustion events', async () => {
      (readLedger.readCumulative as jest.Mock).mockResolvedValue({
        agentId: 'agent-1',
        sessionId: 'session-1',
        cumulativeTokens: 11000,
        cumulativeCostUsd: 1.0,
        projectedCostUsd: 2.0,
        entryCount: 10,
      });

      const config: GovernanceConfig = { maxTokens: 10000 };
      await checkBudgetExhaustion('agent-1', 'session-1', config);

      expect(logging.createStructuredLog).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'budget_exhaustion',
        })
      );
    });

    it('should handle read errors', async () => {
      (readLedger.readCumulative as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const config: GovernanceConfig = { maxTokens: 10000 };

      await expect(
        checkBudgetExhaustion('agent-1', 'session-1', config)
      ).rejects.toThrow();
    });
  });

  describe('checkThresholdWarnings', () => {
    it('should warn when projected cost exceeds 80% threshold', async () => {
      (readLedger.readCumulative as jest.Mock).mockResolvedValue({
        agentId: 'agent-1',
        sessionId: 'session-1',
        cumulativeTokens: 1000,
        cumulativeCostUsd: 70.0,
        projectedCostUsd: 85.0,
        entryCount: 10,
      });

      const config: GovernanceConfig = {
        maxCostUsd: 100,
        warningThresholdPercent: 0.8,
      };
      await checkThresholdWarnings('agent-1', 'session-1', config);

      expect(logging.createStructuredLog).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'threshold_warning',
          type: 'projected_cost',
        })
      );
    });

    it('should warn when cumulative cost exceeds 70% threshold', async () => {
      (readLedger.readCumulative as jest.Mock).mockResolvedValue({
        agentId: 'agent-1',
        sessionId: 'session-1',
        cumulativeTokens: 1000,
        cumulativeCostUsd: 75.0,
        projectedCostUsd: 80.0,
        entryCount: 10,
      });

      const config: GovernanceConfig = {
        maxCostUsd: 100,
        cautionThresholdPercent: 0.7,
      };
      await checkThresholdWarnings('agent-1', 'session-1', config);

      expect(logging.createStructuredLog).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'threshold_warning',
          type: 'cumulative_cost',
        })
      );
    });

    it('should check burst limit for tokens in 1m window', async () => {
      (readLedger.readCumulative as jest.Mock).mockResolvedValue({
        agentId: 'agent-1',
        sessionId: 'session-1',
        cumulativeTokens: 1000,
        cumulativeCostUsd: 10.0,
        projectedCostUsd: 20.0,
        entryCount: 10,
      });

      (readLedger.readRollingWindow as jest.Mock).mockResolvedValue({
        windowSecs: 60,
        startTime: new Date(),
        endTime: new Date(),
        totalTokens: 5001,
        totalCost: 0.5,
        eventCount: 5,
        errorCount: 0,
      });

      const config: GovernanceConfig = { burstLimitTokensPer1m: 5000 };
      await checkThresholdWarnings('agent-1', 'session-1', config);

      expect(logging.createStructuredLog).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'threshold_warning',
          type: 'burst_limit',
        })
      );
    });

    it('should handle read errors gracefully', async () => {
      (readLedger.readCumulative as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const config: GovernanceConfig = { maxCostUsd: 100 };

      const result = await checkThresholdWarnings('agent-1', 'session-1', config);

      expect(Array.isArray(result)).toBe(true);
      expect(logging.logError).toHaveBeenCalled();
    });
  });

  describe('checkSloViolation', () => {
    it('should detect 1m burn rate violation', async () => {
      (readLedger.readRollingWindow as jest.Mock)
        .mockResolvedValueOnce({
          windowSecs: 60,
          startTime: new Date(),
          endTime: new Date(),
          totalTokens: 1000,
          totalCost: 15.0, // > 14× baseline of $0.01/sec
          eventCount: 10,
          errorCount: 0,
        })
        .mockResolvedValueOnce({
          windowSecs: 300,
          startTime: new Date(),
          endTime: new Date(),
          totalTokens: 5000,
          totalCost: 0.5,
          eventCount: 50,
          errorCount: 0,
        })
        .mockResolvedValueOnce({
          windowSecs: 1800,
          startTime: new Date(),
          endTime: new Date(),
          totalTokens: 20000,
          totalCost: 2.0,
          eventCount: 200,
          errorCount: 0,
        });

      const result = await checkSloViolation('agent-1', 'session-1');

      expect(result.hasViolation).toBe(true);
      expect(result.burnRate).toBeGreaterThan(14);
    });

    it('should detect 5m burn rate violation', async () => {
      (readLedger.readRollingWindow as jest.Mock)
        .mockResolvedValueOnce({
          windowSecs: 60,
          startTime: new Date(),
          endTime: new Date(),
          totalTokens: 500,
          totalCost: 0.5,
          eventCount: 5,
          errorCount: 0,
        })
        .mockResolvedValueOnce({
          windowSecs: 300,
          startTime: new Date(),
          endTime: new Date(),
          totalTokens: 5000,
          totalCost: 19.0, // > 6× baseline of $0.01/sec over 300s
          eventCount: 50,
          errorCount: 0,
        })
        .mockResolvedValueOnce({
          windowSecs: 1800,
          startTime: new Date(),
          endTime: new Date(),
          totalTokens: 20000,
          totalCost: 2.0,
          eventCount: 200,
          errorCount: 0,
        });

      const result = await checkSloViolation('agent-1', 'session-1');

      expect(result.hasViolation).toBe(true);
    });

    it('should detect 30m burn rate violation', async () => {
      (readLedger.readRollingWindow as jest.Mock)
        .mockResolvedValueOnce({
          windowSecs: 60,
          startTime: new Date(),
          endTime: new Date(),
          totalTokens: 500,
          totalCost: 0.5,
          eventCount: 5,
          errorCount: 0,
        })
        .mockResolvedValueOnce({
          windowSecs: 300,
          startTime: new Date(),
          endTime: new Date(),
          totalTokens: 5000,
          totalCost: 0.5,
          eventCount: 50,
          errorCount: 0,
        })
        .mockResolvedValueOnce({
          windowSecs: 1800,
          startTime: new Date(),
          endTime: new Date(),
          totalTokens: 20000,
          totalCost: 55.0, // > 3× baseline of $0.01/sec over 1800s
          eventCount: 200,
          errorCount: 0,
        });

      const result = await checkSloViolation('agent-1', 'session-1');

      expect(result.hasViolation).toBe(true);
    });

    it('should not detect violation when within limits', async () => {
      (readLedger.readRollingWindow as jest.Mock)
        .mockResolvedValueOnce({
          windowSecs: 60,
          startTime: new Date(),
          endTime: new Date(),
          totalTokens: 500,
          totalCost: 0.5,
          eventCount: 5,
          errorCount: 0,
        })
        .mockResolvedValueOnce({
          windowSecs: 300,
          startTime: new Date(),
          endTime: new Date(),
          totalTokens: 5000,
          totalCost: 1.5,
          eventCount: 50,
          errorCount: 0,
        })
        .mockResolvedValueOnce({
          windowSecs: 1800,
          startTime: new Date(),
          endTime: new Date(),
          totalTokens: 20000,
          totalCost: 5.0,
          eventCount: 200,
          errorCount: 0,
        });

      const result = await checkSloViolation('agent-1', 'session-1');

      expect(result.hasViolation).toBe(false);
    });

    it('should log SLO violations', async () => {
      (readLedger.readRollingWindow as jest.Mock)
        .mockResolvedValueOnce({
          windowSecs: 60,
          startTime: new Date(),
          endTime: new Date(),
          totalTokens: 1000,
          totalCost: 15.0,
          eventCount: 10,
          errorCount: 0,
        })
        .mockResolvedValueOnce({
          windowSecs: 300,
          startTime: new Date(),
          endTime: new Date(),
          totalTokens: 5000,
          totalCost: 0.5,
          eventCount: 50,
          errorCount: 0,
        })
        .mockResolvedValueOnce({
          windowSecs: 1800,
          startTime: new Date(),
          endTime: new Date(),
          totalTokens: 20000,
          totalCost: 2.0,
          eventCount: 200,
          errorCount: 0,
        });

      await checkSloViolation('agent-1', 'session-1');

      expect(logging.createStructuredLog).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'slo_violation',
        })
      );
    });

    it('should handle read errors gracefully', async () => {
      (readLedger.readRollingWindow as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const result = await checkSloViolation('agent-1', 'session-1');

      expect(result.hasViolation).toBe(false);
      expect(result.burnRate).toBe(0);
      expect(logging.logError).toHaveBeenCalled();
    });
  });
});
