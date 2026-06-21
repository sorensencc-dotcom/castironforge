import { putObject, ensureBucket } from '../../services/MinioClient';
import { upsertDocument, ensureCollection as ensureTypesenseCollection } from '../../services/TypesenseClient';
import { upsertVector, ensureCollection as ensureQdrantCollection } from '../../services/QdrantClient';
import { embed } from '../../services/EmbeddingService';
import { metricsCollector } from '../../utils/metricsCollector';
import type { DocsFilesDocument } from '../../services/TypesenseClient';
import type { PointPayload } from '../../services/QdrantClient';

export interface IngestionContract {
  repo: string;
  path: string;
  text: string;
  rawBuffer: Buffer;
  metadata: Record<string, string | string[]>;
  phase?: string;
  adapter?: string;
}

export async function ingestDocumentToTorqueQuery(contract: IngestionContract): Promise<{
  id: string;
  repo: string;
  path: string;
}> {
  const timer = metricsCollector.start('torque_ingestion');

  try {
    const id = `${contract.repo}:${contract.path}`;
    const now = new Date().toISOString();

    // Determine phase and adapter (caller → metadata → fallback)
    const phase = contract.phase ?? (contract.metadata.phase as string) ?? '';
    const adapter = contract.adapter ?? (contract.metadata.adapter as string) ?? '';

    // 1. Ensure buckets and collections exist
    await Promise.all([
      ensureBucket('cic-torquequery-raw'),
      ensureTypesenseCollection(),
      ensureQdrantCollection('docs_files_vectors', 1536)
    ]);

    // 2. Store raw artifact in MinIO
    await putObject('cic-torquequery-raw', `${id}.raw`, contract.rawBuffer, {
      'Content-Type': (contract.metadata['Content-Type'] as string) ?? 'application/octet-stream'
    });
    metricsCollector.increment('ingestion_raw_stored_total');

    // 3. Generate embedding
    const embedding = await embed(contract.text);
    metricsCollector.increment('ingestion_embeddings_generated_total');

    // 4. Build Typesense document
    const typesenseDoc: DocsFilesDocument = {
      id,
      content: contract.text,
      title: (contract.metadata.title as string) ?? '',
      author: (contract.metadata.Author as string) ?? '',
      mime: (contract.metadata['Content-Type'] as string) ?? 'application/octet-stream',
      keywords: (contract.metadata.Keywords as string[]) ?? [],
      pageCount: parseInt((contract.metadata['Page-Count'] as string) ?? '0', 10),
      repo: contract.repo,
      path: contract.path,
      phase,
      adapter,
      ingestedAt: now,
      updatedAt: now
    };

    // 5. Upsert into Typesense (keyword index)
    await upsertDocument(typesenseDoc);
    metricsCollector.increment('ingestion_typesense_upserted_total');

    // 6. Build and upsert Qdrant vector
    const qdrantPayload: PointPayload = {
      id,
      repo: contract.repo,
      path: contract.path,
      phase,
      adapter,
      mime: typesenseDoc.mime,
      title: typesenseDoc.title,
      author: typesenseDoc.author
    };

    await upsertVector('docs_files_vectors', id, embedding, qdrantPayload);
    metricsCollector.increment('ingestion_qdrant_upserted_total');

    timer.end();
    metricsCollector.increment('ingestion_documents_total');

    return { id, repo: contract.repo, path: contract.path };
  } catch (error) {
    timer.end();
    metricsCollector.increment('ingestion_errors_total');
    throw error;
  }
}
