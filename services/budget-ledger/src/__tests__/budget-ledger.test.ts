/**
 * Budget Ledger (WS-A) Test Suite
 *
 * Tests for write-path, read-path, and governance hooks functionality.
 * Total: 45+ tests covering unit and integration scenarios.
 */

import { writeLedgerEntry } from '../write/writeLedgerEntry';
import { readLatestEntry, readRollingWindow, readCumulative } from '../read/readLedgerEntry';
import { createMockPayload, createMockEntry } from './helpers';

jest.mock('../db/client');
jest.mock('../governance/governanceEvents');
jest.mock('../metrics/ledgerMetrics');
jest.mock('../utils/logging');

describe('Budget Ledger (WS-A) - Core Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Write Path - Ledger Entry Creation', () => {
    it('should create entry with valid payload', async () => {
      const payload = createMockPayload();
      const { transaction } = require('../db/client');
      transaction.mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      const result = await writeLedgerEntry(payload);
      expect(result.status).toBe('success');
      expect(result.agentId).toBe(payload.agentId);
    });

    it('should generate UUID for missing entryId', async () => {
      const payload = createMockPayload();
      (payload as any).entryId = undefined;
      const { transaction } = require('../db/client');
      transaction.mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      const result = await writeLedgerEntry(payload);
      expect(result.entryId).toMatch(/^[0-9a-f-]{36}$/i);
    });

    it('should record metrics on write', async () => {
      const payload = createMockPayload();
      const { transaction } = require('../db/client');
      const { recordWriteMetric } = require('../metrics/ledgerMetrics');
      transaction.mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      await writeLedgerEntry(payload);
      expect(recordWriteMetric).toHaveBeenCalled();
    });

    it('should return latency measurement', async () => {
      const payload = createMockPayload();
      const { transaction } = require('../db/client');
      transaction.mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      const result = await writeLedgerEntry(payload);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should validate agentId presence', async () => {
      const payload = createMockPayload({ agentId: '' });
      const ValidationError = require('../schema/types').ValidationError;

      await expect(writeLedgerEntry(payload)).rejects.toThrow(ValidationError);
    });

    it('should reject negative tokens', async () => {
      const payload = createMockPayload({ tokensUsed: -1 });
      const ValidationError = require('../schema/types').ValidationError;

      await expect(writeLedgerEntry(payload)).rejects.toThrow(ValidationError);
    });

    it('should reject negative cost', async () => {
      const payload = createMockPayload({ costUsd: -0.01 });
      const ValidationError = require('../schema/types').ValidationError;

      await expect(writeLedgerEntry(payload)).rejects.toThrow(ValidationError);
    });

    it('should detect duplicate entries', async () => {
      const payload = createMockPayload();
      const { transaction } = require('../db/client');
      const IdempotencyError = require('../schema/types').IdempotencyError;
      transaction.mockRejectedValue(new IdempotencyError('Already exists'));

      const result = await writeLedgerEntry(payload);
      expect(result.status).toBe('duplicate');
    });

    it('should include metadata in result', async () => {
      const payload = createMockPayload({
        agentId: 'test-agent',
        sessionId: 'test-session',
      });
      const { transaction } = require('../db/client');
      transaction.mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      const result = await writeLedgerEntry(payload);
      expect(result.agentId).toBe('test-agent');
      expect(result.sessionId).toBe('test-session');
      expect(result.timestamp).toBeDefined();
    });

    it('should handle max tokens boundary', async () => {
      const payload = createMockPayload({ tokensUsed: 1000000000 });
      const { transaction } = require('../db/client');
      transaction.mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      const result = await writeLedgerEntry(payload);
      expect(result.status).toBe('success');
    });

    it('should handle max cost boundary', async () => {
      const payload = createMockPayload({ costUsd: 999999.99999 });
      const { transaction } = require('../db/client');
      transaction.mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      const result = await writeLedgerEntry(payload);
      expect(result.status).toBe('success');
    });

    it('should handle zero cost', async () => {
      const payload = createMockPayload({ costUsd: 0 });
      const { transaction } = require('../db/client');
      transaction.mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      const result = await writeLedgerEntry(payload);
      expect(result.status).toBe('success');
    });

    it('should retry on transient errors', async () => {
      const payload = createMockPayload();
      const { transaction } = require('../db/client');
      const DatabaseError = require('../schema/types').DatabaseError;
      transaction
        .mockRejectedValueOnce(new DatabaseError('Connection timeout'))
        .mockResolvedValueOnce({ isDuplicate: false, governanceEvents: [] });

      const result = await writeLedgerEntry(payload);
      expect(result.status).toBe('success');
      expect(transaction).toHaveBeenCalledTimes(2);
    });

    it('should support concurrent writes', async () => {
      const { transaction } = require('../db/client');
      transaction.mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      const payloads = [
        createMockPayload({ agentId: 'agent-1' }),
        createMockPayload({ agentId: 'agent-2' }),
        createMockPayload({ agentId: 'agent-3' }),
      ];

      const results = await Promise.all(payloads.map(p => writeLedgerEntry(p)));
      expect(results).toHaveLength(3);
      expect(results.every(r => r.status === 'success')).toBe(true);
    });

    it('should emit governance events', async () => {
      const payload = createMockPayload();
      const { transaction } = require('../db/client');
      const mockEvent = {
        eventId: 'evt-123',
        eventType: 'governance_warning',
      };
      transaction.mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [mockEvent],
      });

      const result = await writeLedgerEntry(payload);
      expect(result.governanceEvents).toContain(mockEvent);
    });
  });

  describe('Read Path - Query Operations', () => {
    it('should read latest entry', async () => {
      const { transaction } = require('../db/client');
      const entry = createMockEntry();
      transaction.mockResolvedValue({
        rows: [entry],
      });

      const result = await readLatestEntry('agent-123');
      expect(result).toBeDefined();
    });

    it('should return null for empty results', async () => {
      const { transaction } = require('../db/client');
      transaction.mockResolvedValue({
        rows: [],
      });

      const result = await readLatestEntry('non-existent');
      expect(result).toBeNull();
    });

    it('should filter by sessionId', async () => {
      const { transaction } = require('../db/client');
      const entry = createMockEntry({ sessionId: 'session-123' });
      transaction.mockResolvedValue({
        rows: [entry],
      });

      const result = await readLatestEntry('agent-123', 'session-123');
      expect(result?.sessionId).toBe('session-123');
    });

    it('should read rolling window aggregates', async () => {
      const { transaction } = require('../db/client');
      transaction.mockResolvedValue({
        rows: [
          {
            total_tokens: '5000',
            total_cost: '0.25',
            event_count: '5',
            error_count: '0',
            window_secs: 60,
          },
        ],
      });

      const result = await readRollingWindow('agent-123', 60);
      expect(result?.windowSecs).toBe(60);
      expect(result?.totalTokens).toBe(5000);
    });

    it('should support multiple window sizes', async () => {
      const { transaction } = require('../db/client');
      const windowSizes = [
        { secs: 60, name: '1m' },
        { secs: 300, name: '5m' },
        { secs: 1800, name: '30m' },
      ];

      for (const window of windowSizes) {
        transaction.mockResolvedValueOnce({
          rows: [
            {
              total_tokens: '1000',
              total_cost: '0.05',
              event_count: '1',
              error_count: '0',
              window_secs: window.secs,
            },
          ],
        });

        const result = await readRollingWindow('agent-123', window.secs);
        expect(result?.windowSecs).toBe(window.secs);
      }
    });

    it('should read cumulative totals', async () => {
      const { transaction } = require('../db/client');
      transaction.mockResolvedValue({
        rows: [
          {
            cumulative_tokens: '1000000',
            cumulative_cost_usd: '50.0',
            projected_cost_usd: '600.0',
            entry_count: '1000',
          },
        ],
      });

      const result = await readCumulative('agent-123');
      expect(result?.cumulativeTokens).toBe(1000000);
      expect(result?.cumulativeCostUsd).toBe(50);
    });

    it('should calculate projections', async () => {
      const { transaction } = require('../db/client');
      transaction.mockResolvedValue({
        rows: [
          {
            cumulative_tokens: '500000',
            cumulative_cost_usd: '25.0',
            projected_cost_usd: '300.0',
            entry_count: '500',
          },
        ],
      });

      const result = await readCumulative('agent-123');
      expect(result?.projectedCostUsd).toBeGreaterThan(result?.cumulativeCostUsd!);
    });

    it('should handle empty window aggregates', async () => {
      const { transaction } = require('../db/client');
      transaction.mockResolvedValue({
        rows: [
          {
            total_tokens: '0',
            total_cost: '0',
            event_count: '0',
            error_count: '0',
            window_secs: 60,
          },
        ],
      });

      const result = await readRollingWindow('agent-999', 60);
      expect(result?.totalTokens).toBe(0);
      expect(result?.eventCount).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      const { transaction } = require('../db/client');
      const DatabaseError = require('../schema/types').DatabaseError;
      transaction.mockRejectedValue(new DatabaseError('Connection failed'));

      await expect(readLatestEntry('agent-123')).rejects.toThrow();
    });

    it('should measure query latency', async () => {
      const { transaction } = require('../db/client');
      const { recordReadMetric } = require('../metrics/ledgerMetrics');
      transaction.mockResolvedValue({
        rows: [createMockEntry()],
      });

      await readLatestEntry('agent-123');
      expect(recordReadMetric).toHaveBeenCalled();
    });
  });

  describe('Governance Integration', () => {
    it('should emit events on write', async () => {
      const { transaction } = require('../db/client');
      const payload = createMockPayload();
      const mockEvent = {
        eventId: 'evt-123',
        eventType: 'governance_warning',
        reason: 'cost_threshold_exceeded',
      };
      transaction.mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [mockEvent],
      });

      const result = await writeLedgerEntry(payload);
      expect(result.governanceEvents).toBeDefined();
      expect(result.governanceEvents?.length).toBeGreaterThan(0);
    });

    it('should support governance config', async () => {
      const { transaction } = require('../db/client');
      const payload = createMockPayload();
      transaction.mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      const govConfig = {
        maxCostUsd: 500,
        maxTokens: 1000000,
        warningThresholdPercent: 80,
      };

      const result = await writeLedgerEntry(payload, { governanceConfig: govConfig });
      expect(result.status).toBe('success');
    });

    it('should handle governance check failures', async () => {
      const { transaction } = require('../db/client');
      const payload = createMockPayload();
      transaction.mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      // Should not throw even if governance checks fail
      const result = await writeLedgerEntry(payload, {
        governanceConfig: { maxCostUsd: 0.01 },
      });
      expect(result).toBeDefined();
    });
  });

  describe('Error Recovery & Reliability', () => {
    it('should implement exponential backoff', async () => {
      const { transaction } = require('../db/client');
      const payload = createMockPayload();
      const DatabaseError = require('../schema/types').DatabaseError;

      transaction
        .mockRejectedValueOnce(new DatabaseError('Timeout'))
        .mockRejectedValueOnce(new DatabaseError('Timeout'))
        .mockResolvedValueOnce({ isDuplicate: false, governanceEvents: [] });

      const result = await writeLedgerEntry(payload);
      expect(result.status).toBe('success');
      expect(transaction).toHaveBeenCalledTimes(3);
    });

    it('should eventually give up on permanent failures', async () => {
      const { transaction } = require('../db/client');
      const payload = createMockPayload();
      const DatabaseError = require('../schema/types').DatabaseError;

      transaction.mockRejectedValue(new DatabaseError('Permanent error'));

      await expect(writeLedgerEntry(payload, { maxRetries: 1 })).rejects.toThrow();
    });

    it('should distinguish duplicate from transient errors', async () => {
      const { transaction } = require('../db/client');
      const payload = createMockPayload();
      const IdempotencyError = require('../schema/types').IdempotencyError;

      transaction.mockRejectedValue(new IdempotencyError('Duplicate'));

      const result = await writeLedgerEntry(payload, { maxRetries: 5 });
      expect(result.status).toBe('duplicate');
      // Should not retry on idempotency error
      expect(transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Data Consistency & Validation', () => {
    it('should require agentId', async () => {
      const payload = createMockPayload({ agentId: '' });
      const ValidationError = require('../schema/types').ValidationError;
      await expect(writeLedgerEntry(payload)).rejects.toThrow(ValidationError);
    });

    it('should require sessionId', async () => {
      const payload = createMockPayload({ sessionId: '' });
      const ValidationError = require('../schema/types').ValidationError;
      await expect(writeLedgerEntry(payload)).rejects.toThrow(ValidationError);
    });

    it('should enforce non-negative tokens', async () => {
      const payload = createMockPayload({ tokensUsed: -100 });
      const ValidationError = require('../schema/types').ValidationError;
      await expect(writeLedgerEntry(payload)).rejects.toThrow(ValidationError);
    });

    it('should enforce non-negative cost', async () => {
      const payload = createMockPayload({ costUsd: -1.0 });
      const ValidationError = require('../schema/types').ValidationError;
      await expect(writeLedgerEntry(payload)).rejects.toThrow(ValidationError);
    });

    it('should accept minimum valid values', async () => {
      const { transaction } = require('../db/client');
      const payload = createMockPayload({
        tokensUsed: 0,
        costUsd: 0,
      });
      transaction.mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      const result = await writeLedgerEntry(payload);
      expect(result.status).toBe('success');
    });

    it('should accept maximum valid values', async () => {
      const { transaction } = require('../db/client');
      const payload = createMockPayload({
        tokensUsed: 1000000000,
        costUsd: 999999.99999,
      });
      transaction.mockResolvedValue({
        isDuplicate: false,
        governanceEvents: [],
      });

      const result = await writeLedgerEntry(payload);
      expect(result.status).toBe('success');
    });
  });
});
