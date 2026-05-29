// filename: scripts/run-audit.js
// date: 2026-05-10
// version: 1.0.0

import http from 'node:http';
import Database from 'better-sqlite3';
import { handleEvent } from '../src/audit/auditAgent.js';
import { setDatabase, getMigration, getRecordsByAsset, verifyIntegrity } from '../src/audit/auditStore.js';

const REQUIRED_ENV = [
  'DATABASE_URL',
  'MCP_BASE_URL',
  'MCP_WS_URL',
  'AUDIT_AGENT_ID',
  'AUDIT_PORT'
];

const EVENT_SUBSCRIPTIONS = [
  'asset.ingested',
  'asset.enriched',
  'orchestration.complete',
  'synthesis.complete'
];

/**
 * Logs structured JSON to stdout.
 */
function log(level, action, status, extra = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    agentId: process.env.AUDIT_AGENT_ID || 'startup',
    action,
    status,
    ...extra
  };
  process.stdout.write(JSON.stringify(logEntry) + '\n');
}

async function run() {
  try {
    // 1. Validate Env
    for (const env of REQUIRED_ENV) {
      if (!process.env[env]) {
        console.error(`FATAL: Missing environment variable: ${env}`);
        process.exit(1);
      }
    }

    const config = {
      dbPath: process.env.DATABASE_URL,
      mcpBaseUrl: process.env.MCP_BASE_URL,
      mcpWsUrl: process.env.MCP_WS_URL,
      agentId: process.env.AUDIT_AGENT_ID,
      port: parseInt(process.env.AUDIT_PORT, 10)
    };

    // 2. Initialize DB
    const db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
    db.exec(getMigration());
    setDatabase(db);
    log('INFO', 'init_db', 'ok', { dbPath: config.dbPath });

    // 3. Register with MCP
    const registration = {
      agentId: config.agentId,
      type: 'audit',
      version: '1.0.0',
      endpoint: `http://localhost:${config.port}`
    };

    try {
      const res = await fetch(`${config.mcpBaseUrl}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registration)
      });
      if (!res.ok) log('WARN', 'register_mcp', 'error', { status: res.status });
      else log('INFO', 'register_mcp', 'ok');
    } catch (err) {
      log('ERROR', 'register_mcp', 'error', { error: err.message });
    }

    // 4. WebSocket Connection & Subscription
    if (typeof WebSocket === 'undefined') {
      log('ERROR', 'websocket', 'error', { error: 'Global WebSocket not found.' });
    } else {
      const ws = new WebSocket(config.mcpWsUrl);
      
      ws.onopen = () => {
        log('INFO', 'ws_connect', 'ok', { url: config.mcpWsUrl });
        EVENT_SUBSCRIPTIONS.forEach(topic => {
          ws.send(JSON.stringify({ action: 'subscribe', topic }));
        });
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (EVENT_SUBSCRIPTIONS.includes(data.event)) {
            await handleEvent(data);
          }
        } catch (err) {
          log('ERROR', 'ws_message', 'error', { error: err.message });
        }
      };

      ws.onerror = (err) => log('ERROR', 'ws_error', 'error', { error: err.message });
      ws.onclose = () => log('WARN', 'ws_close', 'disconnected');
    }

    // 5. Start HTTP Server
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      
      if (url.pathname === '/health' && req.method === 'GET') {
        // Query total records and anomalies for health
        const stats = db.prepare('SELECT count(*) as total FROM audit_log').get();
        // Simplified anomaly count: query MCP alerts in audit log if tracked, 
        // or just return system stats.
        res.writeHead(200, { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          ok: true,
          agentId: config.agentId,
          totalRecords: stats.total,
          uptime: process.uptime(),
          timestamp: new Date().toISOString()
        }));
        return;
      }

      if (url.pathname.startsWith('/audit/') && req.method === 'GET') {
        const assetId = url.pathname.split('/')[2];
        const records = await getRecordsByAsset(assetId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(records));
        return;
      }

      if (url.pathname.startsWith('/integrity/') && req.method === 'GET') {
        const recordId = url.pathname.split('/')[2];
        const result = await verifyIntegrity(recordId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }

      res.writeHead(404);
      res.end();
    });

    server.listen(config.port, () => {
      log('INFO', 'server_started', 'ok', { port: config.port });
    });

  } catch (err) {
    log('FATAL', 'startup', 'error', { error: err.message });
    process.exit(1);
  }
}

run();
