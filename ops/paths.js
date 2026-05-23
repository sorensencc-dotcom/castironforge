// file: src/lib/paths.js
// created: 2026-05-03
// updated: 2026-05-03
// version: 1.1.0
// Resolves all CIC path constants from config/paths.json.
// Override inboxRoot at runtime with CIC_ROOT env var.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const CONFIG_PATH = resolve(__dirname, '../../config/paths.json');

function loadConfig() {
  let raw;
  try {
    raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  } catch (err) {
    throw new Error(`paths: cannot read config/paths.json — ${err.message}`);
  }
  return raw;
}

function interpolate(value, vars) {
  if (typeof value !== 'string') return value;
  return value.replace(/\{(\w+)\}/g, (_, key) => {
    if (!(key in vars)) throw new Error(`paths: unresolved variable {${key}} in "${value}"`);
    return vars[key];
  });
}

function buildPaths(raw) {
  // CIC_ROOT env var overrides inboxRoot
  const inboxRoot = process.env.CIC_ROOT ?? raw.inboxRoot;
  const vars = { inboxRoot };

  const p = {
    inboxRoot,
    inbox:      interpolate(raw.inbox,      vars),
    quarantine: interpolate(raw.quarantine, vars),
    processed:  interpolate(raw.processed,  vars),
    sidecars:   interpolate(raw.sidecars,   vars),
    bundles:    interpolate(raw.bundles,    vars),
    dailyTasks: interpolate(raw.dailyTasks, vars),
    archive:    raw.archive,
    db:         raw.db,
    categories: raw.categories,
    sweeper:    raw.sweeper ?? { scanParentFolder: false, ignoreNames: [] },
    status: {
      harvester: interpolate(raw.status.harvester, vars),
      indexer:   interpolate(raw.status.indexer,   vars),
      daily:     interpolate(raw.status.daily,      vars),
      corpus:    interpolate(raw.status.corpus,     vars),
      startup:   interpolate(raw.status.startup,    vars),
    },
  };

  // Derived sub-paths
  p.inboxDirs = Object.fromEntries(
    raw.categories.map(cat => [cat, join(p.inbox, cat)])
  );
  p.processedDirs = Object.fromEntries(
    raw.categories.map(cat => [cat, join(p.processed, cat)])
  );
  p.statusDir  = join(p.processed, '_status');
  p.bundlesDir = {
    batches: join(p.bundles, 'batches'),
    daily:   join(p.bundles, 'daily'),
    corpora: join(p.bundles, 'corpora'),
  };

  return p;
}

// Singleton — parsed once per process.
let _paths = null;
export function getPaths() {
  if (!_paths) _paths = buildPaths(loadConfig());
  return _paths;
}
