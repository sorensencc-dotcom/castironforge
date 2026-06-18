import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = process.env.REPO_ROOT
  ?? path.resolve(new URL('.', import.meta.url).pathname, '../../..');

// File extensions worth documenting
const SUPPORTED_EXTS = new Set(['.js', '.ts', '.py', '.yaml', '.yml']);

// Never document these
const IGNORE_PATTERNS = [
  /node_modules/,
  /\.venv/,
  /dist\//,
  /\.git\//,
  /package-lock\.json/,
  /auto-docs\/src\//,   // don't self-document
];

function shouldIgnore(filePath) {
  return IGNORE_PATTERNS.some(p => p.test(filePath));
}

function getChangedFiles() {
  // In CI: compare HEAD to HEAD~1. Locally (REPO_ROOT override): use git status.
  try {
    const result = execSync('git diff --name-only HEAD~1 HEAD', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    return result.trim().split('\n').filter(Boolean);
  } catch {
    // Fallback: all tracked files with local modifications
    const result = execSync('git diff --name-only', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    return result.trim().split('\n').filter(Boolean);
  }
}

export async function scanChangedFiles() {
  const changed = getChangedFiles();

  const relevant = [];
  for (const rel of changed) {
    const ext = path.extname(rel);
    if (!SUPPORTED_EXTS.has(ext)) continue;
    if (shouldIgnore(rel)) continue;

    const abs = path.join(REPO_ROOT, rel);
    if (!existsSync(abs)) continue;      // deleted files — skip

    const content = await readFile(abs, 'utf8');
    relevant.push({ rel, abs, ext, content });
  }

  return relevant;
}
