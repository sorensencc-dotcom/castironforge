/**
 * CIC Memory Spine — Hybrid Dataset Generator
 *
 * Two-stage pipeline:
 *   1. Local LLM (Ollama) drafts Q&A pairs cheaply for each chunk.
 *   2. Claude refines drafts into training-grade questions + summary in one
 *      combined API call per chunk (minimises token spend ~40-60% vs pure Claude).
 *
 * Skip Claude refinement:
 *   DRY_RUN=1  — local drafts only, no Claude calls, no disk writes
 *   SKIP_CLAUDE=1 — local drafts only, writes dataset with draft quality
 *
 * Usage:
 *   node --loader ts-node/esm scripts/generate-dataset-hybrid.ts [docs-root] [out-file]
 *
 * Defaults:
 *   docs-root : ../../../docs
 *   out-file  : datasets/memory-dataset-hybrid-v1.json
 *
 * Environment:
 *   ANTHROPIC_API_KEY  required unless SKIP_CLAUDE=1
 *   LOCAL_LLM_URL      default http://localhost:11434 (set to 'mock' for offline)
 *   LOCAL_LLM_MODEL    default mistral
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join, basename, dirname, sep } from 'path';
import { fileURLToPath } from 'url';
import { localGenerate } from './llm/local-client.js';
import { refineCombined } from './llm/claude-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DRY_RUN    = process.env.DRY_RUN === '1';
const SKIP_CLAUDE = process.env.SKIP_CLAUDE === '1';

// ─── Types ────────────────────────────────────────────────────────────────────

type DocMeta = {
  doc_id: string;
  domain: string;
  timestamp: string;
  path: string;
};

type QAExample = {
  question_text: string;
  answer_text: string;
  doc_id: string;
  chunk_id: string;
  domain: string;
  timestamp: string;
  question_type: 'single_hop' | 'multi_hop';
  source: 'local_draft' | 'claude_refined';
  related_doc_ids?: string[];
};

// ─── Corpus walking ──────────────────────────────────────────────────────────

const EXCLUDE_DIRS = new Set(['assets', 'archive', 'node_modules', '.git']);

function* walkDir(root: string): Generator<string> {
  const entries = readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const full = join(root, entry.name);
    if (entry.isDirectory()) yield* walkDir(full);
    else if (entry.isFile() && full.endsWith('.md')) yield full;
  }
}

function loadDoc(filePath: string, root: string): DocMeta & { content: string } {
  const content = readFileSync(filePath, 'utf-8');
  const doc_id  = basename(filePath, '.md').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const rel     = filePath.slice(root.length + 1);
  const parts   = rel.split(sep);
  const domain  = parts.length > 1 ? parts[0] : 'root';
  return { doc_id, domain, timestamp: new Date().toISOString(), path: filePath, content };
}

// ─── Chunking ─────────────────────────────────────────────────────────────────

function chunkContent(content: string): { chunk_id: string; text: string }[] {
  const TARGET_MIN = 256;
  const TARGET_MAX = 1024;
  const lines = content.split('\n');
  const chunks: { chunk_id: string; text: string }[] = [];
  let buffer: string[] = [];
  let idx = 0;

  for (const line of lines) {
    buffer.push(line);
    const len = buffer.join('\n').length;
    // flush at heading boundaries when buffer is big enough, or at hard max
    const isHeading = line.startsWith('#') && buffer.length > 1;
    if ((isHeading && len >= TARGET_MIN) || len >= TARGET_MAX) {
      const text = buffer.slice(0, isHeading ? -1 : undefined).join('\n').trim();
      if (text) chunks.push({ chunk_id: `c${idx++}`, text });
      buffer = isHeading ? [line] : [];
    }
  }
  const remainder = buffer.join('\n').trim();
  if (remainder) chunks.push({ chunk_id: `c${idx}`, text: remainder });
  return chunks;
}

// ─── Local LLM draft ─────────────────────────────────────────────────────────

const LOCAL_QUESTION_PROMPT = (chunk: string) => `\
You are generating training data for a documentation Q&A system.

Given the following documentation chunk, generate 2-3 specific questions that:
- Are directly answerable from the chunk
- Cover different aspects of the content
- Are concrete and specific, not vague

Format: one question per line, no numbering or bullets.

CHUNK:
${chunk.slice(0, 800)}

QUESTIONS:`;

const LOCAL_SUMMARY_PROMPT = (chunk: string) => `\
Summarize the following documentation chunk in 1-2 sentences. Be factual and concise.

CHUNK:
${chunk.slice(0, 800)}

SUMMARY:`;

async function localDraft(chunkText: string): Promise<{ questions: string[]; summary: string }> {
  const [qResult, sResult] = await Promise.all([
    localGenerate(LOCAL_QUESTION_PROMPT(chunkText)),
    localGenerate(LOCAL_SUMMARY_PROMPT(chunkText)),
  ]);

  const questions = qResult.text
    .split('\n')
    .map(l => l.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(l => l.length > 10 && l.includes('?'));

  return { questions, summary: sResult.text.trim() };
}

// ─── Stats tracker ───────────────────────────────────────────────────────────

type Stats = {
  docs: number;
  chunks: number;
  examples: number;
  claude_input_tokens: number;
  claude_output_tokens: number;
  errors: number;
};

// ─── Main pipeline ───────────────────────────────────────────────────────────

async function buildDataset(root: string, outFile: string): Promise<void> {
  const examples: QAExample[] = [];
  const stats: Stats = {
    docs: 0, chunks: 0, examples: 0,
    claude_input_tokens: 0, claude_output_tokens: 0, errors: 0,
  };

  const allFiles = [...walkDir(root)];
  console.log(`Found ${allFiles.length} markdown files under ${root}`);

  for (const filePath of allFiles) {
    const doc = loadDoc(filePath, root);
    const chunks = chunkContent(doc.content);
    stats.docs++;

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci];
      if (!chunk.text.trim()) continue;
      stats.chunks++;

      // ── Stage 1: local draft ─────────────────────────────────────────────
      let draft: { questions: string[]; summary: string };
      try {
        draft = await localDraft(chunk.text);
      } catch (err) {
        console.error(`  [local] ${doc.doc_id}/${chunk.chunk_id}: ${(err as Error).message}`);
        stats.errors++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [dry] ${doc.doc_id}/${chunk.chunk_id}: ${draft.questions.length} draft questions`);
        continue;
      }

      // ── Stage 2: Claude refinement ───────────────────────────────────────
      if (SKIP_CLAUDE || !process.env.ANTHROPIC_API_KEY) {
        for (const q of draft.questions) {
          if (!q) continue;
          examples.push({
            question_text: q,
            answer_text: draft.summary,
            doc_id: doc.doc_id,
            chunk_id: chunk.chunk_id,
            domain: doc.domain,
            timestamp: doc.timestamp,
            question_type: 'single_hop',
            source: 'local_draft',
          });
          stats.examples++;
        }
        continue;
      }

      // Provide adjacent chunk as related context for multi-hop questions
      const relatedChunks: string[] = [];
      if (ci + 1 < chunks.length) relatedChunks.push(chunks[ci + 1].text);

      let refined: Awaited<ReturnType<typeof refineCombined>>;
      try {
        refined = await refineCombined(chunk.text, draft.questions, draft.summary, relatedChunks);
      } catch (err) {
        console.error(`  [claude] ${doc.doc_id}/${chunk.chunk_id}: ${(err as Error).message} — falling back to draft`);
        stats.errors++;
        // fall back to local draft quality
        for (const q of draft.questions) {
          if (!q) continue;
          examples.push({
            question_text: q,
            answer_text: draft.summary,
            doc_id: doc.doc_id,
            chunk_id: chunk.chunk_id,
            domain: doc.domain,
            timestamp: doc.timestamp,
            question_type: 'single_hop',
            source: 'local_draft',
          });
          stats.examples++;
        }
        continue;
      }

      stats.claude_input_tokens  += refined.input_tokens;
      stats.claude_output_tokens += refined.output_tokens;

      for (const q of refined.questions) {
        if (!q) continue;
        examples.push({
          question_text: q,
          answer_text: refined.summary,
          doc_id: doc.doc_id,
          chunk_id: chunk.chunk_id,
          domain: doc.domain,
          timestamp: doc.timestamp,
          question_type: 'single_hop',
          source: 'claude_refined',
        });
        stats.examples++;
      }

      for (const q of refined.multi_hop_questions) {
        if (!q) continue;
        examples.push({
          question_text: q,
          answer_text: refined.summary,
          doc_id: doc.doc_id,
          chunk_id: chunk.chunk_id,
          domain: doc.domain,
          timestamp: doc.timestamp,
          question_type: 'multi_hop',
          source: 'claude_refined',
          related_doc_ids: relatedChunks.length > 0
            ? [chunks[ci + 1] ? doc.doc_id : doc.doc_id]
            : undefined,
        });
        stats.examples++;
      }

      process.stdout.write(
        `  [ok] ${doc.doc_id}/${chunk.chunk_id}: ` +
        `${refined.questions.length}q + ${refined.multi_hop_questions.length}mh ` +
        `(${refined.input_tokens}+${refined.output_tokens} tok)\n`
      );
    }
  }

  if (DRY_RUN) {
    console.log(`\n[dry-run] ${stats.chunks} chunks across ${stats.docs} docs — no writes.`);
    return;
  }

  const outDir = dirname(outFile);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  writeFileSync(
    outFile,
    JSON.stringify(
      {
        meta: {
          generated_at: new Date().toISOString(),
          docs: stats.docs,
          chunks: stats.chunks,
          claude_input_tokens: stats.claude_input_tokens,
          claude_output_tokens: stats.claude_output_tokens,
          errors: stats.errors,
        },
        examples,
      },
      null,
      2,
    ),
    'utf-8',
  );

  console.log(`\nWrote ${examples.length} Q&A examples → ${outFile}`);
  console.log(`Stats: ${stats.docs} docs, ${stats.chunks} chunks, ${stats.errors} errors`);
  if (!SKIP_CLAUDE) {
    const estimatedCost =
      (stats.claude_input_tokens / 1_000_000) * 5.0 +
      (stats.claude_output_tokens / 1_000_000) * 25.0;
    console.log(
      `Claude tokens: ${stats.claude_input_tokens} in + ${stats.claude_output_tokens} out ≈ $${estimatedCost.toFixed(4)}`,
    );
  }
}

// ─── ESM-safe entry point ─────────────────────────────────────────────────────

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root   = process.argv[2] ?? join(__dirname, '../../../docs');
  const outFile = process.argv[3] ?? join(__dirname, '../datasets/memory-dataset-hybrid-v1.json');
  buildDataset(root, outFile).catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
