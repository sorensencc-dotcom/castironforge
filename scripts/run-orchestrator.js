// scripts/run-orchestrator.js | 2026-05-10 | 1.0.0
/**
 * Research Orchestrator Runner
 * Entry point for the agent. Registers with MCP, starts listener and health server.
 */

import http from 'node:http';
import Database from 'better-sqlite3';
import { startListener } from '../src/orchestrator/mcpListener.js';
import * as entityGraph from '../src/orchestrator/entityGraph.js';
import * as timelineBuilder from '../src/orchestrator/timelineBuilder.js';

const startTime = Date.now();

// ─── Env Validation ───────────────────────────────────────────────────────────
const REQUIRED_ENV = [
  'DATABASE_URL',
  'MCP_BASE_URL',
  'MCP_WS_URL',
  'ORCHESTRATOR_AGENT_ID',
  'ORCHESTRATOR_PORT'
];

for (const env of REQUIRED_ENV) {
  if (!process.env[env]) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'FATAL',
      action: 'startup',
      status: 'error',
      error: `Missing required environment variable: ${env}`
    }));
    process.exit(1);
  }
}

const {
  DATABASE_URL,
  MCP_BASE_URL,
  ORCHESTRATOR_AGENT_ID,
  ORCHESTRATOR_PORT
} = process.env;

// ─── DB Migrations ────────────────────────────────────────────────────────────
async function runMigrations() {
  const dbPath = DATABASE_URL.replace('sqlite://', '');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  
  try {
    db.exec(entityGraph.getMigration());
    db.exec(timelineBuilder.getMigration());
    
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      agentId: ORCHESTRATOR_AGENT_ID,
      action: 'migrations',
      status: 'ok'
    }));
  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'FATAL',
      agentId: ORCHESTRATOR_AGENT_ID,
      action: 'migrations',
      status: 'error',
      error: error.message
    }));
    process.exit(1);
  } finally {
    db.close();
  }
}

// ─── MCP Registration ─────────────────────────────────────────────────────────
async function registerAgent() {
  const url = new URL(`${MCP_BASE_URL}/agents`);
  const payload = JSON.stringify({
    agentId: ORCHESTRATOR_AGENT_ID,
    type: 'orchestrator',
    version: '1.0.0'
  });

  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        resolve();
      } else {
        reject(new Error(`MCP registration failed: HTTP ${res.statusCode}`));
      }
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ─── Health Server ────────────────────────────────────────────────────────────
function startHealthServer() {
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        agentId: ORCHESTRATOR_AGENT_ID,
        uptime: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString()
      }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(ORCHESTRATOR_PORT, () => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      agentId: ORCHESTRATOR_AGENT_ID,
      action: 'healthServer.start',
      status: 'ok',
      port: ORCHESTRATOR_PORT
    }));
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    agentId: ORCHESTRATOR_AGENT_ID,
    action: 'startup',
    status: 'starting'
  }));

  await runMigrations();
  
  try {
    await registerAgent();
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      agentId: ORCHESTRATOR_AGENT_ID,
      action: 'mcp.registration',
      status: 'ok'
    }));
  } catch (error) {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'WARN',
      agentId: ORCHESTRATOR_AGENT_ID,
      action: 'mcp.registration',
      status: 'failed',
      error: error.message
    }));
    // We continue even if registration fails, as MCP might be down temporarily
  }

  startHealthServer();
  startListener();

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    agentId: ORCHESTRATOR_AGENT_ID,
    action: 'startup',
    status: 'ready',
    version: '1.0.0'
  }));
}

main().catch(error => {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'FATAL',
    agentId: ORCHESTRATOR_AGENT_ID,
    action: 'main',
    status: 'error',
    error: error.message
  }));
  process.exit(1);
});
