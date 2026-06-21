/**
 * Hybrid Document Search Tool for Agents
 *
 * Performs BM25 + semantic search with result fusion:
 * - Keyword search via Typesense
 * - Semantic search via Qdrant
 * - Hybrid scoring & ranking
 * - Metadata filtering (repo, phase, adapter)
 */

import { embeddingProvider } from '../../services/embeddingService';

export interface SearchDocument {
  id: string;
  repo: string;
  path: string;
  title: string;
  author: string;
  mime: string;
  phase: string;
  adapter: string;
  sha256: string;
  score: number;
  scoreBreakdown: {
    bm25?: number;
    semantic?: number;
  };
}

export interface DocumentSearchRequest {
  query: string;
  repo?: string;
  phase?: string;
  adapter?: string;
  limit?: number;
}

export interface DocumentSearchResult {
  query: string;
  results: SearchDocument[];
  count: number;
  duration: number;
}

/**
 * Hybrid document search
 */
export async function searchDocuments(
  request: DocumentSearchRequest
): Promise<DocumentSearchResult> {
  const startTime = Date.now();
  const limit = request.limit ?? 10;

  try {
    // Step 1: Keyword search (Typesense)
    const keywordResults = await performKeywordSearch({
      query: request.query,
      repo: request.repo,
      phase: request.phase,
      adapter: request.adapter,
      limit: limit * 2, // Get more to allow for fusion
    });

    // Step 2: Semantic search (Qdrant)
    const embedding = await embeddingProvider.embed(request.query);
    const semanticResults = await performSemanticSearch({
      vector: embedding,
      repo: request.repo,
      phase: request.phase,
      adapter: request.adapter,
      limit: limit * 2,
    });

    // Step 3: Hybrid fusion
    const fusedResults = hybridFuse(keywordResults, semanticResults, limit);

    const duration = Date.now() - startTime;

    return {
      query: request.query,
      results: fusedResults,
      count: fusedResults.length,
      duration,
    };
  } catch (error) {
    console.error('[DocumentSearch] Error:', error);
    throw error;
  }
}

/**
 * Perform keyword search via Typesense
 */
async function performKeywordSearch(params: {
  query: string;
  repo?: string;
  phase?: string;
  adapter?: string;
  limit: number;
}): Promise<SearchDocument[]> {
  // TODO: Wire Typesense client
  // For now, return placeholder results
  console.log(`[KeywordSearch] Would search Typesense: ${params.query}`);
  return [];
}

/**
 * Perform semantic search via Qdrant
 */
async function performSemanticSearch(params: {
  vector: number[];
  repo?: string;
  phase?: string;
  adapter?: string;
  limit: number;
}): Promise<SearchDocument[]> {
  // TODO: Wire Qdrant client
  // For now, return placeholder results
  console.log(`[SemanticSearch] Would search Qdrant with vector: ${params.vector.length} dimensions`);
  return [];
}

/**
 * Hybrid fusion: combine BM25 + semantic scores
 *
 * Algorithm:
 * 1. Normalize scores (0-1 range)
 * 2. Weight by source (configurable)
 * 3. Sort by fused score
 * 4. Return top-k
 */
function hybridFuse(
  keywordResults: SearchDocument[],
  semanticResults: SearchDocument[],
  limit: number,
  keywordWeight: number = 0.4,
  semanticWeight: number = 0.6
): SearchDocument[] {
  const scoreMap = new Map<string, SearchDocument>();

  // Normalize and aggregate keyword scores
  const maxKeywordScore = Math.max(...keywordResults.map((r) => r.score), 1);
  for (const doc of keywordResults) {
    const normalized = doc.score / maxKeywordScore;
    const existing = scoreMap.get(doc.id) ?? { ...doc, scoreBreakdown: {} };
    existing.scoreBreakdown.bm25 = normalized;
    existing.score = (existing.score ?? 0) + normalized * keywordWeight;
    scoreMap.set(doc.id, existing);
  }

  // Normalize and aggregate semantic scores
  const maxSemanticScore = Math.max(...semanticResults.map((r) => r.score), 1);
  for (const doc of semanticResults) {
    const normalized = doc.score / maxSemanticScore;
    const existing = scoreMap.get(doc.id) ?? { ...doc, scoreBreakdown: {} };
    existing.scoreBreakdown.semantic = normalized;
    existing.score = (existing.score ?? 0) + normalized * semanticWeight;
    scoreMap.set(doc.id, existing);
  }

  // Sort by fused score and return top-k
  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Document Search Tool for MCP
 */
export const documentSearchTool = {
  name: 'searchDocuments',
  description:
    'Search CIC corpus with hybrid BM25 + semantic search. Returns ranked documents grounded in MinIO + TorqueQuery.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (natural language or keywords)',
      },
      repo: {
        type: 'string',
        description: 'Filter by repository',
      },
      phase: {
        type: 'string',
        description: 'Filter by CIC phase (e.g., "21", "26")',
      },
      adapter: {
        type: 'string',
        description: 'Filter by adapter (e.g., "torque", "ollama")',
      },
      limit: {
        type: 'number',
        description: 'Maximum results to return (default: 10)',
      },
    },
    required: ['query'],
  },

  async execute(input: DocumentSearchRequest): Promise<DocumentSearchResult> {
    return searchDocuments(input);
  },
};
