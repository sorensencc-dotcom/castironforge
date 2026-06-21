/**
 * List and filter operations for MinIO storage
 *
 * Provides efficient enumeration of artifacts by:
 * - Session ID
 * - Agent ID
 * - Artifact type
 * - Date range
 * - Tags
 */

import { getMinIO, CIC_BUCKETS } from './MinioClient';
import { minioMetricsCollector } from './minioMetrics';

export interface ListFilter {
  prefix?: string;
  agentId?: string;
  sessionId?: string;
  artifactType?: string;
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
  limit?: number;
}

export interface ObjectMetadata {
  name: string;
  size: number;
  lastModified: Date;
  etag: string;
  metadata?: Record<string, string>;
}

export interface ListResult {
  bucket: string;
  objects: ObjectMetadata[];
  truncated: boolean;
  continuationToken?: string;
  count: number;
}

/**
 * List all artifacts in a bucket with optional filtering
 */
export async function listBucketObjects(
  bucket: string,
  filter?: ListFilter
): Promise<ListResult> {
  const startTime = Date.now();

  try {
    const client = getMinIO();
    const objects: ObjectMetadata[] = [];

    // Build prefix for filtering
    let prefix = filter?.prefix || '';
    if (filter?.agentId) {
      prefix = `${filter.agentId}/`;
    }

    // Use Minio list API
    const objectsStream = client.listObjects(bucket, prefix, true);

    return new Promise((resolve, reject) => {
      let count = 0;
      const limit = filter?.limit || 1000;

      objectsStream.on('data', (obj) => {
        if (count >= limit) {
          objectsStream.destroy();
          return;
        }

        // Apply filters
        if (shouldIncludeObject(obj, filter)) {
          objects.push({
            name: obj.name,
            size: obj.size,
            lastModified: new Date(obj.lastModified),
            etag: obj.etag,
          });
          count++;
        }
      });

      objectsStream.on('end', () => {
        const latencyMs = Date.now() - startTime;
        minioMetricsCollector.recordGetOperation(latencyMs, objects.length);

        resolve({
          bucket,
          objects,
          truncated: objects.length >= (filter?.limit || 1000),
          count: objects.length,
        });
      });

      objectsStream.on('error', reject);
    });
  } catch (error) {
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * List agent artifacts for a specific agent
 */
export async function listAgentArtifacts(
  agentId: string,
  sessionId?: string,
  options?: { limit?: number; type?: string }
): Promise<ListResult> {
  const filter: ListFilter = {
    agentId,
    sessionId,
    artifactType: options?.type,
    limit: options?.limit,
  };

  return listBucketObjects(CIC_BUCKETS.AGENT_ARTIFACTS, filter);
}

/**
 * List all artifacts from a session across all buckets
 */
export async function listSessionArtifacts(
  sessionId: string,
  options?: { limit?: number }
): Promise<Map<string, ListResult>> {
  const results = new Map<string, ListResult>();
  const buckets = [
    CIC_BUCKETS.AGENT_ARTIFACTS,
    CIC_BUCKETS.MEMORY,
    CIC_BUCKETS.TORQUEQUERY_RAW,
  ];

  for (const bucket of buckets) {
    try {
      const result = await listBucketObjects(bucket, {
        prefix: sessionId,
        limit: options?.limit,
      });
      results.set(bucket, result);
    } catch (error) {
      console.warn(`Failed to list artifacts in ${bucket} for session ${sessionId}:`, error);
    }
  }

  return results;
}

/**
 * List documents from a specific date range
 */
export async function listByDateRange(
  bucket: string,
  startDate: Date,
  endDate: Date,
  options?: { limit?: number }
): Promise<ListResult> {
  return listBucketObjects(bucket, {
    startDate,
    endDate,
    limit: options?.limit,
  });
}

/**
 * Search for artifacts by prefix pattern
 */
export async function searchByPrefix(
  bucket: string,
  prefix: string,
  options?: { limit?: number }
): Promise<ListResult> {
  return listBucketObjects(bucket, {
    prefix,
    limit: options?.limit,
  });
}

/**
 * Count objects in a bucket
 */
export async function countObjects(bucket: string, prefix?: string): Promise<number> {
  try {
    const client = getMinIO();
    let count = 0;

    const objectsStream = client.listObjects(bucket, prefix || '', true);

    return new Promise((resolve, reject) => {
      objectsStream.on('data', () => {
        count++;
      });

      objectsStream.on('end', () => {
        resolve(count);
      });

      objectsStream.on('error', reject);
    });
  } catch (error) {
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Get storage usage by bucket
 */
export async function getBucketStats(bucket: string): Promise<{
  bucket: string;
  objectCount: number;
  totalSize: number;
}> {
  try {
    const client = getMinIO();
    let objectCount = 0;
    let totalSize = 0;

    const objectsStream = client.listObjects(bucket, '', true);

    return new Promise((resolve, reject) => {
      objectsStream.on('data', (obj) => {
        objectCount++;
        totalSize += obj.size;
      });

      objectsStream.on('end', () => {
        resolve({
          bucket,
          objectCount,
          totalSize,
        });
      });

      objectsStream.on('error', reject);
    });
  } catch (error) {
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Helper to determine if object matches filters
 */
function shouldIncludeObject(obj: any, filter?: ListFilter): boolean {
  if (!filter) return true;

  // Session ID filter
  if (filter.sessionId && !obj.name.includes(filter.sessionId)) {
    return false;
  }

  // Type filter
  if (filter.artifactType && !obj.name.includes(filter.artifactType)) {
    return false;
  }

  // Date range filter
  if (filter.startDate || filter.endDate) {
    const objDate = new Date(obj.lastModified);
    if (filter.startDate && objDate < filter.startDate) {
      return false;
    }
    if (filter.endDate && objDate > filter.endDate) {
      return false;
    }
  }

  return true;
}
