// file: src/lib/folder-validator.js
// created: 2026-05-03
// updated: 2026-05-03
// version: 1.0.0
// CIC folder structure validation and self-healing.
// Used by: validate-cic-folders.js, cic-folders-maintenance.js, run-pipeline.js

import { existsSync, mkdirSync } from 'node:fs';
import { getPaths } from './paths.js';
import { log, logWarn } from './logger.js';

const MODULE = 'folder-validator';

/**
 * Build the required directory list from paths config.
 * @returns {Array<{ label: string, path: string }>}
 */
function getRequiredDirs() {
  const paths = getPaths();
  const cats  = paths.categories;

  const dirs = [
    { label: 'CIC_Inbox',             path: paths.inbox },
    { label: 'CIC_Processed',         path: paths.processed },
    { label: 'CIC_Processed/_status', path: paths.statusDir },
    { label: 'CIC_Sidecars',          path: paths.sidecars },
    { label: 'CIC_Bundles',           path: paths.bundles },
    { label: 'CIC_Bundles/batches',   path: paths.bundlesDir.batches },
    { label: 'CIC_Bundles/daily',     path: paths.bundlesDir.daily },
    { label: 'CIC_Bundles/corpora',   path: paths.bundlesDir.corpora },
    { label: 'CIC_DailyTasks',        path: paths.dailyTasks },
    { label: 'Research/_Archive',     path: paths.archive },
  ];

  for (const cat of cats) {
    dirs.push({ label: `CIC_Inbox/${cat}`,     path: paths.inboxDirs[cat] });
    dirs.push({ label: `CIC_Processed/${cat}`, path: paths.processedDirs[cat] });
  }

  const dailyTaskSubs = ['News', 'People', 'Locations', 'Events'];
  for (const sub of dailyTaskSubs) {
    dirs.push({ label: `CIC_DailyTasks/${sub}`, path: `${paths.dailyTasks}\\${sub}` });
  }

  return dirs;
}

/**
 * Validate (and optionally heal) the CIC folder structure.
 *
 * @param {{ heal?: boolean }} [opts]
 * @returns {{ ok: boolean, missing: string[], created: string[], checked: number }}
 */
export function validateFolders(opts = {}) {
  const heal    = opts.heal === true;
  const dirs    = getRequiredDirs();
  const missing = [];
  const created = [];

  for (const { label, path } of dirs) {
    if (!existsSync(path)) {
      missing.push(label);
      if (heal) {
        try {
          mkdirSync(path, { recursive: true });
          created.push(label);
          log('info', MODULE, `Created missing dir: ${label}`, { path });
        } catch (err) {
          logWarn(MODULE, `Failed to create dir: ${label}`, { path, error: err.message });
        }
      } else {
        logWarn(MODULE, `Missing dir: ${label}`, { path });
      }
    } else {
      log('debug', MODULE, `OK: ${label}`, { path });
    }
  }

  const ok = heal ? created.length === missing.length : missing.length === 0;

  return {
    ok,
    missing,
    created,
    checked: dirs.length,
  };
}
