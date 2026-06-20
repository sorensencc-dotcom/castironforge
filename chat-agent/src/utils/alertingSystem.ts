import { performanceTracker } from './performanceTracker';
import type { AgentRole } from '../orchestrator/types';

/**
 * Alert conditions and firing
 *
 * Monitors metrics in real-time and triggers alerts when thresholds exceeded
 */

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  timestamp: number;
  severity: AlertSeverity;
  agentRole?: AgentRole;
  type: AlertType;
  message: string;
  value?: number;
  threshold?: number;
  metadata?: Record<string, any>;
}

export type AlertType =
  | 'low_success_rate'
  | 'high_failure_rate'
  | 'high_latency'
  | 'high_cost'
  | 'no_executions'
  | 'high_timeout_rate'
  | 'cascading_failure';

export interface AlertRule {
  type: AlertType;
  enabled: boolean;
  severity: AlertSeverity;
  agentSpecific: boolean;  // Per-agent or global
  condition: (metrics: any) => boolean;
  message: (metrics: any) => string;
}

export interface AlertConfig {
  lowSuccessRateThreshold?: number;        // Default: 70%
  highFailureRateThreshold?: number;       // Default: 30%
  highLatencyThreshold?: number;           // Default: 5000ms
  highCostThreshold?: number;              // Default: $1.00 per task
  highTimeoutRateThreshold?: number;       // Default: 15%
  cascadingFailureThreshold?: number;      // Default: 3 agents below 70%
  checkIntervalMs?: number;                // Default: 30 seconds
}

export class AlertingSystem {
  private alerts: Alert[] = [];
  private rules: Map<AlertType, AlertRule> = new Map();
  private config: AlertConfig;
  private maxAlertsSize: number = 1000;
  private lastAlertTime: Map<string, number> = new Map();  // Debounce duplicate alerts
  private checkInterval?: NodeJS.Timeout;

  constructor(config?: AlertConfig) {
    this.config = {
      lowSuccessRateThreshold: 70,
      highFailureRateThreshold: 30,
      highLatencyThreshold: 5000,
      highCostThreshold: 1.0,
      highTimeoutRateThreshold: 15,
      cascadingFailureThreshold: 3,
      checkIntervalMs: 30000,
      ...config
    };

    this.initializeRules();
  }

  /**
   * Start background alert checking
   */
  start(): void {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(() => {
      this.checkAllMetrics();
    }, this.config.checkIntervalMs!);

    console.log(`[AlertingSystem] Started with ${this.rules.size} rules`);
  }

  /**
   * Stop background alert checking
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
      console.log('[AlertingSystem] Stopped');
    }
  }

  /**
   * Get all active alerts
   */
  getAlerts(limit?: number, severity?: AlertSeverity): Alert[] {
    let filtered = [...this.alerts];

    if (severity) {
      filtered = filtered.filter(a => a.severity === severity);
    }

    // Return most recent
    return filtered.slice(-(limit ?? 100)).reverse();
  }

  /**
   * Clear old alerts
   */
  clearOldAlerts(olderThanMs: number): number {
    const cutoff = Date.now() - olderThanMs;
    const before = this.alerts.length;
    this.alerts = this.alerts.filter(a => a.timestamp > cutoff);
    return before - this.alerts.length;
  }

  /**
   * Manually trigger alert
   */
  fireAlert(alert: Omit<Alert, 'id' | 'timestamp'>): void {
    const key = `${alert.type}:${alert.agentRole ?? 'global'}`;
    const lastTime = this.lastAlertTime.get(key) ?? 0;
    const now = Date.now();

    // Debounce: don't fire same alert twice within 60 seconds
    if (now - lastTime < 60000) {
      return;
    }

    const id = `alert-${Date.now()}-${Math.random()}`;
    const fullAlert: Alert = {
      ...alert,
      id,
      timestamp: now
    };

    this.alerts.push(fullAlert);
    this.lastAlertTime.set(key, now);

    // Keep alerts bounded
    if (this.alerts.length > this.maxAlertsSize) {
      this.alerts = this.alerts.slice(-this.maxAlertsSize);
    }

    console.log(`[AlertingSystem] Alert [${fullAlert.severity.toUpperCase()}] ${fullAlert.type}: ${fullAlert.message}`);
  }

  /**
   * Get alert statistics
   */
  getStats(): {
    totalAlerts: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    alertsByType: Record<AlertType, number>;
  } {
    const stats = {
      totalAlerts: this.alerts.length,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      alertsByType: {} as Record<AlertType, number>
    };

    for (const alert of this.alerts) {
      if (alert.severity === 'critical') stats.criticalCount++;
      else if (alert.severity === 'warning') stats.warningCount++;
      else if (alert.severity === 'info') stats.infoCount++;

      stats.alertsByType[alert.type] = (stats.alertsByType[alert.type] ?? 0) + 1;
    }

    return stats;
  }

  // ==================== Private Helpers ====================

  private initializeRules(): void {
    this.rules.set('low_success_rate', {
      type: 'low_success_rate',
      enabled: true,
      severity: 'warning',
      agentSpecific: true,
      condition: (metrics) => metrics.successRate < this.config.lowSuccessRateThreshold!,
      message: (metrics) => `Agent ${metrics.agentRole} has low success rate: ${metrics.successRate.toFixed(1)}%`
    });

    this.rules.set('high_failure_rate', {
      type: 'high_failure_rate',
      enabled: true,
      severity: 'critical',
      agentSpecific: true,
      condition: (metrics) => metrics.failureRate > this.config.highFailureRateThreshold!,
      message: (metrics) => `Agent ${metrics.agentRole} has high failure rate: ${metrics.failureRate.toFixed(1)}%`
    });

    this.rules.set('high_latency', {
      type: 'high_latency',
      enabled: true,
      severity: 'warning',
      agentSpecific: true,
      condition: (metrics) => metrics.avgDuration > this.config.highLatencyThreshold!,
      message: (metrics) => `Agent ${metrics.agentRole} has high latency: ${metrics.avgDuration.toFixed(0)}ms`
    });

    this.rules.set('high_cost', {
      type: 'high_cost',
      enabled: true,
      severity: 'info',
      agentSpecific: true,
      condition: (metrics) => metrics.avgCost > this.config.highCostThreshold!,
      message: (metrics) => `Agent ${metrics.agentRole} has high average cost: $${metrics.avgCost.toFixed(4)}`
    });

    this.rules.set('high_timeout_rate', {
      type: 'high_timeout_rate',
      enabled: true,
      severity: 'critical',
      agentSpecific: true,
      condition: (metrics) => metrics.timeoutRate > this.config.highTimeoutRateThreshold!,
      message: (metrics) => `Agent ${metrics.agentRole} has high timeout rate: ${metrics.timeoutRate.toFixed(1)}%`
    });

    this.rules.set('no_executions', {
      type: 'no_executions',
      enabled: true,
      severity: 'info',
      agentSpecific: true,
      condition: (metrics) => metrics.totalExecutions === 0,
      message: (metrics) => `Agent ${metrics.agentRole} has no executions`
    });

    this.rules.set('cascading_failure', {
      type: 'cascading_failure',
      enabled: true,
      severity: 'critical',
      agentSpecific: false,
      condition: () => this.checkCascadingFailure(),
      message: () => `Multiple agents below ${this.config.lowSuccessRateThreshold}% success rate`
    });
  }

  private checkAllMetrics(): void {
    const allMetrics = performanceTracker.getAllMetrics();

    // Per-agent rules
    for (const metrics of allMetrics) {
      for (const rule of this.rules.values()) {
        if (!rule.enabled || !rule.agentSpecific) continue;

        if (rule.condition(metrics)) {
          this.fireAlert({
            type: rule.type,
            severity: rule.severity,
            agentRole: metrics.agentRole,
            message: rule.message(metrics),
            value: this.getMetricValue(metrics, rule.type),
            threshold: this.getThreshold(rule.type),
            metadata: { metrics }
          });
        }
      }
    }

    // Global rules
    for (const rule of this.rules.values()) {
      if (!rule.enabled || rule.agentSpecific) continue;

      if (rule.condition(null)) {
        this.fireAlert({
          type: rule.type,
          severity: rule.severity,
          message: rule.message(null),
          metadata: { allMetrics }
        });
      }
    }
  }

  private checkCascadingFailure(): boolean {
    const allMetrics = performanceTracker.getAllMetrics();
    const belowThreshold = allMetrics.filter(m => m.successRate < this.config.lowSuccessRateThreshold!).length;
    return belowThreshold >= this.config.cascadingFailureThreshold!;
  }

  private getMetricValue(metrics: any, ruleType: AlertType): number | undefined {
    switch (ruleType) {
      case 'low_success_rate':
        return metrics.successRate;
      case 'high_failure_rate':
        return metrics.failureRate;
      case 'high_latency':
        return metrics.avgDuration;
      case 'high_cost':
        return metrics.avgCost;
      case 'high_timeout_rate':
        return metrics.timeoutRate;
      default:
        return undefined;
    }
  }

  private getThreshold(ruleType: AlertType): number | undefined {
    switch (ruleType) {
      case 'low_success_rate':
        return this.config.lowSuccessRateThreshold;
      case 'high_failure_rate':
        return this.config.highFailureRateThreshold;
      case 'high_latency':
        return this.config.highLatencyThreshold;
      case 'high_cost':
        return this.config.highCostThreshold;
      case 'high_timeout_rate':
        return this.config.highTimeoutRateThreshold;
      default:
        return undefined;
    }
  }
}

// Singleton instance
let alertingSystem: AlertingSystem | null = null;

export function getAlertingSystem(): AlertingSystem {
  if (!alertingSystem) {
    alertingSystem = new AlertingSystem();
  }
  return alertingSystem;
}

export function initializeAlertingSystem(config?: AlertConfig): AlertingSystem {
  if (!alertingSystem) {
    alertingSystem = new AlertingSystem(config);
    alertingSystem.start();
  }
  return alertingSystem;
}
