// File: scripts/living-docs-sync.js | Date: 2026-05-19 | v2.0.0
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

import { providerRegistry } from '../src/living-docs/providers/providerRegistry.js';
import { computeDiff } from '../src/living-docs/diff.js';
import { backupLocal } from '../src/living-docs/versioning.js';
import { sha256 } from '../src/living-docs/utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CONFIG_PATH = join(ROOT, 'config/living-docs.json');
const STATE_PATH = join(ROOT, 'state/living-docs-state.json');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  if (isDryRun) console.log('🧪 DRY RUN MODE ENABLED - No changes will be written.');
  
  console.log('🔄 Starting Living Docs Sync...');

  if (!existsSync(CONFIG_PATH)) {
    console.error(`❌ Configuration not found at ${CONFIG_PATH}`);
    process.exit(1);
  }

  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  const state = existsSync(STATE_PATH) ? JSON.parse(readFileSync(STATE_PATH, 'utf8')) : { docs: [] };

  const results = [];

  for (const docCfg of config.docs) {
    console.log(`\n📄 Processing: ${docCfg.label} (${docCfg.id})`);

    try {
      // 0. Resolve provider
      const provider = providerRegistry[docCfg.provider];
      if (!provider) {
        console.warn(`⚠️ Unknown provider: ${docCfg.provider}. Skipping.`);
        results.push({
          id: docCfg.id,
          label: docCfg.label,
          localPath: docCfg.localPath,
          action: 'SKIPPED',
          status: 'SKIPPED',
          reason: `Unknown provider: ${docCfg.provider}`
        });
        continue;
      }

      // 1. Load Local
      const local = await readLocalDoc(join(ROOT, docCfg.localPath));

      // 2. Load Remote
      let remote;
      // Special-case: Google placeholder ID in dry run
      if (
        isDryRun &&
        docCfg.provider === 'google' &&
        docCfg.remoteId === 'GOOGLE_FILE_ID'
      ) {
        console.log('🧪 Skipping remote fetch (Placeholder ID in dry run)');
        remote = { exists: false, content: null, hash: null };
      } else {
        remote = await provider.fetchDoc(docCfg.remoteId);
      }

      // 3. Get State
      const docState = state.docs.find(d => d.id === docCfg.id) || {};

      // 4. Decide Action
      const action = await decideSyncAction({ docCfg, local, remote, docState });

      if (isDryRun) {
        console.log(`🧪 ACTION PLANNED: ${action}`);
        results.push({
          id: docCfg.id,
          label: docCfg.label,
          localPath: docCfg.localPath,
          action,
          status: 'OK',
          reason: 'Dry run'
        });
        continue;
      }

      // 5. Execute Action
      const result = await executeSyncAction({ docCfg, local, remote, action, provider });

      if (result.status === 'OK') {
        updateDocState(state, result);
      }
      results.push(result);

    } catch (err) {
      console.error(`❌ Error syncing ${docCfg.id}:`, err.message);
      results.push({
        id: docCfg.id,
        label: docCfg.label,
        action: 'ERROR',
        status: 'FAILED',
        reason: err.message
      });
    }
  }

  // 6. Save State
  if (!isDryRun) {
    if (!existsSync(dirname(STATE_PATH))) mkdirSync(dirname(STATE_PATH), { recursive: true });
    writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
  }

  // 7. Summary
  emitSummary(results);
  rl.close();
}

async function readLocalDoc(absolutePath) {
  if (!existsSync(absolutePath)) return { exists: false, content: null, hash: null };
  const content = readFileSync(absolutePath, 'utf8');
  const hash = sha256(content);
  return { exists: true, content, hash };
}

async function decideSyncAction({ docCfg, local, remote, docState }) {
  if (!remote.exists && !local.exists) return 'NOOP';

  // If both exist and content matches, no-op
  if (local.exists && remote.exists && local.content === remote.content) {
    return 'NOOP';
  }

  if (docCfg.direction === 'pull') {
    return remote.exists ? 'PULL_REMOTE_TO_LOCAL' : 'NOOP';
  }

  if (docCfg.direction === 'push') {
    return local.exists ? 'PUSH_LOCAL_TO_REMOTE' : 'NOOP';
  }

  if (docCfg.direction === 'bidirectional') {
    if (local.exists && !remote.exists) return 'PUSH_LOCAL_TO_REMOTE';
    if (!local.exists && remote.exists) return 'PULL_REMOTE_TO_LOCAL';

    if (local.exists && remote.exists) {
      if (docCfg.conflictStrategy === 'local-wins') return 'PUSH_LOCAL_TO_REMOTE';
      if (docCfg.conflictStrategy === 'remote-wins') return 'PULL_REMOTE_TO_LOCAL';
      if (docCfg.conflictStrategy === 'prompt') return 'CONFLICT_RESOLUTION_REQUIRED';
    }
  }

  return 'NOOP';
}

async function executeSyncAction({ docCfg, local, remote, action, provider }) {
  const absoluteLocalPath = join(ROOT, docCfg.localPath);

  if (action === 'NOOP') {
    return {
      id: docCfg.id,
      label: docCfg.label,
      localPath: docCfg.localPath,
      action,
      status: 'OK',
      reason: 'Already in sync'
    };
  }

  if (action === 'CONFLICT_RESOLUTION_REQUIRED') {
    const diff = computeDiff(local.content, remote.content);
    console.log(`\n⚠️ CONFLICT: ${docCfg.label}`);
    console.log(`Diff preview:\n${diff.preview}`);
    const choice = await question('Resolve conflict? [L]ocal wins, [R]emote wins, [S]kip: ');
    
    if (choice.toUpperCase() === 'L') {
      return executeSyncAction({ docCfg, local, remote, action: 'PUSH_LOCAL_TO_REMOTE', provider });
    } else if (choice.toUpperCase() === 'R') {
      return executeSyncAction({ docCfg, local, remote, action: 'PULL_REMOTE_TO_LOCAL', provider });
    } else {
      return {
        id: docCfg.id,
        label: docCfg.label,
        localPath: docCfg.localPath,
        action,
        status: 'SKIPPED',
        reason: 'User skipped conflict'
      };
    }
  }

  if (action === 'PULL_REMOTE_TO_LOCAL') {
    console.log(`⬇️ Pulling remote to ${docCfg.localPath}...`);
    backupLocal(absoluteLocalPath);
    if (!existsSync(dirname(absoluteLocalPath))) mkdirSync(dirname(absoluteLocalPath), { recursive: true });
    writeFileSync(absoluteLocalPath, remote.content, 'utf8');
    return { 
      id: docCfg.id, 
      label: docCfg.label, 
      localPath: docCfg.localPath, 
      action, 
      status: 'OK', 
      localHash: sha256(remote.content), 
      remoteHash: remote.hash 
    };
  }

  if (action === 'PUSH_LOCAL_TO_REMOTE') {
    console.log(`⬆️ Pushing local to remote (${docCfg.provider})...`);
    const updated = await provider.updateDoc(docCfg.remoteId, local.content);
    return { 
      id: docCfg.id, 
      label: docCfg.label, 
      localPath: docCfg.localPath, 
      action, 
      status: 'OK', 
      localHash: local.hash, 
      remoteHash: updated.hash 
    };
  }

  return {
    id: docCfg.id,
    label: docCfg.label,
    localPath: docCfg.localPath,
    action,
    status: 'OK'
  };
}

function updateDocState(state, result) {
  let docState = state.docs.find(d => d.id === result.id);
  if (!docState) {
    docState = { id: result.id };
    state.docs.push(docState);
  }
  docState.localPath = result.localPath;
  docState.localHash = result.localHash || docState.localHash;
  docState.remoteHash = result.remoteHash || docState.remoteHash;
  docState.lastSyncAt = new Date().toISOString();
  docState.lastSyncDirection =
    result.action === 'PULL_REMOTE_TO_LOCAL' ? 'pull' :
    result.action === 'PUSH_LOCAL_TO_REMOTE' ? 'push' :
    docState.lastSyncDirection;
}

function emitSummary(results) {
  console.log('\n--- SYNC SUMMARY ---');
  console.table(results.map(r => ({
    ID: r.id,
    Label: r.label,
    Action: r.action,
    Status: r.status,
    Reason: r.reason || '-'
  })));
  console.log('--------------------\n');
}

main().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
