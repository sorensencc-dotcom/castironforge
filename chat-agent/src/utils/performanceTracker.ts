import type { AgentRole } from '../orchestrator/types';

/**
 * Performance metrics for an agent
 */
export interface AgentMetrics {
  agentRole: AgentRole;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  rejectionCount: number;

  // Aggregated stats
  totalDuration: number;        // Total execution time (ms)
  totalTokens: number;          // Total tokens used
  totalCost: number;            // Total estimated cost ($)

  // Averages
  avgDuration: number;          // Average execution time (ms)
  avgTokens: number;            // Average tokens per execution
  avgCost: number;              // Average cost per execution

  // Rates
  successRate: number;          // % successful (0-100)
  failureRate: number;          // % failed (0-100)
  timeoutRate: number;          // % timeout (0-100)
  rejectionRate: number;        // % rejected (0-100)

  // Recent
  lastExecution?: number;       // Timestamp of last execution
  lastStatus?: 'success' | 'failed' | 'timeout' | 'rejected';
  lastError?: string;
}

/**
 * Historical execution record
 */
export interface ExecutionRecord {
  taskId: string;
  agentRole: AgentRole;
  model: string;
  timestamp: number;
  duration: number;
  tokensUsed: number;
  status: 'success' | 'failed' | 'timeout' | 'rejected';
  error?: string;
  estimatedCost: number;
}

/**
 * Performance tracker for agents
 */
export class PerformanceTracker {
  private metrics: Map<AgentRole, AgentMetrics> = new Map();
  private history: ExecutionRecord[] = [];
  private modelCosts: Map<string, number> = new Map();
  private maxHistorySize: number = 10000;

  constructor(modelCosts?: Map<string, number>) {
    if (modelCosts) {
      this.modelCosts = modelCosts;
    } else {
      // Default cost estimates ($ per 1M tokens)
      this.modelCosts = new Map([
        ['local:*', 0],              // Local = free
        ['cpu:*', 0],                // CPU = free
        ['sharing:gemini*', 0.075],  // Cheapest
        ['sharing:dbrx*', 0.50],
        ['databricks:*', 0.50],
        ['sharing:claude*', 3.00],   // Most expensive
        ['sharing:gpt*', 3.00]
      ]);
    }
  }

  /**
   * Record task execution
   */
  recordExecution(
    taskId: string,
    agentRole: AgentRole,
    model: string,
    duration: number,
    tokensUsed: number,
    status: 'success' | 'failed' | 'timeout' | 'rejected',
    error?: string
  ): void {
    const estimatedCost = this.estimateCost(model, tokensUsed);

    const record: ExecutionRecord = {
      taskId,
      agentRole,
      model,
      timestamp: Date.now(),
      duration,
      tokensUsed,
      status,
      error,
      estimatedCost
    };

    this.history.push(record);

    // Keep history bounded
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }

    // Update aggregated metrics
    this.updateMetrics(agentRole, record);
  }

  /**
   * Get metrics for an agent
   */
  getMetrics(agentRole: AgentRole): AgentMetrics | undefined {
    return this.metrics.get(agentRole);
  }

  /**
   * Get metrics for all agents
   */
  getAllMetrics(): AgentMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get execution history (optional filtering)
   */
  getHistory(
    agentRole?: AgentRole,
    limit: number = 100,
    status?: 'success' | 'failed' | 'timeout' | 'rejected'
  ): ExecutionRecord[] {
    let filtered = [...this.history];

    if (agentRole) {
      filtered = filtered.filter(r => r.agentRole === agentRole);
    }

    if (status) {
      filtered = filtered.filter(r => r.status === status);
    }

    // Return most recent
    return filtered.slice(-limit).reverse();
  }

  /**
   * Get summary stats
   */
  getSummaryStats(): {
    totalExecutions: number;
    successRate: number;
    avgDuration: number;
    avgCost: number;
    totalCost: number;
  } {
    const metrics = Array.from(this.metrics.values());
    const totalExecutions = metrics.reduce((sum, m) => sum + m.totalExecutions, 0);
    const totalSuccessful = metrics.reduce((sum, m) => sum + m.successCount, 0);
    const totalDuration = metrics.reduce((sum, m) => sum + m.totalDuration, 0);
    const totalCost = metrics.reduce((sum, m) => sum + m.totalCost, 0);

    return {
      totalExecutions,
      successRate: totalExecutions > 0 ? (totalSuccessful / totalExecutions) * 100 : 0,
      avgDuration: totalExecutions > 0 ? totalDuration / totalExecutions : 0,
      avgCost: totalExecutions > 0 ? totalCost / totalExecutions : 0,
      totalCost
    };
  }

  /**
   * Reset metrics for an agent
   */
  resetMetrics(agentRole: AgentRole): void {
    this.metrics.delete(agentRole);
    this.history = this.history.filter(r => r.agentRole !== agentRole);
  }

  /**
   * Reset all metrics
   */
  resetAll(): void {
    this.metrics.clear();
    this.history = [];
  }

  // ==================== Private Helpers ====================

  private updateMetrics(agentRole: AgentRole, record: ExecutionRecord): void {
    let metrics = this.metrics.get(agentRole);

    if (!metrics) {
      metrics = {
        agentRole,
        totalExecutions: 0,
        successCount: 0,
        failureCount: 0,
        timeoutCount: 0,
        rejectionCount: 0,
        totalDuration: 0,
        totalTokens: 0,
        totalCost: 0,
        avgDuration: 0,
        avgTokens: 0,
        avgCost: 0,
        successRate: 0,
        failureRate: 0,
        timeoutRate: 0,
        rejectionRate: 0
      };
    }

    // Update counts
    metrics.totalExecutions++;
    switch (record.status) {
      case 'success':
        metrics.successCount++;
        break;
      case 'failed':
        metrics.failureCount++;
        break;
      case 'timeout':
        metrics.timeoutCount++;
        break;
      case 'rejected':
        metrics.rejectionCount++;
        break;
    }

    // Update aggregates
    metrics.totalDuration += record.duration;
    metrics.totalTokens += record.tokensUsed;
    metrics.totalCost += record.estimatedCost;

    // Update averages
    metrics.avgDuration = metrics.totalDuration / metrics.totalExecutions;
    metrics.avgTokens = metrics.totalTokens / metrics.totalExecutions;
    metrics.avgCost = metrics.totalCost / metrics.totalExecutions;

    // Update rates
    metrics.successRate = (metrics.successCount / metrics.totalExecutions) * 100;
    metrics.failureRate = (metrics.failureCount / metrics.totalExecutions) * 100;
    metrics.timeoutRate = (metrics.timeoutCount / metrics.totalExecutions) * 100;
    metrics.rejectionRate = (metrics.rejectionCount / metrics.totalExecutions) * 100;

    // Update recent
    metrics.lastExecution = record.timestamp;
    metrics.lastStatus = record.status;
    if (record.error) {
      metrics.lastError = record.error;
    }

    this.metrics.set(agentRole, metrics);
  }

  private estimateCost(model: string, tokensUsed: number): number {
    // Find matching cost rate
    for (const [pattern, costPerMillion] of this.modelCosts.entries()) {
      if (this.matchesPattern(model, pattern)) {
        return (tokensUsed / 1_000_000) * costPerMillion;
      }
    }

    // Default: assume free if no match
    return 0;
  }

  private matchesPattern(model: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) {
      return model.startsWith(pattern.slice(0, -1));
    }
    return model === pattern;
  }
}

// Singleton instance
export const performanceTracker = new PerformanceTracker();
