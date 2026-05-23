// file: src/harvester/harvester.js
// created: 2026-05-03
// updated: 2026-05-03
// version: 1.0.0
// CIC Harvester — sweeps CIC_Inbox/{category}/ directories.
// For each new file: classify → extract → write sidecar → move to CIC_Processed
//                   → insert DB record → update harvester.json status.

import { readdirSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getPaths } from '../lib/paths.js';
import { classify, mimeHint } from '../lib/classifier.js';
import { hashFile } from './extractor.js';
import { extractInSandbox as extract } from './sandboxExtractor.js';
import { buildSidecar, writeSidecar } from '../lib/sidecar.js';
import { writeStatus, buildHarvesterStatus } from '../lib/status.js';
import { log, logError } from '../lib/logger.js';

const MODULE = 'harvester';

/**
 * Harvest a single file from an inbox directory.
 * @param {object} opts
 * @returns {{ fileRecord: object, sidecarPath: string } | null}
 */
function harvestFile({ filePath, category, sourceType, sourceLabel, runId, db, paths, now }) {
  const filename = basename(filePath);

  // Skip hidden files and already-processed markers
  if (filename.startsWith('.') || filename.endsWith('.sidecar.json')) return null;

  let hash;
  try {
    hash = hashFile(filePath);
  } catch (err) {
    logError(MODULE, 'Cannot hash file — skipping', { filePath, error: err.message });
    return null;
  }

  // Deduplication: skip if hash already in DB
  const existing = db.prepare('SELECT id FROM files WHERE hash_sha256 = ?').get(hash);
  if (existing) {
    log('info', MODULE, 'Duplicate — skipping', { filename, hash });
    return null;
  }

  // Extract metadata
  const extracted = extract(filePath, category);
  const mimeType  = mimeHint(filename);

  // Determine processed path
  const processedDir  = paths.processedDirs[category];
  const processedPath = join(processedDir, filename);

  // Build sidecar
  const sidecar = buildSidecar({
    filename,
    sourcePath:    filePath,
    processedPath,
    category,
    mimeType,
    sizeBytes:     extracted.sizeBytes,
    hashSha256:    hash,
    sourceType,
    sourceLabel,
    ingestedAt:    now,
    runId,
    extractedText: extracted.extractedText,
    entities:      extracted.entities,
    topics:        extracted.topics,
    exifData:      extracted.exifData,
    durationSec:   extracted.durationSec,
    transcript:    extracted.transcript,
  });

  const sidecarPath = writeSidecar(paths.sidecars, sidecar);

  // Move file to CIC_Processed
  if (!existsSync(processedDir)) {
    mkdirSync(processedDir, { recursive: true });
  }
  renameSync(filePath, processedPath);

  // Insert DB record
  const fileRecord = {
    run_id:         runId,
    source_path:    filePath,
    processed_path: processedPath,
    sidecar_path:   sidecarPath,
    filename,
    extension:      filename.slice(filename.lastIndexOf('.')).toLowerCase(),
    category,
    mime_type:      mimeType,
    size_bytes:     extracted.sizeBytes,
    hash_sha256:    hash,
    source_type:    sourceType,
    source_label:   sourceLabel ?? null,
    ingested_at:    now,
    status:         'harvested',
  };

  db.prepare(`
    INSERT INTO files
      (run_id, source_path, processed_path, sidecar_path, filename, extension,
       category, mime_type, size_bytes, hash_sha256, source_type, source_label,
       ingested_at, status)
    VALUES
      (@run_id, @source_path, @processed_path, @sidecar_path, @filename, @extension,
       @category, @mime_type, @size_bytes, @hash_sha256, @source_type, @source_label,
       @ingested_at, @status)
  `).run(fileRecord);

  const fileId = db.prepare('SELECT last_insert_rowid() AS id').get().id;

  // Insert entities
  const insertEntity = db.prepare(`
    INSERT INTO entities (file_id, entity_type, value, confidence, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const ent of extracted.entities) {
    insertEntity.run(fileId, ent.entity_type, ent.value, ent.confidence, ent.source ?? 'metadata', now);
  }

  // Insert topics
  const insertTopic = db.prepare(`
    INSERT INTO topics (file_id, tag, created_at) VALUES (?, ?, ?)
  `);
  for (const tag of extracted.topics) {
    insertTopic.run(fileId, tag, now);
  }

  log('info', MODULE, 'Ingested', { filename, category, hash, sidecarPath, sourceType });
  return { fileRecord, sidecarPath };
}

/**
 * Run the harvester over all CIC_Inbox category directories.
 * @param {import('better-sqlite3').Database} db
 * @param {{ sourceType?: string, sourceLabel?: string, inboxDirs?: object }} [opts]
 * @returns {object} - Run summary.
 */
export function runHarvester(db, opts = {}) {
  const paths      = getPaths();
  const runId      = `harvester-${new Date().toISOString()}`;
  const startedAt  = new Date().toISOString();
  const now        = startedAt;
  const sourceType = opts.sourceType ?? 'inbox';
  const inboxDirs  = opts.inboxDirs  ?? paths.inboxDirs;

  // Register run
  db.prepare(`
    INSERT INTO runs (run_id, run_type, started_at, status) VALUES (?, 'harvester', ?, 'running')
  `).run(runId, startedAt);

  log('info', MODULE, 'Run started', { runId, sourceType });

  let filesFound    = 0;
  let filesIngested = 0;
  let filesSkipped  = 0;
  const errors      = [];

  const harvestBatch = db.transaction((category, dir) => {
    if (!existsSync(dir)) {
      log('warn', MODULE, 'Inbox dir not found — skipping', { category, dir });
      return;
    }

    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      filesFound++;

      try {
        const result = harvestFile({
          filePath:    join(dir, entry.name),
          category,
          sourceType,
          sourceLabel: opts.sourceLabel ?? null,
          runId,
          db,
          paths,
          now,
        });

        if (result) {
          filesIngested++;
        } else {
          filesSkipped++;
        }
      } catch (err) {
        filesSkipped++;
        errors.push({ file: entry.name, error: err.message });
        logError(MODULE, 'File harvest failed', { file: entry.name, error: err.message });
      }
    }
  });

  for (const [category, dir] of Object.entries(inboxDirs)) {
    try {
      harvestBatch(category, dir);
    } catch (err) {
      errors.push({ category, error: err.message });
      logError(MODULE, 'Category harvest failed', { category, error: err.message });
    }
  }

  const completedAt = new Date().toISOString();
  const runStatus   = errors.length > 0 ? 'completed' : 'completed';

  // Update run record
  db.prepare(`
    UPDATE runs SET completed_at = ?, status = ?, files_found = ?, files_ingested = ?, files_skipped = ?
    WHERE run_id = ?
  `).run(completedAt, runStatus, filesFound, filesIngested, filesSkipped, runId);

  // Write status file
  writeStatus(paths.status.harvester, buildHarvesterStatus({
    runId, startedAt, completedAt, filesFound, filesIngested, filesSkipped, errors,
  }));

  const summary = { runId, startedAt, completedAt, filesFound, filesIngested, filesSkipped, errors };
  log('info', MODULE, 'Run completed', summary);
  return summary;
}
