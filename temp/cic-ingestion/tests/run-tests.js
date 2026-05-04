#!/usr/bin/env node
// Simple integration test for mover behavior (mock DB, proper config)
import { writeFile, mkdir, stat, rm, copyFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runMover } from '../src/mover/mover.js';
import { hashFile } from '../src/harvester/hash.js';
import { log } from '../src/lib/logger.js';

// Use test directories in project root
const testTmpBase = join(process.cwd(), '.test-mover-temp');

console.log('Test temp dir:', testTmpBase);

// Set CIC_ROOT to override config
process.env.CIC_ROOT = testTmpBase;

// Cleanup any previous test artifacts
try {
  await rm(testTmpBase, { recursive: true, force: true });
} catch {}

// Backup and restore config/paths.json
const CONFIG_PATH = join(process.cwd(), 'config', 'paths.json');
const CONFIG_BAK = CONFIG_PATH + '.test-bak';

try {
  // Backup original config
  await copyFile(CONFIG_PATH, CONFIG_BAK);
  
  // Update config to use test dirs (CIC_ROOT will handle inboxRoot)
  const configRaw = JSON.parse(await readFile(CONFIG_BAK, 'utf8'));
  configRaw.db = join(testTmpBase, 'data', 'test-cic.db');
  configRaw.archive = join(testTmpBase, '_Archive');
  
  await writeFile(CONFIG_PATH, JSON.stringify(configRaw, null, 2));
  
  // Create test dirs using correct CIC names
  const inbox = join(testTmpBase, 'CIC_Inbox');
  const processed = join(testTmpBase, 'CIC_Processed');
  const sidecars = join(testTmpBase, 'CIC_Sidecars');
  const archive = join(testTmpBase, '_Archive');
  const inboxDocs = join(inbox, 'documents');
  const procDocs = join(processed, 'documents');
  
  await mkdir(inboxDocs, { recursive: true });
  await mkdir(procDocs, { recursive: true });
  await mkdir(sidecars, { recursive: true });
  await mkdir(archive, { recursive: true });

  // Create an original file in inbox/documents
  const originalPath = join(inboxDocs, 'test-doc.docx');
  await writeFile(originalPath, 'hello world', 'utf8');

  // Compute hash
  const h = await hashFile(originalPath);
  const procPath = join(procDocs, 'test-doc.docx');

  // Create mock DB
  const searchIndexRows = [
    {
      search_index_id: 1,
      filename: 'test-doc.docx',
      category: 'documents',
      mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size_bytes: 11,
      hash_sha256: h,
      ingested_at: new Date().toISOString(),
      processed_path: procPath,
      sidecar_path: null
    }
  ];

  const mockDb = {
    prepare: (sql) => ({
      all: () => (sql.includes('SELECT') && sql.includes('search_index')) ? searchIndexRows : [],
      run: () => ({ changes: 1 }),
      get: () => ({ id: 1 })
    }),
    close: () => {}
  };

  // Run mover
  const logger = { 
    info: (d) => log('info', 'test', typeof d === 'object' ? d.message || JSON.stringify(d) : d),
    warn: (d) => log('warn', 'test', typeof d === 'object' ? d.message || JSON.stringify(d) : d),
    error: (d) => log('error', 'test', typeof d === 'object' ? d.message || JSON.stringify(d) : d)
  };
  
  const res = await runMover(mockDb, logger, { dryRun: false, moveOriginals: true, archiveOriginals: true, writeDb: true });
  
  console.log('✓ Mover executed');
  console.log('  Result:', res);

  // Check if processed file exists
  try {
    await stat(procPath);
    console.log('✓ Processed file exists:', procPath);
  } catch {
    throw new Error('Processed file missing after run');
  }

  console.log('\n✓ TEST PASS');
  
} catch (err) {
  console.error('\n✗ TEST FAIL', err.message || err);
  process.exit(1);
} finally {
  // Restore config
  try {
    if (CONFIG_BAK) await copyFile(CONFIG_BAK, CONFIG_PATH);
  } catch {}
  try {
    await rm(testTmpBase, { recursive: true, force: true });
  } catch {}
}
