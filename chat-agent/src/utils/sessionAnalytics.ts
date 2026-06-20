import type { AgentRole } from '../orchestrator/types';

/**
 * Session analytics: per-session performance and cost tracking
 *
 * Tracks detailed metrics per session:
 * - Task counts and success rates
 * - Agent usage breakdown
 * - Cost by agent
 * - Latency statistics
 * - Error frequency
 */

export interface SessionMetrics {
  sessionId: string;
  startTime: number;
  endTime?: number;
  duration?: number;

  // Task counts
  totalTasks: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  rejectionCount: number;

  // Performance
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  p50Duration: number;  // Median
  p95Duration: number;

  // Tokens and cost
  totalTokens: number;
  avgTokensPerTask: number;
  totalCost: number;
  avgCostPerTask: number;

  // Rates
  successRate: number;
  failureRate: number;
  timeoutRate: number;
  rejectionRate: number;

  // Agent breakdown
  agentUsage: Map<AgentRole, {
    taskCount: number;
    successCount: number;
    totalDuration: number;
    totalTokens: number;
    totalCost: number;
  }>;

  // Error tracking
  errors: Array<{
    timestamp: number;
    agent: AgentRole;
    error: string;
    count: number;
  }>;

  // Status
  isActive: boolean;
}

export interface SessionSummary {
  sessionId: string;
  duration: number;
  taskCount: number;
  successRate: number;
  totalCost: number;
  primaryAgent: AgentRole;
  message: string;
}

export class SessionAnalytics {
  private sessions: Map<string, SessionMetrics> = new Map();
  private taskLog: Array<{
    sessionId: string;
    timestamp: number;
    agent: AgentRole;
    duration: number;
    tokensUsed: number;
    status: 'success' | 'failed' | 'timeout' | 'rejected';
    error?: string;
    cost: number;
  }> = [];
  private maxTaskLogSize: number = 100000;

  /**
   * Initialize session
   */
  initializeSession(sessionId: string): SessionMetrics {
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }

    const metrics: SessionMetrics = {
      sessionId,
      startTime: Date.now(),
      totalTasks: 0,
      successCount: 0,
      failureCount: 0,
      timeoutCount: 0,
      rejectionCount: 0,
      totalDuration: 0,
      avgDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      p50Duration: 0,
      p95Duration: 0,
      totalTokens: 0,
      avgTokensPerTask: 0,
      totalCost: 0,
      avgCostPerTask: 0,
      successRate: 0,
      failureRate: 0,
      timeoutRate: 0,
      rejectionRate: 0,
      agentUsage: new Map(),
      errors: [],
      isActive: true
    };

    this.sessions.set(sessionId, metrics);
    return metrics;
  }

  /**
   * Record task execution in session
   */
  recordTask(
    sessionId: string,
    agent: AgentRole,
    duration: number,
    tokensUsed: number,
    status: 'success' | 'failed' | 'timeout' | 'rejected',
    cost: number,
    error?: string
  ): void {
    let metrics = this.sessions.get(sessionId);
    if (!metrics) {
      metrics = this.initializeSession(sessionId);
    }

    // Update counts
    metrics.totalTasks++;
    switch (status) {
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

    // Update performance
    metrics.totalDuration += duration;
    metrics.minDuration = Math.min(metrics.minDuration, duration);
    metrics.maxDuration = Math.max(metrics.maxDuration, duration);
    metrics.avgDuration = metrics.totalDuration / metrics.totalTasks;

    // Update tokens and cost
    metrics.totalTokens += tokensUsed;
    metrics.avgTokensPerTask = metrics.totalTokens / metrics.totalTasks;
    metrics.totalCost += cost;
    metrics.avgCostPerTask = metrics.totalCost / metrics.totalTasks;

    // Update rates
    metrics.successRate = (metrics.successCount / metrics.totalTasks) * 100;
    metrics.failureRate = (metrics.failureCount / metrics.totalTasks) * 100;
    metrics.timeoutRate = (metrics.timeoutCount / metrics.totalTasks) * 100;
    metrics.rejectionRate = (metrics.rejectionCount / metrics.totalTasks) * 100;

    // Update agent breakdown
    let agentMetrics = metrics.agentUsage.get(agent);
    if (!agentMetrics) {
      agentMetrics = {
        taskCount: 0,
        successCount: 0,
        totalDuration: 0,
        totalTokens: 0,
        totalCost: 0
      };
      metrics.agentUsage.set(agent, agentMetrics);
    }

    agentMetrics.taskCount++;
    if (status === 'success') {
      agentMetrics.successCount++;
    }
    agentMetrics.totalDuration += duration;
    agentMetrics.totalTokens += tokensUsed;
    agentMetrics.totalCost += cost;

    // Track error
    if (error) {
      const existing = metrics.errors.find(e => e.error === error && e.agent === agent);
      if (existing) {
        existing.count++;
      } else {
        metrics.errors.push({
          timestamp: Date.now(),
          agent,
          error,
          count: 1
        });
      }
    }

    // Log task
    this.taskLog.push({
      sessionId,
      timestamp: Date.now(),
      agent,
      duration,
      tokensUsed,
      status,
      error,
      cost
    });

    // Keep log bounded
    if (this.taskLog.length > this.maxTaskLogSize) {
      this.taskLog = this.taskLog.slice(-this.maxTaskLogSize);
    }
  }

  /**
   * Close session
   */
  closeSession(sessionId: string): SessionMetrics | null {
    const metrics = this.sessions.get(sessionId);
    if (!metrics) {
      return null;
    }

    metrics.endTime = Date.now();
    metrics.duration = metrics.endTime - metrics.startTime;
    metrics.isActive = false;

    // Calculate percentiles
    const durations = this.taskLog
      .filter(t => t.sessionId === sessionId)
      .map(t => t.duration)
      .sort((a, b) => a - b);

    if (durations.length > 0) {
      metrics.p50Duration = durations[Math.floor(durations.length * 0.5)];
      metrics.p95Duration = durations[Math.floor(durations.length * 0.95)];
    }

    return metrics;
  }

  /**
   * Get session metrics
   */
  getSessionMetrics(sessionId: string): SessionMetrics | null {
    return this.sessions.get(sessionId) ?? null;
  }

  /**
   * Get session summary
   */
  getSessionSummary(sessionId: string): SessionSummary | null {
    const metrics = this.sessions.get(sessionId);
    if (!metrics) {
      return null;
    }

    // Find primary agent (most used)
    let primaryAgent: AgentRole = 'supervisor';
    let maxCount = 0;
    for (const [agent, usage] of metrics.agentUsage.entries()) {
      if (usage.taskCount > maxCount) {
        maxCount = usage.taskCount;
        primaryAgent = agent;
      }
    }

    const duration = metrics.endTime ? metrics.endTime - metrics.startTime : Date.now() - metrics.startTime;
    const message = `Session completed: ${metrics.totalTasks} tasks, ${metrics.successRate.toFixed(1)}% success, $${metrics.totalCost.toFixed(2)} cost`;

    return {
      sessionId,
      duration,
      taskCount: metrics.totalTasks,
      successRate: metrics.successRate,
      totalCost: metrics.totalCost,
      primaryAgent,
      message
    };
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): SessionMetrics[] {
    return Array.from(this.sessions.values()).filter(m => m.isActive);
  }

  /**
   * Get all sessions (active and closed)
   */
  getAllSessions(): SessionMetrics[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session task log
   */
  getSessionTaskLog(sessionId: string): Array<any> {
    return this.taskLog.filter(t => t.sessionId === sessionId);
  }

  /**
   * Compare sessions
   */
  compareSessions(sessionId1: string, sessionId2: string): {
    session1: SessionSummary | null;
    session2: SessionSummary | null;
    comparison: {
      durationDiff: number;
      taskCountDiff: number;
      successRateDiff: number;
      costDiff: number;
      message: string;
    };
  } {
    const s1 = this.getSessionSummary(sessionId1);
    const s2 = this.getSessionSummary(sessionId2);

    if (!s1 || !s2) {
      return { session1: s1, session2: s2, comparison: { durationDiff: 0, taskCountDiff: 0, successRateDiff: 0, costDiff: 0, message: 'Unable to compare' } };
    }

    const durationDiff = s2.duration - s1.duration;
    const taskCountDiff = s2.taskCount - s1.taskCount;
    const successRateDiff = s2.successRate - s1.successRate;
    const costDiff = s2.totalCost - s1.totalCost;

    const message = `Session 2 vs Session 1: ${durationDiff > 0 ? '+' : ''}${(durationDiff / 1000).toFixed(1)}s, ${taskCountDiff > 0 ? '+' : ''}${taskCountDiff} tasks, ${successRateDiff > 0 ? '+' : ''}${successRateDiff.toFixed(1)}%, $${costDiff > 0 ? '+' : ''}${costDiff.toFixed(2)}`;

    return {
      session1: s1,
      session2: s2,
      comparison: {
        durationDiff,
        taskCountDiff,
        successRateDiff,
        costDiff,
        message
      }
    };
  }

  /**
   * Get top errors in session
   */
  getTopErrors(sessionId: string, limit: number = 10): Array<any> {
    const metrics = this.sessions.get(sessionId);
    if (!metrics) {
      return [];
    }

    return metrics.errors
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Export session as JSON
   */
  exportSession(sessionId: string): any {
    const metrics = this.sessions.get(sessionId);
    if (!metrics) {
      return null;
    }

    return {
      ...metrics,
      agentUsage: Object.fromEntries(metrics.agentUsage),
      taskLog: this.getSessionTaskLog(sessionId)
    };
  }
}

// Singleton instance
let sessionAnalytics: SessionAnalytics | null = null;

export function getSessionAnalytics(): SessionAnalytics {
  if (!sessionAnalytics) {
    sessionAnalytics = new SessionAnalytics();
  }
  return sessionAnalytics;
}
