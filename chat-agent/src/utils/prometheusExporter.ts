import { performanceTracker } from './performanceTracker';
import { getAlertingSystem } from './alertingSystem';

/**
 * Prometheus metrics exporter
 *
 * Converts performance metrics to Prometheus format for visualization
 * in Grafana, Prometheus, or other monitoring systems
 */

export function exportPrometheusMetrics(): string {
  const lines: string[] = [];

  // Helper: escape metric names and labels
  const escapeLabelValue = (s: string): string => {
    return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
  };

  // Get all metrics
  const allMetrics = performanceTracker.getAllMetrics();
  const summary = performanceTracker.getSummaryStats();
  const alerts = getAlertingSystem().getStats();

  // HELP and TYPE declarations
  lines.push('# HELP cic_agent_executions_total Total number of task executions');
  lines.push('# TYPE cic_agent_executions_total counter');

  lines.push('# HELP cic_agent_success_total Total successful executions');
  lines.push('# TYPE cic_agent_success_total counter');

  lines.push('# HELP cic_agent_failure_total Total failed executions');
  lines.push('# TYPE cic_agent_failure_total counter');

  lines.push('# HELP cic_agent_timeout_total Total timed-out executions');
  lines.push('# TYPE cic_agent_timeout_total counter');

  lines.push('# HELP cic_agent_rejection_total Total rejected executions');
  lines.push('# TYPE cic_agent_rejection_total counter');

  lines.push('# HELP cic_agent_duration_ms_total Total execution duration in milliseconds');
  lines.push('# TYPE cic_agent_duration_ms_total counter');

  lines.push('# HELP cic_agent_tokens_total Total tokens used');
  lines.push('# TYPE cic_agent_tokens_total counter');

  lines.push('# HELP cic_agent_cost_usd_total Total estimated cost in USD');
  lines.push('# TYPE cic_agent_cost_usd_total gauge');

  lines.push('# HELP cic_agent_success_rate Percentage of successful executions (0-100)');
  lines.push('# TYPE cic_agent_success_rate gauge');

  lines.push('# HELP cic_agent_failure_rate Percentage of failed executions (0-100)');
  lines.push('# TYPE cic_agent_failure_rate gauge');

  lines.push('# HELP cic_agent_timeout_rate Percentage of timed-out executions (0-100)');
  lines.push('# TYPE cic_agent_timeout_rate gauge');

  lines.push('# HELP cic_agent_rejection_rate Percentage of rejected executions (0-100)');
  lines.push('# TYPE cic_agent_rejection_rate gauge');

  lines.push('# HELP cic_agent_avg_duration_ms Average execution duration in milliseconds');
  lines.push('# TYPE cic_agent_avg_duration_ms gauge');

  lines.push('# HELP cic_agent_avg_tokens Average tokens per execution');
  lines.push('# TYPE cic_agent_avg_tokens gauge');

  lines.push('# HELP cic_agent_avg_cost_usd Average cost per execution in USD');
  lines.push('# TYPE cic_agent_avg_cost_usd gauge');

  lines.push('# HELP cic_agent_last_execution Timestamp of last execution');
  lines.push('# TYPE cic_agent_last_execution gauge');

  // Per-agent metrics
  lines.push('');
  for (const metrics of allMetrics) {
    const labels = `agent="${escapeLabelValue(metrics.agentRole)}"`;

    lines.push(`cic_agent_executions_total{${labels}} ${metrics.totalExecutions}`);
    lines.push(`cic_agent_success_total{${labels}} ${metrics.successCount}`);
    lines.push(`cic_agent_failure_total{${labels}} ${metrics.failureCount}`);
    lines.push(`cic_agent_timeout_total{${labels}} ${metrics.timeoutCount}`);
    lines.push(`cic_agent_rejection_total{${labels}} ${metrics.rejectionCount}`);
    lines.push(`cic_agent_duration_ms_total{${labels}} ${metrics.totalDuration}`);
    lines.push(`cic_agent_tokens_total{${labels}} ${metrics.totalTokens}`);
    lines.push(`cic_agent_cost_usd_total{${labels}} ${metrics.totalCost.toFixed(4)}`);
    lines.push(`cic_agent_success_rate{${labels}} ${metrics.successRate.toFixed(2)}`);
    lines.push(`cic_agent_failure_rate{${labels}} ${metrics.failureRate.toFixed(2)}`);
    lines.push(`cic_agent_timeout_rate{${labels}} ${metrics.timeoutRate.toFixed(2)}`);
    lines.push(`cic_agent_rejection_rate{${labels}} ${metrics.rejectionRate.toFixed(2)}`);
    lines.push(`cic_agent_avg_duration_ms{${labels}} ${metrics.avgDuration.toFixed(2)}`);
    lines.push(`cic_agent_avg_tokens{${labels}} ${metrics.avgTokens.toFixed(2)}`);
    lines.push(`cic_agent_avg_cost_usd{${labels}} ${metrics.avgCost.toFixed(6)}`);

    if (metrics.lastExecution) {
      lines.push(`cic_agent_last_execution{${labels}} ${metrics.lastExecution}`);
    }
  }

  // Global metrics
  lines.push('');
  lines.push('# HELP cic_total_executions Total executions across all agents');
  lines.push('# TYPE cic_total_executions gauge');
  lines.push(`cic_total_executions ${summary.totalExecutions}`);

  lines.push('# HELP cic_success_rate Overall success rate (0-100)');
  lines.push('# TYPE cic_success_rate gauge');
  lines.push(`cic_success_rate ${summary.successRate.toFixed(2)}`);

  lines.push('# HELP cic_avg_duration_ms Overall average duration');
  lines.push('# TYPE cic_avg_duration_ms gauge');
  lines.push(`cic_avg_duration_ms ${summary.avgDuration.toFixed(2)}`);

  lines.push('# HELP cic_avg_cost_usd Overall average cost per task');
  lines.push('# TYPE cic_avg_cost_usd gauge');
  lines.push(`cic_avg_cost_usd ${summary.avgCost.toFixed(6)}`);

  lines.push('# HELP cic_total_cost_usd Total estimated cost');
  lines.push('# TYPE cic_total_cost_usd gauge');
  lines.push(`cic_total_cost_usd ${summary.totalCost.toFixed(4)}`);

  // Alert metrics
  lines.push('');
  lines.push('# HELP cic_alerts_total Total number of alerts fired');
  lines.push('# TYPE cic_alerts_total gauge');
  lines.push(`cic_alerts_total ${alerts.totalAlerts}`);

  lines.push('# HELP cic_alerts_critical Number of critical alerts');
  lines.push('# TYPE cic_alerts_critical gauge');
  lines.push(`cic_alerts_critical ${alerts.criticalCount}`);

  lines.push('# HELP cic_alerts_warning Number of warning alerts');
  lines.push('# TYPE cic_alerts_warning gauge');
  lines.push(`cic_alerts_warning ${alerts.warningCount}`);

  lines.push('# HELP cic_alerts_info Number of info alerts');
  lines.push('# TYPE cic_alerts_info gauge');
  lines.push(`cic_alerts_info ${alerts.infoCount}`);

  lines.push('');
  return lines.join('\n') + '\n';
}

/**
 * Grafana dashboard definition
 */
export function getGrafanaDashboard(): Record<string, any> {
  return {
    dashboard: {
      title: 'CIC Agent Performance',
      description: 'Real-time monitoring of agent performance metrics',
      tags: ['cic', 'agents', 'orchestration'],
      timezone: 'browser',
      schemaVersion: 30,
      version: 1,
      panels: [
        {
          title: 'Success Rate by Agent',
          type: 'graph',
          targets: [
            {
              expr: 'cic_agent_success_rate',
              legendFormat: '{{agent}}'
            }
          ],
          gridPos: { h: 8, w: 12, x: 0, y: 0 }
        },
        {
          title: 'Average Duration by Agent',
          type: 'graph',
          targets: [
            {
              expr: 'cic_agent_avg_duration_ms',
              legendFormat: '{{agent}}'
            }
          ],
          gridPos: { h: 8, w: 12, x: 12, y: 0 }
        },
        {
          title: 'Average Cost by Agent',
          type: 'graph',
          targets: [
            {
              expr: 'cic_agent_avg_cost_usd',
              legendFormat: '{{agent}}'
            }
          ],
          gridPos: { h: 8, w: 12, x: 0, y: 8 }
        },
        {
          title: 'Failure Rate by Agent',
          type: 'graph',
          targets: [
            {
              expr: 'cic_agent_failure_rate',
              legendFormat: '{{agent}}'
            }
          ],
          gridPos: { h: 8, w: 12, x: 12, y: 8 }
        },
        {
          title: 'Overall Success Rate',
          type: 'stat',
          targets: [
            {
              expr: 'cic_success_rate'
            }
          ],
          gridPos: { h: 4, w: 6, x: 0, y: 16 }
        },
        {
          title: 'Total Cost',
          type: 'stat',
          targets: [
            {
              expr: 'cic_total_cost_usd'
            }
          ],
          gridPos: { h: 4, w: 6, x: 6, y: 16 }
        },
        {
          title: 'Active Alerts',
          type: 'stat',
          targets: [
            {
              expr: 'cic_alerts_total'
            }
          ],
          gridPos: { h: 4, w: 6, x: 12, y: 16 }
        },
        {
          title: 'Critical Alerts',
          type: 'stat',
          targets: [
            {
              expr: 'cic_alerts_critical'
            }
          ],
          gridPos: { h: 4, w: 6, x: 18, y: 16 }
        }
      ]
    }
  };
}
