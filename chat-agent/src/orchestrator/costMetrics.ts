/**
 * RL-3: Cost Observability Metrics
 *
 * Remediation for Gap RL-3: No cost tracking per agent/gate.
 * Tracks tokens, API calls, model tiers, and per-gate cost impact.
 * Enables cost-aware orchestration and agent tier optimization.
 */

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_hit_tokens?: number; // Tokens served from cache
}

export interface ModelCostConfig {
  model_id: string;
  model_tier: 'small' | 'medium' | 'large' | 'frontier';
  input_cost_per_1m: number; // Cost per 1M input tokens in USD
  output_cost_per_1m: number; // Cost per 1M output tokens in USD
}

export interface CostObservation {
  observation_id: string;
  agent_id: string;
  gate_id: string;
  model_id: string;
  operation: 'inference' | 'embedding' | 'rerank' | 'retrieval';
  tokens_used: TokenUsage;
  latency_ms: number;
  success: boolean;
  cost_usd: number;
  timestamp: string;
}

export interface AgentCostMetrics {
  agent_id: string;
  period_start: string;
  period_end: string;
  total_cost_usd: number;
  total_tokens: number;
  average_cost_per_inference: number;
  cost_by_operation: Record<string, number>; // operation → cost_usd
  cost_by_model: Record<string, number>; // model_id → cost_usd
  inference_count: number;
  cache_hit_ratio: number;
}

export interface GateCostImpact {
  gate_id: string;
  period_start: string;
  period_end: string;
  decisions_processed: number;
  total_cost_usd: number;
  cost_per_decision: number;
  approval_cost_usd: number; // Cost when approved
  rejection_cost_usd: number; // Cost when rejected
  modification_cost_usd: number; // Cost when modified
}

/**
 * Calculate token cost for a single inference
 */
export function calculateInferenceCost(
  tokens: TokenUsage,
  modelConfig: ModelCostConfig
): number {
  const inputCost = (tokens.input_tokens / 1_000_000) * modelConfig.input_cost_per_1m;
  const outputCost = (tokens.output_tokens / 1_000_000) * modelConfig.output_cost_per_1m;
  const cacheCost = tokens.cache_hit_tokens ? (tokens.cache_hit_tokens / 1_000_000) * (modelConfig.input_cost_per_1m * 0.1) : 0; // 10% of input cost

  return inputCost + outputCost + cacheCost;
}

/**
 * Record a cost observation
 */
export function recordCostObservation(
  agentId: string,
  gateId: string,
  modelId: string,
  operation: CostObservation['operation'],
  tokens: TokenUsage,
  latency: number,
  success: boolean,
  costUsd: number
): CostObservation {
  return {
    observation_id: `cost-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    agent_id: agentId,
    gate_id: gateId,
    model_id: modelId,
    operation,
    tokens_used: tokens,
    latency_ms: latency,
    success,
    cost_usd: costUsd,
    timestamp: new Date().toISOString()
  };
}

/**
 * Compute agent cost metrics over a time period
 */
export function computeAgentCostMetrics(
  agentId: string,
  observations: CostObservation[],
  periodStart: Date,
  periodEnd: Date
): AgentCostMetrics {
  const filtered = observations.filter(
    o => o.agent_id === agentId &&
         new Date(o.timestamp) >= periodStart &&
         new Date(o.timestamp) <= periodEnd
  );

  const totalCost = filtered.reduce((sum, o) => sum + o.cost_usd, 0);
  const totalTokens = filtered.reduce((sum, o) => sum + o.tokens_used.input_tokens + o.tokens_used.output_tokens, 0);
  const totalCacheTokens = filtered.reduce((sum, o) => sum + (o.tokens_used.cache_hit_tokens || 0), 0);
  const inferenceCount = filtered.filter(o => o.operation === 'inference').length;

  // Cost by operation
  const costByOperation: Record<string, number> = {};
  for (const obs of filtered) {
    costByOperation[obs.operation] = (costByOperation[obs.operation] || 0) + obs.cost_usd;
  }

  // Cost by model
  const costByModel: Record<string, number> = {};
  for (const obs of filtered) {
    costByModel[obs.model_id] = (costByModel[obs.model_id] || 0) + obs.cost_usd;
  }

  const cacheHitRatio = filtered.length > 0
    ? totalCacheTokens / (totalTokens + totalCacheTokens)
    : 0;

  return {
    agent_id: agentId,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    total_cost_usd: totalCost,
    total_tokens: totalTokens,
    average_cost_per_inference: inferenceCount > 0 ? totalCost / inferenceCount : 0,
    cost_by_operation: costByOperation,
    cost_by_model: costByModel,
    inference_count: inferenceCount,
    cache_hit_ratio: cacheHitRatio
  };
}

/**
 * Analyze cost impact of gate decisions
 */
export function analyzeGateCostImpact(
  gateId: string,
  costObservations: CostObservation[],
  decisions: Array<{ timestamp: string; outcome: 'approved' | 'rejected' | 'modified' }>,
  periodStart: Date,
  periodEnd: Date
): GateCostImpact {
  const gateCosts = costObservations.filter(
    o => o.gate_id === gateId &&
         new Date(o.timestamp) >= periodStart &&
         new Date(o.timestamp) <= periodEnd
  );

  const totalCost = gateCosts.reduce((sum, o) => sum + o.cost_usd, 0);
  const decisionsInPeriod = decisions.filter(
    d => new Date(d.timestamp) >= periodStart &&
         new Date(d.timestamp) <= periodEnd
  );

  // Group costs by decision outcome
  const costByOutcome: Record<string, number> = { approved: 0, rejected: 0, modified: 0 };
  const countByOutcome: Record<string, number> = { approved: 0, rejected: 0, modified: 0 };

  for (const decision of decisionsInPeriod) {
    const timeWindow = 100; // milliseconds - assume cost was incurred within 100ms of decision
    const recentCosts = gateCosts.filter(
      c => Math.abs(new Date(c.timestamp).getTime() - new Date(decision.timestamp).getTime()) <= timeWindow
    );
    const costSum = recentCosts.reduce((s, c) => s + c.cost_usd, 0);

    costByOutcome[decision.outcome] += costSum;
    countByOutcome[decision.outcome]++;
  }

  return {
    gate_id: gateId,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    decisions_processed: decisionsInPeriod.length,
    total_cost_usd: totalCost,
    cost_per_decision: decisionsInPeriod.length > 0 ? totalCost / decisionsInPeriod.length : 0,
    approval_cost_usd: costByOutcome.approved,
    rejection_cost_usd: costByOutcome.rejected,
    modification_cost_usd: costByOutcome.modified
  };
}

/**
 * Cost optimization recommendation
 */
export interface CostOptimizationRecommendation {
  agent_id: string;
  recommendation: string;
  potential_savings_pct: number;
  priority: 'low' | 'medium' | 'high';
  action: string;
}

export function recommendCostOptimization(metrics: AgentCostMetrics): CostOptimizationRecommendation[] {
  const recommendations: CostOptimizationRecommendation[] = [];

  // High cache hit rate is good
  if (metrics.cache_hit_ratio > 0.3) {
    recommendations.push({
      agent_id: metrics.agent_id,
      recommendation: `Cache hit ratio is ${(metrics.cache_hit_ratio * 100).toFixed(1)}%, good caching strategy.`,
      potential_savings_pct: 0,
      priority: 'low',
      action: 'maintain'
    });
  }

  // Low cache hit rate suggests optimization opportunity
  if (metrics.cache_hit_ratio < 0.1) {
    recommendations.push({
      agent_id: metrics.agent_id,
      recommendation: 'Cache hit ratio is low. Consider implementing prompt caching or request deduplication.',
      potential_savings_pct: 5,
      priority: 'medium',
      action: 'enable_prompt_caching'
    });
  }

  // High-cost operations
  for (const [op, cost] of Object.entries(metrics.cost_by_operation)) {
    const opCostPct = (cost / metrics.total_cost_usd) * 100;
    if (opCostPct > 50) {
      recommendations.push({
        agent_id: metrics.agent_id,
        recommendation: `Operation "${op}" accounts for ${opCostPct.toFixed(1)}% of costs. Consider optimization or model tier reduction.`,
        potential_savings_pct: opCostPct > 70 ? 20 : 10,
        priority: opCostPct > 70 ? 'high' : 'medium',
        action: 'optimize_operation'
      });
    }
  }

  // Multiple expensive models
  if (Object.keys(metrics.cost_by_model).length > 2) {
    recommendations.push({
      agent_id: metrics.agent_id,
      recommendation: 'Multiple models in use. Consolidation to a single model tier could reduce costs.',
      potential_savings_pct: 10,
      priority: 'low',
      action: 'consolidate_models'
    });
  }

  return recommendations;
}
