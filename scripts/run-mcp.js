// scripts/run-mcp.js | 2026-05-10 | 1.0.0
/**
 * Standalone MCP Server Runner
 * Initializes HTTP Router and WebSocket Event Bus.
 */

import { createMcpRouter } from '../src/mcp/mcpRouter.js';
import { createEventBus } from '../src/mcp/eventBus.js';

// ─── Env Validation ───────────────────────────────────────────────────────────
const REQUIRED_ENV = [
  'MCP_HTTP_PORT',
  'MCP_WS_PORT',
  'MCP_AGENT_ID'
];

for (const env of REQUIRED_ENV) {
  if (!process.env[env]) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'FATAL',
      service: 'mcp-startup',
      action: 'validateEnv',
      status: 'error',
      error: `Missing required environment variable: ${env}`
    }));
    process.exit(1);
  }
}

const {
  MCP_HTTP_PORT,
  MCP_WS_PORT,
  MCP_AGENT_ID
} = process.env;

// ─── Startup ──────────────────────────────────────────────────────────────────
async function main() {
  const service = 'castironforge-mcp';

  // In our implementation, we'll create the EventBus which starts its own WS server 
  // on MCP_WS_PORT (per the environment variables).
  const eventBus = createEventBus();

  // Create HTTP Router
  const httpServer = createMcpRouter(eventBus);

  // Start HTTP Server
  httpServer.listen(MCP_HTTP_PORT, () => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      service,
      action: 'startup',
      status: 'ok',
      httpPort: MCP_HTTP_PORT,
      wsPort: MCP_WS_PORT,
      agentId: MCP_AGENT_ID
    }));
  });

  // Handle termination
  const shutdown = () => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      service,
      action: 'shutdown',
      status: 'starting'
    }));
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(error => {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'FATAL',
    service: 'castironforge-mcp',
    action: 'main',
    status: 'error',
    error: error.message
  }));
  process.exit(1);
});
