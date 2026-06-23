import { v4 as uuidv4 } from 'uuid';
import { GovernanceEvent } from '../schema/types';
import { createStructuredLog } from '../utils/logging';
import { recordGovernanceEvent } from '../metrics/ledgerMetrics';

interface GovernanceEventPayload {
  eventType: 'governance_warning' | 'governance_abort';
  reason:
    | 'budget_exhaustion'
    | 'cost_threshold_exceeded'
    | 'token_threshold_exceeded'
    | 'projected_cost_exceeded';
  agentId: string;
  sessionId: string;
  ledgerEntryId: string;
  cumulativeTokens: number;
  cumulativeCostUsd: number;
  projectedCostUsd: number;
  maxTokens?: number;
  maxCostUsd?: number;
}

let governanceEventHandlers: ((event: GovernanceEvent) => void)[] = [];

export function onGovernanceEvent(handler: (event: GovernanceEvent) => void): void {
  governanceEventHandlers.push(handler);
}

export function offGovernanceEvent(handler: (event: GovernanceEvent) => void): void {
  governanceEventHandlers = governanceEventHandlers.filter((h) => h !== handler);
}

export async function emitGovernanceEvent(
  payload: GovernanceEventPayload
): Promise<GovernanceEvent> {
  const startTime = Date.now();
  const eventId = uuidv4();

  const event: GovernanceEvent = {
    eventId,
    eventType: payload.eventType,
    reason: payload.reason,
    agentId: payload.agentId,
    sessionId: payload.sessionId,
    ledgerEntryId: payload.ledgerEntryId,
    cumulativeTokens: payload.cumulativeTokens,
    cumulativeCostUsd: payload.cumulativeCostUsd,
    projectedCostUsd: payload.projectedCostUsd,
    maxTokens: payload.maxTokens,
    maxCostUsd: payload.maxCostUsd,
    timestamp: new Date(),
    latencyMs: 0,
  };

  // Record metric
  recordGovernanceEvent(payload.eventType);

  // Dispatch to all handlers asynchronously
  setImmediate(() => {
    governanceEventHandlers.forEach((handler) => {
      try {
        handler(event);
      } catch (err) {
        console.error('Error in governance event handler:', err);
      }
    });
  });

  event.latencyMs = Date.now() - startTime;

  createStructuredLog({
    event: payload.eventType,
    event_id: eventId,
    reason: payload.reason,
    agent_id: payload.agentId,
    session_id: payload.sessionId,
    ledger_entry_id: payload.ledgerEntryId,
    cumulative_tokens: payload.cumulativeTokens,
    cumulative_cost_usd: payload.cumulativeCostUsd,
    projected_cost_usd: payload.projectedCostUsd,
    max_tokens: payload.maxTokens,
    max_cost_usd: payload.maxCostUsd,
    timestamp: event.timestamp.toISOString(),
    latency_ms: event.latencyMs,
  });

  return event;
}
