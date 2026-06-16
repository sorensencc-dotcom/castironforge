/**
 * CIC Memory Spine — MCP Server
 *
 * Exposes memory_query, memory_edit, and memory_admin as MCP tools.
 * Supports stdio transport (for local agents) and can be extended to
 * StreamableHTTP for remote agent connections.
 *
 * Usage (stdio):
 *   node dist/mcp/server.js
 *
 * Usage (HTTP):
 *   MEMORY_SPINE_MCP_TRANSPORT=http node dist/mcp/server.js
 */

import { memoryQueryTool } from './tools/memory_query.js';
import { memoryEditTool } from './tools/memory_edit.js';
import { memoryAdminTool } from './tools/memory_admin.js';
import { loadVersions, activateVersion, rollbackVersion } from '../store/versions.js';
import { upsertDoc, deleteDoc } from '../store/corpus.js';
import { buildStubQueryResponse } from '../lib/query.js';

// MCP wire protocol helpers (stdio JSON-RPC 2.0)

const tools = [memoryQueryTool, memoryEditTool, memoryAdminTool];

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
};

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
  if (name === 'memory_query') {
    const { active: memory_version } = loadVersions();
    const result = buildStubQueryResponse(
      args as Parameters<typeof buildStubQueryResponse>[0],
      memory_version,
    );
    respond(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
    return;
  }

  if (name === 'memory_edit') {
    const { operation, doc_id, payload } = args as {
      operation: 'add' | 'update' | 'delete';
      doc_id: string;
      payload?: Record<string, unknown>;
    };
    const { active: currentVersion } = loadVersions();
    const nextN = parseInt((currentVersion.match(/\d+/) ?? ['1'])[0], 10) + 1;
    const nextVersion = `memory-v${nextN}`;
    if (operation === 'delete') {
      deleteDoc(doc_id);
    } else {
      upsertDoc(doc_id, (payload ?? {}) as never, nextVersion);
    }
    activateVersion(nextVersion);
    respond(id, { content: [{ type: 'text', text: JSON.stringify({ status: 'ok', version: nextVersion }) }] });
    return;
  }

  if (name === 'memory_admin') {
    const { action, target_version, to_version } = args as {
      action: 'activate' | 'rollback' | 'status';
      target_version?: string;
      to_version?: string;
    };
    if (action === 'activate' && target_version) {
      const result = activateVersion(target_version);
      respond(id, { content: [{ type: 'text', text: JSON.stringify(result) }] });
    } else if (action === 'rollback') {
      const result = rollbackVersion(to_version);
      respond(id, { content: [{ type: 'text', text: JSON.stringify(result) }] });
    } else if (action === 'status') {
      const manifest = loadVersions();
      respond(id, { content: [{ type: 'text', text: JSON.stringify({ active_version: manifest.active, available_versions: manifest.available }) }] });
    } else {
      error(id, -32602, `Invalid action or missing parameters for memory_admin`);
    }
    return;
  }

  error(id, -32601, `Unknown tool: ${name}`);
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
        serverInfo: { name: 'cic-memory-spine', version: '0.1.0' },
        capabilities: { tools: {} },
      });
    } else if (req.method === 'tools/list') {
      respond(req.id, { tools });
    } else if (req.method === 'tools/call') {
      const { name, arguments: args } = (req.params ?? {}) as { name: string; arguments: Record<string, unknown> };
      await handleToolCall(req.id, name, args ?? {});
    } else {
      error(req.id, -32601, `Method not found: ${req.method}`);
    }
  }
});
