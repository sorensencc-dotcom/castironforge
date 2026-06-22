import { extractTags } from '../corpus/tags/TagExtractor';
import { typesenseAdapter } from '../corpus/adapters/TypesenseAdapter';
import { minioAdapter } from '../corpus/adapters/MinioAdapter';
import { WorkflowContext } from './types';

export class Reindexer {
  async reindex(context: WorkflowContext): Promise<void> {
    if (!context.documentId) {
      throw new Error('Document ID required for reindex workflow');
    }

    try {
      // 1. Get raw document from MinIO
      const rawDocument = await minioAdapter.listObjects('cic-torquequery-raw');
      const docObject = rawDocument.find(obj => obj.name.includes(context.documentId));

      if (!docObject) {
        throw new Error(`Document not found in MinIO: ${context.documentId}`);
      }

      // 2. Extract tags from document
      const tags = extractTags({
        repo: 'castironforge',
        path: docObject.name,
        text: context.metadata?.content || '',
        metadata: context.metadata || {},
        explicitPhase: context.phase,
        explicitAdapter: context.adapter
      });

      // 3. Update document in Typesense with new tags
      const doc = await typesenseAdapter.getDocument('docs_files', context.documentId);

      const updatedDoc = {
        ...doc,
        phase: tags.phase || doc.phase,
        adapter: tags.adapter || doc.adapter,
        subsystem: tags.subsystem || doc.subsystem,
        updatedAt: new Date().toISOString(),
        sha256: context.sha256 || doc.sha256
      };

      await typesenseAdapter.updateDocument('docs_files', context.documentId, updatedDoc);

      console.log(`[Reindexer] Reindexed document: ${context.documentId}`);
    } catch (error) {
      throw new Error(
        `Reindex failed for ${context.documentId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
