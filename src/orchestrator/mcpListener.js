// src/orchestrator/mcpListener.js | 2026-05-10 | 1.0.0
/**
 * MCP Event Listener
 * Subscribes to asset.enriched events and triggers orchestration.
 */

import WebSocket from 'ws';
import { orchestrate } from './researchOrchestrator.js';

// Validate env vars
const REQUIRED_ENV = ['MCP_WS_URL', 'ORCHESTRATOR_AGENT_ID'];
for (const env of REQUIRED_ENV) {
  if (!process.env[env]) {
    throw new Error(`${env} environment variable is required`);
  }
}

let retryCount = 0;
const MAX_RETRIES = 5;

/**
 * Start the MCP listener.
 */
export function startListener() {
  const wsUrl = process.env.MCP_WS_URL;
  const ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    retryCount = 0;
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      agentId: process.env.ORCHESTRATOR_AGENT_ID,
      action: 'mcpListener.connect',
      status: 'ok',
      msg: 'Connected to MCP WebSocket'
    }));

    // Subscribe to asset.enriched events
    ws.send(JSON.stringify({
      action: 'subscribe',
      topic: 'asset.enriched'
    }));
  });

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        agentId: process.env.ORCHESTRATOR_AGENT_ID,
        action: 'mcpListener.message',
        status: 'ok',
        event: message.event
      }));

      if (message.event === 'asset.enriched') {
        const { assetId } = message.payload || message;
        if (assetId) {
          await orchestrate(assetId);
        }
      }
    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        agentId: process.env.ORCHESTRATOR_AGENT_ID,
        action: 'mcpListener.processMessage',
        status: 'error',
        error: error.message
      }));
    }
  });

  ws.on('close', () => {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'WARN',
      agentId: process.env.ORCHESTRATOR_AGENT_ID,
      action: 'mcpListener.close',
      status: 'disconnected'
    }));

    handleReconnect();
  });

  ws.on('error', (error) => {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      agentId: process.env.ORCHESTRATOR_AGENT_ID,
      action: 'mcpListener.error',
      status: 'error',
      error: error.message
    }));
  });
}

/**
 * Handle reconnection with exponential backoff.
 */
function handleReconnect() {
  if (retryCount >= MAX_RETRIES) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'FATAL',
      agentId: process.env.ORCHESTRATOR_AGENT_ID,
      action: 'mcpListener.reconnect',
      status: 'failed',
      msg: 'Max retries reached'
    }));
    process.exit(1);
  }

  const delay = Math.pow(2, retryCount) * 1000;
  retryCount++;

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    agentId: process.env.ORCHESTRATOR_AGENT_ID,
    action: 'mcpListener.reconnect',
    status: 'pending',
    delayMs: delay,
    retry: retryCount
  }));

  setTimeout(startListener, delay);
}
