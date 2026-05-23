// file: src/lib/status.js
// created: 2026-05-03
// updated: 2026-05-03
// version: 1.0.0
// Read and write _status JSON files in CIC_Processed/_status/.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { log } from './logger.js';

/**
 * Write a status JSON file atomically.
 * @param {string} statusPath - Absolute path to the status file.
 * @param {object} payload    - Status data.
 */
export function writeStatus(statusPath, payload) {
  const dir = dirname(statusPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const data = {
    ...payload,
    updated_at: new Date().toISOString(),
  };

  writeFileSync(statusPath, JSON.stringify(data, null, 2), 'utf8');
  log('debug', 'status', 'Written', { path: statusPath });
}

/**
 * Read a status JSON file. Returns null if not found.
 * @param {string} statusPath
 * @returns {object|null}
 */
export function readStatus(statusPath) {
  if (!existsSync(statusPath)) return null;
  try {
    return JSON.parse(readFileSync(statusPath, 'utf8'));
  } catch (err) {
    log('warn', 'status', 'Corrupt status file — returning null', { path: statusPath, error: err.message });
    return null;
  }
}

/**
 * Build a standard harvester status payload.
 */
export function buildHarvesterStatus({ runId, startedAt, completedAt, filesFound, filesIngested, filesSkipped, errors = [] }) {
  return {
    _schema:        'cic-status-harvester-v1.0.0',
    run_id:         runId,
    started_at:     startedAt,
    completed_at:   completedAt,
    status:         errors.length > 0 ? 'completed_with_errors' : 'completed',
    files_found:    filesFound,
    files_ingested: filesIngested,
    files_skipped:  filesSkipped,
    error_count:    errors.length,
    errors,
  };
}

/**
 * Build a standard indexer status payload.
 */
export function buildIndexerStatus({ runId, startedAt, completedAt, filesIndexed, bundlesCreated, errors = [] }) {
  return {
    _schema:         'cic-status-indexer-v1.0.0',
    run_id:          runId,
    started_at:      startedAt,
    completed_at:    completedAt,
    status:          errors.length > 0 ? 'completed_with_errors' : 'completed',
    files_indexed:   filesIndexed,
    bundles_created: bundlesCreated,
    error_count:     errors.length,
    errors,
  };
}

/**
 * Build a standard daily sweeper status payload.
 */
export function buildDailyStatus({ runId, startedAt, completedAt, sourcesSwept, filesFound, filesIngested, filesArchived, bundleId, errors = [] }) {
  return {
    _schema:         'cic-status-daily-v1.0.0',
    run_id:          runId,
    started_at:      startedAt,
    completed_at:    completedAt,
    status:          errors.length > 0 ? 'completed_with_errors' : 'completed',
    sources_swept:   sourcesSwept,
    files_found:     filesFound,
    files_ingested:  filesIngested,
    files_archived:  filesArchived,
    bundle_id:       bundleId,
    error_count:     errors.length,
    errors,
  };
}

/**
 * Build a standard corpus builder status payload.
 */
export function buildCorpusStatus({ runId, startedAt, completedAt, corporaUpdated, totalEntries, errors = [] }) {
  return {
    _schema:          'cic-status-corpus-v1.0.0',
    run_id:           runId,
    started_at:       startedAt,
    completed_at:     completedAt,
    status:           errors.length > 0 ? 'completed_with_errors' : 'completed',
    corpora_updated:  corporaUpdated,
    total_entries:    totalEntries,
    error_count:      errors.length,
    errors,
  };
}
