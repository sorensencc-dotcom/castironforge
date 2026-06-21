/**
 * TorqueQuery + MinIO Pipeline
 *
 * Bridge between ingestion and indexing:
 * 1. Receive raw documents
 * 2. Store to MinIO (cic-torquequery-raw) for reproducibility
 * 3. Index into TorqueQuery (docs_files + docs_files_vectors)
 * 4. Track metrics
 *
 * This creates a durable, queryable corpus backed by MinIO.
 */

import { storeRawDocument, RawDocument } from '../storage/torquequeryStorage';
import { minioMetricsCollector } from '../storage/minioMetrics';
import { TORQUE_URL } from '../runtimes/config';

export interface DocumentForIndexing {
  id: string;
  title: string;
  content: string;
  source: string;
  sourceUrl?: string;
  mimeType?: string;
  metadata?: Record<string, string>;
}

export interface PipelineResult {
  documentId: string;
  minioKey: string;
  indexed: boolean;
  torqueId?: string;
  error?: string;
}

export interface PipelineStats {
  processed: number;
  stored: number;
  indexed: number;
  failed: number;
  totalDuration: number;
  averageLatency: number;
}

const crypto = require('crypto');

/**
 * Process a single document through the pipeline
 */
export async function processDocument(doc: DocumentForIndexing): Promise<PipelineResult> {
  const startTime = Date.now();

  try {
    // Step 1: Compute content hash for reproducibility
    const contentHash = crypto
      .createHash('sha256')
      .update(doc.content)
      .digest('hex');

    // Step 2: Store raw document to MinIO
    const rawDoc: RawDocument = {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      contentHash,
      source: doc.source,
      sourceUrl: doc.sourceUrl,
      mimeType: doc.mimeType || 'text/plain',
      timestamp: Date.now(),
      metadata: doc.metadata,
    };

    const minioKey = await storeRawDocument(rawDoc);
    console.log(`[TorqueQuery] Stored raw document: ${doc.id} → ${minioKey}`);

    // Step 3: Index into TorqueQuery
    const torqueId = await indexToTorqueQuery({
      id: doc.id,
      title: doc.title,
      text: doc.content,
      source: doc.source,
      metadata: {
        contentHash,
        minioKey,
        indexed_at: new Date().toISOString(),
      },
    });

    const latencyMs = Date.now() - startTime;
    console.log(`[TorqueQuery] Indexed document: ${doc.id} in ${latencyMs}ms`);

    return {
      documentId: doc.id,
      minioKey,
      indexed: true,
      torqueId,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(errorMsg));

    console.error(`[TorqueQuery] Failed to process document ${doc.id}:`, errorMsg);

    return {
      documentId: doc.id,
      minioKey: '',
      indexed: false,
      error: errorMsg,
    };
  }
}

/**
 * Process batch of documents
 */
export async function processBatch(documents: DocumentForIndexing[]): Promise<{
  results: PipelineResult[];
  stats: PipelineStats;
}> {
  const startTime = Date.now();
  const results: PipelineResult[] = [];
  let stored = 0;
  let indexed = 0;
  let failed = 0;

  for (const doc of documents) {
    const result = await processDocument(doc);
    results.push(result);

    if (result.error) {
      failed++;
    } else {
      stored++;
      if (result.indexed) {
        indexed++;
      }
    }
  }

  const totalDuration = Date.now() - startTime;
  const stats: PipelineStats = {
    processed: documents.length,
    stored,
    indexed,
    failed,
    totalDuration,
    averageLatency: Math.round(totalDuration / documents.length),
  };

  console.log(`[TorqueQuery] Batch complete: ${indexed}/${documents.length} indexed in ${totalDuration}ms`);

  return { results, stats };
}

/**
 * Index document into TorqueQuery
 */
async function indexToTorqueQuery(doc: {
  id: string;
  title: string;
  text: string;
  source: string;
  metadata: Record<string, string>;
}): Promise<string> {
  try {
    const response = await fetch(`${TORQUE_URL}/index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doc_id: doc.id,
        title: doc.title,
        content: doc.text,
        source: doc.source,
        metadata: doc.metadata,
      }),
    });

    if (!response.ok) {
      throw new Error(`TorqueQuery index error: ${response.status}`);
    }

    const data = (await response.json()) as { doc_id?: string };
    return data.doc_id || doc.id;
  } catch (error) {
    throw new Error(
      `Failed to index to TorqueQuery: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Reindex from MinIO (disaster recovery / re-embedding)
 */
export async function reindexFromMinIO(minioKey: string): Promise<PipelineResult> {
  try {
    const { retrieveRawDocument } = await import('../storage/torquequeryStorage');
    const rawDoc = await retrieveRawDocument(minioKey);

    return processDocument({
      id: rawDoc.id,
      title: rawDoc.title,
      content: rawDoc.content,
      source: rawDoc.source,
      sourceUrl: rawDoc.sourceUrl,
      mimeType: rawDoc.mimeType,
      metadata: rawDoc.metadata,
    });
  } catch (error) {
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Verify corpus integrity (MinIO stored ≈ TorqueQuery indexed)
 */
export async function verifyCorpusIntegrity(): Promise<{
  minioCount: number;
  torqueCount?: number;
  mismatch: boolean;
}> {
  try {
    const { getBucketStats } = await import('../storage/listOperations');
    const minioStats = await getBucketStats('cic-torquequery-raw');

    // Query TorqueQuery for document count
    const torqueCount = await getTorqueDocumentCount();

    return {
      minioCount: minioStats.objectCount,
      torqueCount,
      mismatch: Math.abs(minioStats.objectCount - (torqueCount || 0)) > 0,
    };
  } catch (error) {
    console.error('[TorqueQuery] Integrity check failed:', error);
    throw error;
  }
}

/**
 * Get document count from TorqueQuery
 */
async function getTorqueDocumentCount(): Promise<number> {
  try {
    const response = await fetch(`${TORQUE_URL}/stats`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      return 0;
    }

    const data = (await response.json()) as { document_count?: number };
    return data.document_count || 0;
  } catch {
    return 0;
  }
}

/**
 * Pipeline health status
 */
export async function getPipelineHealth(): Promise<{
  minioHealthy: boolean;
  torqueHealthy: boolean;
  corpusIntegrity: { mismatch: boolean; minioCount: number } | null;
}> {
  try {
    const { checkMinIOHealth } = await import('../storage/minioHealth');
    const { rag } = await import('./rag');

    const minioStatus = await checkMinIOHealth();
    const minioHealthy = minioStatus.status === 'healthy';

    // Test TorqueQuery connectivity
    let torqueHealthy = false;
    try {
      await rag.search('test', 1);
      torqueHealthy = true;
    } catch {
      torqueHealthy = false;
    }

    // Get corpus stats if both healthy
    let corpusIntegrity = null;
    if (minioHealthy && torqueHealthy) {
      try {
        const stats = await verifyCorpusIntegrity();
        corpusIntegrity = {
          mismatch: stats.mismatch,
          minioCount: stats.minioCount,
        };
      } catch {
        // Ignore integrity check errors
      }
    }

    return {
      minioHealthy,
      torqueHealthy,
      corpusIntegrity,
    };
  } catch (error) {
    console.error('[TorqueQuery] Health check failed:', error);
    return {
      minioHealthy: false,
      torqueHealthy: false,
      corpusIntegrity: null,
    };
  }
}
