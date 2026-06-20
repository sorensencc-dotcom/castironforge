import express from 'express';
import { chatAgentRouter } from './router/chatAgentRouter';
import { orchestrationRouter } from './router/orchestrationRouter';
import { initializeRuntimes } from './runtimes/init';
import { initializeCredentialManager } from './runtimes/credentialManager';
import { initializeAlertingSystem } from './utils/alertingSystem';
import { policyEnforcer, createPolicyEnforcer } from './middleware/policyGate';
import { loadPolicyConfig } from './middleware/policyConfig';
import { OPENSHARING_URL, OPENSHARING_PRINCIPAL_ID } from './runtimes/config';

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
  // Initialize alerting system
  initializeAlertingSystem({
    lowSuccessRateThreshold: 70,
    highFailureRateThreshold: 30,
    highLatencyThreshold: 5000,
    highCostThreshold: 1.0,
    checkIntervalMs: 30000
  });

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
  app.listen(PORT, () => {
    console.log(`CIC Chat Agent listening on http://localhost:${PORT}`);
    console.log(`Policy enforcement enabled:`, policyConfig);
    console.log(`Orchestration endpoints available at http://localhost:${PORT}/orchestration`);
    console.log(`Prometheus metrics available at http://localhost:${PORT}/orchestration/metrics/prometheus`);
    console.log(`Alerts available at http://localhost:${PORT}/orchestration/alerts`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
