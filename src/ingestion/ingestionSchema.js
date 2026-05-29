// filename: ingestionSchema.js
// date: 2026-05-10
// version: 1.0.0

/**
 * Migration Snippet:
 * 
 * CREATE TABLE IF NOT EXISTS assets (
 *   asset_id      TEXT PRIMARY KEY,
 *   mime_type     TEXT NOT NULL,
 *   source_type   TEXT NOT NULL,
 *   storage_path  TEXT NOT NULL,
 *   source_meta   TEXT,
 *   rights_context TEXT,
 *   status        TEXT NOT NULL DEFAULT 'pending',
 *   ingested_at   TEXT NOT NULL,
 *   updated_at    TEXT NOT NULL
 * );
 */

/**
 * @typedef {Object} AssetRecord
 * @property {string} assetId
 * @property {string} mimeType
 * @property {string} sourceType
 * @property {string} storagePath
 * @property {string} sourceMeta - JSON string
 * @property {string} rightsContext - JSON string
 * @property {'pending' | 'enriched' | 'error'} status
 * @property {string} ingestedAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 */

/**
 * Builds a canonical AssetRecord.
 * @param {string} assetId 
 * @param {import('./ingestionValidator.js').RawInput} rawInput 
 * @param {string} storagePath 
 * @returns {AssetRecord}
 */
export function buildAssetRecord(assetId, rawInput, storagePath) {
  const now = new Date().toISOString();
  return {
    assetId,
    mimeType: rawInput.mimeType,
    sourceType: rawInput.sourceType,
    storagePath,
    sourceMeta: JSON.stringify(rawInput.sourceMeta),
    rightsContext: JSON.stringify(rawInput.rightsContext || null),
    status: 'pending',
    ingestedAt: now,
    updatedAt: now
  };
}

/**
 * Persists an AssetRecord to the database.
 * @param {AssetRecord} record 
 * @param {any} db - Database connection instance (better-sqlite3 or compatible)
 * @returns {Promise<void>}
 */
export async function persistAssetRecord(record, db) {
  const sql = `
    INSERT INTO assets (
      asset_id, mime_type, source_type, storage_path, source_meta, rights_context, status, ingested_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `;
  
  // Handle both better-sqlite3 (synchronous .run) and async drivers
  const params = [
    record.assetId,
    record.mimeType,
    record.sourceType,
    record.storagePath,
    record.sourceMeta,
    record.rightsContext,
    record.status,
    record.ingestedAt,
    record.updatedAt
  ];

  if (typeof db.prepare === 'function') {
    const stmt = db.prepare(sql);
    if (typeof stmt.run === 'function') {
      stmt.run(...params);
      return;
    }
  }

  // Fallback for async drivers (like pg or hypothetical async sqlite)
  if (typeof db.query === 'function') {
    await db.query(sql, params);
  } else if (typeof db.execute === 'function') {
    await db.execute(sql, params);
  } else {
    throw new Error('Unsupported database driver interface');
  }
}
