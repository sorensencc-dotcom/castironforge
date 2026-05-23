#!/usr/bin/env node
// file: scripts/run-scanner.js
// date: 2026-05-22
// version: 1.0.0
// Malware Scanner — scans CIC_Quarantine using ClamAV.
// Clean files are moved to CIC_Inbox/documents (default) or identified category.
// Malicious files are moved to _Archive/Malicious and logged.

import { execSync } from 'node:child_process';
import { readdirSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { join, basename } from 'node:path';
import { getPaths } from '../src/lib/paths.js';
import { log, logError } from '../src/lib/logger.js';

const MODULE = 'scanner';

async function main() {
  const paths = getPaths();
  const quarantineDir = paths.quarantine;
  const inboxDir = join(paths.inbox, 'documents'); // Default landing for clean files
  const archiveDir = join(paths.archive, 'Malicious');

  if (!existsSync(quarantineDir)) {
    log('info', MODULE, 'Quarantine directory does not exist. Nothing to scan.');
    return;
  }

  if (!existsSync(archiveDir)) {
    mkdirSync(archiveDir, { recursive: true });
  }

  const files = readdirSync(quarantineDir).filter(f => !f.startsWith('.'));

  if (files.length === 0) {
    log('info', MODULE, 'Quarantine is empty.');
    return;
  }

  log('info', MODULE, `Found ${files.length} files in quarantine. Starting scan...`);

  for (const file of files) {
    const filePath = join(quarantineDir, file);
    
    try {
      // --no-summary reduces noise. exit code 0 = clean, 1 = virus found, 2 = error.
      execSync(`clamscan --no-summary "${filePath}"`, { stdio: 'ignore' });
      
      // If we reach here, it's clean (exit code 0)
      log('info', MODULE, 'File clean', { file });
      
      await emitSecurityEvent('security.scan', { status: 'CLEAN', file });

      const targetPath = join(inboxDir, file);
      if (!existsSync(inboxDir)) mkdirSync(inboxDir, { recursive: true });
      
      renameSync(filePath, targetPath);
      log('info', MODULE, 'Moved to inbox', { file, target: targetPath });
      
    } catch (err) {
      if (err.status === 1) {
        // Virus found
        log('warn', MODULE, 'MALWARE DETECTED', { file });
        
        await emitSecurityEvent('security.scan', { status: 'MALICIOUS', file, detail: 'Virus found' });

        const targetPath = join(archiveDir, file);
        renameSync(filePath, targetPath);
        log('warn', MODULE, 'Moved to malicious archive', { file, target: targetPath });
      } else {
        // Other error (e.g. clamscan missing or file inaccessible)
        logError(MODULE, 'Scan error', { file, error: err.message });
        await emitSecurityEvent('security.scan_error', { file, error: err.message });
      }
    }
  }

  log('info', MODULE, 'Scan cycle complete.');
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
    // Silent fail for telemetry to avoid pipeline disruption
  }
}

main().catch(err => {
  logError(MODULE, 'Scanner fatal error', { error: err.message });
  process.exit(1);
});
