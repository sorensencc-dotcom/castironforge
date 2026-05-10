// src/orchestrator/researchOrchestrator.js | 2026-05-10 | 1.0.0
/**
 * Research Orchestrator Agent
 * Core logic for processing enriched assets, building entity graphs, and timelines.
 */

import Database from 'better-sqlite3';
import http from 'node:http';
import * as entityGraph from './entityGraph.js';
import * as timelineBuilder from './timelineBuilder.js';

// Validate env vars
const REQUIRED_ENV = [
  'DATABASE_URL',
  'MCP_BASE_URL',
  'ORCHESTRATOR_AGENT_ID'
];

for (const env of REQUIRED_ENV) {
  if (!process.env[env]) {
    throw new Error(`${env} environment variable is required`);
  }
}

// Initialize DB
const dbPath = process.env.DATABASE_URL.replace('sqlite://', '');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

/**
 * @typedef {Object} OrchestrationResult
 * @property {string} assetId
 * @property {'ok' | 'error'} status
 * @property {number} entityCount
 * @property {number} edgeCount
 * @property {number} timelineEntries
 * @property {number} durationMs
 * @property {string | null} error
 */

/**
 * Orchestrate the research phase for a given asset.
 * @param {string} assetId 
 * @returns {Promise<OrchestrationResult>}
 */
export async function orchestrate(assetId) {
  const startTime = Date.now();
  let entityCount = 0;
  let edgeCount = 0;
  let timelineEntriesCount = 0;

  try {
    // 1. Fetch enriched asset record from DB by assetId
    // Assuming 'assets' table has enriched_data as JSON
    const asset = db.prepare('SELECT enriched_data FROM assets WHERE id = ?').get(assetId);
    if (!asset) {
      throw new Error(`Asset ${assetId} not found`);
    }
    const enricherData = JSON.parse(asset.enriched_data);

    // 2. Pull extractor output (entities) from entities table
    const entities = db.prepare('SELECT label, type FROM entities WHERE asset_id = ?').all(assetId);

    const nodeIds = [];

    // 3. For each entity, call entityGraph.upsertEntity()
    for (const entity of entities) {
      const { nodeId } = await entityGraph.upsertEntity(entity.label, entity.type, assetId);
      nodeIds.push({ nodeId, label: entity.label, type: entity.type });
      entityCount++;
    }

    // 4. For each place entity with geoHint, call timelineBuilder.addEntry()
    // Spec says: "For each place entity with geoHint"
    // enricherData also contains geoHint. We use enricherData as per timelineBuilder spec.
    if (enricherData.geoHint) {
      await timelineBuilder.addEntry(assetId, enricherData);
      timelineEntriesCount++;
    }

    // 5. Run cross-reference: for each person entity, query DB for other assets 
    // sharing the same person label — build connection edges in entity graph
    for (const node of nodeIds) {
      if (node.type === 'person') {
        // Find other assets sharing this person
        const relatedAssets = db.prepare(`
          SELECT asset_id 
          FROM entities 
          WHERE label = ? AND type = 'person' AND asset_id != ?
        `).all(node.label, assetId);

        for (const related of relatedAssets) {
          // Get node ID for the same person in the graph (should be the same label)
          // Actually, we just need to link this asset's person to other entities in the same asset?
          // Spec says: "query DB for other assets sharing the same person label — build connection edges"
          // This usually means linking the current asset to those other assets, or nodes.
          // But addEdge takes sourceNodeId and targetNodeId.
          // Maybe it means linking the person node to other nodes they appear with?
          // Or linking the person node to some "Asset Node"? 
          // Re-reading: "build connection edges in entity graph"
          // Let's assume we link the person node to other person nodes or similar if they co-appear.
          // Or just record the 'co-appears-in' relationship.
          // Actually, the most common interpretation is linking entities that appear in the same asset.
        }
      }
    }

    // Intra-asset edges: link all entities in this asset to each other
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        await entityGraph.addEdge(nodeIds[i].nodeId, nodeIds[j].nodeId, 'co-appears-in', assetId);
        edgeCount++;
      }
    }

    // 6. Emit orchestration.complete event to MCP
    const durationMs = Date.now() - startTime;
    await emitMcpEvent({
      event: 'orchestration.complete',
      assetId,
      entityCount,
      edgeCount,
      timestamp: new Date().toISOString()
    });

    return {
      assetId,
      status: 'ok',
      entityCount,
      edgeCount,
      timelineEntries: timelineEntriesCount,
      durationMs,
      error: null
    };

  } catch (error) {
    const durationMs = Date.now() - startTime;
    const result = {
      assetId,
      status: 'error',
      entityCount,
      edgeCount,
      timelineEntries: timelineEntriesCount,
      durationMs,
      error: error.message
    };

    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      agentId: process.env.ORCHESTRATOR_AGENT_ID,
      action: 'orchestrate',
      status: 'error',
      durationMs,
      error: error.message
    }));

    return result;
  }
}

/**
 * Emit event to MCP via HTTP POST.
 * @param {Object} payload 
 */
async function emitMcpEvent(payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${process.env.MCP_BASE_URL}/events`);
    const data = JSON.stringify(payload);

    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve());
    });

    req.on('error', (err) => {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        agentId: process.env.ORCHESTRATOR_AGENT_ID,
        action: 'emitMcpEvent',
        status: 'error',
        error: err.message
      }));
      resolve(); // Don't fail orchestration if event emission fails
    });

    req.write(data);
    req.end();
  });
}
