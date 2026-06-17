import http from 'http';
import { logger } from './logger.js';
import { MeshLoader } from './loader.js';
import { AgentRunner } from './agent-runner.js';
import { WorkflowExecutor } from './workflow-executor.js';

const PORT = process.env.PORT || 3000;
const MESH_ROOT = process.env.MESH_ROOT || '../../';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required');
}

const loader = new MeshLoader(MESH_ROOT);
const agentRunner = new AgentRunner(ANTHROPIC_API_KEY);
const executor = new WorkflowExecutor(loader, agentRunner);

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end('Method not allowed\n');
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const payload = JSON.parse(body);
      const { workflow_id, trigger_event } = payload;

      if (!workflow_id || !trigger_event) {
        res.writeHead(400);
        res.end('Missing workflow_id or trigger_event\n');
        return;
      }

      logger.info('webhook_received', { workflow_id, event: trigger_event.event });
      const result = await executor.execute(workflow_id, trigger_event);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result) + '\n');
    } catch (error) {
      logger.error('request_failed', { error: error.message });
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }) + '\n');
    }
  });
});

server.listen(PORT, () => {
  logger.info('mesh_runtime_started', { port: PORT });
});
