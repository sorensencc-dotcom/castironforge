#!/usr/bin/env node
// file: scripts/run-harvester.js
// created: 2026-05-03
// updated: 2026-05-03
// version: 1.0.0
// CLI: Run the CIC Harvester over CIC_Inbox directories.
// Usage: node scripts/run-harvester.js

import { migrate } from '../src/db/migrate.js';
import { getPaths } from '../src/lib/paths.js';
import { runHarvester } from '../src/harvester/harvester.js';
import { log, logError } from '../src/lib/logger.js';

const MODULE = 'run-harvester';

async function main() {
  const paths = getPaths();
  log('info', MODULE, 'Starting harvester', { db: paths.db });

  let db;
  try {
    db = migrate(paths.db);
  } catch (err) {
    logError(MODULE, 'DB init failed', { error: err.message });
    process.exit(1);
  }

  try {
    const summary = runHarvester(db);
    log('info', MODULE, 'Done', summary);
    process.exitCode = 0;
  } catch (err) {
    logError(MODULE, 'Harvester failed', { error: err.message, stack: err.stack });
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();
