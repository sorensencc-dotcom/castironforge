/**
 * TorqueQuery raw corpus storage integration with MinIO
 *
 * This module stores raw documents before they are indexed into TorqueQuery/Typesense,
 * enabling:
 * - Reproducible indexing (re-index from stored raw docs)
 * - Deterministic corpus snapshots
 * - Audit trail of all indexed documents
 * - Ability to reprocess with different embedding models
 */

import { putObject, getObject, CIC_BUCKETS } from './MinioClient';
import { minioMetricsCollector } from './minioMetrics';

export interface RawDocument {
  id: string;
  title: string;
  content: string;
  contentHash: string;
  source: string;
  sourceUrl?: string;
  mimeType: string;
  timestamp: number;
  metadata?: Record<string, string>;
}

export interface DocumentBatch {
  batchId: string;
  documentCount: number;
  totalSize: number;
  timestamp: number;
  indexedAt?: number;
  embeddingModel?: string;
}

const crypto = require('crypto');

function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Store raw document before indexing into TorqueQuery
 */
export async function storeRawDocument(doc: RawDocument): Promise<string> {
  const startTime = Date.now();

  // Validate content hash
  const computedHash = computeHash(doc.content);
  if (doc.contentHash !== computedHash) {
    throw new Error(`Content hash mismatch for document ${doc.id}`);
  }

  // Key structure: source/contentHash/id
  const key = `${doc.source}/${doc.contentHash.substring(0, 8)}/${doc.id}`;

  try {
    const docData = JSON.stringify({
      ...doc,
      storedAt: new Date().toISOString(),
    });

    const metadata: Record<string, string> = {
      'content-type': 'application/json',
      'document-id': doc.id,
      'source': doc.source,
      'content-hash': doc.contentHash,
      'source-mime-type': doc.mimeType,
      ...(doc.sourceUrl && { 'source-url': doc.sourceUrl }),
      ...(doc.metadata && Object.fromEntries(
        Object.entries(doc.metadata).map(([k, v]) => [k, v.toString()])
      )),
    };

    await putObject(CIC_BUCKETS.TORQUEQUERY_RAW, key, docData, metadata);

    const latencyMs = Date.now() - startTime;
    minioMetricsCollector.recordPutOperation(latencyMs, Buffer.byteLength(docData));
    minioMetricsCollector.recordBucketOperation(CIC_BUCKETS.TORQUEQUERY_RAW);

    console.log(`[TorqueQuery] Stored raw document: ${doc.id} (${doc.content.length} bytes)`);
    return key;
  } catch (error) {
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Store batch of documents with manifest
 */
export async function storeBatch(batch: DocumentBatch, documents: RawDocument[]): Promise<string> {
  const startTime = Date.now();

  const batchKey = `batches/${batch.batchId}/manifest.json`;

  try {
    // Store all documents first
    const docKeys: string[] = [];
    for (const doc of documents) {
      const key = await storeRawDocument(doc);
      docKeys.push(key);
    }

    // Store batch manifest
    const manifest = {
      ...batch,
      documents: docKeys,
      storedAt: new Date().toISOString(),
    };

    const manifestData = JSON.stringify(manifest);
    const metadata: Record<string, string> = {
      'content-type': 'application/json',
      'batch-id': batch.batchId,
      'document-count': batch.documentCount.toString(),
    };

    await putObject(CIC_BUCKETS.TORQUEQUERY_RAW, batchKey, manifestData, metadata);

    const latencyMs = Date.now() - startTime;
    minioMetricsCollector.recordPutOperation(latencyMs, Buffer.byteLength(manifestData));
    minioMetricsCollector.recordBucketOperation(CIC_BUCKETS.TORQUEQUERY_RAW);

    console.log(`[TorqueQuery] Stored batch ${batch.batchId}: ${batch.documentCount} documents`);
    return batchKey;
  } catch (error) {
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Retrieve raw document for inspection or reprocessing
 */
export async function retrieveRawDocument(key: string): Promise<RawDocument> {
  const startTime = Date.now();

  try {
    const buffer = await getObject(CIC_BUCKETS.TORQUEQUERY_RAW, key);
    const latencyMs = Date.now() - startTime;
    minioMetricsCollector.recordGetOperation(latencyMs, buffer.length);
    minioMetricsCollector.recordBucketOperation(CIC_BUCKETS.TORQUEQUERY_RAW);

    return JSON.parse(buffer.toString('utf-8'));
  } catch (error) {
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * List all batches in the corpus
 */
export async function listBatches(): Promise<DocumentBatch[]> {
  // This is a placeholder for future implementation with list operations
  // For now, return empty array
  return [];
}

/**
 * Create snapshot of current corpus for versioning
 */
export async function createCorpusSnapshot(snapshotId: string, metadata?: Record<string, string>): Promise<string> {
  const startTime = Date.now();

  const snapshotKey = `snapshots/${snapshotId}/metadata.json`;

  try {
    const snapshotMetadata = {
      snapshotId,
      createdAt: new Date().toISOString(),
      corpus: {
        source: CIC_BUCKETS.TORQUEQUERY_RAW,
        description: 'Complete TorqueQuery raw corpus snapshot',
      },
      ...metadata,
    };

    const data = JSON.stringify(snapshotMetadata);
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'snapshot-id': snapshotId,
    };

    await putObject(CIC_BUCKETS.TORQUEQUERY_RAW, snapshotKey, data, headers);

    const latencyMs = Date.now() - startTime;
    minioMetricsCollector.recordPutOperation(latencyMs, Buffer.byteLength(data));

    console.log(`[TorqueQuery] Created corpus snapshot: ${snapshotId}`);
    return snapshotKey;
  } catch (error) {
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}
