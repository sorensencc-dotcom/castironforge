// file: src/db/migrate.js
// version: 1.1.1 — logger API fix + deterministic async init
// created: 2026-05-03
// updated: 2026-05-04

import Database from 'better-sqlite3';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { getPaths } from '../lib/paths.js';
import { log, logError } from '../lib/logger.js';

export async function migrate(dbPathOverride = null) {
  const paths = getPaths();
  const dbPath = dbPathOverride || paths.db;

  log('info', 'migrate', 'Applying schema', { dbPath });

  try {
    await mkdir(dirname(dbPath), { recursive: true });
  } catch (err) {
    logError('migrate', 'Failed to create DB directory', { error: err.message });
    throw err;
  }

  let db;
  try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT UNIQUE,
        run_type TEXT,
        started_at TEXT,
        completed_at TEXT,
        status TEXT,
        files_found INTEGER DEFAULT 0,
        files_ingested INTEGER DEFAULT 0,
        files_skipped INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT,
        source_path TEXT,
        processed_path TEXT,
        sidecar_path TEXT,
        filename TEXT,
        extension TEXT,
        category TEXT,
        mime_type TEXT,
        size_bytes INTEGER,
        hash_sha256 TEXT UNIQUE,
        source_type TEXT,
        source_label TEXT,
        ingested_at TEXT,
        status TEXT
      );

      CREATE TABLE IF NOT EXISTS entities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER,
        entity_type TEXT,
        value TEXT,
        confidence REAL,
        source TEXT,
        created_at TEXT,
        FOREIGN KEY(file_id) REFERENCES files(id)
      );

      CREATE TABLE IF NOT EXISTS topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER,
        tag TEXT,
        created_at TEXT,
        FOREIGN KEY(file_id) REFERENCES files(id)
      );

      CREATE TABLE IF NOT EXISTS search_index (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT,
        category TEXT,
        mime_type TEXT,
        size_bytes INTEGER,
        hash_sha256 TEXT,
        extracted_text TEXT,
        ingested_at TEXT,
        processed_path TEXT,
        sidecar_path TEXT
      );

      -- Lineage table links search_index entries to archives and originals
      CREATE TABLE IF NOT EXISTS lineage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        search_index_id INTEGER,
        hash_sha256 TEXT,
        original_path TEXT,
        processed_path TEXT,
        sidecar_path TEXT,
        archive_path TEXT,
        created_at TEXT,
        FOREIGN KEY(search_index_id) REFERENCES search_index(id)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS lineage_unique_idx ON lineage(hash_sha256, processed_path);
    `);

    log('info', 'migrate', 'Schema applied', { dbPath });
    return db;

  } catch (err) {
    logError('migrate', 'Schema migration failed', { error: err.message });
    throw err;
  }
}

