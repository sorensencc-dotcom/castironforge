import express from 'express';
import { chatAgentRouter } from './router/chatAgentRouter';
import { orchestrationRouter } from './router/orchestrationRouter';
import { initializeRuntimes } from './runtimes/init';
import { policyEnforcer, createPolicyEnforcer } from './middleware/policyGate';
import { loadPolicyConfig } from './middleware/policyConfig';

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
  await initializeRuntimes();
  app.listen(PORT, () => {
    console.log(`CIC Chat Agent listening on http://localhost:${PORT}`);
    console.log(`Policy enforcement enabled:`, policyConfig);
    console.log(`Orchestration endpoints available at http://localhost:${PORT}/orchestration`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
