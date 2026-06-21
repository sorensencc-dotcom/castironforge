import { QdrantClient as QdrantLib } from '@qdrant/js-client-rest';
import { getEnv } from '../runtimes/config';

const QDRANT_HOST = getEnv('QDRANT_HOST', 'localhost');
const QDRANT_PORT = parseInt(getEnv('QDRANT_PORT', '6333'), 10);
const QDRANT_API_KEY = getEnv('QDRANT_API_KEY', '');

export const qdrantClient = new QdrantLib({
  host: QDRANT_HOST,
  port: QDRANT_PORT,
  apiKey: QDRANT_API_KEY || undefined
});

export interface PointPayload {
  id: string;
  repo: string;
  path: string;
  phase: string;
  adapter: string;
  mime: string;
  title: string;
  author: string;
}

export async function upsertVector(
  collectionName: string,
  id: string,
  vector: number[],
  payload: PointPayload
): Promise<void> {
  try {
    await qdrantClient.upsert(collectionName, {
      points: [
        {
          id,
          vector,
          payload
        }
      ]
    });
  } catch (error) {
    throw new Error(
      `Qdrant upsert failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export interface SearchFilter {
  must?: Array<{ key: string; match: { value: string } }>;
  should?: Array<{ key: string; match: { value: string } }>;
}

export async function searchVectors(
  collectionName: string,
  vector: number[],
  limit: number = 20,
  filter?: SearchFilter
): Promise<any> {
  try {
    return await qdrantClient.search(collectionName, {
      vector,
      limit,
      filter: filter ? buildQdrantFilter(filter) : undefined,
      with_payload: true
    });
  } catch (error) {
    throw new Error(
      `Qdrant search failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function ensureCollection(
  collectionName: string,
  vectorSize: number = 1536
): Promise<void> {
  try {
    try {
      await qdrantClient.getCollection(collectionName);
    } catch {
      await qdrantClient.recreateCollection(collectionName, {
        vectors: {
          size: vectorSize,
          distance: 'Cosine'
        }
      });
    }
  } catch (error) {
    throw new Error(
      `Qdrant collection setup failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function buildQdrantFilter(filter: SearchFilter): any {
  const conditions = [];

  if (filter.must) {
    conditions.push({
      must: filter.must.map((f) => ({
        key: f.key,
        match: { value: f.match.value }
      }))
    });
  }

  if (filter.should) {
    conditions.push({
      should: filter.should.map((f) => ({
        key: f.key,
        match: { value: f.match.value }
      }))
    });
  }

  return conditions.length === 1 ? conditions[0] : { must: conditions };
}
