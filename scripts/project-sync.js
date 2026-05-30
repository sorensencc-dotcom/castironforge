// scripts/project-sync.js | 2026-05-18 | v1.0.0
/**
 * Success Protocol Automation
 * 1. Syncs Skills (SKILLS_REGISTRY.md)
 * 2. Updates State (CIC_PROJECT_STATE.md version & date)
 * 3. Logs Milestones (Optional input)
 * 4. Emits CIC_CONTEXT for session grounding
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { sync as syncSkills } from './skills-sync.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const STATE_PATH = join(ROOT, 'projects/cic/docs/CIC_PROJECT_STATE.md');
const SYSTEM_PATH = join(ROOT, 'projects/cic/docs/CIC_SYSTEM.md');

async function runSuccess() {
  console.log('🚀 Starting Success Protocol...');

  // 1. Sync Skills
  await syncSkills();

  // 1b. Check for --with-docs
  if (process.argv.includes('--with-docs')) {
    console.log('📖 Including Living Docs Sync...');
    spawnSync('node', [join(__dirname, 'living-docs-sync.js')], { stdio: 'inherit' });
  }

  // 2. Update Project State
  if (!existsSync(STATE_PATH)) {
    console.error(`❌ Project State file not found at ${STATE_PATH}`);
    process.exit(1);
  }

  let stateContent = readFileSync(STATE_PATH, 'utf8');
  const today = new Date().toISOString().slice(0, 10);

  // Bump Version (PATCH)
  const versionMatch = stateContent.match(/# v(\d+)\.(\d+)\.(\d+)/);
  let newVersion = '';
  if (versionMatch) {
    const [full, major, minor, patch] = versionMatch;
    newVersion = `v${major}.${minor}.${parseInt(patch) + 1}`;
    stateContent = stateContent.replace(full, `# ${newVersion}`);
  }

  // Update Date
  stateContent = stateContent.replace(/# \d{4}-\d{2}-\d{2}/, `# ${today}`);

  // 3. Log Milestone (Check for command line args)
  const milestone = process.argv[2];
  if (milestone) {
    console.log(`📝 Logging Milestone: ${milestone}`);
    const parts = milestone.split(':');
    const label = parts[0]?.trim() || 'Update';
    const notes = parts.slice(1).join(':')?.trim() || milestone;
    const newRow = `| **${label}** | **DONE** | ${notes} — ${today} |`;
    
    // Find the header separator
    const tableSection = stateContent.indexOf('## 4. Ingestion System Status');
    const headerSeparator = stateContent.indexOf('|---|---|---|', tableSection);
    
    if (headerSeparator !== -1) {
      const insertionPoint = headerSeparator + '|---|---|---|'.length;
      stateContent = stateContent.slice(0, insertionPoint) + `\n${newRow}` + stateContent.slice(insertionPoint);
    }
  }

  writeFileSync(STATE_PATH, stateContent, 'utf8');
  console.log(`✅ Updated ${STATE_PATH} to ${newVersion} (${today})`);

  // 4. Emit CIC_CONTEXT
  const systemContent = existsSync(SYSTEM_PATH) ? readFileSync(SYSTEM_PATH, 'utf8') : '';
  
  // Extract key sections for context
  const systemSummary = systemContent.match(/## 1\. Project Identity([\s\S]*?)(?=##|$)/)?.[1]?.trim() || '';
  const stateSummary = stateContent.match(/## 4\. Ingestion System Status([\s\S]*?)(?=##|$)/)?.[1]?.trim() || '';
  const openTasks = stateContent.match(/## 5\. Open Tasks([\s\S]*?)(?=---|$)/)?.[1]?.trim() || '';

  const contextBlock = `
<CIC_CONTEXT>
# CIC SESSION CONTEXT | ${newVersion} | ${today}
## Identity
${systemSummary}

## System Status
${stateSummary}

## Open Tasks
${openTasks}
</CIC_CONTEXT>
`;

  console.log('\n--- EMITTING CIC_CONTEXT ---');
  console.log(contextBlock);
  console.log('----------------------------\n');
}

runSuccess().catch(console.error);
