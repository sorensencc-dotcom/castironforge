import {
  readLatestEntry,
  readRollingWindow,
  readCumulative,
  readByQuery,
} from '../readLedgerEntry';
import * as dbClient from '../../db/client';
import * as ledgerMetrics from '../../metrics/ledgerMetrics';
import * as logging from '../../utils/logging';
import { LedgerEntry, CumulativeTotals } from '../../schema/types';

jest.mock('../../db/client');
jest.mock('../../metrics/ledgerMetrics');
jest.mock('../../utils/logging');

describe('readLatestEntry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return latest entry for agent', async () => {
    const mockEntry: LedgerEntry = {
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
    };

    (dbClient.query as jest.Mock).mockResolvedValue({
      rows: [mockEntry],
    });

    const result = await readLatestEntry('agent-1');

    expect(result).toEqual(mockEntry);
    expect(dbClient.query).toHaveBeenCalledWith(
      expect.stringContaining('agent_id = $1'),
      ['agent-1']
    );
  });

  it('should return latest entry for agent with session filter', async () => {
    const mockEntry: LedgerEntry = {
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
    };

    (dbClient.query as jest.Mock).mockResolvedValue({
      rows: [mockEntry],
    });

    const result = await readLatestEntry('agent-1', 'session-1');

    expect(result).toEqual(mockEntry);
    expect(dbClient.query).toHaveBeenCalledWith(
      expect.stringContaining('session_id = $2'),
      ['agent-1', 'session-1']
    );
  });

  it('should return null when no entry found', async () => {
    (dbClient.query as jest.Mock).mockResolvedValue({
      rows: [],
    });

    const result = await readLatestEntry('agent-1');

    expect(result).toBeNull();
  });

  it('should record latency metric', async () => {
    (dbClient.query as jest.Mock).mockResolvedValue({
      rows: [],
    });

    await readLatestEntry('agent-1');

    expect(ledgerMetrics.recordReadMetric).toHaveBeenCalledWith(expect.any(Number));
  });

  it('should log structured logs', async () => {
    (dbClient.query as jest.Mock).mockResolvedValue({
      rows: [],
    });

    await readLatestEntry('agent-1');

    expect(logging.createStructuredLog).toHaveBeenCalledWith(
      expect.objectContaining({
        op: 'read_latest_entry',
        agent_id: 'agent-1',
        status: 'not_found',
      })
    );
  });

  it('should handle errors gracefully', async () => {
    (dbClient.query as jest.Mock).mockRejectedValue(new Error('Database error'));

    await expect(readLatestEntry('agent-1')).rejects.toThrow('Database error');
    expect(logging.createStructuredLog).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
      })
    );
  });
});

describe('readRollingWindow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should calculate rolling window for 1 minute', async () => {
    (dbClient.query as jest.Mock)
      .mockResolvedValueOnce({
        rows: [
          {
            total_tokens: '500',
            total_cost: '0.05',
            event_count: '5',
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
            cumulativeTokens: 500,
            cumulativeCostUsd: 0.05,
            projectedCostUsd: 1.0,
            schemaVersion: 3,
          },
        ],
      });

    const result = await readRollingWindow('agent-1', 60);

    expect(result.windowSecs).toBe(60);
    expect(result.totalTokens).toBe(500);
    expect(result.totalCost).toBe(0.05);
    expect(result.eventCount).toBe(5);
    expect(result.errorCount).toBe(1);
  });

  it('should support 5 minute window', async () => {
    (dbClient.query as jest.Mock)
      .mockResolvedValueOnce({
        rows: [
          {
            total_tokens: '2000',
            total_cost: '0.2',
            event_count: '20',
            error_count: '2',
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

    const result = await readRollingWindow('agent-1', 300);

    expect(result.windowSecs).toBe(300);
    expect(result.totalTokens).toBe(2000);
  });

  it('should support 30 minute window', async () => {
    (dbClient.query as jest.Mock)
      .mockResolvedValueOnce({
        rows: [
          {
            total_tokens: '9000',
            total_cost: '0.9',
            event_count: '90',
            error_count: '5',
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
            cumulativeTokens: 9000,
            cumulativeCostUsd: 0.9,
            projectedCostUsd: 1.0,
            schemaVersion: 3,
          },
        ],
      });

    const result = await readRollingWindow('agent-1', 1800);

    expect(result.windowSecs).toBe(1800);
  });

  it('should reject unsupported window sizes', async () => {
    await expect(readRollingWindow('agent-1', 120)).rejects.toThrow(
      'Unsupported windowSecs'
    );
  });

  it('should include session filter when provided', async () => {
    (dbClient.query as jest.Mock)
      .mockResolvedValueOnce({
        rows: [
          {
            total_tokens: '100',
            total_cost: '0.01',
            event_count: '1',
            error_count: '0',
            latest_timestamp: new Date().toISOString(),
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
      });

    await readRollingWindow('agent-1', 60, 'session-1');

    const calls = (dbClient.query as jest.Mock).mock.calls;
    expect(calls[0][1]).toContain('session-1');
  });

  it('should handle zero-value aggregations', async () => {
    (dbClient.query as jest.Mock)
      .mockResolvedValueOnce({
        rows: [
          {
            total_tokens: '0',
            total_cost: '0.0',
            event_count: '0',
            error_count: '0',
            latest_timestamp: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
      });

    const result = await readRollingWindow('agent-1', 60);

    expect(result.totalTokens).toBe(0);
    expect(result.totalCost).toBe(0);
    expect(result.eventCount).toBe(0);
  });
});

describe('readCumulative', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (dbClient.query as jest.Mock).mockReset();
  });

  it('should return cumulative totals for agent', async () => {
    (dbClient.query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          cumulative_tokens: '5000',
          cumulative_cost_usd: '0.5',
          projected_cost_usd: '2.0',
          earliest_timestamp: '2024-01-01T00:00:00Z',
          latest_timestamp: '2024-01-01T10:00:00Z',
          entry_count: '50',
        },
      ],
    });

    const result: CumulativeTotals = await readCumulative('agent-1');

    expect(result.agentId).toBe('agent-1');
    expect(result.cumulativeTokens).toBe(5000);
    expect(result.cumulativeCostUsd).toBe(0.5);
    expect(result.projectedCostUsd).toBe(2.0);
    expect(result.entryCount).toBe(50);
  });

  it('should include session ID when provided', async () => {
    (dbClient.query as jest.Mock).mockResolvedValue({
      rows: [
        {
          cumulative_tokens: '1000',
          cumulative_cost_usd: '0.1',
          projected_cost_usd: '0.5',
          earliest_timestamp: '2024-01-01T00:00:00Z',
          latest_timestamp: '2024-01-01T01:00:00Z',
          entry_count: '10',
        },
      ],
    });

    const result = await readCumulative('agent-1', 'session-1');

    expect(result.sessionId).toBe('session-1');
    expect(dbClient.query).toHaveBeenCalledWith(
      expect.stringContaining('session_id = $2'),
      expect.arrayContaining(['agent-1', 'session-1'])
    );
  });

  it('should parse numeric values correctly', async () => {
    (dbClient.query as jest.Mock).mockResolvedValue({
      rows: [
        {
          cumulative_tokens: '1234567',
          cumulative_cost_usd: '123.45',
          projected_cost_usd: '567.89',
          earliest_timestamp: null,
          latest_timestamp: null,
          entry_count: '100',
        },
      ],
    });

    const result = await readCumulative('agent-1');

    expect(result.cumulativeTokens).toBe(1234567);
    expect(result.cumulativeCostUsd).toBe(123.45);
    expect(result.projectedCostUsd).toBe(567.89);
  });

  it('should handle zero totals', async () => {
    (dbClient.query as jest.Mock).mockResolvedValue({
      rows: [
        {
          cumulative_tokens: '0',
          cumulative_cost_usd: '0.0',
          projected_cost_usd: '0.0',
          earliest_timestamp: null,
          latest_timestamp: null,
          entry_count: '0',
        },
      ],
    });

    const result = await readCumulative('agent-1');

    expect(result.cumulativeTokens).toBe(0);
    expect(result.cumulativeCostUsd).toBe(0);
  });
});

describe('readByQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should filter by agentId', async () => {
    (dbClient.query as jest.Mock).mockResolvedValue({
      rows: [],
    });

    await readByQuery({ agentId: 'agent-1' });

    expect(dbClient.query).toHaveBeenCalledWith(
      expect.stringContaining('agent_id = $1'),
      expect.arrayContaining(['agent-1'])
    );
  });

  it('should filter by sessionId', async () => {
    (dbClient.query as jest.Mock).mockResolvedValue({
      rows: [],
    });

    await readByQuery({ agentId: 'agent-1', sessionId: 'session-1' });

    const calls = (dbClient.query as jest.Mock).mock.calls;
    expect(calls[0][1]).toContain('session-1');
  });

  it('should filter by time range', async () => {
    (dbClient.query as jest.Mock).mockResolvedValue({
      rows: [],
    });

    const startTime = new Date('2024-01-01');
    const endTime = new Date('2024-01-02');

    await readByQuery({ agentId: 'agent-1', startTime, endTime });

    const calls = (dbClient.query as jest.Mock).mock.calls;
    expect(calls[0][1]).toContain(startTime);
    expect(calls[0][1]).toContain(endTime);
  });

  it('should filter by eventType', async () => {
    (dbClient.query as jest.Mock).mockResolvedValue({
      rows: [],
    });

    await readByQuery({ agentId: 'agent-1', eventType: 'warning' });

    const calls = (dbClient.query as jest.Mock).mock.calls;
    expect(calls[0][1]).toContain('warning');
  });

  it('should support pagination with limit', async () => {
    (dbClient.query as jest.Mock).mockResolvedValue({
      rows: [],
    });

    await readByQuery({ agentId: 'agent-1', limit: 10 });

    const sql = (dbClient.query as jest.Mock).mock.calls[0][0];
    expect(sql).toContain('LIMIT');
  });

  it('should support pagination with offset', async () => {
    (dbClient.query as jest.Mock).mockResolvedValue({
      rows: [],
    });

    await readByQuery({ agentId: 'agent-1', limit: 10, offset: 20 });

    const sql = (dbClient.query as jest.Mock).mock.calls[0][0];
    expect(sql).toContain('OFFSET');
  });

  it('should combine multiple filters', async () => {
    (dbClient.query as jest.Mock).mockResolvedValue({
      rows: [],
    });

    const startTime = new Date('2024-01-01');
    const endTime = new Date('2024-01-02');

    await readByQuery({
      agentId: 'agent-1',
      sessionId: 'session-1',
      startTime,
      endTime,
      eventType: 'usage',
      limit: 100,
    });

    const sql = (dbClient.query as jest.Mock).mock.calls[0][0];
    expect(sql).toContain('agent_id');
    expect(sql).toContain('session_id');
    expect(sql).toContain('timestamp');
    expect(sql).toContain('event_type');
    expect(sql).toContain('LIMIT');
  });

  it('should sort by timestamp descending', async () => {
    (dbClient.query as jest.Mock).mockResolvedValue({
      rows: [],
    });

    await readByQuery({ agentId: 'agent-1' });

    const sql = (dbClient.query as jest.Mock).mock.calls[0][0];
    expect(sql).toContain('ORDER BY timestamp DESC');
  });
});
