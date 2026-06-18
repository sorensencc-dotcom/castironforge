import express from 'express';
import { chatAgentRouter } from './router/chatAgentRouter';
import { initializeExclusionAgent, shutdownExclusionAgent } from './exclusion/integration';

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

app.use('/', chatAgentRouter);

const server = app.listen(PORT, async () => {
  console.log(`CIC Chat Agent listening on http://localhost:${PORT}`);

  // Initialize ExclusionAgent
  try {
    await initializeExclusionAgent();
  } catch (err) {
    console.error('Failed to initialize ExclusionAgent:', err);
    console.warn('Chat agent is running but ExclusionAgent endpoints will return 503');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  shutdownExclusionAgent();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  shutdownExclusionAgent();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
