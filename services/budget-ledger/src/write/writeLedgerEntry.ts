import { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  LedgerWritePayload,
  LedgerWriteResult,
  LedgerEntry,
  GovernanceEvent,
  ValidationError,
  IdempotencyError,
  DatabaseError,
  SchemaConstants,
} from '../schema/types';
import { transaction } from '../db/client';
import { emitGovernanceEvent } from '../governance/governanceEvents';
import { recordWriteMetric } from '../metrics/ledgerMetrics';
import { createStructuredLog } from '../utils/logging';

interface WriteOptions {
  maxRetries?: number;
  retryDelays?: number[];
  governanceConfig?: GovernanceConfig;
}

interface GovernanceConfig {
  maxTokens?: number;
  maxCostUsd?: number;
  warningThresholdPercent?: number;
  caustionThresholdPercent?: number;
}

export async function writeLedgerEntry(
  payload: LedgerWritePayload,
  options: WriteOptions = {}
): Promise<LedgerWriteResult> {
  const startTime = Date.now();
  const entryId = payload.entryId || uuidv4();
  const maxRetries = options.maxRetries ?? 3;
  const retryDelays = options.retryDelays ?? [100, 200, 400];

  // Validate payload
  validatePayload(payload);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await performWrite(entryId, payload, options.governanceConfig);
      const latencyMs = Date.now() - startTime;

      recordWriteMetric({
        status: result.isDuplicate ? 'duplicate' : 'success',
        latencyMs,
      });

      createStructuredLog({
        op: 'ledger_write',
        entry_id: entryId,
        agent_id: payload.agentId,
        session_id: payload.sessionId,
        tokens_used: payload.tokensUsed,
        cost_usd: payload.costUsd,
        cumulative_cost_usd: payload.cumulativeCostUsd,
        projected_cost_usd: payload.projectedCostUsd,
        status: result.isDuplicate ? 'duplicate' : 'success',
        latency_ms: latencyMs,
        error: null,
      });

      return {
        entryId,
        agentId: payload.agentId,
        sessionId: payload.sessionId,
        timestamp: new Date(),
        status: result.isDuplicate ? 'duplicate' : 'success',
        latencyMs,
        governanceEvents: result.governanceEvents,
      };
    } catch (err) {
      lastError = err as Error;

      if (err instanceof IdempotencyError) {
        const latencyMs = Date.now() - startTime;
        recordWriteMetric({ status: 'duplicate', latencyMs });
        return {
          entryId,
          agentId: payload.agentId,
          sessionId: payload.sessionId,
          timestamp: new Date(),
          status: 'duplicate',
          latencyMs,
        };
      }

      if (err instanceof ValidationError) {
        throw err;
      }

      if (attempt < maxRetries) {
        const delayMs = retryDelays[attempt];
        await sleep(delayMs);
        continue;
      }
    }
  }

  const latencyMs = Date.now() - startTime;
  recordWriteMetric({ status: 'failure', latencyMs });

  createStructuredLog({
    op: 'ledger_write',
    entry_id: entryId,
    agent_id: payload.agentId,
    session_id: payload.sessionId,
    tokens_used: payload.tokensUsed,
    cost_usd: payload.costUsd,
    cumulative_cost_usd: payload.cumulativeCostUsd,
    projected_cost_usd: payload.projectedCostUsd,
    status: 'failure',
    latency_ms: latencyMs,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  });

  throw new DatabaseError(
    `Failed to write ledger entry after ${maxRetries + 1} attempts`,
    { entryId, originalError: lastError }
  );
}

function validatePayload(payload: LedgerWritePayload): void {
  if (!payload.agentId || typeof payload.agentId !== 'string') {
    throw new ValidationError('agentId is required and must be a string');
  }

  if (!payload.sessionId || typeof payload.sessionId !== 'string') {
    throw new ValidationError('sessionId is required and must be a string');
  }

  if (typeof payload.tokensUsed !== 'number' || payload.tokensUsed < SchemaConstants.MIN_TOKENS) {
    throw new ValidationError(
      `tokensUsed must be a number >= ${SchemaConstants.MIN_TOKENS}`,
      { received: payload.tokensUsed }
    );
  }

  if (typeof payload.costUsd !== 'number' || payload.costUsd < SchemaConstants.MIN_COST_USD) {
    throw new ValidationError(
      `costUsd must be a number >= ${SchemaConstants.MIN_COST_USD}`,
      { received: payload.costUsd }
    );
  }

  if (
    typeof payload.cumulativeTokens !== 'number' ||
    payload.cumulativeTokens < SchemaConstants.MIN_TOKENS
  ) {
    throw new ValidationError(
      `cumulativeTokens must be a number >= ${SchemaConstants.MIN_TOKENS}`,
      { received: payload.cumulativeTokens }
    );
  }

  if (
    typeof payload.cumulativeCostUsd !== 'number' ||
    payload.cumulativeCostUsd < SchemaConstants.MIN_COST_USD
  ) {
    throw new ValidationError(
      `cumulativeCostUsd must be a number >= ${SchemaConstants.MIN_COST_USD}`,
      { received: payload.cumulativeCostUsd }
    );
  }

  if (typeof payload.projectedCostUsd !== 'number') {
    throw new ValidationError('projectedCostUsd is required and must be a number', {
      received: payload.projectedCostUsd,
    });
  }

  if (payload.projectedCostUsd < payload.cumulativeCostUsd) {
    throw new ValidationError(
      'projectedCostUsd must be >= cumulativeCostUsd',
      {
        projectedCostUsd: payload.projectedCostUsd,
        cumulativeCostUsd: payload.cumulativeCostUsd,
      }
    );
  }

  if (payload.eventType && !['usage', 'warning', 'abort'].includes(payload.eventType)) {
    throw new ValidationError(
      'eventType must be one of: usage, warning, abort',
      { received: payload.eventType }
    );
  }
}

interface WriteResult {
  isDuplicate: boolean;
  governanceEvents: GovernanceEvent[];
}

async function performWrite(
  entryId: string,
  payload: LedgerWritePayload,
  governanceConfig?: GovernanceConfig
): Promise<WriteResult> {
  return transaction(async (client) => {
    // Check for duplicate entry (idempotency)
    const existingResult = await client.query<{ entry_id: string }>(
      'SELECT entry_id FROM ledger_entries WHERE entry_id = $1',
      [entryId]
    );

    if (existingResult.rows.length > 0) {
      throw new IdempotencyError('Entry already exists', { entryId });
    }

    // Insert ledger entry
    const insertResult = await client.query<LedgerEntry>(
      `INSERT INTO ledger_entries (
        entry_id,
        agent_id,
        session_id,
        timestamp,
        event_type,
        tokens_used,
        cost_usd,
        cumulative_tokens,
        cumulative_cost_usd,
        projected_cost_usd,
        metadata,
        schema_version,
        created_at
      ) VALUES (
        $1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11, NOW()
      ) RETURNING *`,
      [
        entryId,
        payload.agentId,
        payload.sessionId,
        payload.eventType || 'usage',
        payload.tokensUsed,
        payload.costUsd,
        payload.cumulativeTokens,
        payload.cumulativeCostUsd,
        payload.projectedCostUsd,
        payload.metadata || {},
        SchemaConstants.VERSION,
      ]
    );

    if (insertResult.rows.length === 0) {
      throw new DatabaseError('Failed to insert ledger entry');
    }

    const entry = insertResult.rows[0];

    // Check for governance violations
    const governanceEvents = await checkGovernanceConditions(
      entry,
      client,
      governanceConfig
    );

    return {
      isDuplicate: false,
      governanceEvents,
    };
  });
}

async function checkGovernanceConditions(
  entry: LedgerEntry,
  client: PoolClient,
  config?: GovernanceConfig
): Promise<GovernanceEvent[]> {
  const events: GovernanceEvent[] = [];

  const maxTokens = config?.maxTokens;
  const maxCostUsd = config?.maxCostUsd;
  const warningThreshold = config?.warningThresholdPercent ?? 0.8;
  const caustionThreshold = config?.caustionThresholdPercent ?? 0.7;

  // Check for budget exhaustion (abort conditions)
  if (maxTokens && entry.cumulativeTokens > maxTokens) {
    const abortEvent = await emitGovernanceEvent({
      eventType: 'governance_abort',
      reason: 'budget_exhaustion',
      agentId: entry.agentId,
      sessionId: entry.sessionId,
      ledgerEntryId: entry.entryId,
      cumulativeTokens: entry.cumulativeTokens,
      cumulativeCostUsd: entry.cumulativeCostUsd,
      projectedCostUsd: entry.projectedCostUsd,
      maxTokens,
    });
    events.push(abortEvent);
  }

  if (maxCostUsd && entry.cumulativeCostUsd > maxCostUsd) {
    const abortEvent = await emitGovernanceEvent({
      eventType: 'governance_abort',
      reason: 'budget_exhaustion',
      agentId: entry.agentId,
      sessionId: entry.sessionId,
      ledgerEntryId: entry.entryId,
      cumulativeTokens: entry.cumulativeTokens,
      cumulativeCostUsd: entry.cumulativeCostUsd,
      projectedCostUsd: entry.projectedCostUsd,
      maxCostUsd,
    });
    events.push(abortEvent);
  }

  if (maxCostUsd && entry.projectedCostUsd > maxCostUsd) {
    const abortEvent = await emitGovernanceEvent({
      eventType: 'governance_abort',
      reason: 'budget_exhaustion',
      agentId: entry.agentId,
      sessionId: entry.sessionId,
      ledgerEntryId: entry.entryId,
      cumulativeTokens: entry.cumulativeTokens,
      cumulativeCostUsd: entry.cumulativeCostUsd,
      projectedCostUsd: entry.projectedCostUsd,
      maxCostUsd,
    });
    events.push(abortEvent);
  }

  // Check for threshold warnings (non-abort conditions)
  if (maxCostUsd) {
    const warningThresholdCost = maxCostUsd * warningThreshold;
    const caustionThresholdCost = maxCostUsd * caustionThreshold;

    if (entry.projectedCostUsd > warningThresholdCost && !hasAbortEvent(events)) {
      const warningEvent = await emitGovernanceEvent({
        eventType: 'governance_warning',
        reason: 'cost_threshold_exceeded',
        agentId: entry.agentId,
        sessionId: entry.sessionId,
        ledgerEntryId: entry.entryId,
        cumulativeTokens: entry.cumulativeTokens,
        cumulativeCostUsd: entry.cumulativeCostUsd,
        projectedCostUsd: entry.projectedCostUsd,
        maxCostUsd,
      });
      events.push(warningEvent);
    }

    if (entry.cumulativeCostUsd > caustionThresholdCost && !hasAbortEvent(events)) {
      const warningEvent = await emitGovernanceEvent({
        eventType: 'governance_warning',
        reason: 'cost_threshold_exceeded',
        agentId: entry.agentId,
        sessionId: entry.sessionId,
        ledgerEntryId: entry.entryId,
        cumulativeTokens: entry.cumulativeTokens,
        cumulativeCostUsd: entry.cumulativeCostUsd,
        projectedCostUsd: entry.projectedCostUsd,
        maxCostUsd,
      });
      events.push(warningEvent);
    }
  }

  return events;
}

function hasAbortEvent(events: GovernanceEvent[]): boolean {
  return events.some((e) => e.eventType === 'governance_abort');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
