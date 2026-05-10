// src/orchestrator/timelineBuilder.js | 2026-05-10 | 1.0.0
/**
 * Timeline Builder Module
 * Manages timeline entries in the database.
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
 * @typedef {Object} TimelineEntry
 * @property {string} entry_id
 * @property {string} asset_id
 * @property {string} place_label
 * @property {string} geo_hint
 * @property {string} scene
 * @property {string} timestamp
 * @property {string} created_at
 */

/**
 * Add a timeline entry if geoHint is present.
 * @param {string} assetId 
 * @param {Object} enricherData 
 * @param {string} enricherData.scene
 * @param {Array<{label: string, confidence: number}>} enricherData.places
 * @param {string|null} enricherData.geoHint
 * @returns {Promise<void>}
 */
export async function addEntry(assetId, enricherData) {
  const { scene, places, geoHint } = enricherData;

  if (!geoHint) {
    return;
  }

  try {
    const entryId = crypto.randomUUID();
    const placeLabel = places && places.length > 0 ? places[0].label : 'Unknown';
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO timeline_entries (entry_id, asset_id, place_label, geo_hint, scene, timestamp, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(entryId, assetId, placeLabel, geoHint, scene, now, now);
  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      agentId: process.env.ORCHESTRATOR_AGENT_ID,
      action: 'addTimelineEntry',
      status: 'error',
      error: error.message
    }));
    throw error;
  }
}

/**
 * Get all timeline entries for a specific asset.
 * @param {string} assetId 
 * @returns {Promise<TimelineEntry[]>}
 */
export async function getEntriesByAsset(assetId) {
  try {
    return db.prepare('SELECT * FROM timeline_entries WHERE asset_id = ?').all(assetId);
  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      agentId: process.env.ORCHESTRATOR_AGENT_ID,
      action: 'getEntriesByAsset',
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
    CREATE TABLE IF NOT EXISTS timeline_entries (
      entry_id TEXT PRIMARY KEY,
      asset_id TEXT,
      place_label TEXT,
      geo_hint TEXT,
      scene TEXT,
      timestamp TEXT,
      created_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_timeline_asset ON timeline_entries(asset_id);
  `;
}
