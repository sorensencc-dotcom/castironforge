import { GovernanceEvent } from '../schema/types';
import { readCumulative, readRollingWindow } from '../read/readLedgerEntry';
import { createStructuredLog, logWarning, logError } from '../utils/logging';

export interface GovernanceConfig {
  maxTokens?: number;
  maxCostUsd?: number;
  warningThresholdPercent?: number;
  caustionThresholdPercent?: number;
  burstLimitTokensPer1m?: number;
}

export interface GovernanceDecision {
  shouldAbort: boolean;
  reason?: string;
  events: GovernanceEvent[];
}

type GovernanceHook = (
  agentId: string,
  sessionId: string,
  config: GovernanceConfig
) => Promise<GovernanceDecision>;

type SloControllerCallback = (event: GovernanceEvent) => Promise<void>;
type CanaryGateCallback = (event: GovernanceEvent) => Promise<void>;

let sloControllerCallbacks: SloControllerCallback[] = [];
let canaryGateCallbacks: CanaryGateCallback[] = [];
const governanceHooks: Map<string, GovernanceHook> = new Map();

export function registerGovernanceHook(name: string, hook: GovernanceHook): void {
  governanceHooks.set(name, hook);
  createStructuredLog({
    event: 'governance_hook_registered',
    hook_name: name,
  });
}

export function onSloControllerEvent(callback: SloControllerCallback): void {
  sloControllerCallbacks.push(callback);
}

export function onCanaryGateEvent(callback: CanaryGateCallback): void {
  canaryGateCallbacks.push(callback);
}

export async function checkGovernanceState(
  agentId: string,
  sessionId: string,
  config: GovernanceConfig
): Promise<GovernanceDecision> {
  const events: GovernanceEvent[] = [];
  let shouldAbort = false;
  let abortReason = '';

  // Check all registered hooks
  for (const [hookName, hook] of governanceHooks.entries()) {
    try {
      const hookResult = await hook(agentId, sessionId, config);
      events.push(...hookResult.events);
      if (hookResult.shouldAbort) {
        shouldAbort = true;
        abortReason = hookResult.reason || 'Governance hook triggered abort';
      }
    } catch (err) {
      logError(`Governance hook ${hookName} failed`, err as Error, {
        agent_id: agentId,
        session_id: sessionId,
      });
    }
  }

  // Propagate events to subscribers
  if (events.length > 0) {
    await propagateEvents(events);
  }

  return {
    shouldAbort,
    reason: abortReason,
    events,
  };
}

export async function checkBudgetExhaustion(
  agentId: string,
  sessionId: string,
  config: GovernanceConfig
): Promise<GovernanceDecision> {
  const events: GovernanceEvent[] = [];
  let shouldAbort = false;
  let abortReason = '';

  try {
    const cumulative = await readCumulative(agentId, sessionId);

    // Check token budget
    if (config.maxTokens && cumulative.cumulativeTokens > config.maxTokens) {
      shouldAbort = true;
      abortReason = 'Token budget exhausted';
      createStructuredLog({
        event: 'budget_exhaustion',
        type: 'tokens',
        agent_id: agentId,
        session_id: sessionId,
        cumulative_tokens: cumulative.cumulativeTokens,
        max_tokens: config.maxTokens,
      });
    }

    // Check cost budget
    if (config.maxCostUsd && cumulative.cumulativeCostUsd > config.maxCostUsd) {
      shouldAbort = true;
      abortReason = 'Cost budget exhausted';
      createStructuredLog({
        event: 'budget_exhaustion',
        type: 'cost',
        agent_id: agentId,
        session_id: sessionId,
        cumulative_cost_usd: cumulative.cumulativeCostUsd,
        max_cost_usd: config.maxCostUsd,
      });
    }

    // Check projected cost
    if (config.maxCostUsd && cumulative.projectedCostUsd > config.maxCostUsd) {
      shouldAbort = true;
      abortReason = 'Projected cost exceeds budget';
      createStructuredLog({
        event: 'budget_exhaustion',
        type: 'projected_cost',
        agent_id: agentId,
        session_id: sessionId,
        projected_cost_usd: cumulative.projectedCostUsd,
        max_cost_usd: config.maxCostUsd,
      });
    }
  } catch (err) {
    logError('Budget exhaustion check failed', err as Error, {
      agent_id: agentId,
      session_id: sessionId,
    });
    throw err;
  }

  return {
    shouldAbort,
    reason: abortReason,
    events,
  };
}

export async function checkThresholdWarnings(
  agentId: string,
  sessionId: string,
  config: GovernanceConfig
): Promise<GovernanceEvent[]> {
  const events: GovernanceEvent[] = [];

  try {
    const cumulative = await readCumulative(agentId, sessionId);
    const warningThreshold = config.warningThresholdPercent ?? 0.8;
    const caustionThreshold = config.caustionThresholdPercent ?? 0.7;

    if (config.maxCostUsd) {
      const warningThresholdCost = config.maxCostUsd * warningThreshold;
      const caustionThresholdCost = config.maxCostUsd * caustionThreshold;

      // Projected cost warning
      if (cumulative.projectedCostUsd > warningThresholdCost) {
        const percentConsumed = (cumulative.projectedCostUsd / config.maxCostUsd) * 100;
        createStructuredLog({
          event: 'threshold_warning',
          type: 'projected_cost',
          agent_id: agentId,
          session_id: sessionId,
          projected_cost_usd: cumulative.projectedCostUsd,
          max_cost_usd: config.maxCostUsd,
          percent_of_budget: percentConsumed,
        });
        logWarning(`Agent ${agentId} projected cost at ${percentConsumed.toFixed(1)}% of budget`);
      }

      // Cumulative cost warning
      if (cumulative.cumulativeCostUsd > caustionThresholdCost) {
        const percentConsumed = (cumulative.cumulativeCostUsd / config.maxCostUsd) * 100;
        createStructuredLog({
          event: 'threshold_warning',
          type: 'cumulative_cost',
          agent_id: agentId,
          session_id: sessionId,
          cumulative_cost_usd: cumulative.cumulativeCostUsd,
          max_cost_usd: config.maxCostUsd,
          percent_of_budget: percentConsumed,
        });
        logWarning(
          `Agent ${agentId} cumulative cost at ${percentConsumed.toFixed(1)}% of budget`
        );
      }
    }

    // Check burst limit (tokens in last 1m)
    if (config.burstLimitTokensPer1m) {
      const window1m = await readRollingWindow(agentId, 60, sessionId);
      if (window1m.totalTokens > config.burstLimitTokensPer1m) {
        createStructuredLog({
          event: 'threshold_warning',
          type: 'burst_limit',
          agent_id: agentId,
          session_id: sessionId,
          tokens_in_1m: window1m.totalTokens,
          burst_limit: config.burstLimitTokensPer1m,
        });
        logWarning(
          `Agent ${agentId} burst limit exceeded: ${window1m.totalTokens} tokens in last 1m`
        );
      }
    }
  } catch (err) {
    logError('Threshold warning check failed', err as Error, {
      agent_id: agentId,
      session_id: sessionId,
    });
  }

  return events;
}

export async function checkSloViolation(
  agentId: string,
  sessionId: string
): Promise<{ hasViolation: boolean; burnRate: number }> {
  try {
    // Calculate burn rate from rolling windows
    const window1m = await readRollingWindow(agentId, 60, sessionId);
    const window5m = await readRollingWindow(agentId, 300, sessionId);
    const window30m = await readRollingWindow(agentId, 1800, sessionId);

    // SLO targets (from WS-B documentation)
    const targets = {
      '1m': { threshold: 14 }, // > 14× burn rate triggers warning
      '5m': { threshold: 6 }, // > 6× burn rate triggers warning
      '30m': { threshold: 3 }, // > 3× burn rate triggers warning
    };

    // Calculate burn rates as cost per second
    const baseline = 0.01; // $0.01/sec baseline (configurable)
    const burnRate1m = (window1m.totalCost / 60) / baseline;
    const burnRate5m = (window5m.totalCost / 300) / baseline;
    const burnRate30m = (window30m.totalCost / 1800) / baseline;

    const hasViolation =
      burnRate1m > targets['1m'].threshold ||
      burnRate5m > targets['5m'].threshold ||
      burnRate30m > targets['30m'].threshold;

    if (hasViolation) {
      createStructuredLog({
        event: 'slo_violation',
        agent_id: agentId,
        session_id: sessionId,
        burn_rate_1m: burnRate1m,
        burn_rate_5m: burnRate5m,
        burn_rate_30m: burnRate30m,
        targets,
      });
    }

    return {
      hasViolation,
      burnRate: Math.max(burnRate1m, burnRate5m, burnRate30m),
    };
  } catch (err) {
    logError('SLO violation check failed', err as Error, {
      agent_id: agentId,
      session_id: sessionId,
    });
    return { hasViolation: false, burnRate: 0 };
  }
}

async function propagateEvents(events: GovernanceEvent[]): Promise<void> {
  // Propagate to SLO Controller
  for (const event of events) {
    if (event.eventType === 'governance_abort') {
      for (const callback of sloControllerCallbacks) {
        try {
          await callback(event);
        } catch (err) {
          logError('SLO Controller callback failed', err as Error, {
            event_id: event.eventId,
          });
        }
      }
    }
  }

  // Propagate to Canary Gates
  for (const event of events) {
    if (event.eventType === 'governance_abort') {
      for (const callback of canaryGateCallbacks) {
        try {
          await callback(event);
        } catch (err) {
          logError('Canary gate callback failed', err as Error, {
            event_id: event.eventId,
          });
        }
      }
    }
  }
}

// Register default hooks on module load
registerGovernanceHook('budget_exhaustion', async (agentId, sessionId, config) =>
  checkBudgetExhaustion(agentId, sessionId, config)
);

registerGovernanceHook('threshold_warnings', async (agentId, sessionId, config) => {
  const warningEvents = await checkThresholdWarnings(agentId, sessionId, config);
  return { shouldAbort: false, events: warningEvents };
});

registerGovernanceHook('slo_violation', async (agentId, sessionId) => {
  const { hasViolation } = await checkSloViolation(agentId, sessionId);
  return {
    shouldAbort: false,
    reason: hasViolation ? 'SLO violation detected' : undefined,
    events: [],
  };
});
