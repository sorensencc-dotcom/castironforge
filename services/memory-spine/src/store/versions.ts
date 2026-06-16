import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.MEMORY_SPINE_DATA_DIR ?? join(__dirname, '../../data');
const VERSIONS_FILE = join(DATA_DIR, 'versions.json');

export interface VersionManifest {
  active: string;
  previous: string | null;
  available: string[];
  history: Array<{ version: string; activated_at: string }>;
}

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function loadVersions(): VersionManifest {
  ensureDataDir();
  if (!existsSync(VERSIONS_FILE)) {
    const initial: VersionManifest = {
      active: 'memory-v1',
      previous: null,
      available: ['memory-v1'],
      history: [{ version: 'memory-v1', activated_at: new Date().toISOString() }],
    };
    writeFileSync(VERSIONS_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(readFileSync(VERSIONS_FILE, 'utf-8')) as VersionManifest;
}

export function saveVersions(manifest: VersionManifest): void {
  ensureDataDir();
  writeFileSync(VERSIONS_FILE, JSON.stringify(manifest, null, 2));
}

export function activateVersion(targetVersion: string): { active_version: string; previous_version: string } {
  const manifest = loadVersions();
  if (!manifest.available.includes(targetVersion)) {
    manifest.available.push(targetVersion);
  }
  const prev = manifest.active;
  manifest.previous = prev;
  manifest.active = targetVersion;
  manifest.history.push({ version: targetVersion, activated_at: new Date().toISOString() });
  saveVersions(manifest);
  return { active_version: targetVersion, previous_version: prev };
}

export function rollbackVersion(toVersion?: string): { active_version: string; rolled_back_from: string } {
  const manifest = loadVersions();
  const rolledBackFrom = manifest.active;
  const target = toVersion ?? manifest.previous ?? manifest.active;
  manifest.previous = rolledBackFrom;
  manifest.active = target;
  manifest.history.push({ version: target, activated_at: new Date().toISOString() });
  saveVersions(manifest);
  return { active_version: target, rolled_back_from: rolledBackFrom };
}
