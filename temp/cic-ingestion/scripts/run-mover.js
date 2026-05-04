#!/usr/bin/env node
// file: scripts/run-mover.js
// runner for the post-ingestion mover/archiver

import { migrate } from '../src/db/migrate.js';
import { getPaths } from '../src/lib/paths.js';
import { runMover } from '../src/mover/mover.js';
import { log } from '../src/lib/logger.js';

const MODULE = 'run-mover';

async function main() {
  const paths = getPaths();
  log('info', MODULE, 'Starting mover', { db: paths.db });

  let db;
  try {
    db = await migrate(paths.db);
  } catch (err) {
    log('error', MODULE, 'DB init failed', { error: err.message });
    process.exit(1);
  }

  const logger = {
    info: (data) => log('info', 'mover', data.message, data),
    warn: (data) => log('warn', 'mover', data.message, data),
    error: (data) => log('error', 'mover', data.message, data)
  };

  try {
    const summary = await runMover(db, logger, { dryRun: process.argv.includes('--dry-run') });
    log('info', MODULE, 'Done', summary);
    process.exitCode = 0;
  } catch (err) {
    log('error', MODULE, 'Mover failed', { error: err.message, stack: err.stack });
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();
