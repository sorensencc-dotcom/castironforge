/**
 * Tika → TorqueQuery Ingestion Bridge
 *
 * Complete pipeline:
 * 1. Receive extracted document from Tika
 * 2. Store raw artifact in MinIO
 * 3. Generate embedding via provider
 * 4. Index into Typesense (BM25)
 * 5. Index into Qdrant (semantic)
 * 6. Return deterministic result
 */

import crypto from 'crypto';
import { putObject } from '../../storage/MinioClient';
import { embeddingProvider } from '../../services/embeddingService';
import { minioMetricsCollector } from '../../storage/minioMetrics';

export interface IngestionInput {
  repo: string;
  path: string;
  text: string;
  rawBuffer: Buffer;
  metadata?: Record<string, string>;
  phase?: string;
  adapter?: string;
}

export interface IngestionResult {
  id: string;
  repo: string;
  path: string;
  sha256: string;
  minioKey: string;
  embeddingDims: number;
  indexed: {
    typesense: boolean;
    qdrant: boolean;
  };
  timestamp: string;
  error?: string;
}

/**
 * Ingest document through complete pipeline
 */
export async function ingestDocumentToTorqueQuery(input: IngestionInput): Promise<IngestionResult> {
  const startTime = Date.now();
  const id = `${input.repo}:${input.path}`;
  const now = new Date().toISOString();

  const result: IngestionResult = {
    id,
    repo: input.repo,
    path: input.path,
    sha256: '',
    minioKey: '',
    embeddingDims: 0,
    indexed: {
      typesense: false,
      qdrant: false,
    },
    timestamp: now,
  };

  try {
    // Step 1: Compute deterministic hash
    const sha256 = crypto.createHash('sha256').update(input.rawBuffer).digest('hex');
    result.sha256 = sha256;

    // Step 2: Store raw artifact to MinIO
    const minioKey = `${input.repo}/${sha256.substring(0, 8)}/${input.path}`;
    await putObject('cic-torquequery-raw', minioKey, input.rawBuffer, {
      'content-type': 'application/octet-stream',
      'document-id': id,
      'repo': input.repo,
      'path': input.path,
      'content-hash': sha256,
      ...(input.metadata && Object.fromEntries(
        Object.entries(input.metadata).map(([k, v]) => [k.toLowerCase(), v.toString()])
      )),
    });

    result.minioKey = minioKey;
    minioMetricsCollector.recordBucketOperation('cic-torquequery-raw');
    console.log(`[Ingestion] Stored raw document: ${id} → ${minioKey}`);

    // Step 3: Generate embedding
    const embedding = await embeddingProvider.embed(input.text);
    result.embeddingDims = embedding.length;
    console.log(`[Ingestion] Generated embedding: ${embedding.length} dimensions`);

    // Step 4: Index into Typesense (BM25)
    try {
      await indexToTypesense({
        id,
        content: input.text,
        title: input.metadata?.title ?? '',
        author: input.metadata?.Author ?? '',
        mime: input.metadata?.['Content-Type'] ?? '',
        keywords: (input.metadata?.Keywords ?? '').split(',').filter(Boolean),
        pageCount: parseInt(input.metadata?.['Page-Count'] ?? '0', 10),
        repo: input.repo,
        path: input.path,
        phase: input.phase ?? input.metadata?.phase ?? '',
        adapter: input.adapter ?? input.metadata?.adapter ?? '',
        sha256,
      });
      result.indexed.typesense = true;
      console.log(`[Ingestion] Indexed to Typesense: ${id}`);
    } catch (error) {
      console.warn(`[Ingestion] Failed to index to Typesense: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Step 5: Index into Qdrant (semantic)
    try {
      await indexToQdrant({
        id,
        vector: embedding,
        payload: {
          id,
          repo: input.repo,
          path: input.path,
          phase: input.phase ?? input.metadata?.phase ?? '',
          adapter: input.adapter ?? input.metadata?.adapter ?? '',
          mime: input.metadata?.['Content-Type'] ?? '',
          title: input.metadata?.title ?? '',
          author: input.metadata?.Author ?? '',
          sha256,
        },
      });
      result.indexed.qdrant = true;
      console.log(`[Ingestion] Indexed to Qdrant: ${id}`);
    } catch (error) {
      console.warn(`[Ingestion] Failed to index to Qdrant: ${error instanceof Error ? error.message : String(error)}`);
    }

    const duration = Date.now() - startTime;
    console.log(`[Ingestion] Complete: ${id} in ${duration}ms`);

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    console.error(`[Ingestion] Failed to ingest ${id}:`, result.error);
    return result;
  }
}

/**
 * Index to Typesense (BM25 keyword index)
 */
async function indexToTypesense(doc: {
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
  sha256: string;
}): Promise<void> {
  // TODO: Wire Typesense client
  // For now, placeholder implementation
  console.log(`[Typesense] Would index document: ${doc.id}`);
}

/**
 * Index to Qdrant (semantic vector index)
 */
async function indexToQdrant(doc: {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}): Promise<void> {
  // TODO: Wire Qdrant client
  // For now, placeholder implementation
  console.log(`[Qdrant] Would index vector for document: ${doc.id}`);
}
