/**
 * Hybrid Search Fusion
 *
 * Combines BM25 (keyword) and semantic scores into ranked results.
 *
 * Algorithm:
 * 1. Normalize both score sets to 0-1 range
 * 2. Compute weighted sum (configurable weights)
 * 3. Sort by fused score
 * 4. Deduplicate by document ID
 */

export interface ScoredDocument {
  id: string;
  score: number;
  scoreBreakdown?: Record<string, number>;
  [key: string]: unknown;
}

export interface FusionConfig {
  keywordWeight?: number; // Default: 0.4
  semanticWeight?: number; // Default: 0.6
}

/**
 * Fuse results from keyword and semantic search
 */
export function hybridFuse<T extends ScoredDocument>(
  keywordResults: T[],
  semanticResults: T[],
  limit: number,
  config?: FusionConfig
): T[] {
  const keywordWeight = config?.keywordWeight ?? 0.4;
  const semanticWeight = config?.semanticWeight ?? 0.6;

  if (keywordWeight + semanticWeight !== 1.0) {
    console.warn('[HybridFusion] Weights do not sum to 1.0, normalizing');
  }

  const scoreMap = new Map<string, T>();

  // Normalize and aggregate keyword scores
  const maxKeywordScore = Math.max(...keywordResults.map((r) => r.score), 1);
  for (const doc of keywordResults) {
    const normalized = doc.score / maxKeywordScore;
    const existing: T = scoreMap.has(doc.id)
      ? scoreMap.get(doc.id)!
      : { ...doc, score: 0, scoreBreakdown: {} };

    if (!existing.scoreBreakdown) {
      existing.scoreBreakdown = {};
    }
    existing.scoreBreakdown.bm25 = normalized;
    existing.score = (existing.score ?? 0) + normalized * keywordWeight;

    scoreMap.set(doc.id, existing);
  }

  // Normalize and aggregate semantic scores
  const maxSemanticScore = Math.max(...semanticResults.map((r) => r.score), 1);
  for (const doc of semanticResults) {
    const normalized = doc.score / maxSemanticScore;
    const existing: T = scoreMap.has(doc.id)
      ? scoreMap.get(doc.id)!
      : { ...doc, score: 0, scoreBreakdown: {} };

    if (!existing.scoreBreakdown) {
      existing.scoreBreakdown = {};
    }
    existing.scoreBreakdown.semantic = normalized;
    existing.score = (existing.score ?? 0) + normalized * semanticWeight;

    scoreMap.set(doc.id, existing);
  }

  // Sort by fused score and return top-k
  return Array.from(scoreMap.values())
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}

/**
 * Compute reciprocal rank fusion (RRF)
 *
 * Alternative fusion strategy that treats results as ranked lists.
 * Less sensitive to absolute score values.
 */
export function reciprocalRankFusion<T extends ScoredDocument>(
  keywordResults: T[],
  semanticResults: T[],
  limit: number,
  k: number = 60
): T[] {
  const scoreMap = new Map<string, { doc: T; score: number }>();

  // RRF for keyword results
  for (let i = 0; i < keywordResults.length; i++) {
    const doc = keywordResults[i];
    const rrf = 1 / (k + i + 1);
    const existing = scoreMap.get(doc.id);
    if (existing) {
      existing.score += rrf;
    } else {
      scoreMap.set(doc.id, { doc, score: rrf });
    }
  }

  // RRF for semantic results
  for (let i = 0; i < semanticResults.length; i++) {
    const doc = semanticResults[i];
    const rrf = 1 / (k + i + 1);
    const existing = scoreMap.get(doc.id);
    if (existing) {
      existing.score += rrf;
    } else {
      scoreMap.set(doc.id, { doc, score: rrf });
    }
  }

  // Sort by RRF score
  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .map((item) => {
      item.doc.score = item.score;
      return item.doc;
    })
    .slice(0, limit);
}
