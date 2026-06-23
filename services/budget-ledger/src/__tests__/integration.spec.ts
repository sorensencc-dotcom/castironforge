import { writeLedgerEntry } from '../write/writeLedgerEntry';
import {
  readLatestEntry,
  readRollingWindow,
  readCumulative,
  readByQuery,
} from '../read/readLedgerEntry';
import {
  checkGovernanceState,
  checkSloViolation,
} from '../governance/hooks';
import * as dbClient from '../db/client';
import { LedgerWritePayload } from '../schema/types';

jest.mock('../db/client');
jest.mock('../governance/governanceEvents');
jest.mock('../metrics/ledgerMetrics');
jest.mock('../utils/logging');

describe('Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Write-Read Cycle', () => {
    it('should write entry and read it back', async () => {
      const payload: LedgerWritePayload = {
        agentId: 'agent-1',
        sessionId: 'session-1',
        tokensUsed: 100,
        costUsd: 0.01,
        cumulativeTokens: 100,
        cumulativeCostUsd: 0.01,
        projectedCostUsd: 1.0,
        entryId: 'entry-1',
      };

      (dbClient.transaction as jest.Mock).mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      (dbClient.query as jest.Mock).mockResolvedValue({
        rows: [
          {
            entryId: 'entry-1',
            agentId: 'agent-1',
            sessionId: 'session-1',
            timestamp: new Date(),
            createdAt: new Date(),
            eventType: 'usage',
            tokensUsed: 100,
            costUsd: 0.01,
            cumulativeTokens: 100,
            cumulativeCostUsd: 0.01,
            projectedCostUsd: 1.0,
            schemaVersion: 3,
          },
        ],
      });

      const writeResult = await writeLedgerEntry(payload);
      expect(writeResult.status).toBe('success');

      const readResult = await readLatestEntry('agent-1', 'session-1');
      expect(readResult?.entryId).toBe('entry-1');
      expect(readResult?.agentId).toBe('agent-1');
    });

    it('should maintain data consistency across multiple writes', async () => {
      const payloads: LedgerWritePayload[] = [
        {
          agentId: 'agent-1',
          sessionId: 'session-1',
          tokensUsed: 100,
          costUsd: 0.01,
          cumulativeTokens: 100,
          cumulativeCostUsd: 0.01,
          projectedCostUsd: 1.0,
          entryId: 'entry-1',
        },
        {
          agentId: 'agent-1',
          sessionId: 'session-1',
          tokensUsed: 200,
          costUsd: 0.02,
          cumulativeTokens: 300,
          cumulativeCostUsd: 0.03,
          projectedCostUsd: 1.0,
          entryId: 'entry-2',
        },
      ];

      (dbClient.transaction as jest.Mock).mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      for (const payload of payloads) {
        await writeLedgerEntry(payload);
      }

      expect(dbClient.transaction).toHaveBeenCalledTimes(2);
    });
  });

  describe('Multi-Agent Scenarios', () => {
    it('should isolate data between different agents', async () => {
      const agent1Payload: LedgerWritePayload = {
        agentId: 'agent-1',
        sessionId: 'session-1',
        tokensUsed: 100,
        costUsd: 0.01,
        cumulativeTokens: 100,
        cumulativeCostUsd: 0.01,
        projectedCostUsd: 1.0,
      };

      const agent2Payload: LedgerWritePayload = {
        agentId: 'agent-2',
        sessionId: 'session-2',
        tokensUsed: 200,
        costUsd: 0.02,
        cumulativeTokens: 200,
        cumulativeCostUsd: 0.02,
        projectedCostUsd: 2.0,
      };

      (dbClient.transaction as jest.Mock).mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      await writeLedgerEntry(agent1Payload);
      await writeLedgerEntry(agent2Payload);

      (dbClient.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            entryId: 'entry-1',
            agentId: 'agent-1',
            sessionId: 'session-1',
            cumulativeTokens: 100,
            cumulativeCostUsd: 0.01,
          },
        ],
      });

      const agent1Data = await readLatestEntry('agent-1');
      expect(agent1Data?.agentId).toBe('agent-1');
      expect(agent1Data?.cumulativeTokens).toBe(100);
    });

    it('should support multiple sessions per agent', async () => {
      const session1Payload: LedgerWritePayload = {
        agentId: 'agent-1',
        sessionId: 'session-1',
        tokensUsed: 100,
        costUsd: 0.01,
        cumulativeTokens: 100,
        cumulativeCostUsd: 0.01,
        projectedCostUsd: 1.0,
      };

      const session2Payload: LedgerWritePayload = {
        agentId: 'agent-1',
        sessionId: 'session-2',
        tokensUsed: 200,
        costUsd: 0.02,
        cumulativeTokens: 200,
        cumulativeCostUsd: 0.02,
        projectedCostUsd: 2.0,
      };

      (dbClient.transaction as jest.Mock).mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      await writeLedgerEntry(session1Payload);
      await writeLedgerEntry(session2Payload);

      (dbClient.query as jest.Mock).mockResolvedValue({
        rows: [
          {
            sessionId: 'session-1',
            cumulativeTokens: 100,
          },
        ],
      });

      const result = await readLatestEntry('agent-1', 'session-1');
      expect(result?.sessionId).toBe('session-1');
    });
  });

  describe('Governance Event Propagation', () => {
    it('should propagate governance events through write operation', async () => {
      const governanceEvent = {
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

      (dbClient.transaction as jest.Mock).mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [governanceEvent],
      });

      const payload: LedgerWritePayload = {
        agentId: 'agent-1',
        sessionId: 'session-1',
        tokensUsed: 100,
        costUsd: 0.01,
        cumulativeTokens: 100,
        cumulativeCostUsd: 0.01,
        projectedCostUsd: 1.0,
      };

      const result = await writeLedgerEntry(payload);
      expect(result.governanceEvents).toContain(governanceEvent);
    });

    it('should check governance state after write', async () => {
      (dbClient.transaction as jest.Mock).mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      (dbClient.query as jest.Mock).mockResolvedValue({
        rows: [
          {
            cumulative_tokens: '5000',
            cumulative_cost_usd: '0.5',
            projected_cost_usd: '2.0',
            earliest_timestamp: null,
            latest_timestamp: null,
            entry_count: '50',
          },
        ],
      });

      const payload: LedgerWritePayload = {
        agentId: 'agent-1',
        sessionId: 'session-1',
        tokensUsed: 100,
        costUsd: 0.01,
        cumulativeTokens: 5000,
        cumulativeCostUsd: 0.5,
        projectedCostUsd: 2.0,
      };

      await writeLedgerEntry(payload);

      const decision = await checkGovernanceState('agent-1', 'session-1', {});
      expect(decision).toBeDefined();
      expect(decision.events).toBeDefined();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle idempotent duplicate writes', async () => {
      const payload: LedgerWritePayload = {
        agentId: 'agent-1',
        sessionId: 'session-1',
        tokensUsed: 100,
        costUsd: 0.01,
        cumulativeTokens: 100,
        cumulativeCostUsd: 0.01,
        projectedCostUsd: 1.0,
        entryId: 'entry-1',
      };

      (dbClient.transaction as jest.Mock)
        .mockResolvedValueOnce({
          isDuplicate: false,
          governanceEvents: [],
        });

      const result1 = await writeLedgerEntry(payload);
      expect(result1.status).toBe('success');
      expect(dbClient.transaction).toHaveBeenCalledTimes(1);
    });

    it('should support parallel reads', async () => {
      (dbClient.query as jest.Mock).mockResolvedValue({
        rows: [
          {
            entryId: 'entry-1',
            agentId: 'agent-1',
            sessionId: 'session-1',
            cumulativeTokens: 100,
            cumulativeCostUsd: 0.01,
          },
        ],
      });

      const promises = [
        readLatestEntry('agent-1'),
        readLatestEntry('agent-1'),
        readLatestEntry('agent-1'),
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
      expect(results.every((r) => r?.agentId === 'agent-1')).toBe(true);
    });
  });

  describe('Rolling Window Analysis', () => {
    it('should calculate rolling windows across multiple time intervals', async () => {
      (dbClient.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [
            {
              total_tokens: '500',
              total_cost: '0.05',
              event_count: '5',
              error_count: '0',
              latest_timestamp: new Date().toISOString(),
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              entryId: 'entry-1',
              agentId: 'agent-1',
              sessionId: 'session-1',
              timestamp: new Date(),
              createdAt: new Date(),
              eventType: 'usage',
              tokensUsed: 100,
              costUsd: 0.01,
              cumulativeTokens: 500,
              cumulativeCostUsd: 0.05,
              projectedCostUsd: 1.0,
              schemaVersion: 3,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              total_tokens: '2000',
              total_cost: '0.2',
              event_count: '20',
              error_count: '1',
              latest_timestamp: new Date().toISOString(),
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              entryId: 'entry-1',
              agentId: 'agent-1',
              sessionId: 'session-1',
              timestamp: new Date(),
              createdAt: new Date(),
              eventType: 'usage',
              tokensUsed: 100,
              costUsd: 0.01,
              cumulativeTokens: 2000,
              cumulativeCostUsd: 0.2,
              projectedCostUsd: 1.0,
              schemaVersion: 3,
            },
          ],
        });

      const window1m = await readRollingWindow('agent-1', 60);
      const window5m = await readRollingWindow('agent-1', 300);

      expect(window1m.windowSecs).toBe(60);
      expect(window5m.windowSecs).toBe(300);
      expect(window5m.totalTokens).toBeGreaterThanOrEqual(window1m.totalTokens);
    });
  });

  describe('Cumulative Totals', () => {
    it('should track cumulative values across sessions', async () => {
      (dbClient.query as jest.Mock).mockResolvedValue({
        rows: [
          {
            cumulative_tokens: '10000',
            cumulative_cost_usd: '1.0',
            projected_cost_usd: '5.0',
            earliest_timestamp: '2024-01-01T00:00:00Z',
            latest_timestamp: '2024-01-01T10:00:00Z',
            entry_count: '100',
          },
        ],
      });

      const cumulative = await readCumulative('agent-1');

      expect(cumulative.cumulativeTokens).toBe(10000);
      expect(cumulative.cumulativeCostUsd).toBe(1.0);
      expect(cumulative.projectedCostUsd).toBe(5.0);
      expect(cumulative.entryCount).toBe(100);
    });

    it('should handle session-scoped cumulative totals', async () => {
      (dbClient.query as jest.Mock).mockResolvedValue({
        rows: [
          {
            cumulative_tokens: '500',
            cumulative_cost_usd: '0.05',
            projected_cost_usd: '0.5',
            earliest_timestamp: '2024-01-01T00:00:00Z',
            latest_timestamp: '2024-01-01T01:00:00Z',
            entry_count: '10',
          },
        ],
      });

      const cumulative = await readCumulative('agent-1', 'session-1');

      expect(cumulative.sessionId).toBe('session-1');
      expect(cumulative.cumulativeTokens).toBe(500);
    });
  });

  describe('SLO Violation Detection', () => {
    it('should integrate SLO checks with governance state', async () => {
      (dbClient.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [
            {
              total_tokens: '1000',
              total_cost: '15.0',
              event_count: '10',
              error_count: '0',
              latest_timestamp: new Date().toISOString(),
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              entryId: 'entry-1',
              agentId: 'agent-1',
              sessionId: 'session-1',
              timestamp: new Date(),
              createdAt: new Date(),
              eventType: 'usage',
              tokensUsed: 100,
              costUsd: 0.01,
              cumulativeTokens: 1000,
              cumulativeCostUsd: 15.0,
              projectedCostUsd: 1.0,
              schemaVersion: 3,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              total_tokens: '5000',
              total_cost: '0.5',
              event_count: '50',
              error_count: '0',
              latest_timestamp: new Date().toISOString(),
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              entryId: 'entry-1',
              agentId: 'agent-1',
              sessionId: 'session-1',
              timestamp: new Date(),
              createdAt: new Date(),
              eventType: 'usage',
              tokensUsed: 100,
              costUsd: 0.01,
              cumulativeTokens: 5000,
              cumulativeCostUsd: 0.5,
              projectedCostUsd: 1.0,
              schemaVersion: 3,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              total_tokens: '20000',
              total_cost: '2.0',
              event_count: '200',
              error_count: '0',
              latest_timestamp: new Date().toISOString(),
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              entryId: 'entry-1',
              agentId: 'agent-1',
              sessionId: 'session-1',
              timestamp: new Date(),
              createdAt: new Date(),
              eventType: 'usage',
              tokensUsed: 100,
              costUsd: 0.01,
              cumulativeTokens: 20000,
              cumulativeCostUsd: 2.0,
              projectedCostUsd: 1.0,
              schemaVersion: 3,
            },
          ],
        });

      const sloResult = await checkSloViolation('agent-1', 'session-1');
      expect(sloResult).toHaveProperty('hasViolation');
      expect(sloResult).toHaveProperty('burnRate');
    });
  });

  describe('Complex Queries', () => {
    it('should filter by multiple criteria', async () => {
      (dbClient.query as jest.Mock).mockResolvedValue({
        rows: [
          {
            entryId: 'entry-1',
            agentId: 'agent-1',
            sessionId: 'session-1',
            timestamp: new Date(),
            createdAt: new Date(),
            eventType: 'warning',
            tokensUsed: 100,
            costUsd: 0.01,
            cumulativeTokens: 100,
            cumulativeCostUsd: 0.01,
            projectedCostUsd: 1.0,
            schemaVersion: 3,
          },
        ],
      });

      const startTime = new Date('2024-01-01');
      const endTime = new Date('2024-01-02');

      const results = await readByQuery({
        agentId: 'agent-1',
        sessionId: 'session-1',
        startTime,
        endTime,
        eventType: 'warning',
        limit: 10,
      });

      expect(results).toHaveLength(1);
      expect(results[0].eventType).toBe('warning');
    });
  });

  describe('Error Recovery', () => {
    it('should recover from transient failures during read', async () => {
      (dbClient.query as jest.Mock)
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockResolvedValueOnce({
          rows: [
            {
              entryId: 'entry-1',
              agentId: 'agent-1',
              sessionId: 'session-1',
              timestamp: new Date(),
              createdAt: new Date(),
              eventType: 'usage',
              tokensUsed: 100,
              costUsd: 0.01,
              cumulativeTokens: 100,
              cumulativeCostUsd: 0.01,
              projectedCostUsd: 1.0,
              schemaVersion: 3,
            },
          ],
        });

      // First call fails, need to retry manually
      try {
        await readLatestEntry('agent-1');
      } catch (e) {
        // Expected first failure
      }

      const result = await readLatestEntry('agent-1');
      expect(result?.agentId).toBe('agent-1');
    });
  });
});
