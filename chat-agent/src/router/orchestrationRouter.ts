import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { orchestrator } from '../orchestrator/orchestrator';
import { performanceTracker } from '../utils/performanceTracker';
import { adaptiveRouter } from '../utils/agentSelector';
import { getAlertingSystem } from '../utils/alertingSystem';
import { exportPrometheusMetrics, getGrafanaDashboard } from '../utils/prometheusExporter';
import { getMetricsStore } from '../utils/metricsStore';
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
