import { Router } from 'express';
import { DistributedMinIOOrchestrator } from '../storage/distributed/DistributedMinIOOrchestrator';

export function createDistributedStorageRouter(
  orchestrator: DistributedMinIOOrchestrator
): Router {
  const router = Router();

  router.get('/distributed-storage/status', (_req, res) => {
    try {
      const status = orchestrator.getStatus();
      res.json(status);
    } catch (error) {
      console.error('Failed to get distributed storage status:', error);
      res.status(500).json({ error: 'Failed to get status' });
    }
  });

  router.get('/distributed-storage/health', async (_req, res) => {
    try {
      const failoverManager = orchestrator.getFailoverManager();
      const status = failoverManager.getStatus();
      res.json(status);
    } catch (error) {
      console.error('Failed to get health:', error);
      res.status(500).json({ error: 'Failed to get health' });
    }
  });

  router.get('/distributed-storage/replication', (_req, res) => {
    try {
      const replicationEngine = orchestrator.getReplicationEngine();
      const status = replicationEngine.getSyncStatus();
      const pending = replicationEngine.getPendingEventCount();

      res.json({
        syncStatus: status,
        pendingEvents: pending,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Failed to get replication status:', error);
      res.status(500).json({ error: 'Failed to get replication status' });
    }
  });

  router.get('/distributed-storage/metrics', (_req, res) => {
    try {
      const metricsCollector = orchestrator.getMetricsCollector();
      const latest = metricsCollector.getLatestMetrics();
      const history = metricsCollector.getMetricsHistory(10);

      res.json({
        latest,
        history,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Failed to get metrics:', error);
      res.status(500).json({ error: 'Failed to get metrics' });
    }
  });

  router.get('/distributed-storage/active-dc', (_req, res) => {
    try {
      const minioClient = orchestrator.getMinIOClient();
      const activeDC = minioClient.getActiveDC();
      const health = minioClient.getHealthStatus();

      res.json({
        activeDC,
        health,
        isHealthy: minioClient.isHealthy(),
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Failed to get active DC:', error);
      res.status(500).json({ error: 'Failed to get active DC' });
    }
  });

  return router;
}
