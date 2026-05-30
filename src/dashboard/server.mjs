// File: src/dashboard/server.mjs | Date: 2026-05-30 | v1.0.0
import express from 'express';
import skillOptRouter from './skillopt.mjs';
import { log } from '../lib/logger.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3000;
const MODULE = 'dashboard-server';

app.use(express.json());

// Serve static files for the dashboard UI (if any)
// Assuming UI assets might be in src/dashboard/public or similar
app.use(express.static(path.join(__dirname, 'public'))); 

// Register SkillOpt API router
app.use('/api/skillopt', skillOptRouter);

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'SkillOpt Dashboard API' });
});

app.listen(PORT, () => {
  log('info', MODULE, `SkillOpt Dashboard API server listening on port ${PORT}`);
  console.log(`SkillOpt Dashboard UI (if available) can be accessed at http://localhost:${PORT}`);
});

export default app;
