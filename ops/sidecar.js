// file: src/lib/sidecar.js
// created: 2026-05-03
// updated: 2026-05-03
// version: 1.0.0
// Read and write sidecar JSON files in CIC_Sidecars/.
// Sidecar filename = <hash_sha256>.sidecar.json

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { log } from './logger.js';

/**
 * Build the sidecar filename from a SHA-256 hash.
 * @param {string} hash
 * @returns {string}
 */
export function sidecarFilename(hash) {
  return `${hash}.sidecar.json`;
}

/**
 * Write a sidecar JSON file to the sidecars directory.
 * @param {string} sidecarsDir - Absolute path to CIC_Sidecars/.
 * @param {object} sidecar     - Sidecar object (must include hash_sha256).
 * @returns {string} - Absolute path to written sidecar file.
 */
export function writeSidecar(sidecarsDir, sidecar) {
  if (!sidecar?.hash_sha256) {
    throw new Error('sidecar: missing hash_sha256 field');
  }

  const filename = sidecarFilename(sidecar.hash_sha256);
  const outPath  = join(sidecarsDir, filename);

  if (!existsSync(sidecarsDir)) {
    mkdirSync(sidecarsDir, { recursive: true });
  }

  writeFileSync(outPath, JSON.stringify(sidecar, null, 2), 'utf8');
  log('debug', 'sidecar', 'Written', { path: outPath });
  return outPath;
}

/**
 * Read an existing sidecar file.
 * @param {string} sidecarPath - Absolute path to the .sidecar.json file.
 * @returns {object}
 */
export function readSidecar(sidecarPath) {
  if (!existsSync(sidecarPath)) {
    throw new Error(`sidecar: file not found — ${sidecarPath}`);
  }
  return JSON.parse(readFileSync(sidecarPath, 'utf8'));
}

/**
 * Build a sidecar object from harvested file metadata.
 * @param {object} opts
 * @returns {object} - Sidecar payload.
 */
export function buildSidecar(opts) {
  const {
    filename,
    sourcePath,
    processedPath,
    category,
    mimeType,
    sizeBytes,
    hashSha256,
    sourceType,
    sourceLabel = null,
    ingestedAt,
    runId,
    extractedText = null,
    entities = [],
    topics = [],
    exifData = null,
    durationSec = null,
    transcript = null,
    notes = null,
  } = opts;

  return {
    _schema:        'cic-sidecar-v1.0.0',
    hash_sha256:    hashSha256,
    filename,
    source_path:    sourcePath,
    processed_path: processedPath,
    category,
    mime_type:      mimeType,
    size_bytes:     sizeBytes,
    source_type:    sourceType,
    source_label:   sourceLabel,
    ingested_at:    ingestedAt,
    run_id:         runId,
    extraction: {
      text:         extractedText,
      entities,
      topics,
      exif:         exifData,
      duration_sec: durationSec,
      transcript,
    },
    notes,
  };
}
