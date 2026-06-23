import { writeLedgerEntry } from '../writeLedgerEntry';
import * as dbClient from '../../db/client';
import * as ledgerMetrics from '../../metrics/ledgerMetrics';
import * as logging from '../../utils/logging';
import {
  LedgerWritePayload,
  ValidationError,
  IdempotencyError,
  DatabaseError,
} from '../../schema/types';

jest.mock('../../db/client');
jest.mock('../../governance/governanceEvents');
jest.mock('../../metrics/ledgerMetrics');
jest.mock('../../utils/logging');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234'),
}));

describe('writeLedgerEntry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validation', () => {
    const validPayload: LedgerWritePayload = {
      agentId: 'agent-1',
      sessionId: 'session-1',
      tokensUsed: 100,
      costUsd: 0.01,
      cumulativeTokens: 100,
      cumulativeCostUsd: 0.01,
      projectedCostUsd: 1.0,
    };

    it('should throw ValidationError for missing agentId', async () => {
      const payload = { ...validPayload, agentId: '' };
      await expect(writeLedgerEntry(payload)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for missing sessionId', async () => {
      const payload = { ...validPayload, sessionId: '' };
      await expect(writeLedgerEntry(payload)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid tokensUsed (negative)', async () => {
      const payload = { ...validPayload, tokensUsed: -1 };
      await expect(writeLedgerEntry(payload)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid costUsd (negative)', async () => {
      const payload = { ...validPayload, costUsd: -0.01 };
      await expect(writeLedgerEntry(payload)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid cumulativeTokens', async () => {
      const payload = { ...validPayload, cumulativeTokens: -1 };
      await expect(writeLedgerEntry(payload)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid cumulativeCostUsd', async () => {
      const payload = { ...validPayload, cumulativeCostUsd: -1 };
      await expect(writeLedgerEntry(payload)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when projectedCostUsd < cumulativeCostUsd', async () => {
      const payload = {
        ...validPayload,
        cumulativeCostUsd: 2.0,
        projectedCostUsd: 1.0,
      };
      await expect(writeLedgerEntry(payload)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid eventType', async () => {
      const payload = { ...validPayload, eventType: 'invalid' as any };
      await expect(writeLedgerEntry(payload)).rejects.toThrow(ValidationError);
    });

    it('should accept valid eventType values', async () => {
      const mockTransaction = jest.fn().mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });
      (dbClient.transaction as jest.Mock).mockImplementation(mockTransaction);

      for (const eventType of ['usage', 'warning', 'abort']) {
        const payload = { ...validPayload, eventType: eventType as any };
        jest.clearAllMocks();
        (dbClient.transaction as jest.Mock).mockImplementation(mockTransaction);

        await writeLedgerEntry(payload);
        expect(mockTransaction).toHaveBeenCalled();
      }
    });
  });

  describe('successful writes', () => {
    const validPayload: LedgerWritePayload = {
      agentId: 'agent-1',
      sessionId: 'session-1',
      tokensUsed: 100,
      costUsd: 0.01,
      cumulativeTokens: 100,
      cumulativeCostUsd: 0.01,
      projectedCostUsd: 1.0,
    };

    it('should write a valid entry successfully', async () => {
      (dbClient.transaction as jest.Mock).mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      const result = await writeLedgerEntry(validPayload);

      expect(result.status).toBe('success');
      expect(result.agentId).toBe('agent-1');
      expect(result.sessionId).toBe('session-1');
      expect(result.entryId).toBe('test-uuid-1234');
    });

    it('should generate entryId if not provided', async () => {
      (dbClient.transaction as jest.Mock).mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      const result = await writeLedgerEntry(validPayload);
      expect(result.entryId).toBe('test-uuid-1234');
    });

    it('should use provided entryId', async () => {
      (dbClient.transaction as jest.Mock).mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      const payloadWithId = { ...validPayload, entryId: 'custom-id' };
      const result = await writeLedgerEntry(payloadWithId);
      expect(result.entryId).toBe('custom-id');
    });

    it('should record write metrics on success', async () => {
      (dbClient.transaction as jest.Mock).mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      await writeLedgerEntry(validPayload);

      expect(ledgerMetrics.recordWriteMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          latencyMs: expect.any(Number),
        })
      );
    });

    it('should log structured logs on success', async () => {
      (dbClient.transaction as jest.Mock).mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      await writeLedgerEntry(validPayload);

      expect(logging.createStructuredLog).toHaveBeenCalledWith(
        expect.objectContaining({
          op: 'ledger_write',
          status: 'success',
        })
      );
    });

    it('should include governance events in result', async () => {
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

      const result = await writeLedgerEntry(validPayload);
      expect(result.governanceEvents).toContain(governanceEvent);
    });
  });

  describe('idempotency', () => {
    const validPayload: LedgerWritePayload = {
      agentId: 'agent-1',
      sessionId: 'session-1',
      tokensUsed: 100,
      costUsd: 0.01,
      cumulativeTokens: 100,
      cumulativeCostUsd: 0.01,
      projectedCostUsd: 1.0,
      entryId: 'duplicate-id',
    };

    it('should return duplicate status on IdempotencyError', async () => {
      (dbClient.transaction as jest.Mock).mockRejectedValue(
        new IdempotencyError('Entry already exists', { entryId: 'duplicate-id' })
      );

      const result = await writeLedgerEntry(validPayload);

      expect(result.status).toBe('duplicate');
      expect(result.entryId).toBe('duplicate-id');
    });

    it('should record duplicate metric on idempotency error', async () => {
      (dbClient.transaction as jest.Mock).mockRejectedValue(
        new IdempotencyError('Entry already exists', { entryId: 'duplicate-id' })
      );

      await writeLedgerEntry(validPayload);

      expect(ledgerMetrics.recordWriteMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'duplicate',
        })
      );
    });
  });

  describe('retry logic', () => {
    const validPayload: LedgerWritePayload = {
      agentId: 'agent-1',
      sessionId: 'session-1',
      tokensUsed: 100,
      costUsd: 0.01,
      cumulativeTokens: 100,
      cumulativeCostUsd: 0.01,
      projectedCostUsd: 1.0,
    };

    it('should retry on transient database error', async () => {
      (dbClient.transaction as jest.Mock)
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockResolvedValueOnce({
          isDuplicate: false,
          governanceEvents: [],
        });

      const result = await writeLedgerEntry(validPayload);
      expect(result.status).toBe('success');
      expect(dbClient.transaction).toHaveBeenCalledTimes(2);
    });

    it('should respect custom retry delays', async () => {
      (dbClient.transaction as jest.Mock)
        .mockRejectedValueOnce(new Error('Timeout 1'))
        .mockRejectedValueOnce(new Error('Timeout 2'))
        .mockResolvedValueOnce({
          isDuplicate: false,
          governanceEvents: [],
        });

      const customDelays = [50, 100];
      const startTime = Date.now();
      await writeLedgerEntry(validPayload, { retryDelays: customDelays });
      const elapsed = Date.now() - startTime;

      // Should have accumulated at least the sum of delays
      expect(elapsed).toBeGreaterThanOrEqual(150);
    });

    it('should fail after max retries exhausted', async () => {
      (dbClient.transaction as jest.Mock).mockRejectedValue(
        new Error('Database connection lost')
      );

      await expect(writeLedgerEntry(validPayload, { maxRetries: 1 })).rejects.toThrow(
        DatabaseError
      );
    });

    it('should throw ValidationError immediately without retries', async () => {
      const payload = { ...validPayload, agentId: '' };

      await expect(writeLedgerEntry(payload)).rejects.toThrow(ValidationError);
      expect(dbClient.transaction).not.toHaveBeenCalled();
    });

    it('should log failure after retries exhausted', async () => {
      (dbClient.transaction as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(writeLedgerEntry(validPayload, { maxRetries: 1 })).rejects.toThrow();

      expect(logging.createStructuredLog).toHaveBeenCalledWith(
        expect.objectContaining({
          op: 'ledger_write',
          status: 'failure',
          error: expect.any(String),
        })
      );
    });
  });

  describe('governance configuration', () => {
    const validPayload: LedgerWritePayload = {
      agentId: 'agent-1',
      sessionId: 'session-1',
      tokensUsed: 100,
      costUsd: 0.01,
      cumulativeTokens: 100,
      cumulativeCostUsd: 0.01,
      projectedCostUsd: 1.0,
    };

    it('should pass governance config to performWrite', async () => {
      (dbClient.transaction as jest.Mock).mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      const governanceConfig = {
        maxTokens: 10000,
        maxCostUsd: 100,
        warningThresholdPercent: 0.8,
      };

      await writeLedgerEntry(validPayload, { governanceConfig });

      expect(dbClient.transaction).toHaveBeenCalled();
    });
  });

  describe('latency measurement', () => {
    const validPayload: LedgerWritePayload = {
      agentId: 'agent-1',
      sessionId: 'session-1',
      tokensUsed: 100,
      costUsd: 0.01,
      cumulativeTokens: 100,
      cumulativeCostUsd: 0.01,
      projectedCostUsd: 1.0,
    };

    it('should measure latency for successful write', async () => {
      (dbClient.transaction as jest.Mock).mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      const result = await writeLedgerEntry(validPayload);

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.latencyMs).toBe('number');
    });

    it('should measure latency even on failure', async () => {
      (dbClient.transaction as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      try {
        await writeLedgerEntry(validPayload, { maxRetries: 0 });
      } catch (err) {
        // Expected
      }

      expect(ledgerMetrics.recordWriteMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          latencyMs: expect.any(Number),
        })
      );
    });
  });

  describe('metadata handling', () => {
    const validPayload: LedgerWritePayload = {
      agentId: 'agent-1',
      sessionId: 'session-1',
      tokensUsed: 100,
      costUsd: 0.01,
      cumulativeTokens: 100,
      cumulativeCostUsd: 0.01,
      projectedCostUsd: 1.0,
      metadata: {
        model: 'gpt-4',
        endpoint: '/chat',
        userId: 'user-123',
      },
    };

    it('should preserve custom metadata', async () => {
      (dbClient.transaction as jest.Mock).mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      await writeLedgerEntry(validPayload);

      expect(dbClient.transaction).toHaveBeenCalled();
    });

    it('should handle metadata as optional', async () => {
      (dbClient.transaction as jest.Mock).mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      const { metadata, ...payloadWithoutMetadata } = validPayload;
      await writeLedgerEntry(payloadWithoutMetadata);

      expect(dbClient.transaction).toHaveBeenCalled();
    });
  });
});
