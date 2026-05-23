// src/mcp/eventBus.js | 2026-05-10 | 1.0.0
/**
 * MCP Event Bus
 * WebSocket server for real-time event fanout.
 */

import { WebSocketServer } from 'ws';
import * as registry from './subscriptionRegistry.js';

// Global stats
let totalPublished = 0;
const eventTypeCounts = {};

/**
 * Creates and initializes the Event Bus.
 * @param {import('node:http').Server} httpServer
 * @returns {Object} EventBus instance
 */
export function createEventBus(httpServer) {
  // Spec says: Attach to same HTTP server (upgrade) OR start on WS port.
  // Runner spec says start on MCP_WS_PORT. We'll use the WS port for standalone.
  // If no httpServer is provided, we expect MCP_WS_PORT to be used in the runner.
  
  const wss = new WebSocketServer({ 
    port: process.env.MCP_WS_PORT ? parseInt(process.env.MCP_WS_PORT) : undefined,
    server: httpServer && !process.env.MCP_WS_PORT ? httpServer : undefined 
  });

  const service = 'mcp-event-bus';

  // Heartbeat mechanism
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  wss.on('connection', (ws) => {
    let clientId = null;
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'SUBSCRIBE') {
          const events = message.events || [];
          clientId = registry.register(events, ws);
          
          console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            service,
            action: 'subscribe',
            status: 'ok',
            clientId,
            events
          }));
        }
      } catch (error) {
        console.error(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'ERROR',
          service,
          action: 'processMessage',
          status: 'error',
          error: error.message
        }));
      }
    });

    ws.on('close', () => {
      if (clientId) {
        registry.unregister(clientId);
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'INFO',
          service,
          action: 'disconnect',
          status: 'ok',
          clientId
        }));
      }
    });
  });

  return {
    /**
     * Publish an event to all subscribers.
     * @param {Object} eventData
     */
    publish(eventData) {
      const eventType = eventData.event;
      if (!eventType) return;

      const subscribers = registry.getSubscribers(eventType);
      const payload = JSON.stringify({ type: 'EVENT', ...eventData });

      totalPublished++;
      eventTypeCounts[eventType] = (eventTypeCounts[eventType] || 0) + 1;

      subscribers.forEach((ws) => {
        try {
          if (ws.readyState === 1) { // OPEN
            ws.send(payload);
          }
        } catch (error) {
          console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            service,
            action: 'fanout',
            status: 'error',
            eventType,
            error: error.message
          }));
        }
      });

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service,
        action: 'publish',
        status: 'ok',
        eventType,
        subscriberCount: subscribers.length,
        timestamp: eventData.timestamp || new Date().toISOString()
      }));
    },

    getSubscriberCount(eventType) {
      return registry.getSubscribers(eventType).length;
    },

    getStats() {
      return {
        totalPublished,
        totalSubscribers: registry.getTotalCount(),
        eventTypeCounts
      };
    }
  };
}
