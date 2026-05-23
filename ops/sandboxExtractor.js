// file: src/harvester/sandboxExtractor.js
// date: 2026-05-23
// version: 1.0.0
// Executes the extraction logic inside a restricted Docker container.

import { execSync } from 'node:child_process';
import { resolve, basename, dirname } from 'node:path';
import { log, logError } from '../lib/logger.js';

const MODULE = 'sandbox-extractor';

/**
 * Run extraction in a Docker sandbox.
 * @param {string} filePath - Absolute path to the file.
 * @param {string} category - File category (documents, photos, etc).
 * @returns {object} - Extraction result.
 */
export function extractInSandbox(filePath, category) {
  const absPath = resolve(filePath);
  const dir     = dirname(absPath);
  const file    = basename(absPath);
  const start   = Date.now();

  log('debug', MODULE, 'Running sandbox extraction', { file, category });

  try {
    // Mount the directory containing the file as read-only.
    // Run with --network none for maximum isolation.
    const cmd = `docker run --rm \
      --network none \
      -v "${dir}":/data:ro \
      cic-extractor-sandbox "/data/${file}" "${category}"`;

    const output = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    const durationMs = Date.now() - start;
    
    emitSecurityEvent('security.sandbox_run', { 
      file, 
      category, 
      status: 'success', 
      durationMs 
    });

    return JSON.parse(output);
  } catch (err) {
    const durationMs = Date.now() - start;
    logError(MODULE, 'Sandbox extraction failed', { 
      file, 
      error: err.message,
      stdout: err.stdout,
      stderr: err.stderr 
    });
    
    emitSecurityEvent('security.sandbox_run', { 
      file, 
      category, 
      status: 'failed', 
      error: err.message,
      durationMs 
    });

    // Fallback or return partial failure record
    return {
      error: true,
      message: err.message,
      sizeBytes: 0,
      extractedText: null,
      entities: [],
      topics: [],
    };
  }
}

/**
 * Emits a security event to the MCP.
 */
async function emitSecurityEvent(event, data) {
  const mcpUrl = process.env.MCP_BASE_URL || 'http://localhost:3000';
  try {
    await fetch(`${mcpUrl}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        ...data,
        timestamp: new Date().toISOString()
      })
    });
  } catch (err) {
    // Silent fail
  }
}

