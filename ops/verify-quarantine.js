// file: tests/test-malware-quarantine.js
// date: 2026-05-22
// Test script for validating the Malware Quarantine logic.

import { ingest, setDatabase } from '../src/ingestion/ingestionAgent.js';
import { logInfo, logError } from '../src/lib/logger.js';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { getPaths } from '../src/lib/paths.js';

const MODULE = 'test-security';

// Mock DB
const mockDb = {
  prepare: () => ({ run: () => ({ lastInsertRowid: 1 }), get: () => ({}) })
};

async function runTest() {
  process.env.DATABASE_URL = './test.db';
  process.env.MCP_BASE_URL = 'http://localhost:3000';
  process.env.INGESTION_PORT = '3001';
  process.env.INGESTION_AGENT_ID = 'test-agent';
  process.env.ASSET_STORAGE_PATH = './test_assets';

  setDatabase(mockDb);
  const paths = getPaths();

  const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

  logInfo(MODULE, 'Starting Malware Quarantine Test');

  // 1. Test clean file
  logInfo(MODULE, 'Testing clean file ingestion...');
  const cleanResult = await ingest({
    sourceType: 'file',
    mimeType: 'text/plain',
    payload: 'This is a clean file.',
    sourceMeta: { label: 'clean-test' }
  });

  if (cleanResult.status === 'ok' && existsSync(cleanResult.storagePath)) {
    logInfo(MODULE, 'Clean file test passed.');
    unlinkSync(cleanResult.storagePath);
  } else {
    logError(MODULE, 'Clean file test failed.', cleanResult);
  }

  // 2. Test malicious file (EICAR)
  logInfo(MODULE, 'Testing MALICIOUS file ingestion (EICAR)...');
  const maliciousResult = await ingest({
    sourceType: 'file',
    mimeType: 'text/plain',
    payload: EICAR,
    sourceMeta: { label: 'malicious-test' }
  });

  if (maliciousResult.status === 'error' && maliciousResult.error.includes('Malware detected')) {
    logInfo(MODULE, 'Malicious file test passed: Malware was caught and blocked.');
    
    // Check if it's in the malicious archive
    const maliciousArchive = join(paths.archive, 'Malicious');
    logInfo(MODULE, `Checking malicious archive: ${maliciousArchive}`);
    // We can't easily check the exact filename since it's a UUID, but we can check if folder exists
    if (existsSync(maliciousArchive)) {
       logInfo(MODULE, 'Malicious archive folder exists.');
    }
  } else {
    logError(MODULE, 'Malicious file test FAILED: Malware was NOT caught!', maliciousResult);
  }
}

runTest().catch(err => {
  logError(MODULE, 'Test runner failed', { error: err.message });
});
