import {
  LedgerWritePayload,
  LedgerEntry,
  GovernanceEvent,
} from '../schema/types';

export function createMockPayload(
  overrides?: Partial<LedgerWritePayload>
): LedgerWritePayload {
  return {
    agentId: 'agent-123',
    sessionId: 'session-456',
    tokensUsed: 1000,
    costUsd: 0.05,
    cumulativeTokens: 1000,
    cumulativeCostUsd: 0.05,
    projectedCostUsd: 0.1,
    ...overrides,
  };
}

export function createMockEntry(
  overrides?: Partial<LedgerEntry>
): LedgerEntry {
  return {
    entryId: 'entry-123',
    agentId: 'agent-123',
    sessionId: 'session-456',
    tokensUsed: 1000,
    costUsd: 0.05,
    cumulativeTokens: 1000,
    cumulativeCostUsd: 0.05,
    projectedCostUsd: 0.1,
    timestamp: new Date(),
    createdAt: new Date(),
    eventType: 'usage',
    schemaVersion: 1,
    ...overrides,
  };
}

export function createMockGovernanceEvent(
  overrides?: Partial<GovernanceEvent>
): GovernanceEvent {
  return {
    eventId: 'event-123',
    timestamp: new Date(),
    eventType: 'governance_warning',
    reason: 'cost_threshold_exceeded',
    agentId: 'agent-123',
    sessionId: 'session-456',
    ledgerEntryId: 'entry-123',
    cumulativeTokens: 1000,
    cumulativeCostUsd: 0.05,
    projectedCostUsd: 0.1,
    latencyMs: 10,
    ...overrides,
  };
}

export function mockDbClient() {
  return {
    query: jest.fn(),
    release: jest.fn(),
  };
}

export function mockPoolClient() {
  return {
    query: jest.fn(),
    release: jest.fn(),
    connect: jest.fn(),
  };
}
