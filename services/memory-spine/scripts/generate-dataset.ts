/**
 * CIC Memory Spine — Dataset Generator
 *
 * Walks a directory of markdown docs, chunks them, and generates synthetic
 * Q&A pairs for training the memory model. Replace the placeholder
 * generateQuestions() and summarizeChunk() functions with LLM-based
 * generation before use in a real training run.
 *
 * Usage:
 *   node --loader ts-node/esm scripts/generate-dataset.ts [docs-root] [out-file]
 *
 * Defaults:
 *   docs-root : ../../../docs
 *   out-file  : datasets/memory-dataset-v1.json
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join, basename, dirname, sep } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
  related_doc_ids?: string[];
  related_chunk_ids?: string[];
};

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
  const doc_id = basename(filePath, '.md').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  // Derive domain from first subdirectory under root; top-level files get 'root'
  const rel = filePath.slice(root.length + 1);
  const parts = rel.split(sep);
  const domain = parts.length > 1 ? parts[0] : 'root';
  return { doc_id, domain, timestamp: new Date().toISOString(), path: filePath, content };
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
  if (buffer.length && buffer.some(l => l.trim())) {
    chunks.push({ chunk_id: `c${idx}`, text: buffer.join('\n').trim() });
  }
  return chunks;
}

// Placeholder: replace with LLM-based question generation.
function generateQuestions(chunkText: string): string[] {
  const firstLine = chunkText.split('\n').find(l => l.trim().length > 0) ?? '';
  const heading = firstLine.replace(/^#+\s*/, '').trim();
  return [
    `What does this section describe?`,
    heading ? `Explain: ${heading}` : `Summarize this CIC document section.`,
  ].filter(Boolean);
}

// Placeholder: replace with LLM summarizer.
function summarizeChunk(chunkText: string): string {
  return chunkText.slice(0, 512);
}

function buildDataset(root: string, outFile: string): void {
  const examples: QAExample[] = [];

  for (const filePath of walkDir(root)) {
    const doc = loadDoc(filePath, root);
    const chunks = chunkContent(doc.content);

    for (const chunk of chunks) {
      if (!chunk.text.trim()) continue;
      const questions = generateQuestions(chunk.text);
      const answer = summarizeChunk(chunk.text);

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
    }
  }

  const outDir = dirname(outFile);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  writeFileSync(outFile, JSON.stringify({ examples }, null, 2), 'utf-8');
  console.log(`Wrote ${examples.length} Q&A examples → ${outFile}`);
}

// ESM-safe main guard
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root = process.argv[2] ?? join(__dirname, '../../../docs');
  const out  = process.argv[3] ?? join(__dirname, '../datasets/memory-dataset-v1.json');
  buildDataset(root, out);
}
