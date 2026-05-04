// file: src/mover/mover.js
// Post-ingestion mover & archiver with original-source recovery.

import { stat, mkdir, copyFile, rename } from 'node:fs/promises';
import { dirname, join, extname, basename } from 'node:path';
import { getPaths } from '../lib/paths.js';
import { classifyByExtension } from './classifier.js';
import { moveFile, copyFile as safeCopyFile, readText } from '../lib/fs-utils.js';
import { hashFile } from '../harvester/hash.js';

const TEMP_SUFFIX = '.tmp-archive';

async function findOriginalCandidate(paths, filename, hash, sidecarPath, logger) {
  // 1) Sidecar may reference original path
  if (sidecarPath) {
    try {
      const raw = await readText(sidecarPath);
      const sc = JSON.parse(raw);
      const candidate = sc.original_path || sc.source_path || sc.source || null;
      if (candidate) {
        try {
          await stat(candidate);
          if (hash) {
            const h = await hashFile(candidate);
            if (h === hash) return candidate;
            logger.info({ module: 'mover', message: 'Sidecar original hash mismatch', candidate, expectedHash: hash, foundHash: h });
          } else {
            return candidate;
          }
        } catch (err) {
          logger.info({ module: 'mover', message: 'Sidecar original not accessible', candidate, error: err.message });
        }
      }
    } catch (err) {
      // ignore sidecar read errors (non-fatal)
      logger.info({ module: 'mover', message: 'Cannot read sidecar for original lookup', sidecarPath, error: err.message });
    }
  }

  // 2) Look for filename in known inbox dirs
  for (const d of Object.values(paths.inboxDirs)) {
    const cand = join(d, filename);
    try {
      await stat(cand);
      if (hash) {
        try {
          const h = await hashFile(cand);
          if (h === hash) return cand;
        } catch (err) {
          logger.info({ module: 'mover', message: 'Hashing failed during original lookup', cand, error: err.message });
        }
      } else {
        return cand;
      }
    } catch (err) {
      // not found - continue
    }
  }

  // 3) Look at top-level inbox
  try {
    const cand = join(paths.inbox, filename);
    await stat(cand);
    if (hash) {
      const h = await hashFile(cand);
      if (h === hash) return cand;
    } else return cand;
  } catch (err) {
    // not found
  }

  return null;
}

export async function runMover(db, logger, options = {}) {
  const paths = getPaths();
  const dryRun = !!options.dryRun;
  const moveOriginals = options.moveOriginals !== undefined ? !!options.moveOriginals : true;
  const archiveOriginals = options.archiveOriginals !== undefined ? !!options.archiveOriginals : true;
  const writeDb = options.writeDb !== undefined ? !!options.writeDb : true;
  const now = new Date().toISOString();

  logger.info({ module: 'mover', message: 'Run started', runAt: now, dryRun, moveOriginals, archiveOriginals });

  let rows;
  try {
    rows = db.prepare('SELECT id AS search_index_id, filename, category, mime_type, size_bytes, hash_sha256, ingested_at, processed_path, sidecar_path FROM search_index').all();
  } catch (err) {
    logger.error({ module: 'mover', message: 'DB query failed', error: err.message });
    return;
  }

  let processed = 0;
  let archived = 0;
  let lineageInserted = 0;
  const errors = [];

  for (const r of rows) {
    let processedPath = r.processed_path;
    const sidecarPath = r.sidecar_path;
    const hash = r.hash_sha256 || null;
    const filename = r.filename;
    const category = r.category || classifyByExtension(filename, r.mime_type || '');

    if (!processedPath) {
      logger.warn({ module: 'mover', message: 'Missing processed_path in search_index', filename, searchIndexId: r.search_index_id });
      // try to synthesize a processed path based on category
      processedPath = join(paths.processedDirs[category], filename);
    }

    // Attempt to find original in inbox (sidecar guided or filename lookup)
    let originalPath = null;
    try {
      originalPath = await findOriginalCandidate(paths, basename(processedPath), hash, sidecarPath, logger);
    } catch (err) {
      logger.info({ module: 'mover', message: 'Original lookup failed', error: err.message, filename });
    }

    // If original found and processed missing, move original -> processed
    try {
      let processedExists = true;
      try { await stat(processedPath); } catch (e) { processedExists = false; }

      if (originalPath && !processedExists) {
        if (moveOriginals) {
          if (!dryRun) {
            await moveFile(originalPath, processedPath);
            logger.info({ module: 'mover', message: 'Moved original to processed', originalPath, processedPath });
          } else {
            logger.info({ module: 'mover', message: 'Dry-run: would move original to processed', originalPath, processedPath });
          }
          processedExists = true;
        } else {
          logger.info({ module: 'mover', message: 'Move-originals disabled; skipping move', originalPath, processedPath });
        }
      }

      // If original exists and processed already exists, archive the original to avoid inbox duplication
      if (originalPath && processedExists && archiveOriginals) {
        // create archive path for original: archive/<category>/YYYY/MM/DD/originals/<hash-or-ts>-orig-<filename>
        const d = new Date(r.ingested_at || now);
        const y = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const origArchiveDir = join(paths.archive, category, String(y), mm, dd, 'originals');
        const ext = extname(filename) || '';
        const origArchiveName = (hash ? `${hash}-orig-${filename}` : `${Date.now()}-orig-${filename}`) + '';
        const origArchivePath = join(origArchiveDir, origArchiveName);

        try {
          // if archive of original exists, skip
          try { await stat(origArchivePath); logger.info({ module: 'mover', message: 'Original archive already exists', origArchivePath }); }
          catch (e) {
            if (!dryRun) {
              await moveFile(originalPath, origArchivePath);
              logger.info({ module: 'mover', message: 'Moved original to archive', originalPath, origArchivePath });
            } else {
              logger.info({ module: 'mover', message: 'Dry-run: would move original to archive', originalPath, origArchivePath });
            }
          }
        } catch (err) {
          logger.error({ module: 'mover', message: 'Failed to archive original', originalPath, error: err.message });
          errors.push({ file: originalPath, error: err.message });
        }

        // record originalPath in lineage later
      } else if (originalPath && processedExists && !archiveOriginals) {
        logger.info({ module: 'mover', message: 'Archive-originals disabled; leaving original in inbox', originalPath });
      }

      // At this point, ensure processed file exists before archiving processed copy
      try {
        await stat(processedPath);
      } catch (err) {
        logger.warn({ module: 'mover', message: 'Processed file missing after attempts; skipping', processedPath, error: err.message });
        continue;
      }

      // Archive processed file as before
      const d = new Date(r.ingested_at || now);
      const y = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const ext = extname(filename) || '';
      const archiveDir = join(paths.archive, category, String(y), mm, dd);
      const archiveName = (hash ? hash : `${Date.now()}-${filename}`) + ext;
      const archivePath = join(archiveDir, archiveName);

      try {
        await mkdir(archiveDir, { recursive: true });

        try {
          await stat(archivePath);
          logger.info({ module: 'mover', message: 'Archive already exists', archivePath });
        } catch (err) {
          if (err.code === 'ENOENT') {
            if (!dryRun) {
              // copy processed to tmp then rename
              const tmp = archivePath + TEMP_SUFFIX;
              await safeCopyFile(processedPath, tmp);
              await rename(tmp, archivePath);
              archived++;
              logger.info({ module: 'mover', message: 'Archived file', processedPath, archivePath });
            } else {
              archived++;
              logger.info({ module: 'mover', message: 'Dry-run: would archive', processedPath, archivePath });
            }
          } else throw err;
        }
      } catch (err) {
        logger.error({ module: 'mover', message: 'Failed to archive processed', processedPath, error: err.message });
        errors.push({ file: processedPath, error: err.message });
      }

      // Insert lineage with originalPath if known
      try {
        if (writeDb) {
          const stmt = db.prepare(`
            INSERT OR IGNORE INTO lineage
              (search_index_id, hash_sha256, original_path, processed_path, sidecar_path, archive_path, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);

          const result = stmt.run(
            r.search_index_id,
            hash,
            originalPath,
            processedPath,
            sidecarPath,
            archivePath,
            new Date().toISOString()
          );

          if (result.changes && result.changes > 0) lineageInserted++;
        } else {
          logger.info({ module: 'mover', message: 'Dry-run: would insert lineage', searchIndexId: r.search_index_id, processedPath, archivePath, originalPath });
        }
      } catch (err) {
        logger.error({ module: 'mover', message: 'Failed to insert lineage', error: err.message, processedPath });
        errors.push({ file: processedPath, error: err.message });
      }

      processed++;
    } catch (err) {
      logger.error({ module: 'mover', message: 'Mover error', file: processedPath, error: err.message });
      errors.push({ file: processedPath, error: err.message });
    }
  }

  const completedAt = new Date().toISOString();
  logger.info({
    module: 'mover',
    message: 'Run completed',
    startedAt: now,
    completedAt,
    processed,
    archived,
    lineageInserted,
    errors
  });

  return { processed, archived, lineageInserted, errors };
}
