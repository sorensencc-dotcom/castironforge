/**
 * CIC Memory Spine — Corpus Seeder
 *
 * Reads CIC knowledge artifacts from the repo and POSTs each one
 * to MemoryEdit so MemoryQuery returns real answers instead of stubs.
 *
 * Usage:
 *   node --loader ts-node/esm scripts/seed.ts
 *   MEMORY_SPINE_URL=http://localhost:3100 node --loader ts-node/esm scripts/seed.ts
 *
 * Dry-run (no HTTP calls):
 *   DRY_RUN=1 node --loader ts-node/esm scripts/seed.ts
 */

import { readFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../');
const BASE_URL = process.env.MEMORY_SPINE_URL ?? 'http://localhost:3100';
const DRY_RUN = process.env.DRY_RUN === '1';

// ---------------------------------------------------------------------------
// Seed manifest — ordered by dependency graph
// ---------------------------------------------------------------------------

interface SeedEntry {
  doc_id: string;
  domain: string;
  tags: string[];
  rel_path: string;  // relative to REPO_ROOT
  title: string;
}

const SEED_MANIFEST: SeedEntry[] = [
  // CIC core architecture
  {
    doc_id: 'cic-architecture',
    domain: 'cic-core',
    tags: ['architecture', 'layers'],
    rel_path: 'docs/project-brain/castironforge/architecture.md',
    title: 'CIC Architecture',
  },
  // Operator command reference
  {
    doc_id: 'cic-commands',
    domain: 'cic-core',
    tags: ['commands', 'operator', 'pipeline'],
    rel_path: 'docs/project-brain/castironforge/commands.md',
    title: 'CIC Operator Command Reference',
  },
  // Ingestion pipeline
  {
    doc_id: 'cic-ingestion',
    domain: 'cic-core',
    tags: ['ingestion', 'pipeline', 'harvest', 'scrape'],
    rel_path: 'docs/project-brain/castironforge/ingestion.md',
    title: 'CIC Ingestion Pipeline',
  },
  // Research engine internals
  {
    doc_id: 'cic-research-engine',
    domain: 'cic-core',
    tags: ['research-engine', 'enrichment', 'semantic-search', 'clustering'],
    rel_path: 'docs/project-brain/castironforge/research-engine.md',
    title: 'CIC Research Engine Internals',
  },
  // Memory Spine spec (self-referential — useful for agents asking about the Spine itself)
  {
    doc_id: 'memory-spine-overview',
    domain: 'memory-spine',
    tags: ['memory', 'knowledge-spine', 'memo', 'architecture'],
    rel_path: 'docs/memory-spine/OVERVIEW.md',
    title: 'CIC Memory Spine Overview',
  },
  {
    doc_id: 'memory-spine-api',
    domain: 'memory-spine',
    tags: ['memory', 'api', 'query', 'edit', 'admin', 'provenance'],
    rel_path: 'docs/memory-spine/API.md',
    title: 'CIC Memory Spine API Reference',
  },
  {
    doc_id: 'memory-spine-agent-patterns',
    domain: 'memory-spine',
    tags: ['memory', 'agents', 'confidence', 'fallback', 'mcp'],
    rel_path: 'docs/memory-spine/AGENT_CALL_PATTERNS.md',
    title: 'CIC Memory Spine Agent Call Patterns',
  },
  {
    doc_id: 'memory-spine-training',
    domain: 'memory-spine',
    tags: ['memory', 'training', 'pipeline', 'supervision'],
    rel_path: 'docs/memory-spine/TRAINING_PIPELINE.md',
    title: 'CIC Memory Spine Training Pipeline',
  },
  {
    doc_id: 'memory-spine-versioning',
    domain: 'memory-spine',
    tags: ['memory', 'versioning', 'hot-swap', 'rollback'],
    rel_path: 'docs/memory-spine/VERSIONING.md',
    title: 'CIC Memory Spine Versioning',
  },
  {
    doc_id: 'memory-spine-deployment',
    domain: 'memory-spine',
    tags: ['memory', 'deployment', 'topology', 'node'],
    rel_path: 'docs/memory-spine/DEPLOYMENT.md',
    title: 'CIC Memory Spine Deployment',
  },
  {
    doc_id: 'memory-spine-orchestrator-patch',
    domain: 'memory-spine',
    tags: ['memory', 'orchestrator', 'wiring', 'integration'],
    rel_path: 'docs/memory-spine/ORCHESTRATOR_PATCH.md',
    title: 'CIC Memory Spine Orchestrator Integration Patch',
  },
  // Ingestion service contracts
  {
    doc_id: 'cic-ingestion-services',
    domain: 'infra',
    tags: ['services', 'orchestrator', 'sweeper', 'daemon', 'matrix'],
    rel_path: 'docs/ingestion/services.md',
    title: 'CIC Ingestion Services',
  },
  {
    doc_id: 'cic-ingestion-queues',
    domain: 'infra',
    tags: ['queues', 'events', 'ingestion', 'messaging'],
    rel_path: 'docs/ingestion/queues.md',
    title: 'CIC Ingestion Queue Definitions',
  },
  // News digests — real CIC research synthesis (supervision signal)
  {
    doc_id: 'cic-digest-2026-04-23',
    domain: 'research',
    tags: ['digest', 'research', 'synthesis', '2026-04-23'],
    rel_path: 'docs/project-brain/castironforge/cic-news-digest_2026-04-23_v1.md',
    title: 'CIC News Digest 2026-04-23',
  },
  {
    doc_id: 'cic-digest-2026-04-24',
    domain: 'research',
    tags: ['digest', 'research', 'synthesis', '2026-04-24'],
    rel_path: 'docs/project-brain/castironforge/cic-news-digest_2026-04-24_v3.md',
    title: 'CIC News Digest 2026-04-24',
  },
  {
    doc_id: 'cic-digest-2026-04-25',
    domain: 'research',
    tags: ['digest', 'research', 'synthesis', '2026-04-25'],
    rel_path: 'docs/project-brain/castironforge/cic-news-digest_2026-04-25_v1.md',
    title: 'CIC News Digest 2026-04-25',
  },
  {
    doc_id: 'cic-digest-2026-05-03',
    domain: 'research',
    tags: ['digest', 'research', 'synthesis', '2026-05-03'],
    rel_path: 'docs/project-brain/castironforge/cic-news-digest_2026-05-03_v1.md',
    title: 'CIC News Digest 2026-05-03',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readDoc(rel_path: string): string | null {
  const abs = join(REPO_ROOT, rel_path);
  if (!existsSync(abs)) {
    console.warn(`  [skip] file not found: ${rel_path}`);
    return null;
  }
  return readFileSync(abs, 'utf-8').trim();
}

async function postEdit(entry: SeedEntry, content: string): Promise<boolean> {
  const body = {
    operation: 'add',
    doc_id: entry.doc_id,
    payload: {
      title: entry.title,
      content,
      domain: entry.domain,
      tags: entry.tags,
    },
  };

  if (DRY_RUN) {
    console.log(`  [dry-run] would POST /v1/memory/edit — doc_id: ${entry.doc_id} (${content.length} chars)`);
    return true;
  }

  const res = await fetch(`${BASE_URL}/v1/memory/edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`  [error] ${res.status} — ${text}`);
    return false;
  }

  const json = await res.json() as { status: string; version: string };
  console.log(`  [ok] ${json.status} → ${json.version}`);
  return true;
}

async function checkHealth(): Promise<boolean> {
  if (DRY_RUN) return true;
  try {
    const res = await fetch(`${BASE_URL}/health`);
    const json = await res.json() as { status: string; active_version: string };
    console.log(`Memory Spine reachable — active: ${json.active_version}\n`);
    return true;
  } catch {
    console.error(`Cannot reach Memory Spine at ${BASE_URL}. Start it first:\n  npm run dev\n`);
    return false;
  }
}

async function fetchStatus(): Promise<void> {
  if (DRY_RUN) return;
  const res = await fetch(`${BASE_URL}/v1/memory/admin/status`);
  const json = await res.json() as {
    active_version: string;
    corpus_doc_count: number;
    last_edit: string | null;
  };
  console.log('\nPost-seed status:');
  console.log(`  active_version  : ${json.active_version}`);
  console.log(`  corpus_doc_count: ${json.corpus_doc_count}`);
  console.log(`  last_edit       : ${json.last_edit ?? 'none'}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`CIC Memory Spine — Corpus Seeder`);
  console.log(`Target : ${DRY_RUN ? '(dry-run)' : BASE_URL}`);
  console.log(`Docs   : ${SEED_MANIFEST.length} entries\n`);

  if (!(await checkHealth())) process.exit(1);

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of SEED_MANIFEST) {
    console.log(`→ ${entry.doc_id} [${entry.domain}]`);
    const content = readDoc(entry.rel_path);
    if (!content) { skipped++; continue; }

    const success = await postEdit(entry, content);
    if (success) ok++; else failed++;
  }

  await fetchStatus();

  console.log(`\nDone — ${ok} seeded, ${skipped} skipped, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
