/**
 * Memory layer storage integration with MinIO
 *
 * Stores long-term memory, embeddings, and semantic clusters:
 * - Embedding batches
 * - Memory snapshots
 * - Semantic clusters
 * - Entity relationships
 * - Contextual memory
 */

import { putObject, getObject, deleteObject, CIC_BUCKETS } from './MinioClient';
import { minioMetricsCollector } from './minioMetrics';

export interface EmbeddingBatch {
  batchId: string;
  modelId: string;
  documentCount: number;
  embeddingDimension: number;
  totalSize: number;
  createdAt: number;
  embeddingModel?: string;
}

export interface MemorySnapshot {
  snapshotId: string;
  timestamp: number;
  version: string;
  memories: {
    shortTerm: Record<string, unknown>[];
    longTerm: Record<string, unknown>[];
    semantic: Record<string, unknown>[];
  };
  embeddingModel?: string;
  metadata?: Record<string, string>;
}

export interface SemanticCluster {
  clusterId: string;
  centerEmbedding: number[];
  documents: {
    documentId: string;
    distance: number;
  }[];
  size: number;
  timestamp: number;
}

/**
 * Store embedding batch
 */
export async function storeEmbeddingBatch(
  batch: EmbeddingBatch,
  embeddings: Buffer
): Promise<string> {
  const startTime = Date.now();

  const key = `embeddings/${batch.modelId}/${batch.batchId}.bin`;

  try {
    const metadata: Record<string, string> = {
      'content-type': 'application/octet-stream',
      'batch-id': batch.batchId,
      'model-id': batch.modelId,
      'document-count': batch.documentCount.toString(),
      'embedding-dimension': batch.embeddingDimension.toString(),
      'batch-size': embeddings.length.toString(),
    };

    await putObject(CIC_BUCKETS.MEMORY, key, embeddings, metadata);

    const latencyMs = Date.now() - startTime;
    minioMetricsCollector.recordPutOperation(latencyMs, embeddings.length);
    minioMetricsCollector.recordBucketOperation(CIC_BUCKETS.MEMORY);

    console.log(`[Memory] Stored embedding batch: ${batch.batchId} (${batch.documentCount} documents)`);
    return key;
  } catch (error) {
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Retrieve embedding batch
 */
export async function retrieveEmbeddingBatch(key: string): Promise<Buffer> {
  const startTime = Date.now();

  try {
    const buffer = await getObject(CIC_BUCKETS.MEMORY, key);
    const latencyMs = Date.now() - startTime;
    minioMetricsCollector.recordGetOperation(latencyMs, buffer.length);
    minioMetricsCollector.recordBucketOperation(CIC_BUCKETS.MEMORY);

    return buffer;
  } catch (error) {
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Store memory snapshot
 */
export async function storeMemorySnapshot(snapshot: MemorySnapshot): Promise<string> {
  const startTime = Date.now();

  const key = `snapshots/${snapshot.snapshotId}/memory.json`;

  try {
    const data = JSON.stringify({
      ...snapshot,
      storedAt: new Date().toISOString(),
    });

    const metadata: Record<string, string> = {
      'content-type': 'application/json',
      'snapshot-id': snapshot.snapshotId,
      'snapshot-version': snapshot.version,
      'memory-size': data.length.toString(),
      ...(snapshot.metadata && Object.fromEntries(
        Object.entries(snapshot.metadata).map(([k, v]) => [k, v.toString()])
      )),
    };

    await putObject(CIC_BUCKETS.MEMORY, key, data, metadata);

    const latencyMs = Date.now() - startTime;
    minioMetricsCollector.recordPutOperation(latencyMs, Buffer.byteLength(data));
    minioMetricsCollector.recordBucketOperation(CIC_BUCKETS.MEMORY);

    console.log(`[Memory] Stored memory snapshot: ${snapshot.snapshotId}`);
    return key;
  } catch (error) {
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Retrieve memory snapshot
 */
export async function retrieveMemorySnapshot(key: string): Promise<MemorySnapshot> {
  const startTime = Date.now();

  try {
    const buffer = await getObject(CIC_BUCKETS.MEMORY, key);
    const latencyMs = Date.now() - startTime;
    minioMetricsCollector.recordGetOperation(latencyMs, buffer.length);
    minioMetricsCollector.recordBucketOperation(CIC_BUCKETS.MEMORY);

    return JSON.parse(buffer.toString('utf-8'));
  } catch (error) {
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Store semantic cluster
 */
export async function storeSemanticCluster(cluster: SemanticCluster): Promise<string> {
  const startTime = Date.now();

  const key = `clusters/${cluster.clusterId}.json`;

  try {
    const data = JSON.stringify({
      ...cluster,
      storedAt: new Date().toISOString(),
    });

    const metadata: Record<string, string> = {
      'content-type': 'application/json',
      'cluster-id': cluster.clusterId,
      'cluster-size': cluster.size.toString(),
      'document-count': cluster.documents.length.toString(),
    };

    await putObject(CIC_BUCKETS.MEMORY, key, data, metadata);

    const latencyMs = Date.now() - startTime;
    minioMetricsCollector.recordPutOperation(latencyMs, Buffer.byteLength(data));
    minioMetricsCollector.recordBucketOperation(CIC_BUCKETS.MEMORY);

    console.log(`[Memory] Stored semantic cluster: ${cluster.clusterId} (${cluster.size} documents)`);
    return key;
  } catch (error) {
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Retrieve semantic cluster
 */
export async function retrieveSemanticCluster(key: string): Promise<SemanticCluster> {
  const startTime = Date.now();

  try {
    const buffer = await getObject(CIC_BUCKETS.MEMORY, key);
    const latencyMs = Date.now() - startTime;
    minioMetricsCollector.recordGetOperation(latencyMs, buffer.length);
    minioMetricsCollector.recordBucketOperation(CIC_BUCKETS.MEMORY);

    return JSON.parse(buffer.toString('utf-8'));
  } catch (error) {
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Delete old memory snapshot (lifecycle management)
 */
export async function deleteMemorySnapshot(key: string): Promise<void> {
  try {
    await deleteObject(CIC_BUCKETS.MEMORY, key);
    minioMetricsCollector.recordBucketOperation(CIC_BUCKETS.MEMORY);
    console.log(`[Memory] Deleted snapshot: ${key}`);
  } catch (error) {
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Create memory snapshot index for quick retrieval
 */
export async function createSnapshotIndex(
  sessions: Array<{ sessionId: string; latestSnapshotKey: string; timestamp: number }>
): Promise<string> {
  const indexKey = `index/memory-snapshots.json`;

  try {
    const data = JSON.stringify({
      index: sessions,
      lastUpdated: new Date().toISOString(),
    });

    await putObject(CIC_BUCKETS.MEMORY, indexKey, data);
    console.log(`[Memory] Updated snapshot index (${sessions.length} sessions)`);
    return indexKey;
  } catch (error) {
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}
