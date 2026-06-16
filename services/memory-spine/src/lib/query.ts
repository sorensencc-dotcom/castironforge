import { getDoc, listDocs } from '../store/corpus.js';
import type { CorpusDoc } from '../store/corpus.js';
import type { MemoryQueryRequest, MemoryQueryResponse } from '../types.js';

// Keyword-based retrieval over the seeded corpus.
// Scores each doc by term overlap with the query, filtered by domain when provided.
// Replaced by the trained memory model in Phase 3; interface stays identical.

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);
}

function score(doc: CorpusDoc, queryTokens: string[], domain?: string): number {
  if (domain && doc.domain !== domain && doc.domain !== 'cic-core') return 0;

  const docTokens = new Set([
    ...tokenize(doc.title),
    ...tokenize(doc.content.slice(0, 2000)),
    ...doc.tags.flatMap(t => tokenize(t)),
  ]);

  let hits = 0;
  for (const t of queryTokens) {
    if (docTokens.has(t)) hits++;
  }
  return hits;
}

export function buildStubQueryResponse(req: MemoryQueryRequest, memory_version: string): MemoryQueryResponse {
  const queryTokens = tokenize(req.query_text);
  const maxTokens = req.max_tokens ?? 256;

  // Score every doc in the corpus and pick the best match
  const docs = listDocs();
  let best: CorpusDoc | null = null;
  let bestScore = 0;

  for (const doc of docs) {
    const s = score(doc, queryTokens, req.domain);
    if (s > bestScore) { bestScore = s; best = doc; }
  }

  if (!best || bestScore === 0) {
    return {
      answer_text: `[stub] No match found in corpus. Query: "${req.query_text}" — domain: ${req.domain ?? 'unspecified'}.`,
      provenance: [],
      confidence: 0.0,
      memory_version,
    };
  }

  // Confidence is a rough function of term overlap; capped at 0.6 until a real model is loaded
  const confidence = Math.min(0.6, bestScore / Math.max(queryTokens.length, 1) * 0.8);

  return {
    answer_text: best.content.slice(0, maxTokens),
    provenance: [{ doc_id: best.doc_id, chunk_id: best.chunks[0]?.chunk_id ?? 'c0', timestamp: best.last_edited }],
    confidence,
    memory_version,
  };
}
