import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { orchestrator } from '../orchestrator/orchestrator';
import { performanceTracker } from '../utils/performanceTracker';
import { adaptiveRouter } from '../utils/agentSelector';
import { getAlertingSystem } from '../utils/alertingSystem';
import { exportPrometheusMetrics, getGrafanaDashboard } from '../utils/prometheusExporter';
import { getMetricsStore } from '../utils/metricsStore';
import { getCostManager } from '../utils/costManager';
import { getRemediationSystem } from '../utils/remediationSystem';
import { getSessionAnalytics } from '../utils/sessionAnalytics';
import type { TaskRequest } from '../orchestrator/types';

export const orchestrationRouter = Router();

/**
 * List all available agents
 */
orchestrationRouter.get('/agents', (req: Request, res: Response) => {
  const agents = orchestrator.listAgents();
  res.json({ agents });
});

/**
 * Get agent details
 */
orchestrationRouter.get('/agents/:role', (req: Request, res: Response) => {
  const agent = orchestrator.getAgent(req.params.role as any);
  if (!agent) {
    return res.status(404).json({ error: `Agent '${req.params.role}' not found` });
  }
  res.json({ agent });
});

/**
 * Select best agent for a task (adaptive routing)
 */
orchestrationRouter.post('/agents/select', (req: Request, res: Response) => {
  const { candidates, minSuccessRate, strategy } = req.body as {
    candidates: string[];
    minSuccessRate?: number;
    strategy?: 'cost-optimized' | 'reliability-optimized';
  };

  if (!candidates || candidates.length === 0) {
    return res.status(400).json({ error: 'Missing required field: candidates (array of agent roles)' });
  }

  const best = adaptiveRouter.selectAgent(candidates as any, { minSuccessRate, strategy });
  if (!best) {
    return res.status(404).json({ error: 'No suitable agent found matching criteria' });
  }

  res.json({ agent: best });
});

/**
 * Rank agents by performance (adaptive routing)
 */
orchestrationRouter.post('/agents/rank', (req: Request, res: Response) => {
  const { candidates, minSuccessRate, strategy } = req.body as {
    candidates: string[];
    minSuccessRate?: number;
    strategy?: 'cost-optimized' | 'reliability-optimized';
  };

  if (!candidates || candidates.length === 0) {
    return res.status(400).json({ error: 'Missing required field: candidates (array of agent roles)' });
  }

  const ranked = adaptiveRouter.rankAgents(candidates as any, { minSuccessRate, strategy });
  res.json({ agents: ranked });
});

/**
 * Execute a task via an agent
 */
orchestrationRouter.post('/tasks', async (req: Request, res: Response) => {
  const { sessionId, agent, instruction, context, priority } = req.body as {
    sessionId: string;
    agent: string;
    instruction: string;
    context?: Record<string, any>;
    priority?: number;
  };

  if (!agent || !instruction) {
    return res.status(400).json({ error: 'Missing required fields: agent, instruction' });
  }

  const taskRequest: TaskRequest = {
    taskId: randomUUID(),
    sessionId: sessionId || 'anonymous',
    agent: agent as any,
    instruction,
    context,
    priority: priority ?? 50
  };

  try {
    const result = await orchestrator.executeTask(taskRequest);
    res.json({ task: taskRequest, result });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * Get task status
 */
orchestrationRouter.get('/tasks/:taskId', (req: Request, res: Response) => {
  const result = orchestrator.getTaskResult(req.params.taskId);
  if (!result) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json({ result });
});

/**
 * List active tasks
 */
orchestrationRouter.get('/tasks', (req: Request, res: Response) => {
  const activeTasks = orchestrator.getActiveTasks();
  res.json({ activeTasks });
});

/**
 * Execute a multi-step workflow
 */
orchestrationRouter.post('/workflows/:workflowId/execute', async (req: Request, res: Response) => {
  const { workflowId } = req.params;
  const { sessionId, context } = req.body as {
    sessionId: string;
    context?: Record<string, any>;
  };

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing required field: sessionId' });
  }

  try {
    const execution = await orchestrator.executeWorkflow(workflowId, sessionId, context);
    res.json({ execution });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * Get workflow execution status
 */
orchestrationRouter.get('/workflows/:executionId', (req: Request, res: Response) => {
  const execution = orchestrator.getWorkflowExecution(req.params.executionId);
  if (!execution) {
    return res.status(404).json({ error: 'Workflow execution not found' });
  }
  res.json({ execution });
});

/**
 * Get performance metrics for an agent
 */
orchestrationRouter.get('/metrics/:agentRole', (req: Request, res: Response) => {
  const metrics = performanceTracker.getMetrics(req.params.agentRole as any);
  if (!metrics) {
    return res.status(404).json({ error: `No metrics for agent '${req.params.agentRole}'` });
  }
  res.json({ metrics });
});

/**
 * Get performance metrics for all agents
 */
orchestrationRouter.get('/metrics', (req: Request, res: Response) => {
  const allMetrics = performanceTracker.getAllMetrics();
  const summary = performanceTracker.getSummaryStats();
  res.json({ metrics: allMetrics, summary });
});

/**
 * Get execution history (with optional filtering)
 */
orchestrationRouter.get('/history', (req: Request, res: Response) => {
  const agentRole = req.query.agent as string | undefined;
  const status = req.query.status as any;
  const limit = parseInt(req.query.limit as string) || 100;

  const history = performanceTracker.getHistory(agentRole as any, limit, status);
  res.json({ history });
});

/**
 * Reset metrics
 */
orchestrationRouter.post('/metrics/reset', (req: Request, res: Response) => {
  const { agentRole } = req.body as { agentRole?: string };

  if (agentRole) {
    performanceTracker.resetMetrics(agentRole as any);
    res.json({ message: `Metrics reset for agent '${agentRole}'` });
  } else {
    performanceTracker.resetAll();
    res.json({ message: 'All metrics reset' });
  }
});

/**
 * Get active alerts
 */
orchestrationRouter.get('/alerts', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const severity = req.query.severity as any;

  const alerting = getAlertingSystem();
  const alerts = alerting.getAlerts(limit, severity);
  const stats = alerting.getStats();

  res.json({ alerts, stats });
});

/**
 * Prometheus metrics export
 */
orchestrationRouter.get('/metrics/prometheus', (req: Request, res: Response) => {
  const metrics = exportPrometheusMetrics();
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(metrics);
});

/**
 * Grafana dashboard definition
 */
orchestrationRouter.get('/dashboards/grafana', (req: Request, res: Response) => {
  const dashboard = getGrafanaDashboard();
  res.json(dashboard);
});

/**
 * Get historical metrics (with time range filtering)
 */
orchestrationRouter.get('/metrics/history', async (req: Request, res: Response) => {
  try {
    const store = getMetricsStore();
    const startTime = req.query.startTime ? parseInt(req.query.startTime as string) : undefined;
    const endTime = req.query.endTime ? parseInt(req.query.endTime as string) : undefined;
    const agent = req.query.agent as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 1000;

    const records = await store.queryHistory({
      startTime,
      endTime,
      agentRole: agent as any,
      limit
    });

    res.json({ records, count: records.length });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * Get historical statistics for a time period
 */
orchestrationRouter.get('/metrics/stats-historical', async (req: Request, res: Response) => {
  try {
    const store = getMetricsStore();
    const startTime = req.query.startTime ? parseInt(req.query.startTime as string) : undefined;
    const endTime = req.query.endTime ? parseInt(req.query.endTime as string) : undefined;
    const agent = req.query.agent as string | undefined;

    const stats = await store.getHistoricalStats({
      startTime,
      endTime,
      agentRole: agent as any
    });

    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * Analyze agent performance trend
 */
orchestrationRouter.get('/metrics/trend/:agentRole', async (req: Request, res: Response) => {
  try {
    const store = getMetricsStore();
    const windowMs = req.query.window ? parseInt(req.query.window as string) : 60 * 60 * 1000;  // 1h default

    const trend = await store.analyzeTrend(req.params.agentRole as any, windowMs);
    res.json({ trend });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * Export metrics to CSV
 */
orchestrationRouter.get('/metrics/export/csv', async (req: Request, res: Response) => {
  try {
    const store = getMetricsStore();
    const startTime = req.query.startTime ? parseInt(req.query.startTime as string) : undefined;
    const endTime = req.query.endTime ? parseInt(req.query.endTime as string) : undefined;
    const agent = req.query.agent as string | undefined;

    const csv = await store.exportToCSV({
      startTime,
      endTime,
      agentRole: agent as any
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=metrics.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * Save current metrics snapshot
 */
orchestrationRouter.post('/metrics/snapshot', async (req: Request, res: Response) => {
  try {
    const store = getMetricsStore();
    await store.saveSnapshot();
    res.json({ message: 'Metrics snapshot saved' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * Set budget for a session
 */
orchestrationRouter.post('/budgets', (req: Request, res: Response) => {
  const { sessionId, totalBudget, strategy, warningThreshold } = req.body as {
    sessionId: string;
    totalBudget: number;
    strategy?: 'hard-limit' | 'soft-limit' | 'alert-only';
    warningThreshold?: number;
  };

  if (!sessionId || totalBudget === undefined) {
    return res.status(400).json({ error: 'Missing required fields: sessionId, totalBudget' });
  }

  const costManager = getCostManager();
  costManager.setBudget({
    sessionId,
    totalBudget,
    strategy: strategy ?? 'soft-limit',
    warningThreshold: warningThreshold ?? 80,
    projectionEnabled: true
  });

  res.json({ message: `Budget of $${totalBudget} set for session '${sessionId}'` });
});

/**
 * Get budget status for a session
 */
orchestrationRouter.get('/budgets/:sessionId', (req: Request, res: Response) => {
  const costManager = getCostManager();
  const budget = costManager.getSessionBudget(req.params.sessionId);

  if (!budget) {
    return res.status(404).json({ error: `No budget set for session '${req.params.sessionId}'` });
  }

  res.json({ budget });
});

/**
 * Get all active budgets
 */
orchestrationRouter.get('/budgets', (req: Request, res: Response) => {
  const costManager = getCostManager();
  const budgets = costManager.getAllBudgets();
  res.json({ budgets });
});

/**
 * Get budget alerts
 */
orchestrationRouter.get('/budgets/alerts/active', (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

  const costManager = getCostManager();
  const alerts = costManager.getAlerts(sessionId, limit);

  res.json({ alerts, count: alerts.length });
});

/**
 * Project session cost
 */
orchestrationRouter.get('/budgets/:sessionId/projection', (req: Request, res: Response) => {
  const costManager = getCostManager();
  const projection = costManager.projectSessionCost(req.params.sessionId);

  if (!projection) {
    return res.status(404).json({ error: `No projection available for session '${req.params.sessionId}'` });
  }

  res.json({ projection });
});

/**
 * Clear budget for session
 */
orchestrationRouter.delete('/budgets/:sessionId', (req: Request, res: Response) => {
  const costManager = getCostManager();
  costManager.clearBudget(req.params.sessionId);
  res.json({ message: `Budget cleared for session '${req.params.sessionId}'` });
});

/**
 * Get circuit breaker status for agent
 */
orchestrationRouter.get('/health/circuits/:agentRole', (req: Request, res: Response) => {
  const remediationSystem = getRemediationSystem();
  const circuit = remediationSystem.getCircuitStatus(req.params.agentRole as any);

  if (!circuit) {
    return res.status(404).json({ error: `No circuit breaker for agent '${req.params.agentRole}'` });
  }

  res.json({ circuit });
});

/**
 * Get all circuit breakers
 */
orchestrationRouter.get('/health/circuits', (req: Request, res: Response) => {
  const remediationSystem = getRemediationSystem();
  const circuits = remediationSystem.getAllCircuits();
  res.json({ circuits });
});

/**
 * Get health report
 */
orchestrationRouter.get('/health/report', (req: Request, res: Response) => {
  const remediationSystem = getRemediationSystem();
  const report = remediationSystem.getHealthReport();
  res.json({ report });
});

/**
 * Manually open circuit (operator action)
 */
orchestrationRouter.post('/health/circuits/:agentRole/open', (req: Request, res: Response) => {
  const { reason } = req.body as { reason?: string };
  const remediationSystem = getRemediationSystem();

  remediationSystem.manuallyOpenCircuit(req.params.agentRole as any, reason ?? 'Manual operator action');
  res.json({ message: `Circuit opened for agent '${req.params.agentRole}'` });
});

/**
 * Manually close circuit (operator action)
 */
orchestrationRouter.post('/health/circuits/:agentRole/close', (req: Request, res: Response) => {
  const remediationSystem = getRemediationSystem();
  remediationSystem.manuallyCloseCircuit(req.params.agentRole as any);
  res.json({ message: `Circuit closed for agent '${req.params.agentRole}'` });
});

/**
 * Get remediation actions
 */
orchestrationRouter.get('/health/actions', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
  const remediationSystem = getRemediationSystem();
  const actions = remediationSystem.getActions(limit);
  res.json({ actions, count: actions.length });
});

/**
 * Get session metrics
 */
orchestrationRouter.get('/sessions/:sessionId', (req: Request, res: Response) => {
  const sessionAnalytics = getSessionAnalytics();
  const metrics = sessionAnalytics.getSessionMetrics(req.params.sessionId);

  if (!metrics) {
    return res.status(404).json({ error: `No session found: '${req.params.sessionId}'` });
  }

  res.json({ metrics });
});

/**
 * Get all sessions (active and closed)
 */
orchestrationRouter.get('/sessions', (req: Request, res: Response) => {
  const sessionAnalytics = getSessionAnalytics();
  const sessions = sessionAnalytics.getAllSessions();
  res.json({ sessions, count: sessions.length });
});

/**
 * Get active sessions only
 */
orchestrationRouter.get('/sessions/active/list', (req: Request, res: Response) => {
  const sessionAnalytics = getSessionAnalytics();
  const sessions = sessionAnalytics.getActiveSessions();
  res.json({ sessions, count: sessions.length });
});

/**
 * Get session summary
 */
orchestrationRouter.get('/sessions/:sessionId/summary', (req: Request, res: Response) => {
  const sessionAnalytics = getSessionAnalytics();
  const summary = sessionAnalytics.getSessionSummary(req.params.sessionId);

  if (!summary) {
    return res.status(404).json({ error: `No session found: '${req.params.sessionId}'` });
  }

  res.json({ summary });
});

/**
 * Close session and finalize metrics
 */
orchestrationRouter.post('/sessions/:sessionId/close', (req: Request, res: Response) => {
  const sessionAnalytics = getSessionAnalytics();
  const metrics = sessionAnalytics.closeSession(req.params.sessionId);

  if (!metrics) {
    return res.status(404).json({ error: `No session found: '${req.params.sessionId}'` });
  }

  res.json({ message: `Session '${req.params.sessionId}' closed`, metrics });
});

/**
 * Get top errors in session
 */
orchestrationRouter.get('/sessions/:sessionId/errors', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
  const sessionAnalytics = getSessionAnalytics();
  const errors = sessionAnalytics.getTopErrors(req.params.sessionId, limit);

  res.json({ errors, count: errors.length });
});

/**
 * Get session task log
 */
orchestrationRouter.get('/sessions/:sessionId/tasks', (req: Request, res: Response) => {
  const sessionAnalytics = getSessionAnalytics();
  const tasks = sessionAnalytics.getSessionTaskLog(req.params.sessionId);

  res.json({ tasks, count: tasks.length });
});

/**
 * Compare two sessions
 */
orchestrationRouter.post('/sessions/compare', (req: Request, res: Response) => {
  const { sessionId1, sessionId2 } = req.body as {
    sessionId1: string;
    sessionId2: string;
  };

  if (!sessionId1 || !sessionId2) {
    return res.status(400).json({ error: 'Missing required fields: sessionId1, sessionId2' });
  }

  const sessionAnalytics = getSessionAnalytics();
  const comparison = sessionAnalytics.compareSessions(sessionId1, sessionId2);

  res.json({ comparison });
});

/**
 * Export session as JSON
 */
orchestrationRouter.get('/sessions/:sessionId/export', (req: Request, res: Response) => {
  const sessionAnalytics = getSessionAnalytics();
  const exported = sessionAnalytics.exportSession(req.params.sessionId);

  if (!exported) {
    return res.status(404).json({ error: `No session found: '${req.params.sessionId}'` });
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=session-${req.params.sessionId}.json`);
  res.send(JSON.stringify(exported, (key, value) => {
    if (value instanceof Map) {
      return Object.fromEntries(value);
    }
    return value;
  }, 2));
});

/**
 * MinIO health status
 */
orchestrationRouter.get('/health/minio', async (_req: Request, res: Response) => {
  try {
    const { getLastHealthStatus } = await import('../storage/minioHealth');
    const status = getLastHealthStatus();

    if (!status) {
      return res.status(503).json({ error: 'MinIO health check has not run yet' });
    }

    res.status(status.status === 'healthy' ? 200 : 503).json(status);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to check MinIO health',
    });
  }
});

/**
 * MinIO metrics
 */
orchestrationRouter.get('/metrics/minio', (_req: Request, res: Response) => {
  try {
    const { minioMetricsCollector } = require('../storage/minioMetrics');
    const metrics = minioMetricsCollector.getAggregateMetrics();
    res.json({ metrics });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to retrieve MinIO metrics',
    });
  }
});
