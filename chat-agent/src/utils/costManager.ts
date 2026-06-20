import { performanceTracker } from './performanceTracker';
import type { AgentRole } from '../orchestrator/types';

/**
 * Cost budgeting and enforcement
 *
 * Tracks spending per session and enforces cost limits
 * - Hard limits: block operations that exceed budget
 * - Soft limits: warn but allow (configurable)
 * - Cost projections: estimate session cost at current burn rate
 */

export type BudgetStrategy = 'hard-limit' | 'soft-limit' | 'alert-only';

export interface BudgetConfig {
  sessionId: string;
  totalBudget: number;           // Max spend in dollars
  strategy: BudgetStrategy;       // How to enforce limit
  warningThreshold?: number;      // Warn at % of budget (default: 80%)
  projectionEnabled?: boolean;    // Enable cost projection (default: true)
  costPerToken?: Map<string, number>;  // Override per-model costs
}

export interface SessionBudget {
  sessionId: string;
  totalBudget: number;
  strategy: BudgetStrategy;
  spent: number;
  remaining: number;
  percentUsed: number;
  projectedFinalCost?: number;
  tasksExecuted: number;
  createdAt: number;
  lastActivity: number;
}

export interface BudgetAlert {
  sessionId: string;
  timestamp: number;
  type: 'warning' | 'exceeded';
  spent: number;
  budget: number;
  percentUsed: number;
  message: string;
}

export class CostManager {
  private budgets: Map<string, BudgetConfig> = new Map();
  private spent: Map<string, number> = new Map();
  private tasksPerSession: Map<string, number> = new Map();
  private createdAt: Map<string, number> = new Map();
  private alerts: BudgetAlert[] = [];
  private maxAlertsSize: number = 1000;

  /**
   * Create or update budget for session
   */
  setBudget(config: BudgetConfig): void {
    this.budgets.set(config.sessionId, {
      ...config,
      warningThreshold: config.warningThreshold ?? 80,
      projectionEnabled: config.projectionEnabled ?? true
    });

    if (!this.spent.has(config.sessionId)) {
      this.spent.set(config.sessionId, 0);
      this.tasksPerSession.set(config.sessionId, 0);
      this.createdAt.set(config.sessionId, Date.now());
    }
  }

  /**
   * Record task cost
   */
  recordCost(sessionId: string, cost: number): void {
    const current = this.spent.get(sessionId) ?? 0;
    this.spent.set(sessionId, current + cost);

    const tasks = this.tasksPerSession.get(sessionId) ?? 0;
    this.tasksPerSession.set(sessionId, tasks + 1);
  }

  /**
   * Check if operation is allowed under budget
   */
  canProceed(sessionId: string, estimatedCost: number): { allowed: boolean; reason?: string } {
    const budget = this.budgets.get(sessionId);
    if (!budget) {
      return { allowed: true };  // No budget set, allow
    }

    const currentSpent = this.spent.get(sessionId) ?? 0;
    const totalAfter = currentSpent + estimatedCost;

    if (budget.strategy === 'hard-limit') {
      if (totalAfter > budget.totalBudget) {
        return {
          allowed: false,
          reason: `Cost of $${estimatedCost.toFixed(4)} would exceed budget. Current: $${currentSpent.toFixed(2)}, Remaining: $${(budget.totalBudget - currentSpent).toFixed(2)}`
        };
      }
    } else if (budget.strategy === 'soft-limit') {
      if (totalAfter > budget.totalBudget) {
        console.warn(`[CostManager] Soft limit exceeded for ${sessionId}: $${totalAfter.toFixed(2)} > $${budget.totalBudget}`);
      }
    }

    return { allowed: true };
  }

  /**
   * Get current session budget status
   */
  getSessionBudget(sessionId: string): SessionBudget | null {
    const budget = this.budgets.get(sessionId);
    if (!budget) {
      return null;
    }

    const spent = this.spent.get(sessionId) ?? 0;
    const remaining = budget.totalBudget - spent;
    const percentUsed = (spent / budget.totalBudget) * 100;
    const tasks = this.tasksPerSession.get(sessionId) ?? 0;
    const created = this.createdAt.get(sessionId) ?? Date.now();

    // Calculate projected final cost
    let projectedFinalCost: number | undefined;
    if (budget.projectionEnabled && tasks > 0) {
      const avgCostPerTask = spent / tasks;
      const allMetrics = performanceTracker.getAllMetrics();
      const avgTasksPerSession = allMetrics.length > 0
        ? allMetrics.reduce((sum, m) => sum + m.totalExecutions, 0) / allMetrics.length
        : 5;  // Fallback estimate

      projectedFinalCost = avgCostPerTask * avgTasksPerSession;
    }

    return {
      sessionId,
      totalBudget: budget.totalBudget,
      strategy: budget.strategy,
      spent,
      remaining,
      percentUsed,
      projectedFinalCost,
      tasksExecuted: tasks,
      createdAt: created,
      lastActivity: Date.now()
    };
  }

  /**
   * Get all active budgets
   */
  getAllBudgets(): SessionBudget[] {
    const budgets: SessionBudget[] = [];

    for (const sessionId of this.budgets.keys()) {
      const budget = this.getSessionBudget(sessionId);
      if (budget) {
        budgets.push(budget);
      }
    }

    return budgets;
  }

  /**
   * Check budget and fire alerts if needed
   */
  checkBudgetHealth(sessionId: string): void {
    const budget = this.budgets.get(sessionId);
    if (!budget) {
      return;
    }

    const status = this.getSessionBudget(sessionId);
    if (!status) {
      return;
    }

    // Fire warning if approaching threshold
    if (status.percentUsed >= (budget.warningThreshold ?? 80) && status.percentUsed < 100) {
      this.fireAlert({
        sessionId,
        type: 'warning',
        spent: status.spent,
        budget: status.totalBudget,
        percentUsed: status.percentUsed
      });
    }

    // Fire exceeded alert if over budget
    if (status.percentUsed > 100) {
      this.fireAlert({
        sessionId,
        type: 'exceeded',
        spent: status.spent,
        budget: status.totalBudget,
        percentUsed: status.percentUsed
      });
    }
  }

  /**
   * Get budget alerts
   */
  getAlerts(sessionId?: string, limit?: number): BudgetAlert[] {
    let filtered = [...this.alerts];

    if (sessionId) {
      filtered = filtered.filter(a => a.sessionId === sessionId);
    }

    return filtered.slice(-(limit ?? 100)).reverse();
  }

  /**
   * Clear budget for session
   */
  clearBudget(sessionId: string): void {
    this.budgets.delete(sessionId);
    this.spent.delete(sessionId);
    this.tasksPerSession.delete(sessionId);
    this.createdAt.delete(sessionId);
  }

  /**
   * Clear all expired budgets (older than maxAge)
   */
  clearExpiredBudgets(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let cleared = 0;

    for (const [sessionId, created] of this.createdAt.entries()) {
      if (now - created > maxAgeMs) {
        this.clearBudget(sessionId);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Get cost projection for a session
   */
  projectSessionCost(sessionId: string): {
    current: number;
    projected: number;
    confidence: number;
    message: string;
  } | null {
    const status = this.getSessionBudget(sessionId);
    if (!status || status.tasksExecuted === 0) {
      return null;
    }

    const avgCostPerTask = status.spent / status.tasksExecuted;
    const allMetrics = performanceTracker.getAllMetrics();

    // Estimate typical tasks per session
    let estimatedTotalTasks = 5;
    if (allMetrics.length > 0) {
      const totalTasks = allMetrics.reduce((sum, m) => sum + m.totalExecutions, 0);
      estimatedTotalTasks = Math.ceil(totalTasks / Math.max(allMetrics.length, 1));
    }

    const projected = avgCostPerTask * estimatedTotalTasks;
    const confidence = Math.min(100, (status.tasksExecuted / estimatedTotalTasks) * 100);

    let message = `Estimated final cost: $${projected.toFixed(2)} (${confidence.toFixed(0)}% confidence)`;
    if (confidence < 50) {
      message += ' [Low confidence - more tasks needed for accurate estimate]';
    }

    return {
      current: status.spent,
      projected,
      confidence,
      message
    };
  }

  // ==================== Private Helpers ====================

  private fireAlert(alert: Omit<BudgetAlert, 'timestamp' | 'message'>): void {
    const message = alert.type === 'warning'
      ? `Session ${alert.sessionId} has used ${alert.percentUsed.toFixed(1)}% of budget ($${alert.spent.toFixed(2)}/$${alert.budget.toFixed(2)})`
      : `Session ${alert.sessionId} EXCEEDED budget: $${alert.spent.toFixed(2)} > $${alert.budget.toFixed(2)}`;

    const fullAlert: BudgetAlert = {
      ...alert,
      timestamp: Date.now(),
      message
    };

    this.alerts.push(fullAlert);

    // Keep bounded
    if (this.alerts.length > this.maxAlertsSize) {
      this.alerts = this.alerts.slice(-this.maxAlertsSize);
    }

    console.log(`[CostManager] ${message}`);
  }
}

// Singleton instance
let costManager: CostManager | null = null;

export function getCostManager(): CostManager {
  if (!costManager) {
    costManager = new CostManager();
  }
  return costManager;
}
