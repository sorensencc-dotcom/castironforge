/**
 * CIC Memory Spine — Pure-Claude Dataset Generator
 *
 * Drops in as a direct replacement for generate-dataset.ts with LLM-backed
 * generateQuestions() and summarizeChunk(). Calls Claude for each chunk;
 * prefer generate-dataset-hybrid.ts to reduce token spend on large corpora.
 *
 * Usage:
 *   node --loader ts-node/esm scripts/generate-dataset-llm.ts [docs-root] [out-file]
 *
 * Defaults:
 *   docs-root : ../../../docs
 *   out-file  : datasets/memory-dataset-llm-v1.json
 *
 * Env:
 *   ANTHROPIC_API_KEY  required
 *   DRY_RUN=1          walk docs, no Claude calls, no writes
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join, basename, dirname, sep } from 'path';
import { fileURLToPath } from 'url';
import { claudeText } from './llm/claude-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN   = process.env.DRY_RUN === '1';

type QAExample = {
  question_text: string;
  answer_text: string;
  doc_id: string;
  chunk_id: string;
  domain: string;
  timestamp: string;
};

const EXCLUDE_DIRS = new Set(['assets', 'archive', 'node_modules', '.git']);

function* walkDir(root: string): Generator<string> {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const full = join(root, entry.name);
    if (entry.isDirectory()) yield* walkDir(full);
    else if (entry.isFile() && full.endsWith('.md')) yield full;
  }
}

function loadDoc(filePath: string, root: string) {
  const content = readFileSync(filePath, 'utf-8');
  const doc_id  = basename(filePath, '.md').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const rel     = filePath.slice(root.length + 1);
  const parts   = rel.split(sep);
  const domain  = parts.length > 1 ? parts[0] : 'root';
  return { doc_id, domain, timestamp: new Date().toISOString(), content };
}

function chunkContent(content: string): { chunk_id: string; text: string }[] {
  const lines = content.split('\n');
  const chunks: { chunk_id: string; text: string }[] = [];
  let buffer: string[] = [];
  let idx = 0;
  for (const line of lines) {
    buffer.push(line);
    if (buffer.join('\n').length > 1024) {
      chunks.push({ chunk_id: `c${idx++}`, text: buffer.join('\n').trim() });
      buffer = [];
    }
  }
  if (buffer.some(l => l.trim())) {
    chunks.push({ chunk_id: `c${idx}`, text: buffer.join('\n').trim() });
  }
  return chunks;
}

async function generateQuestions(chunkText: string): Promise<string[]> {
  const prompt = `You are generating high-quality questions for training a CIC (Cast Iron Forge) memory model.

Chunk:
${chunkText.slice(0, 1200)}

Task:
- Produce 3-6 questions an agent might ask to retrieve this information.
- Focus on CIC architecture, behavior, and configuration.
- Avoid yes/no questions. Prefer "How", "What", "Why", "When", "Which".
- Do not mention "this section" or "this document" in the questions.
- One question per line, no numbering or bullets.`;

  const out = await claudeText(prompt, 512);
  return out.split('\n').map(l => l.replace(/^[-*\d.)\s]+/, '').trim()).filter(l => l.length > 10 && l.includes('?'));
}

async function summarizeChunk(chunkText: string): Promise<string> {
  const prompt = `You are summarizing CIC (Cast Iron Forge) documentation for a memory model.

Chunk:
${chunkText.slice(0, 1200)}

Task:
- Summarize in 2-4 sentences.
- Preserve key components, behaviors, and constraints.
- Be specific to CIC; avoid generic filler.
- Return only the summary, no preamble.`;

  return claudeText(prompt, 256);
}

async function buildDataset(root: string, outFile: string): Promise<void> {
  const examples: QAExample[] = [];
  let docs = 0, chunks = 0, errors = 0;
  let inputTokensEst = 0;

  const files = [...walkDir(root)];
  console.log(`Found ${files.length} markdown files under ${root}`);

  for (const filePath of files) {
    const doc = loadDoc(filePath, root);
    const docChunks = chunkContent(doc.content);
    docs++;

    for (const chunk of docChunks) {
      if (!chunk.text.trim()) continue;
      chunks++;

      if (DRY_RUN) {
        console.log(`  [dry] ${doc.doc_id}/${chunk.chunk_id}`);
        continue;
      }

      let questions: string[];
      let answer: string;
      try {
        [questions, answer] = await Promise.all([
          generateQuestions(chunk.text),
          summarizeChunk(chunk.text),
        ]);
      } catch (err) {
        console.error(`  [err] ${doc.doc_id}/${chunk.chunk_id}: ${(err as Error).message}`);
        errors++;
        continue;
      }

      inputTokensEst += Math.ceil(chunk.text.length / 4) * 2; // rough estimate

      for (const q of questions) {
        examples.push({
          question_text: q,
          answer_text: answer,
          doc_id: doc.doc_id,
          chunk_id: chunk.chunk_id,
          domain: doc.domain,
          timestamp: doc.timestamp,
        });
      }

      process.stdout.write(`  [ok] ${doc.doc_id}/${chunk.chunk_id}: ${questions.length}q\n`);
    }
  }

  if (DRY_RUN) {
    console.log(`\n[dry-run] ${chunks} chunks across ${docs} docs — no writes.`);
    return;
  }

  const outDir = dirname(outFile);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  writeFileSync(
    outFile,
    JSON.stringify(
      {
        meta: { generated_at: new Date().toISOString(), docs, chunks, errors, estimated_input_tokens: inputTokensEst },
        examples,
      },
      null,
      2,
    ),
    'utf-8',
  );

  console.log(`\nWrote ${examples.length} Q&A examples → ${outFile}`);
  console.log(`Stats: ${docs} docs, ${chunks} chunks, ${errors} errors`);
  console.log(`Estimated tokens (rough): ~${inputTokensEst.toLocaleString()} input`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root    = process.argv[2] ?? join(__dirname, '../../../docs');
  const outFile = process.argv[3] ?? join(__dirname, '../datasets/memory-dataset-llm-v1.json');
  buildDataset(root, outFile).catch(err => { console.error('Fatal:', err); process.exit(1); });
}
