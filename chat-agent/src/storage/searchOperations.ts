/**
 * Search and query operations for MinIO stored artifacts
 *
 * Provides searching by:
 * - Object metadata
 * - Content hash
 * - Tags
 * - Custom attributes
 */

import { getMinIO, CIC_BUCKETS } from './MinioClient';
import { minioMetricsCollector } from './minioMetrics';

export interface SearchQuery {
  bucket: string;
  metadataFilters?: Record<string, string | string[]>;
  tags?: string[];
  contentHash?: string;
  sizeRange?: { min: number; max: number };
  limit?: number;
}

export interface SearchResult {
  name: string;
  size: number;
  metadata?: Record<string, string>;
  etag: string;
  lastModified: Date;
}

/**
 * Search artifacts by metadata
 */
export async function searchByMetadata(query: SearchQuery): Promise<SearchResult[]> {
  const startTime = Date.now();

  try {
    const client = getMinIO();
    const results: SearchResult[] = [];

    const objectsStream = client.listObjects(query.bucket, '', true);

    return new Promise((resolve, reject) => {
      const limit = query.limit || 1000;
      let count = 0;

      objectsStream.on('data', async (obj) => {
        if (count >= limit) {
          objectsStream.destroy();
          return;
        }

        try {
          // Get object metadata
          const stat = await client.statObject(query.bucket, obj.name);

          if (matchesQuery(stat.metaData as Record<string, string>, query)) {
            results.push({
              name: obj.name,
              size: obj.size,
              metadata: stat.metaData as Record<string, string>,
              etag: stat.etag,
              lastModified: new Date(stat.lastModified),
            });
            count++;
          }
        } catch (error) {
          // Skip objects that can't be read
          console.warn(`Failed to read metadata for ${obj.name}:`, error);
        }
      });

      objectsStream.on('end', () => {
        const latencyMs = Date.now() - startTime;
        minioMetricsCollector.recordGetOperation(latencyMs, results.length);
        resolve(results);
      });

      objectsStream.on('error', reject);
    });
  } catch (error) {
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Find artifacts by agent ID and session
 */
export async function findAgentSession(
  agentId: string,
  sessionId: string,
  options?: { limit?: number }
): Promise<SearchResult[]> {
  return searchByMetadata({
    bucket: CIC_BUCKETS.AGENT_ARTIFACTS,
    metadataFilters: {
      'agent-id': agentId,
      'session-id': sessionId,
    },
    limit: options?.limit,
  });
}

/**
 * Find all artifacts by content hash
 */
export async function findByContentHash(
  bucket: string,
  contentHash: string
): Promise<SearchResult[]> {
  return searchByMetadata({
    bucket,
    contentHash,
  });
}

/**
 * Find artifacts by multiple tags
 */
export async function findByTags(
  bucket: string,
  tags: string[],
  matchAll: boolean = false
): Promise<SearchResult[]> {
  const startTime = Date.now();

  try {
    const client = getMinIO();
    const results: SearchResult[] = [];

    const objectsStream = client.listObjects(bucket, '', true);

    return new Promise((resolve, reject) => {
      objectsStream.on('data', async (obj) => {
        try {
          const stat = await client.statObject(bucket, obj.name);
          const metadata = stat.metaData as Record<string, string>;
          const objectTags = (metadata['tags'] || '').split(',').filter(Boolean);

          let matches = false;
          if (matchAll) {
            matches = tags.every((tag) => objectTags.includes(tag));
          } else {
            matches = tags.some((tag) => objectTags.includes(tag));
          }

          if (matches) {
            results.push({
              name: obj.name,
              size: obj.size,
              metadata,
              etag: stat.etag,
              lastModified: new Date(stat.lastModified),
            });
          }
        } catch (error) {
          console.warn(`Failed to read metadata for ${obj.name}:`, error);
        }
      });

      objectsStream.on('end', () => {
        const latencyMs = Date.now() - startTime;
        minioMetricsCollector.recordGetOperation(latencyMs, results.length);
        resolve(results);
      });

      objectsStream.on('error', reject);
    });
  } catch (error) {
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Find recent artifacts (last N hours)
 */
export async function findRecent(
  bucket: string,
  hoursAgo: number,
  options?: { limit?: number }
): Promise<SearchResult[]> {
  const startTime = Date.now();
  const cutoffTime = new Date(startTime - hoursAgo * 60 * 60 * 1000);

  try {
    const client = getMinIO();
    const results: SearchResult[] = [];

    const objectsStream = client.listObjects(bucket, '', true);

    return new Promise((resolve, reject) => {
      const limit = options?.limit || 1000;
      let count = 0;

      objectsStream.on('data', async (obj) => {
        if (count >= limit) {
          objectsStream.destroy();
          return;
        }

        try {
          const stat = await client.statObject(bucket, obj.name);
          if (new Date(stat.lastModified) > cutoffTime) {
            results.push({
              name: obj.name,
              size: obj.size,
              metadata: stat.metaData as Record<string, string>,
              etag: stat.etag,
              lastModified: new Date(stat.lastModified),
            });
            count++;
          }
        } catch (error) {
          console.warn(`Failed to read metadata for ${obj.name}:`, error);
        }
      });

      objectsStream.on('end', () => {
        const latencyMs = Date.now() - startTime;
        minioMetricsCollector.recordGetOperation(latencyMs, results.length);
        resolve(results);
      });

      objectsStream.on('error', reject);
    });
  } catch (error) {
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Helper to check if metadata matches query filters
 */
function matchesQuery(metadata: Record<string, string>, query: SearchQuery): boolean {
  // Content hash filter
  if (query.contentHash && metadata['content-hash'] !== query.contentHash) {
    return false;
  }

  // Size range filter
  if (query.sizeRange) {
    const size = parseInt(metadata['original-size'] || '0', 10);
    if (size < query.sizeRange.min || size > query.sizeRange.max) {
      return false;
    }
  }

  // Metadata filters
  if (query.metadataFilters) {
    for (const [key, value] of Object.entries(query.metadataFilters)) {
      const metaKey = key.toLowerCase();
      const metaValue = metadata[metaKey];

      if (Array.isArray(value)) {
        if (!value.includes(metaValue)) {
          return false;
        }
      } else {
        if (metaValue !== value) {
          return false;
        }
      }
    }
  }

  return true;
}
