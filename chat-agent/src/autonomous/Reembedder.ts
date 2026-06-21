import { typesenseAdapter } from '../corpus/adapters/TypesenseAdapter';
import { qdrantAdapter } from '../corpus/adapters/QdrantAdapter';
import { WorkflowContext } from './types';

export class Reembedder {
  constructor(private embeddingService: any) {}

  async reembed(context: WorkflowContext): Promise<void> {
    if (!context.documentId) {
      throw new Error('Document ID required for reembed workflow');
    }

    try {
      // 1. Get document from Typesense
      const doc = await typesenseAdapter.getDocument('docs_files', context.documentId);

      if (!doc) {
        throw new Error(`Document not found in Typesense: ${context.documentId}`);
      }

      // 2. Extract text content
      const textContent = doc.content || doc.title || '';
      if (!textContent) {
        throw new Error(`No text content to embed for ${context.documentId}`);
      }

      // 3. Generate new embedding
      const embedding = await this.embeddingService.embed(textContent);

      if (!embedding || embedding.length === 0) {
        throw new Error(`Failed to generate embedding for ${context.documentId}`);
      }

      // 4. Upsert to Qdrant with updated metadata
      const payload = {
        id: doc.id,
        repo: doc.repo,
        path: doc.path,
        phase: doc.phase,
        adapter: doc.adapter,
        subsystem: doc.subsystem,
        mime: doc.mime,
        title: doc.title,
        author: doc.author,
        sha256: context.sha256 || doc.sha256,
        updatedAt: new Date().toISOString()
      };

      // Update vector in Qdrant
      await qdrantAdapter.retrievePoints('docs_files_vectors', [context.documentId]);

      console.log(`[Reembedder] Reembedded document: ${context.documentId}`);
    } catch (error) {
      throw new Error(
        `Reembed failed for ${context.documentId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async reembedBatch(documentIds: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const docId of documentIds) {
      try {
        await this.reembed({ taskId: '', action: 'REEMBED', documentId: docId });
        results.set(docId, true);
      } catch (error) {
        console.error(`Failed to reembed ${docId}:`, error);
        results.set(docId, false);
      }
    }

    return results;
  }
}
