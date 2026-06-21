/**
 * Retrieval MCP Tools
 *
 * Provides corpus search and document retrieval operations.
 * Designed to interface with TorqueQuery or similar vector search backends.
 */

import { docSearch } from '../../tools/documentSearch';

type RetrievalResult = {
  success: boolean;
  data?: unknown;
  error?: string;
};

type SearchParams = {
  query: string;
  limit?: number;
  filters?: Record<string, unknown>;
  offset?: number;
};

type GetParams = {
  doc_id: string;
};

type ListParams = {
  category?: string;
  limit?: number;
  offset?: number;
};

const handlers: Record<string, (args: Record<string, unknown>) => Promise<RetrievalResult>> = {
  async search(args: Record<string, unknown>): Promise<RetrievalResult> {
    const { query, limit = 10, filters, offset = 0 } = args as SearchParams;

    if (!query) {
      return { success: false, error: 'Missing required parameter: query' };
    }

    // TODO: Integrate with TorqueQuery or retrieval backend
    // For now, return a stub response structure
    return {
      success: true,
      data: {
        query,
        limit,
        offset,
        filters: filters || {},
        results: [],
        total: 0,
        took_ms: 0
      }
    };
  },

  async get(args: Record<string, unknown>): Promise<RetrievalResult> {
    const { doc_id } = args as GetParams;

    if (!doc_id) {
      return { success: false, error: 'Missing required parameter: doc_id' };
    }

    // TODO: Retrieve from corpus store
    return {
      success: true,
      data: {
        doc_id,
        content: '',
        metadata: {},
        retrieved_at: new Date().toISOString()
      }
    };
  },

  async list(args: Record<string, unknown>): Promise<RetrievalResult> {
    const { category, limit = 20, offset = 0 } = args as ListParams;

    // TODO: List documents from corpus with optional category filter
    return {
      success: true,
      data: {
        category: category || 'all',
        limit,
        offset,
        documents: [],
        total: 0
      }
    };
  },

  async searchDocuments(args: Record<string, unknown>): Promise<RetrievalResult> {
    try {
      const {
        query,
        topK = 10,
        repo,
        phase,
        adapter,
        alpha = 0.4,
        beta = 0.6
      } = args as {
        query: string;
        topK?: number;
        repo?: string;
        phase?: string;
        adapter?: string;
        alpha?: number;
        beta?: number;
      };

      if (!query) {
        return { success: false, error: 'Missing required parameter: query' };
      }

      const results = await docSearch(query, { topK, repo, phase, adapter, alpha, beta });

      return {
        success: true,
        data: {
          query,
          topK,
          results,
          total: results.length,
          note: 'Hybrid keyword + semantic search, fusion weights: alpha (keyword) = ' +
            alpha + ', beta (semantic) = ' + beta
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Document search failed'
      };
    }
  }
};

const definitions = [
  {
    name: 'retrieval.search',
    description: 'Search corpus by query with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Maximum results to return', default: 10 },
        filters: { type: 'object', description: 'Optional search filters' },
        offset: { type: 'number', description: 'Result offset for pagination', default: 0 }
      },
      required: ['query']
    }
  },
  {
    name: 'retrieval.get',
    description: 'Retrieve a specific document by ID',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Document ID' }
      },
      required: ['doc_id']
    }
  },
  {
    name: 'retrieval.list',
    description: 'List documents from corpus, optionally filtered by category',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Optional category filter' },
        limit: { type: 'number', description: 'Maximum results to return', default: 20 },
        offset: { type: 'number', description: 'Result offset for pagination', default: 0 }
      }
    }
  },
  {
    name: 'retrieval.searchDocuments',
    description: 'Search extracted documents using hybrid keyword + semantic search (TorqueQuery)',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        topK: { type: 'number', description: 'Maximum results to return', default: 10 },
        repo: { type: 'string', description: 'Optional repository filter' },
        phase: { type: 'string', description: 'Optional phase filter (e.g., "27", "28")' },
        adapter: { type: 'string', description: 'Optional adapter filter (e.g., "WarmPool", "LlamaPool")' },
        alpha: {
          type: 'number',
          description: 'Keyword score weight (0-1)',
          default: 0.4
        },
        beta: {
          type: 'number',
          description: 'Semantic score weight (0-1)',
          default: 0.6
        }
      },
      required: ['query']
    }
  }
];

export const retrievalTools = {
  handlers,
  definitions
};
