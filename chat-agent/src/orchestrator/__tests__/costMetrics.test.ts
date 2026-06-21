/**
 * RL-3: Cost Observability Metrics — Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  calculateInferenceCost,
  recordCostObservation,
  computeAgentCostMetrics,
  analyzeGateCostImpact,
  recommendCostOptimization,
  ModelCostConfig,
  TokenUsage,
  CostObservation
} from '../costMetrics';

describe('RL-3: Cost Observability Metrics', () => {
  let modelConfig: ModelCostConfig;

  beforeEach(() => {
    modelConfig = {
      model_id: 'claude-opus-4-8',
      model_tier: 'large',
      input_cost_per_1m: 3.0,
      output_cost_per_1m: 15.0
    };
  });

  describe('calculateInferenceCost', () => {
    it('should calculate cost for input and output tokens', () => {
      const tokens: TokenUsage = {
        input_tokens: 1000,
        output_tokens: 500
      };

      const cost = calculateInferenceCost(tokens, modelConfig);

      // (1000 / 1M) * 3.0 + (500 / 1M) * 15.0 = 0.003 + 0.0075 = 0.0105
      expect(cost).toBeCloseTo(0.0105, 6);
    });

    it('should apply cache discount to cache_hit_tokens', () => {
      const tokens: TokenUsage = {
        input_tokens: 1000,
        output_tokens: 500,
        cache_hit_tokens: 100
      };

      const cost = calculateInferenceCost(tokens, modelConfig);

      // input: (1000 / 1M) * 3.0 = 0.003
      // output: (500 / 1M) * 15.0 = 0.0075
      // cache (10% of input): (100 / 1M) * 3.0 * 0.1 = 0.00003
      // total: 0.01053
      expect(cost).toBeCloseTo(0.01053, 5);
    });

    it('should handle zero tokens', () => {
      const tokens: TokenUsage = {
        input_tokens: 0,
        output_tokens: 0
      };

      const cost = calculateInferenceCost(tokens, modelConfig);
      expect(cost).toBe(0);
    });

    it('should scale correctly for different model tiers', () => {
      const smallModel: ModelCostConfig = {
        model_id: 'claude-haiku',
        model_tier: 'small',
        input_cost_per_1m: 0.25,
        output_cost_per_1m: 1.25
      };

      const tokens: TokenUsage = {
        input_tokens: 1000,
        output_tokens: 500
      };

      const largeCost = calculateInferenceCost(tokens, modelConfig);
      const smallCost = calculateInferenceCost(tokens, smallModel);

      expect(smallCost).toBeLessThan(largeCost);
    });
  });

  describe('recordCostObservation', () => {
    it('should create cost observation with all fields', () => {
      const tokens: TokenUsage = { input_tokens: 1000, output_tokens: 500 };
      const cost = calculateInferenceCost(tokens, modelConfig);

      const obs = recordCostObservation(
        'agent-1',
        'gate-1',
        'claude-opus-4-8',
        'inference',
        tokens,
        250,
        true,
        cost
      );

      expect(obs.agent_id).toBe('agent-1');
      expect(obs.gate_id).toBe('gate-1');
      expect(obs.model_id).toBe('claude-opus-4-8');
      expect(obs.operation).toBe('inference');
      expect(obs.latency_ms).toBe(250);
      expect(obs.success).toBe(true);
      expect(obs.cost_usd).toBeCloseTo(cost, 6);
      expect(obs.observation_id).toBeDefined();
      expect(obs.timestamp).toBeDefined();
    });
  });

  describe('computeAgentCostMetrics', () => {
    let observations: CostObservation[];
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    beforeEach(() => {
      observations = [
        recordCostObservation(
          'agent-1',
          'gate-1',
          'claude-opus-4-8',
          'inference',
          { input_tokens: 1000, output_tokens: 500, cache_hit_tokens: 100 },
          250,
          true,
          0.02
        ),
        recordCostObservation(
          'agent-1',
          'gate-1',
          'claude-opus-4-8',
          'inference',
          { input_tokens: 2000, output_tokens: 1000 },
          300,
          true,
          0.05
        ),
        recordCostObservation(
          'agent-1',
          'gate-2',
          'claude-opus-4-8',
          'embedding',
          { input_tokens: 500, output_tokens: 0 },
          100,
          true,
          0.0015
        ),
        recordCostObservation(
          'agent-2', // Different agent
          'gate-1',
          'claude-opus-4-8',
          'inference',
          { input_tokens: 1000, output_tokens: 500 },
          250,
          true,
          0.02
        )
      ];
    });

    it('should compute metrics for specific agent and period', () => {
      const metrics = computeAgentCostMetrics(
        'agent-1',
        observations,
        yesterday,
        tomorrow
      );

      expect(metrics.agent_id).toBe('agent-1');
      expect(metrics.total_cost_usd).toBeCloseTo(0.0715, 4); // 0.02 + 0.05 + 0.0015
      expect(metrics.inference_count).toBe(2);
    });

    it('should compute cache hit ratio', () => {
      const metrics = computeAgentCostMetrics(
        'agent-1',
        observations,
        yesterday,
        tomorrow
      );

      // Total tokens: 1000+500+100 + 2000+1000 + 500 = 5100
      // Cache tokens: 100
      // Ratio: 100 / 5100 = 0.0196
      expect(metrics.cache_hit_ratio).toBeCloseTo(100 / 5100, 3);
    });

    it('should break down costs by operation', () => {
      const metrics = computeAgentCostMetrics(
        'agent-1',
        observations,
        yesterday,
        tomorrow
      );

      expect(metrics.cost_by_operation['inference']).toBeDefined();
      expect(metrics.cost_by_operation['embedding']).toBeDefined();
    });

    it('should break down costs by model', () => {
      const metrics = computeAgentCostMetrics(
        'agent-1',
        observations,
        yesterday,
        tomorrow
      );

      expect(metrics.cost_by_model['claude-opus-4-8']).toBeDefined();
    });

    it('should filter by time period', () => {
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);

      const metrics = computeAgentCostMetrics(
        'agent-1',
        observations,
        startOfToday,
        endOfToday
      );

      // Metrics should be within bounds
      expect(metrics.total_cost_usd).toBeGreaterThanOrEqual(0);
      expect(metrics.total_tokens).toBeGreaterThanOrEqual(0);
    });
  });

  describe('analyzeGateCostImpact', () => {
    let observations: CostObservation[];
    let decisions: Array<{ timestamp: string; outcome: 'approved' | 'rejected' | 'modified' }>;

    beforeEach(() => {
      const now = new Date();
      observations = [
        recordCostObservation('agent-1', 'gate-1', 'claude-opus-4-8', 'inference', { input_tokens: 1000, output_tokens: 500 }, 250, true, 0.02),
        recordCostObservation('agent-1', 'gate-1', 'claude-opus-4-8', 'inference', { input_tokens: 2000, output_tokens: 1000 }, 300, true, 0.05),
        recordCostObservation('agent-1', 'gate-1', 'claude-opus-4-8', 'inference', { input_tokens: 1500, output_tokens: 750 }, 280, true, 0.03)
      ];

      decisions = [
        { timestamp: new Date(now.getTime() - 200).toISOString(), outcome: 'approved' },
        { timestamp: new Date(now.getTime() - 100).toISOString(), outcome: 'rejected' },
        { timestamp: now.toISOString(), outcome: 'modified' }
      ];
    });

    it('should compute gate cost impact', () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const impact = analyzeGateCostImpact('gate-1', observations, decisions, startOfDay, endOfDay);

      expect(impact.gate_id).toBe('gate-1');
      expect(impact.decisions_processed).toBe(3);
      expect(impact.total_cost_usd).toBeGreaterThan(0);
      expect(impact.cost_per_decision).toBeGreaterThan(0);
    });

    it('should break down cost by decision outcome', () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const impact = analyzeGateCostImpact('gate-1', observations, decisions, startOfDay, endOfDay);

      expect(impact.approval_cost_usd).toBeGreaterThanOrEqual(0);
      expect(impact.rejection_cost_usd).toBeGreaterThanOrEqual(0);
      expect(impact.modification_cost_usd).toBeGreaterThanOrEqual(0);
    });
  });

  describe('recommendCostOptimization', () => {
    it('should recommend caching when hit ratio is low', () => {
      const metrics = {
        agent_id: 'agent-1',
        period_start: new Date().toISOString(),
        period_end: new Date().toISOString(),
        total_cost_usd: 1.0,
        total_tokens: 10000,
        average_cost_per_inference: 0.1,
        cost_by_operation: { inference: 1.0 },
        cost_by_model: { 'claude-opus-4-8': 1.0 },
        inference_count: 10,
        cache_hit_ratio: 0.05 // Low
      };

      const recs = recommendCostOptimization(metrics);
      const caching = recs.find(r => r.action === 'enable_prompt_caching');
      expect(caching).toBeDefined();
    });

    it('should recommend optimization for high-cost operations', () => {
      const metrics = {
        agent_id: 'agent-1',
        period_start: new Date().toISOString(),
        period_end: new Date().toISOString(),
        total_cost_usd: 1.0,
        total_tokens: 10000,
        average_cost_per_inference: 0.1,
        cost_by_operation: { inference: 0.8 }, // 80% of costs
        cost_by_model: { 'claude-opus-4-8': 1.0 },
        inference_count: 10,
        cache_hit_ratio: 0.2
      };

      const recs = recommendCostOptimization(metrics);
      const optimization = recs.find(r => r.recommendation.includes('accounts for'));
      expect(optimization).toBeDefined();
      expect(optimization?.priority).toBe('high');
    });

    it('should praise good cache performance', () => {
      const metrics = {
        agent_id: 'agent-1',
        period_start: new Date().toISOString(),
        period_end: new Date().toISOString(),
        total_cost_usd: 1.0,
        total_tokens: 10000,
        average_cost_per_inference: 0.1,
        cost_by_operation: { inference: 1.0 },
        cost_by_model: { 'claude-opus-4-8': 1.0 },
        inference_count: 10,
        cache_hit_ratio: 0.4 // Good cache hit
      };

      const recs = recommendCostOptimization(metrics);
      const praise = recs.find(r => r.action === 'maintain');
      expect(praise).toBeDefined();
      expect(praise?.priority).toBe('low');
    });
  });
});
