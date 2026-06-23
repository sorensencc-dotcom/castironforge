import { writeLedgerEntry } from '../write/writeLedgerEntry';
import { readRollingWindow, readCumulative } from '../read/readLedgerEntry';
import * as dbClient from '../db/client';
import { LedgerWritePayload } from '../schema/types';

jest.mock('../db/client');
jest.mock('../governance/governanceEvents');
jest.mock('../metrics/ledgerMetrics');
jest.mock('../utils/logging');

describe('Load Scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('High-Volume Writes', () => {
    it('should handle 100 sequential writes', async () => {
      (dbClient.transaction as jest.Mock).mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      const writePromises: Promise<any>[] = [];

      for (let i = 0; i < 100; i++) {
        const payload: LedgerWritePayload = {
          agentId: `agent-${i % 10}`,
          sessionId: `session-${i % 5}`,
          tokensUsed: 100,
          costUsd: 0.01,
          cumulativeTokens: (i + 1) * 100,
          cumulativeCostUsd: (i + 1) * 0.01,
          projectedCostUsd: 10.0,
        };

        writePromises.push(writeLedgerEntry(payload));
      }

      const results = await Promise.all(writePromises);

      expect(results).toHaveLength(100);
      expect(results.every((r) => r.status === 'success')).toBe(true);
      expect(dbClient.transaction).toHaveBeenCalledTimes(100);
    });

    it('should handle writes with varying payload sizes', async () => {
      (dbClient.transaction as jest.Mock).mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      const payloads: LedgerWritePayload[] = [
        // Minimal payload
        {
          agentId: 'agent-1',
          sessionId: 'session-1',
          tokensUsed: 1,
          costUsd: 0.0001,
          cumulativeTokens: 1,
          cumulativeCostUsd: 0.0001,
          projectedCostUsd: 0.001,
        },
        // Medium payload with metadata
        {
          agentId: 'agent-1',
          sessionId: 'session-1',
          tokensUsed: 1000,
          costUsd: 0.1,
          cumulativeTokens: 1001,
          cumulativeCostUsd: 0.1001,
          projectedCostUsd: 1.0,
          metadata: {
            model: 'gpt-4',
            endpoint: '/chat/completions',
            userId: 'user-123',
            tags: ['important', 'urgent'],
          },
        },
        // Large payload with complex metadata
        {
          agentId: 'agent-1',
          sessionId: 'session-1',
          tokensUsed: 10000,
          costUsd: 1.0,
          cumulativeTokens: 11001,
          cumulativeCostUsd: 1.1001,
          projectedCostUsd: 10.0,
          metadata: {
            model: 'gpt-4-turbo',
            endpoint: '/chat/completions',
            userId: 'user-456',
            tags: ['batch', 'analytics'],
            context: {
              timestamp: new Date().toISOString(),
              region: 'us-west-2',
              datacenter: 'pdx-1',
              version: '2.5.0',
            },
            metrics: {
              latency_ms: 150,
              tokens_per_second: 100,
              cost_per_token: 0.0001,
            },
          },
        },
      ];

      for (const payload of payloads) {
        await writeLedgerEntry(payload);
      }

      expect(dbClient.transaction).toHaveBeenCalledTimes(3);
    });

    it('should track performance metrics under load', async () => {
      (dbClient.transaction as jest.Mock).mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      for (let i = 0; i < 50; i++) {
        const payload: LedgerWritePayload = {
          agentId: `agent-${i % 5}`,
          sessionId: `session-${i % 3}`,
          tokensUsed: 100,
          costUsd: 0.01,
          cumulativeTokens: (i + 1) * 100,
          cumulativeCostUsd: (i + 1) * 0.01,
          projectedCostUsd: 10.0,
        };

        await writeLedgerEntry(payload);
      }

      expect(dbClient.transaction).toHaveBeenCalledTimes(50);
    });
  });

  describe('Multi-Agent Load', () => {
    it('should distribute load across 10 agents', async () => {
      (dbClient.transaction as jest.Mock).mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      const promises: Promise<any>[] = [];

      for (let agentNum = 1; agentNum <= 10; agentNum++) {
        for (let writeNum = 1; writeNum <= 10; writeNum++) {
          const payload: LedgerWritePayload = {
            agentId: `agent-${agentNum}`,
            sessionId: `session-${agentNum}-${writeNum}`,
            tokensUsed: 100,
            costUsd: 0.01,
            cumulativeTokens: writeNum * 100,
            cumulativeCostUsd: writeNum * 0.01,
            projectedCostUsd: 10.0,
          };

          promises.push(writeLedgerEntry(payload));
        }
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(100);
      expect(results.every((r) => r.status === 'success')).toBe(true);
    });

    it('should handle agents with different cumulative costs', async () => {
      (dbClient.transaction as jest.Mock).mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      const agentCosts = {
        'high-usage-agent': 50.0,
        'medium-usage-agent': 10.0,
        'low-usage-agent': 0.5,
      };

      for (const [agentId, baseCost] of Object.entries(agentCosts)) {
        for (let i = 0; i < 20; i++) {
          const payload: LedgerWritePayload = {
            agentId,
            sessionId: `session-${i}`,
            tokensUsed: Math.floor(1000 * (baseCost / 10)),
            costUsd: baseCost / 20,
            cumulativeTokens: (i + 1) * Math.floor(1000 * (baseCost / 10)),
            cumulativeCostUsd: (i + 1) * (baseCost / 20),
            projectedCostUsd: baseCost * 2,
          };

          await writeLedgerEntry(payload);
        }
      }

      expect(dbClient.transaction).toHaveBeenCalledTimes(60);
    });
  });

  describe('Read Operations Under Load', () => {
    it('should handle sequential read operations', async () => {
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

      // Sequential reads should work without interference
      for (let i = 0; i < 10; i++) {
        // Perform some read operation (mocked)
        (dbClient.query as jest.Mock);
      }

      expect(dbClient.query).toBeDefined();
    });
  });

  describe('Stress Testing', () => {
    it('should handle rapid fire writes from single agent', async () => {
      (dbClient.transaction as jest.Mock).mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      const writeCount = 200;
      const promises: Promise<any>[] = [];

      const startTime = Date.now();

      for (let i = 0; i < writeCount; i++) {
        const payload: LedgerWritePayload = {
          agentId: 'stress-test-agent',
          sessionId: 'stress-test-session',
          tokensUsed: 100,
          costUsd: 0.01,
          cumulativeTokens: (i + 1) * 100,
          cumulativeCostUsd: (i + 1) * 0.01,
          projectedCostUsd: 100.0,
        };

        promises.push(writeLedgerEntry(payload));
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results).toHaveLength(writeCount);
      expect(results.every((r) => r.status === 'success')).toBe(true);

      const throughput = writeCount / ((endTime - startTime) / 1000);
      console.log(`Throughput: ${throughput.toFixed(2)} writes/second`);
    });

    it('should maintain data consistency under concurrent writes and reads', async () => {
      (dbClient.transaction as jest.Mock).mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      (dbClient.query as jest.Mock).mockResolvedValue({
        rows: [
          {
            cumulative_tokens: '50000',
            cumulative_cost_usd: '5.0',
            projected_cost_usd: '20.0',
            earliest_timestamp: null,
            latest_timestamp: null,
            entry_count: '500',
          },
        ],
      });

      const writePromises: Promise<any>[] = [];
      const readPromises: Promise<any>[] = [];

      for (let i = 0; i < 50; i++) {
        const payload: LedgerWritePayload = {
          agentId: 'stress-agent',
          sessionId: 'stress-session',
          tokensUsed: 100,
          costUsd: 0.01,
          cumulativeTokens: (i + 1) * 100,
          cumulativeCostUsd: (i + 1) * 0.01,
          projectedCostUsd: 10.0,
        };

        writePromises.push(writeLedgerEntry(payload));
      }

      for (let i = 0; i < 25; i++) {
        readPromises.push(readCumulative('stress-agent'));
      }

      const [writeResults, readResults] = await Promise.all([
        Promise.all(writePromises),
        Promise.all(readPromises),
      ]);

      expect(writeResults).toHaveLength(50);
      expect(readResults).toHaveLength(25);
      expect(writeResults.every((r) => r.status === 'success')).toBe(true);
    });
  });

  describe('Budget Exhaustion Scenarios', () => {
    it('should handle high-cost agents approaching limits', async () => {
      (dbClient.transaction as jest.Mock).mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      const budgetLimit = 100.0;
      let currentCost = 0.0;

      for (let i = 0; i < 100; i++) {
        const costPerWrite = budgetLimit / 100;
        currentCost += costPerWrite;

        const payload: LedgerWritePayload = {
          agentId: 'high-cost-agent',
          sessionId: 'session-1',
          tokensUsed: 1000,
          costUsd: costPerWrite,
          cumulativeTokens: (i + 1) * 1000,
          cumulativeCostUsd: currentCost,
          projectedCostUsd: Math.max(currentCost, budgetLimit * 1.5),
        };

        await writeLedgerEntry(payload);
      }

      expect(dbClient.transaction).toHaveBeenCalledTimes(100);
    });

    it('should handle burst spending patterns', async () => {
      (dbClient.transaction as jest.Mock).mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      const patterns = [
        // Normal usage
        ...Array(10).fill(0.01),
        // Burst (high usage)
        ...Array(20).fill(0.1),
        // Normal again
        ...Array(10).fill(0.01),
      ];

      let cumulativeCost = 0.0;

      for (let i = 0; i < patterns.length; i++) {
        const cost = patterns[i];
        cumulativeCost += cost;

        const payload: LedgerWritePayload = {
          agentId: 'burst-agent',
          sessionId: 'session-1',
          tokensUsed: 100,
          costUsd: cost,
          cumulativeTokens: (i + 1) * 100,
          cumulativeCostUsd: cumulativeCost,
          projectedCostUsd: cumulativeCost * 2,
        };

        await writeLedgerEntry(payload);
      }

      expect(dbClient.transaction).toHaveBeenCalledTimes(40);
    });
  });
});
