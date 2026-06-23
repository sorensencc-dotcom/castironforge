/**
 * WS-A Budget Ledger — Authoritative TypeScript types
 *
 * Mirrors budget_ledger_v3 SQL schema.
 * All ledger operations use these types for compile-time safety.
 */

/**
 * LedgerEntry: A single row in the ledger_entries table
 *
 * Represents one budget event (usage, warning, or abort).
 * All cumulative fields are monotonically increasing.
 */
export interface LedgerEntry {
  // Identifiers
  entryId: string; // UUID, unique per entry
  agentId: string; // Agent or subsystem identifier
  sessionId: string; // Session or request identifier

  // Timing
  timestamp: Date; // Event time (server time)
  createdAt: Date; // Insert time (immutable)

  // Event classification
  eventType: 'usage' | 'warning' | 'abort';

  // This event's usage
  tokensUsed: number; // Tokens consumed in this event (>= 0)
  costUsd: number; // Cost of this event (>= 0)

  // Cumulative totals (monotonically increasing)
  cumulativeTokens: number; // Running token total (>= 0)
  cumulativeCostUsd: number; // Running cost total (>= 0)

  // Projection
  projectedCostUsd: number; // Estimated cost to completion (>= cumulativeCostUsd)

  // Flexible metadata
  metadata?: Record<string, unknown>;

  // Schema version (for migrations)
  schemaVersion: number;
}

/**
 * LedgerWritePayload: Request payload for writing a ledger entry
 *
 * Used when inserting new entries into the ledger.
 * Validation occurs before write.
 */
export interface LedgerWritePayload {
  // Required identifiers
  agentId: string;
  sessionId: string;

  // Required usage data
  tokensUsed: number;
  costUsd: number;

  // Required cumulative totals
  cumulativeTokens: number;
  cumulativeCostUsd: number;

  // Required projection
  projectedCostUsd: number;

  // Event classification (defaults to 'usage')
  eventType?: 'usage' | 'warning' | 'abort';

  // Optional metadata (arbitrary JSON)
  metadata?: Record<string, unknown>;

  // Idempotency key (if not provided, generated)
  entryId?: string;
}

/**
 * LedgerWriteResult: Response from a successful ledger write
 */
export interface LedgerWriteResult {
  entryId: string;
  agentId: string;
  sessionId: string;
  timestamp: Date;
  status: 'success' | 'duplicate'; // duplicate if entryId already exists
  latencyMs: number;
  governanceEvents?: GovernanceEvent[];
}

/**
 * LedgerReadQuery: Parameters for reading from the ledger
 */
export interface LedgerReadQuery {
  // Which agent/session to read
  agentId?: string;
  sessionId?: string;

  // Time range
  startTime?: Date;
  endTime?: Date;

  // Rolling window (seconds)
  windowSecs?: number; // 60 (1m), 300 (5m), 1800 (30m)

  // Filtering
  eventType?: 'usage' | 'warning' | 'abort';

  // Pagination
  limit?: number;
  offset?: number;
}

/**
 * RollingWindowResult: Aggregated data over a time window
 *
 * Used by SLO Controller to compute burn-rate.
 */
export interface RollingWindowResult {
  windowSecs: number;
  startTime: Date;
  endTime: Date;

  // Aggregations
  totalTokens: number;
  totalCost: number;
  eventCount: number;
  errorCount: number;

  // Latest state
  latestEntry?: LedgerEntry;
}

/**
 * CumulativeTotals: Cumulative usage for an agent/session
 *
 * Used by governance and monitoring.
 */
export interface CumulativeTotals {
  agentId: string;
  sessionId?: string;

  cumulativeTokens: number;
  cumulativeCostUsd: number;
  projectedCostUsd: number;

  // Metadata
  earliestEntry?: Date;
  latestEntry?: Date;
  entryCount: number;
}

/**
 * GovernanceEvent: Triggered when budget/governance thresholds crossed
 *
 * Emitted during write-path; propagated to SLO Controller and Canary Gates.
 */
export interface GovernanceEvent {
  eventId: string;
  eventType: 'governance_warning' | 'governance_abort';
  reason:
    | 'budget_exhaustion'
    | 'cost_threshold_exceeded'
    | 'token_threshold_exceeded'
    | 'projected_cost_exceeded';

  // Context
  agentId: string;
  sessionId: string;
  ledgerEntryId: string;

  // Threshold values
  cumulativeTokens: number;
  cumulativeCostUsd: number;
  projectedCostUsd: number;
  maxTokens?: number;
  maxCostUsd?: number;

  timestamp: Date;
  latencyMs: number;
}

/**
 * LedgerError: Ledger-specific errors
 */
export class LedgerError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'LedgerError';
  }
}

export class ValidationError extends LedgerError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

export class IdempotencyError extends LedgerError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('IDEMPOTENCY_ERROR', message, details);
    this.name = 'IdempotencyError';
  }
}

export class DatabaseError extends LedgerError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('DATABASE_ERROR', message, details);
    this.name = 'DatabaseError';
  }
}

/**
 * LedgerMetrics: Prometheus metric types
 */
export interface LedgerMetrics {
  writesTotal: number;
  writeFailuresTotal: number;
  writeLatencyP95Ms: number;
  writeLatencyP99Ms: number;
  readLatencyP95Ms: number;
  readLatencyP99Ms: number;
  driftTotal: number;
  budgetExhaustionEventsTotal: number;
  governanceAbortTotal: number;
  governanceWarningTotal: number;
}

/**
 * SchemaConstants: Budget Ledger v3 schema metadata
 */
export const SchemaConstants = {
  VERSION: 3,
  TABLE_NAME: 'ledger_entries',

  // Constraints
  MIN_TOKENS: 0,
  MIN_COST_USD: 0,
  MAX_TOKENS: 1_000_000_000,
  MAX_COST_USD: 999_999.99999,

  // Timing
  TIMESTAMP_PRECISION: 'TIMESTAMP WITH TIME ZONE',

  // Indexes
  INDEXES: [
    'idx_ledger_agent_time',
    'idx_ledger_session',
    'idx_ledger_event_type',
    'idx_ledger_timestamp',
    'idx_ledger_agent_event_time',
  ],
} as const;
