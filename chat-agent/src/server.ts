import express from 'express';
import { chatAgentRouter } from './router/chatAgentRouter';
import { orchestrationRouter } from './router/orchestrationRouter';
import { initializeRuntimes } from './runtimes/init';
import { initializeCredentialManager } from './runtimes/credentialManager';
import { initializeAlertingSystem, getAlertingSystem } from './utils/alertingSystem';
import { initializeMetricsStore, startMetricsSnapshot } from './utils/metricsStore';
import { initializeRemediationSystem, getRemediationSystem } from './utils/remediationSystem';
import { getSessionAnalytics } from './utils/sessionAnalytics';
import { policyEnforcer, createPolicyEnforcer } from './middleware/policyGate';
import { loadPolicyConfig } from './middleware/policyConfig';
import { OPENSHARING_URL, OPENSHARING_PRINCIPAL_ID } from './runtimes/config';
import { initializeEmbeddingService } from './services/EmbeddingService';
import { initializeMinIO, ensureAllBuckets } from './storage/MinioClient';
import { startMinIOHealthMonitoring, stopMinIOHealthMonitoring } from './storage/minioHealth';
import { lifecycleManager } from './storage/lifecycleManager';

const app = express();
const PORT = process.env.PORT ?? 8000;

app.use(express.json());

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174'];
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// Load policy config from environment
const policyConfig = loadPolicyConfig();
const policyMiddleware = createPolicyEnforcer(policyConfig).middleware();
app.use(policyMiddleware);

// Register routers
app.use('/', chatAgentRouter);
app.use('/orchestration', orchestrationRouter);

async function start() {
  // Initialize embedding service (OpenAI or local)
  try {
    initializeEmbeddingService();
    console.log('[EmbeddingService] Initialized');
  } catch (err) {
    console.warn('[EmbeddingService] Failed to initialize:', err instanceof Error ? err.message : String(err));
  }

  // Initialize MinIO storage
  try {
    initializeMinIO();
    await ensureAllBuckets();
    startMinIOHealthMonitoring(30000);  // Health check every 30 seconds

    // Initialize lifecycle management
    await lifecycleManager.initialize();
    await lifecycleManager.applyPolicies();

    console.log('[MinIO] Initialized with all buckets and health monitoring');
    console.log('[MinIO] Lifecycle policies applied');
  } catch (err) {
    console.warn('[MinIO] Initialization failed:', err instanceof Error ? err.message : String(err));
    console.warn('[MinIO] Continuing without MinIO. Some features may be unavailable.');
  }

  // Initialize metrics store and restore previous metrics
  await initializeMetricsStore('.cic-metrics');
  startMetricsSnapshot(15 * 60 * 1000);  // Save snapshot every 15 minutes
  console.log('[MetricsStore] Initialized with periodic snapshots');

  // Initialize alerting system
  initializeAlertingSystem({
    lowSuccessRateThreshold: 70,
    highFailureRateThreshold: 30,
    highLatencyThreshold: 5000,
    highCostThreshold: 1.0,
    checkIntervalMs: 30000
  });

  // Initialize remediation system
  initializeRemediationSystem({
    failureThreshold: 5,
    successThreshold: 3,
    circuitOpenTimeoutMs: 60000,
    rateLimit: 10,
    minExecutionsForDecision: 5
  });

  // Initialize session analytics cleanup
  getSessionAnalytics().start();
  console.log('[SessionAnalytics] Initialized with automatic cleanup');

  // Initialize credential manager for OpenSharing (if configured)
  if (OPENSHARING_URL && OPENSHARING_PRINCIPAL_ID) {
    try {
      await initializeCredentialManager(OPENSHARING_URL, OPENSHARING_PRINCIPAL_ID);
      console.log('[CredentialManager] Initialized for OpenSharing');
    } catch (err) {
      console.warn('[CredentialManager] Failed to initialize:', err instanceof Error ? err.message : String(err));
    }
  }

  await initializeRuntimes();
  const server = app.listen(PORT, () => {
    console.log(`CIC Chat Agent listening on http://localhost:${PORT}`);
    console.log(`Policy enforcement enabled:`, policyConfig);
    console.log(`Orchestration endpoints available at http://localhost:${PORT}/orchestration`);
    console.log(`Prometheus metrics available at http://localhost:${PORT}/orchestration/metrics/prometheus`);
    console.log(`Alerts available at http://localhost:${PORT}/orchestration/alerts`);
    console.log(`Historical metrics available at http://localhost:${PORT}/orchestration/metrics/history`);
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n[Server] Received ${signal}, shutting down gracefully...`);

    // Stop accepting new requests
    server.close(async () => {
      console.log('[Server] HTTP server closed');

      // Stop background processes
      policyEnforcer.stop?.();
      getAlertingSystem().stop?.();
      getRemediationSystem().stop?.();
      getSessionAnalytics().stop?.();
      stopMinIOHealthMonitoring();

      console.log('[Server] Background processes stopped');
      process.exit(0);
    });

    // Force exit after timeout
    setTimeout(() => {
      console.error('[Server] Graceful shutdown timeout, forcing exit');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
