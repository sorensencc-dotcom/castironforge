// filename: src/extractor/extractorEnricher.js
// date: 2026-05-15
// version: 1.1.0

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ExtractorRegistry } from './extractorRegistry.js';
import { log, logError, logInfo } from '../lib/logger.js';
import { getPaths } from '../lib/paths.js';
import { readSidecar, writeSidecar } from '../lib/sidecar.js';
import { insertVector } from '../providers/qdrant.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MODULE = 'enricher';

/**
 * Normalizes extractor output to a canonical shape regardless of v1 or v2 extractor.
 *
 * v1 shape (imageAnalyzerExtractor):
 *   { scene: string, people: [{label, confidence}], places: [{label, confidence}], objects: [string] }
 *
 * v2 shape (ImageAnalyzerV2):
 *   { sceneGraph: {...}, faceClusters: {...}, placeRecognition: {...}, crossReferences: {...} }
 *
 * @param {object|null} data - result.data from extractor
 * @returns {{ scene: string|null, people: Array, places: Array, objects: string[] }}
 */
function normalizeExtractorData(data) {
  if (!data || typeof data !== 'object') return null;

  // v2 detection: sceneGraph key present
  if (Object.hasOwn(data, 'sceneGraph')) {
    const sg  = data.sceneGraph  ?? {};
    const pr  = data.placeRecognition ?? {};
    const cr  = data.crossReferences  ?? {};

    const people = (cr.publicFigures ?? []).map(f => ({
      label:      f.label      ?? 'unknown',
      confidence: f.confidence ?? 0
    }));

    const places = [
      ...(pr.candidates ?? []).map(c => ({ label: c.label, confidence: c.confidence ?? 0 })),
      ...(cr.publicLocations ?? []).map(l => ({ label: l.label, confidence: l.confidence ?? 0 }))
    ];

    const objects = (sg.objects ?? [])
      .map(o => (typeof o === 'object' ? o.label : String(o)))
      .filter(Boolean);

    return {
      scene:   sg.description ?? null,
      people,
      places,
      objects
    };
  }

  // v1 shape (already canonical)
  return {
    scene:   typeof data.scene === 'string' ? data.scene : null,
    people:  Array.isArray(data.people)  ? data.people  : [],
    places:  Array.isArray(data.places)  ? data.places  : [],
    objects: Array.isArray(data.objects) ? data.objects : []
  };
}

/**
 * Runs the enrichment process for files in the database.
 * @param {import('better-sqlite3').Database} db
 * @returns {Promise<object>} - Run summary.
 */
export async function runEnricher(db) {
  const paths = getPaths();
  const registry = new ExtractorRegistry();
  
  // Initialize registry with all extractors in the current directory
  const extractorFiles = await fs.readdir(__dirname);
  const extractorModules = extractorFiles
    .filter(f => f.endsWith('.js') && !['iExtractor.js', 'extractorRegistry.js', 'extractorRunner.js', 'extractorEnricher.js'].includes(f))
    .map(f => path.join(__dirname, f));

  await registry.init(extractorModules);

  const runId = `enricher-${new Date().toISOString()}`;
  const startedAt = new Date().toISOString();

  // Register run
  db.prepare(`
    INSERT INTO runs (run_id, run_type, started_at, status) VALUES (?, 'enricher', ?, 'running')
  `).run(runId, startedAt);

  logInfo(MODULE, 'Run started', { runId });

  // Query files that might need enrichment. 
  // For now, focus on 'photos' that haven't been processed by 'image_analyzer' yet.
  // We check the entities table for existing 'ai_vision' entries.
  const filesToEnrich = db.prepare(`
    SELECT f.* FROM files f
    WHERE f.category = 'photos'
    AND f.id NOT IN (
      SELECT file_id FROM entities WHERE source = 'ai_vision'
    )
    LIMIT 50 -- Cap per run to manage costs/time
  `).all();

  logInfo(MODULE, 'Files to enrich', { count: filesToEnrich.length });

  let enrichedCount = 0;
  let errorCount = 0;

  for (const file of filesToEnrich) {
    try {
      const payload = await fs.readFile(file.processed_path);
      const job = {
        jobId: runId,
        assetId: file.hash_sha256,
        mimeType: file.mime_type,
        payload,
        meta: { category: file.category }
      };

      const result = await registry.route(job);

      if (result.status === 'ok' && result.data) {
        const now = new Date().toISOString();
        const normalized = normalizeExtractorData(result.data);

        if (!normalized) {
          errorCount++;
          logError(MODULE, 'Failed to normalize extractor data', { filename: file.filename, extractorId: result.extractorId });
          continue;
        }

        // Transactional update: entities, topics, and sidecar
        const updateTx = db.transaction(() => {
          const insertEntity = db.prepare(`
            INSERT INTO entities (file_id, entity_type, value, confidence, source, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `);

          for (const person of normalized.people) {
            insertEntity.run(file.id, 'PERSON', person.label, person.confidence, 'ai_vision', now);
          }

          for (const place of normalized.places) {
            insertEntity.run(file.id, 'LOCATION', place.label, place.confidence, 'ai_vision', now);
          }

          for (const obj of normalized.objects) {
            insertEntity.run(file.id, 'ARTIFACT', String(obj), 0.9, 'ai_vision', now);
          }

          const insertTopic = db.prepare(`
            INSERT OR IGNORE INTO topics (file_id, tag, created_at) VALUES (?, ?, ?)
          `);
          if (normalized.scene) {
            insertTopic.run(file.id, 'ai-described', now);
          }
        });

        updateTx();

        // Update sidecar
        try {
          const sidecar = readSidecar(file.sidecar_path);
          sidecar.extraction.ai_vision = result.data;
          if (normalized.scene) {
            sidecar.notes = (sidecar.notes ? sidecar.notes + '\n' : '') + `AI Analysis: ${normalized.scene}`;
          }
          writeSidecar(paths.sidecars, sidecar);
        } catch (sidecarErr) {
          logError(MODULE, 'Failed to update sidecar', { file: file.filename, error: sidecarErr.message });
        }

        // Qdrant Vector Integration (§0.1-A)
        if (result.data && result.data.vector && Array.isArray(result.data.vector)) {
          try {
            await insertVector('cic_vectors', file.id, result.data.vector, {
              filename: file.filename,
              category: file.category,
              extractor: result.extractorId
            });
          } catch (qdrantErr) {
            logError(MODULE, 'Failed to insert vector into Qdrant', { file: file.filename, error: qdrantErr.message });
          }
        }

        enrichedCount++;
        logInfo(MODULE, 'Enriched file', { filename: file.filename, extractor: result.extractorId });
      } else if (result.status === 'unsupported') {
        logInfo(MODULE, 'File unsupported by extractors', { filename: file.filename, mimeType: file.mime_type });
      } else {
        errorCount++;
        logError(MODULE, 'Extraction failed', { filename: file.filename, error: result.error });
      }
    } catch (err) {
      errorCount++;
      logError(MODULE, 'Enrichment task failed', { file: file.filename, error: err.message });
    }
  }

  const completedAt = new Date().toISOString();
  db.prepare(`
    UPDATE runs SET completed_at = ?, status = 'completed', files_ingested = ?, files_skipped = ?
    WHERE run_id = ?
  `).run(completedAt, enrichedCount, errorCount, runId);

  logInfo(MODULE, 'Run completed', { enrichedCount, errorCount });
  return { runId, enrichedCount, errorCount };
}
