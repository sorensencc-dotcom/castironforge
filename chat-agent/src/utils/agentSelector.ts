import { performanceTracker } from './performanceTracker';
import type { AgentRole } from '../orchestrator/types';

/**
 * Adaptive agent selector: routes tasks to best-performing agent
 *
 * Strategy: Maximize success rate while minimizing cost
 * - Filter agents by minimum success threshold (default: 70%)
 * - Among eligible agents, prefer lowest average cost
 * - Fallback to highest success rate if costs are similar
 * - Operator can specify preferred agents to restrict selection
 */

export interface SelectionCriteria {
  minSuccessRate?: number;      // Default: 70% success rate minimum
  maxAvgCost?: number;          // Default: no limit
  preferredAgents?: AgentRole[]; // If set, only consider these agents
  excludeAgents?: AgentRole[];   // Never select these agents
  strategy?: 'cost-optimized' | 'reliability-optimized';  // Default: cost-optimized
}

export interface AgentScore {
  agentRole: AgentRole;
  successRate: number;
  avgCost: number;
  avgDuration: number;
  totalExecutions: number;
  score: number;  // Composite score (lower = better)
  scoreBreakdown: {
    successPenalty: number;     // Higher failure rate = higher penalty
    costScore: number;          // Normalized cost (0-1)
    durationScore: number;      // Normalized duration (0-1)
  };
}

export class AdaptiveRouter {
  /**
   * Select best agent for a task
   */
  selectAgent(candidates: AgentRole[], criteria?: SelectionCriteria): AgentRole | null {
    const defaultCriteria: SelectionCriteria = {
      minSuccessRate: 70,
      strategy: 'cost-optimized',
      ...criteria
    };

    // Get metrics for all agents
    const allMetrics = performanceTracker.getAllMetrics();
    const metricsMap = new Map(allMetrics.map(m => [m.agentRole, m]));

    // Filter candidates
    let eligible = candidates
      .filter(role => metricsMap.has(role))
      .filter(role => !defaultCriteria.excludeAgents?.includes(role))
      .filter(role => {
        if (defaultCriteria.preferredAgents && defaultCriteria.preferredAgents.length > 0) {
          return defaultCriteria.preferredAgents.includes(role);
        }
        return true;
      });

    if (eligible.length === 0) {
      // Fallback: accept any candidate if filtering eliminated everyone
      eligible = candidates.filter(role => !defaultCriteria.excludeAgents?.includes(role));
    }

    // Score eligible agents
    const scores: AgentScore[] = eligible
      .map(role => {
        const metrics = metricsMap.get(role);
        if (!metrics) {
          return null;
        }

        // If no executions, score conservatively
        if (metrics.totalExecutions === 0) {
          return {
            agentRole: role,
            successRate: 100,  // Unknown = optimistic
            avgCost: 0,
            avgDuration: 0,
            totalExecutions: 0,
            score: 1000,  // Very high score (bad)
            scoreBreakdown: {
              successPenalty: 0,
              costScore: 0,
              durationScore: 0
            }
          };
        }

        // Filter by minimum success rate
        if (metrics.successRate < (defaultCriteria.minSuccessRate ?? 70)) {
          return {
            agentRole: role,
            successRate: metrics.successRate,
            avgCost: metrics.avgCost,
            avgDuration: metrics.avgDuration,
            totalExecutions: metrics.totalExecutions,
            score: 10000,  // Extremely high (disqualified)
            scoreBreakdown: {
              successPenalty: 10000,
              costScore: 0,
              durationScore: 0
            }
          };
        }

        // Calculate composite score
        const successPenalty = (100 - metrics.successRate) * 10;  // Higher failure rate = higher penalty
        const costScore = metrics.avgCost;  // Direct cost value
        const durationScore = metrics.avgDuration / 1000;  // Normalized to seconds

        let score: number;
        if (defaultCriteria.strategy === 'reliability-optimized') {
          // Prioritize success rate, then cost
          score = successPenalty * 2 + costScore + durationScore * 0.1;
        } else {
          // Prioritize cost, then success rate
          score = costScore * 2 + successPenalty + durationScore * 0.1;
        }

        return {
          agentRole: role,
          successRate: metrics.successRate,
          avgCost: metrics.avgCost,
          avgDuration: metrics.avgDuration,
          totalExecutions: metrics.totalExecutions,
          score,
          scoreBreakdown: {
            successPenalty,
            costScore,
            durationScore
          }
        };
      })
      .filter((s): s is AgentScore => s !== null);

    if (scores.length === 0) {
      return null;
    }

    // Sort by score (lower = better) and pick best
    scores.sort((a, b) => a.score - b.score);
    return scores[0].agentRole;
  }

  /**
   * Rank all agents by performance
   */
  rankAgents(candidates: AgentRole[], criteria?: SelectionCriteria): AgentScore[] {
    const defaultCriteria: SelectionCriteria = {
      minSuccessRate: 70,
      strategy: 'cost-optimized',
      ...criteria
    };

    const allMetrics = performanceTracker.getAllMetrics();
    const metricsMap = new Map(allMetrics.map(m => [m.agentRole, m]));

    const scores: AgentScore[] = candidates
      .filter(role => metricsMap.has(role))
      .map(role => {
        const metrics = metricsMap.get(role)!;

        if (metrics.totalExecutions === 0) {
          return {
            agentRole: role,
            successRate: 100,
            avgCost: 0,
            avgDuration: 0,
            totalExecutions: 0,
            score: 1000,
            scoreBreakdown: {
              successPenalty: 0,
              costScore: 0,
              durationScore: 0
            }
          };
        }

        const successPenalty = (100 - metrics.successRate) * 10;
        const costScore = metrics.avgCost;
        const durationScore = metrics.avgDuration / 1000;

        let score: number;
        if (defaultCriteria.strategy === 'reliability-optimized') {
          score = successPenalty * 2 + costScore + durationScore * 0.1;
        } else {
          score = costScore * 2 + successPenalty + durationScore * 0.1;
        }

        return {
          agentRole: role,
          successRate: metrics.successRate,
          avgCost: metrics.avgCost,
          avgDuration: metrics.avgDuration,
          totalExecutions: metrics.totalExecutions,
          score,
          scoreBreakdown: {
            successPenalty,
            costScore,
            durationScore
          }
        };
      });

    scores.sort((a, b) => a.score - b.score);
    return scores;
  }

  /**
   * Get explanation for agent selection
   */
  explainSelection(agentRole: AgentRole, candidates: AgentRole[], criteria?: SelectionCriteria): string {
    const allMetrics = performanceTracker.getAllMetrics();
    const metricsMap = new Map(allMetrics.map(m => [m.agentRole, m]));

    const selected = metricsMap.get(agentRole);
    if (!selected || selected.totalExecutions === 0) {
      return `Selected ${agentRole} (no historical data)`;
    }

    const ranking = this.rankAgents(candidates, criteria);
    const position = ranking.findIndex(s => s.agentRole === agentRole) + 1;

    return (
      `Selected ${agentRole} (rank ${position}/${ranking.length}): ` +
      `${selected.successRate.toFixed(1)}% success, ` +
      `$${selected.avgCost.toFixed(4)}/task, ` +
      `${selected.avgDuration.toFixed(0)}ms avg. ` +
      `(Score: ${ranking[0].score.toFixed(2)})`
    );
  }
}

// Singleton instance
export const adaptiveRouter = new AdaptiveRouter();
