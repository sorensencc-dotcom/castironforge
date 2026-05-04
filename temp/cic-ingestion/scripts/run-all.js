#!/usr/bin/env node
// file: scripts/run-all.js
// version: 1.1.0 — aligned with unified runner suite
// updated: 2026-05-04

import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getPaths } from '../src/lib/paths.js';
import { log } from '../src/lib/logger.js';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const SCRIPTS    = __dirname;
const PROJECT    = resolve(__dirname, '..');
const NODE       = process.execPath;

const MODULE = 'run-all';

const STAGES = [
  { name: 'init',                script: 'init.js' },
  { name: 'folders-maintenance', script: 'cic-folders-maintenance.js' },
  { name: 'harvester',           script: 'run-harvester.js' },
  { name: 'sweeper',             script: 'run-sweeper.js' },
  { name: 'mover',               script: 'run-mover.js' },
  { name: 'indexer',             script: 'run-indexer.js' },
  { name: 'corpus',              script: 'run-corpus.js' },
  { name: 'pipeline',            script: 'run-pipeline.js' },
  { name: 'status',              script: 'print-status.js' }
];

const PARALLEL_GROUPS = [
  ['harvester', 'sweeper']
];

const args       = process.argv.slice(2);
const stopOnFail = args.includes('--stop-on-fail');
const dryRun     = args.includes('--dry-run');
const parallel   = args.includes('--parallel');

function argValue(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

const skipSet = new Set(
  (argValue('--skip') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
);

function preflight(paths) {
  const issues = [];

  if (!existsSync(paths.inboxRoot))
    issues.push(`Inbox root not accessible: ${paths.inboxRoot}`);

  if (!existsSync(paths.inbox))
    issues.push(`Inbox folder missing: ${paths.inbox}`);

  if (!existsSync(paths.statusDir))
    issues.push(`Status directory missing: ${paths.statusDir}`);

  for (const stage of STAGES) {
    if (!existsSync(join(SCRIPTS, stage.script)))
      issues.push(`Script missing: ${stage.script}`);
  }

  if (issues.length > 0 && !dryRun) {
    log('warn', MODULE, 'Pre-flight issues', { issues });
    for (const i of issues) console.error(`  ⚠  ${i}`);
  }

  return issues;
}

async function runStage(stage) {
  const scriptPath = join(SCRIPTS, stage.script);
  const t0 = Date.now();

  log('info', MODULE, `▸ Starting: ${stage.name}`, { script: stage.script });

  try {
    const { stdout, stderr } = await execFileAsync(NODE, [scriptPath], {
      cwd: PROJECT,
      env: { ...process.env },
      timeout: 15 * 60 * 1000
    });

    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    log('info', MODULE, `✓ Completed: ${stage.name}`, { elapsed: `${elapsed}s` });

    return { name: stage.name, status: 'ok', elapsed };
  } catch (err) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    log('error', MODULE, `✗ Failed: ${stage.name}`, {
      elapsed: `${elapsed}s`,
      error: err.message
    });

    return { name: stage.name, status: 'failed', elapsed, error: err.message };
  }
}

function isParallelGroup(names) {
  if (!parallel) return false;
  return PARALLEL_GROUPS.some(g =>
    names.length === g.length && names.every(n => g.includes(n))
  );
}

async function main() {
  const paths   = getPaths();
  const runId   = new Date().toISOString().replace(/[:.]/g, '-');
  const planned = STAGES.filter(s => !skipSet.has(s.name));
  const skipped = STAGES.filter(s => skipSet.has(s.name)).map(s => s.name);

  log('info', MODULE, 'Full run starting', {
    runId,
    stages: planned.map(s => s.name),
    skipped,
    stopOnFail,
    parallel,
    dryRun
  });

  preflight(paths);

  if (dryRun) {
    console.log('');
    console.log('  DRY RUN — full execution plan:');
    console.log(`  Inbox Root: ${paths.inboxRoot}`);
    console.log(`  DB:         ${paths.db}`);
    console.log('');
    for (let i = 0; i < planned.length; i++) {
      const exists = existsSync(join(SCRIPTS, planned[i].script)) ? '✓' : '✗';
      const pTag = parallel && PARALLEL_GROUPS.flat().includes(planned[i].name)
        ? ' [parallel]'
        : '';
      console.log(`    ${i + 1}. [${exists}] ${planned[i].name}  →  ${planned[i].script}${pTag}`);
    }
    if (skipped.length > 0) console.log(`    Skipped: ${skipped.join(', ')}`);
    console.log(`    Stop-on-fail: ${stopOnFail}`);
    console.log(`    Parallel: ${parallel}`);
    console.log('');
    return;
  }

  const results = [];
  let aborted = false;
  let i = 0;

  while (i < planned.length) {
    if (aborted) {
      results.push({ name: planned[i].name, status: 'skipped', elapsed: '0' });
      i++;
      continue;
    }

    const lookahead = planned.slice(i, i + 2).map(s => s.name);

    if (lookahead.length === 2 && isParallelGroup(lookahead)) {
      log('info', MODULE, `Running in parallel: ${lookahead.join(', ')}`);

      const batch = await Promise.all([
        runStage(planned[i]),
        runStage(planned[i + 1])
      ]);

      results.push(...batch);

      if (stopOnFail && batch.some(r => r.status === 'failed')) {
        log('warn', MODULE, 'Stop-on-fail triggered during parallel batch');
        aborted = true;
      }

      i += 2;
    } else {
      const result = await runStage(planned[i]);
      results.push(result);

      if (result.status === 'failed' && stopOnFail) {
        log('warn', MODULE, 'Stop-on-fail triggered');
        aborted = true;
      }

      i++;
    }
  }

  const ok     = results.filter(r => r.status === 'ok').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const total  = results.reduce((s, r) => s + parseFloat(r.elapsed || 0), 0).toFixed(1);

  console.log('');
  console.log('  CIC FULL RUN — SUMMARY');
  console.log('  ═══════════════════════════════════════════════');
  for (const r of results) {
    const icon = r.status === 'ok' ? '✓' : r.status === 'failed' ? '✗' : '⊘';
    console.log(`  ${icon}  ${r.name.padEnd(22)} ${r.status.padEnd(16)} ${(r.elapsed + 's').padStart(8)}`);
  }
  console.log('  ───────────────────────────────────────────────');
  console.log(`  Total: ${ok} ok, ${failed} failed   Elapsed: ${total}s`);
  console.log('');

  log('info', MODULE, 'Full run finished', {
    runId,
    ok,
    failed,
    elapsed: `${total}s`
  });

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  log('error', MODULE, 'Fatal', { error: err.message });
  process.exit(1);
});
