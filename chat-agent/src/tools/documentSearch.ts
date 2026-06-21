import { TORQUE_URL } from '../runtimes/config';
import { metricsCollector } from '../utils/metricsCollector';

export interface DocumentSearchResult {
  id: string;
  path: string;
  repo?: string;
  content: string;
  mime: string;
  title?: string;
  author?: string;
  score: number;
  ingestedAt: string;
}

export async function docSearch(
  query: string,
  options?: {
    topK?: number;
    repo?: string;
    mimeType?: string;
  }
): Promise<DocumentSearchResult[]> {
  const timer = metricsCollector.start('document_search');

  try {
    const topK = options?.topK ?? 10;

    const searchPayload: Record<string, unknown> = {
      query,
      topK,
      collection: 'docs_files'
    };

    if (options?.repo) {
      searchPayload.filters = { repo: options.repo };
    }

    const res = await fetch(`${TORQUE_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchPayload)
    });

    if (!res.ok) {
      throw new Error(`Document search failed: ${res.status}`);
    }

    const data = (await res.json()) as {
      results?: DocumentSearchResult[];
    };

    const results = data.results ?? [];
    timer.end();
    metricsCollector.increment('document_search_total');

    return results;
  } catch (error) {
    timer.end();
    metricsCollector.increment('document_search_errors_total');
    throw error;
  }
}
