import { Router } from 'express';
import { AutonomousOrchestrator } from '../autonomous/AutonomousOrchestrator';

export function createAutonomousRouter(orchestrator: AutonomousOrchestrator): Router {
  const router = Router();

  router.get('/autonomous/status', (_req, res) => {
    try {
      const status = orchestrator.getStatus();
      res.json(status);
    } catch (error) {
      console.error('Failed to get autonomous status:', error);
      res.status(500).json({ error: 'Failed to get status' });
    }
  });

  router.post('/autonomous/start', async (_req, res) => {
    try {
      await orchestrator.start();
      res.json({ message: 'Autonomous system started' });
    } catch (error) {
      console.error('Failed to start autonomous system:', error);
      res.status(500).json({ error: 'Failed to start' });
    }
  });

  router.post('/autonomous/stop', (_req, res) => {
    try {
      orchestrator.stop();
      res.json({ message: 'Autonomous system stopped' });
    } catch (error) {
      console.error('Failed to stop autonomous system:', error);
      res.status(500).json({ error: 'Failed to stop' });
    }
  });

  return router;
}
