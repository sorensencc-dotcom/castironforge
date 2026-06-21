import { searchDocuments as searchTypesense } from '../services/TypesenseClient';
import { searchVectors as searchQdrant } from '../services/QdrantClient';
import { embed } from '../services/EmbeddingService';
import { hybridFuse } from '../services/HybridFusion';
import { metricsCollector } from '../utils/metricsCollector';
import type { FusedResult } from '../services/HybridFusion';

export interface DocumentSearchOptions {
  topK?: number;
  repo?: string;
  phase?: string;
  adapter?: string;
  alpha?: number;
  beta?: number;
}

export async function docSearch(
  query: string,
  options?: DocumentSearchOptions
): Promise<FusedResult[]> {
  const timer = metricsCollector.start('document_search');

  try {
    const topK = options?.topK ?? 10;
    const alpha = options?.alpha ?? 0.4;
    const beta = options?.beta ?? 0.6;

    // Build Typesense filter
    const filters: string[] = [];
    if (options?.repo) filters.push(`repo:${options.repo}`);
    if (options?.phase) filters.push(`phase:${options.phase}`);
    if (options?.adapter) filters.push(`adapter:${options.adapter}`);
    const filterBy = filters.length > 0 ? filters.join(' && ') : undefined;

    // Parallel: keyword search + semantic search
    const [tsResults, embedding] = await Promise.all([
      searchTypesense(query, {
        queryBy: 'content,title,author',
        filterBy,
        perPage: topK
      }),
      embed(query)
    ]);

    const qdantFilter = options?.repo || options?.phase || options?.adapter
      ? {
          must: [
            options?.repo ? { key: 'repo', match: { value: options.repo } } : null,
            options?.phase ? { key: 'phase', match: { value: options.phase } } : null,
            options?.adapter ? { key: 'adapter', match: { value: options.adapter } } : null
          ].filter(Boolean) as any[]
        }
      : undefined;

    const qdResults = await searchQdrant('docs_files_vectors', embedding, topK, qdantFilter);

    // Hybrid fusion
    const results = hybridFuse(
      tsResults.hits ?? [],
      qdResults ?? [],
      alpha,
      beta
    );

    timer.end();
    metricsCollector.increment('document_search_total');

    return results;
  } catch (error) {
    timer.end();
    metricsCollector.increment('document_search_errors_total');
    throw error;
  }
}
