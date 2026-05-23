// filename: ingestionAgent.js
// date: 2026-05-22
// version: 2.0.0
// Ingestion Agent — handles secure ingestion with ClamAV scanning.
// All ingested material lands in Quarantine first.

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { validateRawInput, detectMimeType, resolveUrl } from './ingestionValidator.js';
import { buildAssetRecord, persistAssetRecord } from './ingestionSchema.js';
import { getPaths } from '../lib/paths.js';
import { log, logError, logWarn } from '../lib/logger.js';

const MODULE = 'ingestion-agent';

// Validate all env vars at module load
const REQUIRED_ENV = [
  'DATABASE_URL',
  'MCP_BASE_URL',
  'INGESTION_PORT',
  'INGESTION_AGENT_ID',
  'ASSET_STORAGE_PATH'
];

for (const env of REQUIRED_ENV) {
  if (!process.env[env]) {
    throw new Error(`Missing environment variable: ${env}`);
  }
}

const paths = getPaths();
const config = {
  dbUrl: process.env.DATABASE_URL,
  mcpBaseUrl: process.env.MCP_BASE_URL,
  agentId: process.env.INGESTION_AGENT_ID,
  storagePath: process.env.ASSET_STORAGE_PATH,
  quarantinePath: paths.quarantine,
  maliciousPath: path.join(paths.archive, 'Malicious')
};

/** @type {any} */
let dbInstance = null;

/**
 * Initializes the agent with a database instance.
 * @param {any} db 
 */
export function setDatabase(db) {
  dbInstance = db;
}

/**
 * @typedef {Object} IngestionResult
 * @property {string | null} assetId
 * @property {'ok' | 'error' | 'unsupported'} status
 * @property {string} mimeType
 * @property {string | null} storagePath
 * @property {number} durationMs
 * @property {string | null} error
 */

/**
 * Ingests raw source material with mandatory malware scanning.
 * @param {import('./ingestionValidator.js').RawInput} rawInput 
 * @returns {Promise<IngestionResult>}
 */
export async function ingest(rawInput) {
  const start = Date.now();
  let assetId = null;
  let finalMimeType = rawInput.mimeType;
  let payloadBuffer = null;

  try {
    // 1. Validate rawInput shape
    const validation = validateRawInput(rawInput);
    if (!validation.valid) {
      const status = validation.error && validation.error.startsWith('Unsupported MIME type')
        ? 'unsupported'
        : 'error';
      return createResult(null, status, finalMimeType, null, start, validation.error);
    }

    // 2. Detect/confirm MIME type
    if (rawInput.sourceType === 'url') {
      log('info', MODULE, 'Resolving URL', { url: rawInput.payload });
      const resolved = await resolveUrl(rawInput.payload);
      finalMimeType = resolved.mimeType;
      payloadBuffer = resolved.payload;
    } else {
      payloadBuffer = Buffer.isBuffer(rawInput.payload) 
        ? rawInput.payload 
        : Buffer.from(rawInput.payload);
      
      const detected = detectMimeType(payloadBuffer);
      if (detected !== 'application/octet-stream' && detected !== finalMimeType) {
        log('debug', MODULE, 'MIME detection override', { provided: finalMimeType, detected });
        finalMimeType = detected;
      }
    }

    // 3. Assign assetId
    assetId = crypto.randomUUID();

    // 4. Secure Landing (Quarantine)
    const ext = getExtension(finalMimeType);
    const storageFile = `${assetId}${ext}`;
    const linuxTempPath = path.join('/tmp', storageFile);
    const quarantinePath = path.join(config.quarantinePath, storageFile);
    const absolutePath = path.join(config.storagePath, storageFile);
    
    // Write to Linux-native /tmp first to avoid WSL2 /mnt/c/ interop issues with ClamAV
    await fs.writeFile(linuxTempPath, payloadBuffer);

    // 5. Malware Scan
    log('info', MODULE, 'Scanning for malware', { assetId, file: storageFile });
    try {
      execSync(`clamscan --no-summary "${linuxTempPath}"`, { stdio: 'ignore' });
      log('info', MODULE, 'File clean', { assetId });
      await emitSecurityEvent('security.scan', { assetId, status: 'CLEAN', file: storageFile });
    } catch (scanErr) {
      if (scanErr.status === 1) {
        logWarn(MODULE, 'MALWARE DETECTED — Quarantining permanently', { assetId, file: storageFile });
        await emitSecurityEvent('security.scan', { assetId, status: 'MALICIOUS', file: storageFile, detail: 'Virus found' });
        await fs.mkdir(config.maliciousPath, { recursive: true });
        const maliciousDest = path.join(config.maliciousPath, storageFile);
        await fs.copyFile(linuxTempPath, maliciousDest);
        await fs.unlink(linuxTempPath);
        throw new Error('Security Error: Malware detected in ingested payload.');
      }
      await emitSecurityEvent('security.scan_error', { assetId, file: storageFile, error: scanErr.message });
      // Cleanup temp file on error
      if (existsSync(linuxTempPath)) await fs.unlink(linuxTempPath);
      throw new Error(`Malware scan failed: ${scanErr.message}`);
    }

    // 6. Move to permanent storage (and keep copy in quarantine if desired, or just move)
    await fs.mkdir(config.storagePath, { recursive: true });
    await fs.copyFile(linuxTempPath, absolutePath);
    
    await fs.mkdir(config.quarantinePath, { recursive: true });
    await fs.copyFile(linuxTempPath, quarantinePath);
    await fs.unlink(linuxTempPath);



    // 7. Persist to DB
    if (!dbInstance) {
      throw new Error('Database instance not initialized for Ingestion Agent');
    }
    const record = buildAssetRecord(assetId, { ...rawInput, mimeType: finalMimeType }, absolutePath);
    await persistAssetRecord(record, dbInstance);

    // 8. Emit pipeline trigger event
    await emitTriggerEvent(assetId, finalMimeType);

    log('info', MODULE, 'Ingestion successful', { assetId, mimeType: finalMimeType, durationMs: Date.now() - start });

    return createResult(assetId, 'ok', finalMimeType, absolutePath, start, null);

  } catch (error) {
    logError(MODULE, 'Ingestion failed', { assetId, error: error.message });
    return createResult(assetId, 'error', finalMimeType, null, start, error.message);
  }
}

/**
 * Creates an IngestionResult.
 */
function createResult(assetId, status, mimeType, storagePath, start, error) {
  return {
    assetId,
    status,
    mimeType,
    storagePath,
    durationMs: Date.now() - start,
    error
  };
}

/**
 * Emits a trigger event to the MCP.
 */
async function emitTriggerEvent(assetId, mimeType) {
  const url = `${config.mcpBaseUrl}/events`;
  const body = {
    event: 'asset.ingested',
    assetId,
    mimeType,
    timestamp: new Date().toISOString()
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      log('warn', MODULE, 'Failed to emit event', { status: res.status, assetId });
    } else {
      log('info', MODULE, 'Trigger event emitted', { assetId });
    }
  } catch (err) {
    logError(MODULE, 'Error emitting trigger event', { error: err.message, assetId });
  }
}

/**
 * Emits a security event to the MCP.
 */
async function emitSecurityEvent(event, data) {
  const url = `${config.mcpBaseUrl}/events`;
  const body = {
    event,
    ...data,
    timestamp: new Date().toISOString()
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      log('warn', MODULE, 'Failed to emit security event', { status: res.status, event });
    }
  } catch (err) {
    logError(MODULE, 'Error emitting security event', { error: err.message, event });
  }
}

/**
 * Maps MIME type to file extension.
 */
function getExtension(mimeType) {
  switch (mimeType) {
    case 'image/jpeg':      return '.jpg';
    case 'image/png':       return '.png';
    case 'image/webp':      return '.webp';
    case 'image/gif':       return '.gif';
    case 'application/pdf': return '.pdf';
    case 'text/plain':      return '.txt';
    case 'text/html':       return '.html';
    case 'application/json':return '.json';
    case 'video/mp4':       return '.mp4';
    case 'audio/mpeg':      return '.mp3';
    default:                return '.bin';
  }
}
