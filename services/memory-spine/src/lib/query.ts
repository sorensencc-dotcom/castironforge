import { getDoc } from '../store/corpus.js';
import type { MemoryQueryRequest, MemoryQueryResponse } from '../types.js';

export function buildStubQueryResponse(req: MemoryQueryRequest, memory_version: string): MemoryQueryResponse {
  const lower = req.query_text.toLowerCase();
  const docId = lower.includes('repair') ? 'adr-42'
    : lower.includes('build') ? 'adr-10'
    : 'doc-0';

  const doc = getDoc(docId);

  return {
    answer_text: doc
      ? doc.content.slice(0, req.max_tokens ?? 256)
      : `[stub] No trained model loaded. Query: "${req.query_text}" — domain: ${req.domain ?? 'unspecified'}.`,
    provenance: doc
      ? [{ doc_id: docId, chunk_id: doc.chunks[0]?.chunk_id ?? 'c0', timestamp: doc.last_edited }]
      : [],
    confidence: doc ? 0.5 : 0.1,
    memory_version,
  };
}
