// src/mcp/mcpRouter.js | 2026-05-10 | 1.0.0
/**
 * MCP Router
 * HTTP endpoints for event ingestion, agent registration, and health monitoring.
 */

import http from 'node:http';

const agentsRegistry = new Map();
const startTime = Date.now();

// Security Telemetry Aggregator
const securityStats = {
  scansTotal: 0,
  malwareDetected: 0,
  sandboxRuns: 0,
  sandboxFailures: 0,
  lastMalwareAt: null
};
const securityLog = [];
const MAX_LOG_SIZE = 50;

/**
 * Updates security stats based on incoming events.
 */
function processSecurityEvent(eventData) {
  const { event, status } = eventData;
  
  if (event === 'security.scan') {
    securityStats.scansTotal++;
    if (status === 'MALICIOUS') {
      securityStats.malwareDetected++;
      securityStats.lastMalwareAt = eventData.timestamp;
    }
  } else if (event === 'security.sandbox_run') {
    securityStats.sandboxRuns++;
    if (status === 'failed') {
      securityStats.sandboxFailures++;
    }
  }

  // Rolling log
  securityLog.unshift(eventData);
  if (securityLog.length > MAX_LOG_SIZE) {
    securityLog.pop();
  }
}

/**
 * Creates the MCP HTTP Router.
 * @param {Object} eventBus
 * @returns {import('node:http').Server}
 */
export function createMcpRouter(eventBus) {
  const service = 'mcp-router';

  const server = http.createServer(async (req, res) => {
    const { method, url } = req;
    const requestStart = Date.now();

    /**
     * Helper to read JSON body.
     */
    const readBody = () => new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(new Error('Invalid JSON'));
        }
      });
      req.on('error', reject);
    });

    /**
     * Helper to send JSON response.
     */
    const sendJson = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: status >= 400 ? 'WARN' : 'INFO',
        service,
        action: `${method} ${url}`,
        status: status >= 400 ? 'error' : 'ok',
        durationMs: Date.now() - requestStart
      }));
    };

    try {
      // POST /events
      if (method === 'POST' && url === '/events') {
        const body = await readBody();
        if (!body.event) {
          return sendJson(400, { error: 'Missing required field: event' });
        }
        
        const timestamp = body.timestamp || new Date().toISOString();
        const eventData = { ...body, timestamp };
        
        // Internal security aggregation
        if (body.event.startsWith('security.')) {
          processSecurityEvent(eventData);
        }

        eventBus.publish(eventData);
        
        return sendJson(200, { 
          received: true, 
          eventType: body.event, 
          subscriberCount: eventBus.getSubscriberCount(body.event) 
        });
      }

      // GET /security/telemetry
      if (method === 'GET' && url === '/security/telemetry') {
        return sendJson(200, {
          stats: securityStats,
          events: securityLog,
          timestamp: new Date().toISOString()
        });
      }

      // POST /agents
      if (method === 'POST' && url === '/agents') {
        const body = await readBody();
        if (!body.agentId) {
          return sendJson(400, { error: 'Missing required field: agentId' });
        }
        
        agentsRegistry.set(body.agentId, {
          ...body,
          registeredAt: new Date().toISOString()
        });
        
        return sendJson(200, { registered: true, agentId: body.agentId });
      }

      // GET /agents
      if (method === 'GET' && url === '/agents') {
        return sendJson(200, Array.from(agentsRegistry.values()));
      }

      // GET /health
      if (method === 'GET' && url === '/health') {
        return sendJson(200, {
          ok: true,
          uptime: Math.floor((Date.now() - startTime) / 1000),
          totalAgents: agentsRegistry.size,
          stats: eventBus.getStats(),
          timestamp: new Date().toISOString()
        });
      }

      // 404
      sendJson(404, { error: 'Not Found' });

    } catch (error) {
      sendJson(error.message === 'Invalid JSON' ? 400 : 500, { 
        error: error.message || 'Internal Server Error' 
      });
    }
  });

  return server;
}
