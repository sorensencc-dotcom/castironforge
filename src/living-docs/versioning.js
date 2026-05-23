// File: src/living-docs/versioning.js | Date: 2026-05-18 | v1.0.0
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

/**
 * Creates a local backup of a file before it's overwritten.
 * @param {string} localPath 
 */
export function backupLocal(localPath) {
  if (!existsSync(localPath)) return;
  
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = join("backups", "living-docs", dirname(localPath));
  
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  const base = basename(localPath);
  const backupPath = join(dir, `${base}.${ts}.bak.md`);
  
  copyFileSync(localPath, backupPath);
  console.log(`[LIVING-DOCS] Backup created: ${backupPath}`);
  return backupPath;
}
