import {
  LedgerEntry,
  LedgerReadQuery,
  RollingWindowResult,
  CumulativeTotals,
} from '../schema/types';
import { query } from '../db/client';
import { recordReadMetric } from '../metrics/ledgerMetrics';
import { createStructuredLog } from '../utils/logging';

export async function readLatestEntry(
  agentId: string,
  sessionId?: string
): Promise<LedgerEntry | null> {
  const startTime = Date.now();

  try {
    const result = await query<LedgerEntry>(
      `SELECT * FROM ledger_entries
       WHERE agent_id = $1 ${sessionId ? 'AND session_id = $2' : ''}
       ORDER BY timestamp DESC
       LIMIT 1`,
      sessionId ? [agentId, sessionId] : [agentId]
    );

    const latencyMs = Date.now() - startTime;
    recordReadMetric(latencyMs);

    if (result.rows.length === 0) {
      createStructuredLog({
        op: 'read_latest_entry',
        agent_id: agentId,
        session_id: sessionId,
        status: 'not_found',
        latency_ms: latencyMs,
      });
      return null;
    }

    const entry = result.rows[0];
    createStructuredLog({
      op: 'read_latest_entry',
      agent_id: agentId,
      session_id: sessionId,
      status: 'success',
      entry_id: entry.entryId,
      latency_ms: latencyMs,
    });

    return entry;
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    recordReadMetric(latencyMs);

    createStructuredLog({
      op: 'read_latest_entry',
      agent_id: agentId,
      session_id: sessionId,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
      latency_ms: latencyMs,
    });

    throw err;
  }
}

export async function readRollingWindow(
  agentId: string,
  windowSecs: number = 300,
  sessionId?: string
): Promise<RollingWindowResult> {
  const startTime = Date.now();

  if (![60, 300, 1800].includes(windowSecs)) {
    throw new Error(`Unsupported windowSecs: ${windowSecs}. Supported: 60, 300, 1800`);
  }

  try {
    const endTime = new Date();
    const startTimeDate = new Date(endTime.getTime() - windowSecs * 1000);

    const result = await query<{
      total_tokens: string;
      total_cost: string;
      event_count: string;
      error_count: string;
      latest_timestamp: string;
    }>(
      `SELECT
         COALESCE(SUM(tokens_used), 0)::TEXT as total_tokens,
         COALESCE(SUM(cost_usd), 0)::TEXT as total_cost,
         COUNT(*)::TEXT as event_count,
         SUM(CASE WHEN event_type IN ('warning', 'abort') THEN 1 ELSE 0 END)::TEXT as error_count,
         MAX(timestamp)::TEXT as latest_timestamp
       FROM ledger_entries
       WHERE agent_id = $1
         AND timestamp >= $2
         AND timestamp < $3
         ${sessionId ? 'AND session_id = $4' : ''}`,
      sessionId
        ? [agentId, startTimeDate, endTime, sessionId]
        : [agentId, startTimeDate, endTime]
    );

    const latencyMs = Date.now() - startTime;
    recordReadMetric(latencyMs);

    const row = result.rows[0];
    const totalTokens = parseInt(row.total_tokens, 10);
    const totalCost = parseFloat(row.total_cost);
    const eventCount = parseInt(row.event_count, 10);
    const errorCount = parseInt(row.error_count, 10);

    // Get latest entry for this window
    let latestEntry: LedgerEntry | null = null;
    if (row.latest_timestamp) {
      const latestResult = await query<LedgerEntry>(
        `SELECT * FROM ledger_entries
         WHERE agent_id = $1
           AND timestamp = $2::TIMESTAMP
           ${sessionId ? 'AND session_id = $3' : ''}
         LIMIT 1`,
        sessionId ? [agentId, row.latest_timestamp, sessionId] : [agentId, row.latest_timestamp]
      );

      if (latestResult.rows.length > 0) {
        latestEntry = latestResult.rows[0];
      }
    }

    createStructuredLog({
      op: 'read_rolling_window',
      agent_id: agentId,
      session_id: sessionId,
      window_secs: windowSecs,
      status: 'success',
      total_tokens: totalTokens,
      total_cost: totalCost,
      event_count: eventCount,
      error_count: errorCount,
      latency_ms: latencyMs,
    });

    return {
      windowSecs,
      startTime: startTimeDate,
      endTime,
      totalTokens,
      totalCost,
      eventCount,
      errorCount,
      latestEntry: latestEntry || undefined,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    recordReadMetric(latencyMs);

    createStructuredLog({
      op: 'read_rolling_window',
      agent_id: agentId,
      session_id: sessionId,
      window_secs: windowSecs,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
      latency_ms: latencyMs,
    });

    throw err;
  }
}

export async function readCumulative(
  agentId: string,
  sessionId?: string
): Promise<CumulativeTotals> {
  const startTime = Date.now();

  try {
    const result = await query<{
      cumulative_tokens: string;
      cumulative_cost_usd: string;
      projected_cost_usd: string;
      earliest_timestamp: string;
      latest_timestamp: string;
      entry_count: string;
    }>(
      `SELECT
         COALESCE(MAX(cumulative_tokens), 0)::TEXT as cumulative_tokens,
         COALESCE(MAX(cumulative_cost_usd), 0)::TEXT as cumulative_cost_usd,
         COALESCE(MAX(projected_cost_usd), 0)::TEXT as projected_cost_usd,
         MIN(timestamp)::TEXT as earliest_timestamp,
         MAX(timestamp)::TEXT as latest_timestamp,
         COUNT(*)::TEXT as entry_count
       FROM ledger_entries
       WHERE agent_id = $1
         ${sessionId ? 'AND session_id = $2' : ''}`,
      sessionId ? [agentId, sessionId] : [agentId]
    );

    const latencyMs = Date.now() - startTime;
    recordReadMetric(latencyMs);

    const row = result.rows[0];
    const cumulativeTokens = parseInt(row.cumulative_tokens, 10);
    const cumulativeCostUsd = parseFloat(row.cumulative_cost_usd);
    const projectedCostUsd = parseFloat(row.projected_cost_usd);
    const entryCount = parseInt(row.entry_count, 10);

    createStructuredLog({
      op: 'read_cumulative',
      agent_id: agentId,
      session_id: sessionId,
      status: 'success',
      cumulative_tokens: cumulativeTokens,
      cumulative_cost_usd: cumulativeCostUsd,
      projected_cost_usd: projectedCostUsd,
      entry_count: entryCount,
      latency_ms: latencyMs,
    });

    return {
      agentId,
      sessionId,
      cumulativeTokens,
      cumulativeCostUsd,
      projectedCostUsd,
      earliestEntry: row.earliest_timestamp ? new Date(row.earliest_timestamp) : undefined,
      latestEntry: row.latest_timestamp ? new Date(row.latest_timestamp) : undefined,
      entryCount,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    recordReadMetric(latencyMs);

    createStructuredLog({
      op: 'read_cumulative',
      agent_id: agentId,
      session_id: sessionId,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
      latency_ms: latencyMs,
    });

    throw err;
  }
}

export async function readByQuery(query_param: LedgerReadQuery): Promise<LedgerEntry[]> {
  const startTime = Date.now();

  try {
    let sql = 'SELECT * FROM ledger_entries WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (query_param.agentId) {
      sql += ` AND agent_id = $${paramIndex}`;
      values.push(query_param.agentId);
      paramIndex++;
    }

    if (query_param.sessionId) {
      sql += ` AND session_id = $${paramIndex}`;
      values.push(query_param.sessionId);
      paramIndex++;
    }

    if (query_param.startTime) {
      sql += ` AND timestamp >= $${paramIndex}`;
      values.push(query_param.startTime);
      paramIndex++;
    }

    if (query_param.endTime) {
      sql += ` AND timestamp <= $${paramIndex}`;
      values.push(query_param.endTime);
      paramIndex++;
    }

    if (query_param.eventType) {
      sql += ` AND event_type = $${paramIndex}`;
      values.push(query_param.eventType);
      paramIndex++;
    }

    sql += ' ORDER BY timestamp DESC';

    if (query_param.limit) {
      sql += ` LIMIT $${paramIndex}`;
      values.push(query_param.limit);
      paramIndex++;
    }

    if (query_param.offset) {
      sql += ` OFFSET $${paramIndex}`;
      values.push(query_param.offset);
      paramIndex++;
    }

    const result = await query<LedgerEntry>(sql, values);
    const latencyMs = Date.now() - startTime;
    recordReadMetric(latencyMs);

    createStructuredLog({
      op: 'read_by_query',
      query: query_param,
      status: 'success',
      result_count: result.rows.length,
      latency_ms: latencyMs,
    });

    return result.rows;
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    recordReadMetric(latencyMs);

    createStructuredLog({
      op: 'read_by_query',
      query: query_param,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
      latency_ms: latencyMs,
    });

    throw err;
  }
}
