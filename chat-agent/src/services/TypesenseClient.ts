import Typesense from 'typesense';
import { getEnv } from '../runtimes/config';

const TYPESENSE_HOST = getEnv('TYPESENSE_HOST', 'localhost');
const TYPESENSE_PORT = parseInt(getEnv('TYPESENSE_PORT', '8108'), 10);
const TYPESENSE_API_KEY = getEnv('TYPESENSE_API_KEY', 'default-key');

export const typesenseClient = new Typesense.Client({
  nodes: [
    {
      host: TYPESENSE_HOST,
      port: TYPESENSE_PORT,
      protocol: 'http'
    }
  ],
  apiKey: TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 10
});

export interface DocsFilesDocument {
  id: string;
  content: string;
  title: string;
  author: string;
  mime: string;
  keywords: string[];
  pageCount: number;
  repo: string;
  path: string;
  phase: string;
  adapter: string;
  ingestedAt: string;
  updatedAt: string;
}

export async function upsertDocument(doc: DocsFilesDocument): Promise<void> {
  try {
    await typesenseClient.collections('docs_files').documents().upsert(doc);
  } catch (error) {
    throw new Error(
      `Typesense upsert failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export interface SearchOptions {
  queryBy: string;
  filterBy?: string;
  perPage?: number;
  page?: number;
}

export async function searchDocuments(
  query: string,
  options: SearchOptions
): Promise<any> {
  try {
    return await typesenseClient
      .collections('docs_files')
      .documents()
      .search({
        q: query,
        query_by: options.queryBy,
        filter_by: options.filterBy,
        per_page: options.perPage ?? 20,
        page: options.page ?? 1
      });
  } catch (error) {
    throw new Error(
      `Typesense search failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function ensureCollection(): Promise<void> {
  try {
    const schema = {
      name: 'docs_files',
      fields: [
        { name: 'id', type: 'string' },
        { name: 'content', type: 'string' },
        { name: 'title', type: 'string', facet: true },
        { name: 'author', type: 'string', facet: true },
        { name: 'mime', type: 'string', facet: true },
        { name: 'keywords', type: 'string[]' },
        { name: 'pageCount', type: 'int32' },
        { name: 'repo', type: 'string', facet: true },
        { name: 'path', type: 'string' },
        { name: 'phase', type: 'string', facet: true },
        { name: 'adapter', type: 'string', facet: true },
        { name: 'ingestedAt', type: 'string' },
        { name: 'updatedAt', type: 'string' }
      ],
      default_sorting_field: 'ingestedAt'
    };

    try {
      await typesenseClient.collections('docs_files').retrieve();
    } catch {
      await typesenseClient.collections().create(schema as any);
    }
  } catch (error) {
    throw new Error(
      `Typesense collection setup failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
