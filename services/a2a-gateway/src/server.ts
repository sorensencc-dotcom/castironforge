/**
 * A2A Gateway Server
 *
 * Express server implementing the A2A Protocol v0.3 interface as a gateway
 * between CIC Mesh and external A2A-compatible agents.
 *
 * Gap I-2 Remediation: Event Bus ≠ A2A — cross-team agent isolation
 */

import express, { Request, Response } from 'express';
import { translator } from './translator.js';
import type { A2ATask, A2AInputProvided, GatewayConfig, A2AAgentCard } from './types.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;

const config: GatewayConfig = {
  port: PORT,
  log_level: process.env.GATEWAY_LOG_LEVEL || 'info',
  event_bus_url: process.env.EVENT_BUS_URL || 'redis://localhost:6379',
  a2a_version: process.env.A2A_VERSION || '0.3',
  max_task_duration_seconds: parseInt(process.env.MAX_TASK_DURATION_SECONDS || '86400', 10),
  health_check_interval: 30000
};

// Middleware
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

/* ============== Agent Card Endpoint ============== */

app.get('/.well-known/agent.json', (req: Request, res: Response) => {
  const agentCard: A2AAgentCard = {
    agent_id: 'a2a-gateway',
    display_name: 'CIC Mesh A2A Gateway',
    description: 'Interoperability gateway exposing CIC Mesh workflows to external A2A-compatible agents',
    version: '1.1.0',
    layer: 'orchestrator',
    capabilities: {
      input_types: ['application/json', 'application/vnd.a2a.task+json'],
      output_types: ['application/json', 'application/vnd.a2a.artifact+json'],
      runtime_profiles: ['FAST', 'BALANCED', 'THOROUGH', 'SCHEDULED', 'SAFE']
    },
    endpoints: {
      health: '/health',
      metrics: '/metrics',
      a2a: '/a2a/v1'
    },
    well_known_url: '/.well-known/agent.json'
  };

  res.json(agentCard);
});

/* ============== Health & Metrics Endpoints ============== */

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.1.0',
    a2a_protocol_version: config.a2a_version,
    event_bus: config.event_bus_url,
    uptime_seconds: process.uptime()
  });
});

app.get('/metrics', (req: Request, res: Response) => {
  res.json({
    active_tasks: translator['taskStates']?.size || 0,
    timestamp: new Date().toISOString(),
    gateway_uptime_ms: process.uptime() * 1000
  });
});

/* ============== A2A Task Submission Endpoint ============== */

/**
 * POST /a2a/v1/tasks
 * Accept inbound A2A Task submissions and translate to CIC Mesh workflow
 */
app.post('/a2a/v1/tasks', (req: Request, res: Response) => {
  try {
    const a2aTask = req.body as A2ATask;

    if (!a2aTask.id || !a2aTask.agentId) {
      return res.status(400).json({
        error: 'Invalid A2A Task: missing required fields (id, agentId)'
      });
    }

    // Translate A2A Task to CIC Mesh event
    const { event, state } = translator.translateA2ATaskToCICEvent(a2aTask);

    console.log(`[A2A Gateway] Inbound task: A2A=${a2aTask.id} → CIC=${event.workflow_id}`);

    // TODO: Publish event to CIC Mesh Event Bus
    // EventBus.publish(event);

    res.status(202).json({
      id: state.a2a_task_id,
      cicWorkflowId: state.cic_workflow_id,
      status: 'working',
      createdAt: state.created_at,
      streamUrl: `/a2a/v1/tasks/${state.a2a_task_id}/stream`
    });
  } catch (err) {
    console.error('[A2A Gateway] Task submission error:', err);
    res.status(500).json({ error: 'Task submission failed' });
  }
});

/* ============== A2A Task Status Streaming Endpoint ============== */

/**
 * GET /a2a/v1/tasks/:taskId/stream
 * Server-Sent Events stream for task progress updates
 */
app.get('/a2a/v1/tasks/:taskId/stream', (req: Request, res: Response) => {
  const { taskId } = req.params;

  const state = translator.findStateByA2ATaskId(taskId);
  if (!state) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial connection message
  res.write(
    `data: ${JSON.stringify({
      type: 'connected',
      taskId,
      cicWorkflowId: state.cic_workflow_id,
      timestamp: new Date().toISOString()
    })}\n\n`
  );

  // Create SSE sender function
  const sender = (data: string) => {
    try {
      res.write(data);
    } catch (err) {
      console.error('[A2A Gateway] SSE write error:', err);
    }
  };

  // Register client
  translator.registerSSEClient(state.cic_workflow_id, sender);

  // Cleanup on disconnect
  req.on('close', () => {
    translator.unregisterSSEClient(state.cic_workflow_id, sender);
    res.end();
  });
});

/* ============== A2A Input Provided Endpoint ============== */

/**
 * POST /a2a/v1/tasks/:taskId/input
 * External clients provide input to resolve HITL gates
 */
app.post('/a2a/v1/tasks/:taskId/input', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const inputProvided = req.body as A2AInputProvided;

    const state = translator.findStateByA2ATaskId(taskId);
    if (!state) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (!state.open_gate) {
      return res.status(400).json({ error: 'Task is not awaiting input' });
    }

    // Translate A2A InputProvided to CIC Mesh event
    const event = translator.translateA2AInputProvidedToCICEvent(taskId, inputProvided.input);
    if (!event) {
      return res.status(500).json({ error: 'Failed to translate input' });
    }

    console.log(`[A2A Gateway] Input provided for task: ${taskId}`);

    // TODO: Publish event to CIC Mesh Event Bus
    // EventBus.publish(event);

    // Update state
    translator.updateStateStatus(state.cic_workflow_id, 'working');
    state.open_gate = undefined;

    res.json({
      status: 'input-accepted',
      taskId,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[A2A Gateway] Input provision error:', err);
    res.status(500).json({ error: 'Failed to process input' });
  }
});

/* ============== A2A Task Cancellation Endpoint ============== */

/**
 * POST /a2a/v1/tasks/:taskId/cancel
 * External clients can request cancellation of a task
 */
app.post('/a2a/v1/tasks/:taskId/cancel', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;

    const state = translator.findStateByA2ATaskId(taskId);
    if (!state) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Translate A2A cancellation to CIC Mesh event
    const event = translator.translateA2ACancellationToCICEvent(taskId);
    if (!event) {
      return res.status(500).json({ error: 'Failed to translate cancellation' });
    }

    console.log(`[A2A Gateway] Cancellation requested for task: ${taskId}`);

    // TODO: Publish event to CIC Mesh Event Bus
    // EventBus.publish(event);

    // Update state
    translator.updateStateStatus(state.cic_workflow_id, 'cancelled');

    res.json({
      status: 'cancellation-requested',
      taskId,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[A2A Gateway] Cancellation error:', err);
    res.status(500).json({ error: 'Failed to process cancellation' });
  }
});

/* ============== Periodic Cleanup ============== */

setInterval(() => {
  translator.cleanupExpiredTasks();
}, config.health_check_interval);

/* ============== Server Startup ============== */

async function start(): Promise<void> {
  const server = app.listen(config.port, () => {
    console.log(`[A2A Gateway] Listening on port ${config.port}`);
    console.log(`[A2A Gateway] A2A Protocol: v${config.a2a_version}`);
    console.log(`[A2A Gateway] Event Bus: ${config.event_bus_url}`);
    console.log(`[A2A Gateway] Health check: GET /health`);
    console.log(`[A2A Gateway] Agent card: GET /.well-known/agent.json`);
    console.log(`[A2A Gateway] A2A endpoint: POST /a2a/v1/tasks`);
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n[A2A Gateway] Received ${signal}, shutting down gracefully...`);

    server.close(async () => {
      console.log('[A2A Gateway] HTTP server closed');
      process.exit(0);
    });

    // Force exit after timeout
    setTimeout(() => {
      console.error('[A2A Gateway] Graceful shutdown timeout, forcing exit');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

start().catch(err => {
  console.error('[A2A Gateway] Failed to start:', err);
  process.exit(1);
});
