import { Router } from 'express';
import { MultiAgentOrchestrator } from '../agents/MultiAgentOrchestrator';

export function createAgentsRouter(orchestrator: MultiAgentOrchestrator): Router {
  const router = Router();

  router.get('/agents/status', (_req, res) => {
    try {
      const status = orchestrator.getStatus();
      res.json(status);
    } catch (error) {
      console.error('Failed to get agents status:', error);
      res.status(500).json({ error: 'Failed to get status' });
    }
  });

  router.get('/agents/metrics', (_req, res) => {
    try {
      const metrics = orchestrator.getCollectiveMetrics();
      res.json(metrics);
    } catch (error) {
      console.error('Failed to get agents metrics:', error);
      res.status(500).json({ error: 'Failed to get metrics' });
    }
  });

  router.get('/agents/roster', (_req, res) => {
    try {
      const agents = orchestrator.getAgentStatus();
      res.json({ agents, count: agents.length });
    } catch (error) {
      console.error('Failed to get agent roster:', error);
      res.status(500).json({ error: 'Failed to get roster' });
    }
  });

  router.post('/agents/start', async (_req, res) => {
    try {
      await orchestrator.start();
      res.json({ message: 'Multi-agent system started' });
    } catch (error) {
      console.error('Failed to start agents:', error);
      res.status(500).json({ error: 'Failed to start' });
    }
  });

  router.post('/agents/stop', (_req, res) => {
    try {
      orchestrator.stop();
      res.json({ message: 'Multi-agent system stopped' });
    } catch (error) {
      console.error('Failed to stop agents:', error);
      res.status(500).json({ error: 'Failed to stop' });
    }
  });

  return router;
}
