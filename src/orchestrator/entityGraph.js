// src/orchestrator/entityGraph.js | 2026-05-10 | 1.0.0
/**
 * Entity Graph Module
 * Manages entity nodes and edges in the database.
 */

import Database from 'better-sqlite3';
import crypto from 'node:crypto';

// Validate env vars
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Initialize DB
const dbPath = process.env.DATABASE_URL.replace('sqlite://', '');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

/**
 * @typedef {Object} EntityNode
 * @property {string} node_id
 * @property {string} label
 * @property {string} type
 * @property {string} first_seen
 * @property {string} last_seen
 * @property {number} occurrence_count
 */

/**
 * Upsert an entity into the graph.
 * @param {string} label 
 * @param {'person' | 'place' | 'object'} type 
 * @param {string} assetId 
 * @returns {Promise<{ nodeId: string, created: boolean }>}
 */
export async function upsertEntity(label, type, assetId) {
  try {
    const existing = db.prepare('SELECT node_id, occurrence_count FROM entity_nodes WHERE label = ? AND type = ?').get(label, type);

    if (existing) {
      db.prepare(`
        UPDATE entity_nodes 
        SET occurrence_count = occurrence_count + 1,
            last_seen = datetime('now')
        WHERE node_id = ?
      `).run(existing.node_id);
      
      return { nodeId: existing.node_id, created: false };
    } else {
      const nodeId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO entity_nodes (node_id, label, type, first_seen, last_seen, occurrence_count)
        VALUES (?, ?, ?, datetime('now'), datetime('now'), 1)
      `).run(nodeId, label, type);
      
      return { nodeId, created: true };
    }
  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      agentId: process.env.ORCHESTRATOR_AGENT_ID,
      action: 'upsertEntity',
      status: 'error',
      error: error.message
    }));
    throw error;
  }
}

/**
 * Add or update an edge between two nodes.
 * @param {string} sourceNodeId 
 * @param {string} targetNodeId 
 * @param {'co-appears-in' | 'located-at' | 'associated-with'} relationship 
 * @param {string} assetId 
 * @returns {Promise<void>}
 */
export async function addEdge(sourceNodeId, targetNodeId, relationship, assetId) {
  try {
    const edgeId = `${sourceNodeId}:${targetNodeId}:${relationship}`;
    const existing = db.prepare('SELECT asset_ids FROM entity_edges WHERE edge_id = ?').get(edgeId);

    if (existing) {
      const assetIds = JSON.parse(existing.asset_ids);
      if (!assetIds.includes(assetId)) {
        assetIds.push(assetId);
        db.prepare('UPDATE entity_edges SET asset_ids = ? WHERE edge_id = ?').run(JSON.stringify(assetIds), edgeId);
      }
    } else {
      db.prepare(`
        INSERT INTO entity_edges (edge_id, source_node, target_node, relationship, asset_ids)
        VALUES (?, ?, ?, ?, ?)
      `).run(edgeId, sourceNodeId, targetNodeId, relationship, JSON.stringify([assetId]));
    }
  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      agentId: process.env.ORCHESTRATOR_AGENT_ID,
      action: 'addEdge',
      status: 'error',
      error: error.message
    }));
    throw error;
  }
}

/**
 * Get all nodes connected to a specific node.
 * @param {string} nodeId 
 * @returns {Promise<EntityNode[]>}
 */
export async function getConnections(nodeId) {
  try {
    return db.prepare(`
      SELECT n.* 
      FROM entity_nodes n
      JOIN entity_edges e ON (e.source_node = n.node_id OR e.target_node = n.node_id)
      WHERE (e.source_node = ? OR e.target_node = ?) AND n.node_id != ?
    `).all(nodeId, nodeId, nodeId);
  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      agentId: process.env.ORCHESTRATOR_AGENT_ID,
      action: 'getConnections',
      status: 'error',
      error: error.message
    }));
    return [];
  }
}

/**
 * Get migration SQL.
 * @returns {string}
 */
export function getMigration() {
  return `
    CREATE TABLE IF NOT EXISTS entity_nodes (
      node_id TEXT PRIMARY KEY,
      label TEXT,
      type TEXT,
      first_seen TEXT,
      last_seen TEXT,
      occurrence_count INTEGER
    );
    CREATE TABLE IF NOT EXISTS entity_edges (
      edge_id TEXT PRIMARY KEY,
      source_node TEXT,
      target_node TEXT,
      relationship TEXT,
      asset_ids TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_entity_nodes_label_type ON entity_nodes(label, type);
    CREATE INDEX IF NOT EXISTS idx_entity_edges_source ON entity_edges(source_node);
    CREATE INDEX IF NOT EXISTS idx_entity_edges_target ON entity_edges(target_node);
  `;
}
