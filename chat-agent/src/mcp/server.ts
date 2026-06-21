/**
 * CastIronForge MCP Server
 *
 * Exposes four tool namespaces:
 * - retrieval: corpus search and document retrieval
 * - git: repository operations
 * - cic: component control and diagnostics
 * - test-runner: test execution and results
 *
 * Supports stdio transport (JSON-RPC 2.0).
 *
 * Usage:
 *   node dist/mcp/server.js
 */

import { retrievalTools } from './tools/retrieval.js';
import { gitTools } from './tools/git.js';
import { cicTools } from './tools/cic.js';
import { testRunnerTools } from './tools/testRunner.js';

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
};

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
};

const allTools: ToolDefinition[] = [
  ...retrievalTools.definitions,
  ...gitTools.definitions,
  ...cicTools.definitions,
  ...testRunnerTools.definitions
];

function send(payload: unknown): void {
  process.stdout.write(JSON.stringify(payload) + '\n');
}

function respond(id: number | string, result: unknown): void {
  send({ jsonrpc: '2.0', id, result });
}

function error(id: number | string, code: number, message: string): void {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

async function handleToolCall(id: number | string, name: string, args: Record<string, unknown>): Promise<void> {
  const [namespace, toolName] = name.includes('.') ? name.split('.') : [name, name];

  try {
    let result: unknown;

    if (namespace === 'retrieval' && retrievalTools.handlers[toolName]) {
      result = await retrievalTools.handlers[toolName](args);
    } else if (namespace === 'git' && gitTools.handlers[toolName]) {
      result = await gitTools.handlers[toolName](args);
    } else if (namespace === 'cic' && cicTools.handlers[toolName]) {
      result = await cicTools.handlers[toolName](args);
    } else if (namespace === 'test-runner' && testRunnerTools.handlers[toolName]) {
      result = await testRunnerTools.handlers[toolName](args);
    } else {
      error(id, -32601, `Unknown tool: ${name}`);
      return;
    }

    respond(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error(id, -32603, `Tool execution failed: ${message}`);
  }
}

// Stdio JSON-RPC loop
process.stdin.setEncoding('utf-8');
let buffer = '';

process.stdin.on('data', async (chunk: string) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop() ?? '';

  for (const line of lines) {
    if (!line.trim()) continue;
    let req: JsonRpcRequest;
    try {
      req = JSON.parse(line) as JsonRpcRequest;
    } catch {
      send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      continue;
    }

    if (req.method === 'initialize') {
      respond(req.id, {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'castironforge-mcp', version: '1.0.0' },
        capabilities: { tools: {} }
      });
    } else if (req.method === 'tools/list') {
      respond(req.id, { tools: allTools });
    } else if (req.method === 'tools/call') {
      const { name, arguments: args } = (req.params ?? {}) as { name: string; arguments: Record<string, unknown> };
      await handleToolCall(req.id, name, args ?? {});
    } else {
      error(req.id, -32601, `Method not found: ${req.method}`);
    }
  }
});
