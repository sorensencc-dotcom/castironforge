import { extractorRegistry } from './extractors/ExtractorRegistry';
import { evidenceBus } from './evidence/EvidenceBus';
import { metricsCollector } from '../utils/metricsCollector';

export interface IngestOptions {
  extractorName?: string;
  sourcePath: string;
  sourceRepo?: string;
}

export class IngestionService {
  async ingest(buffer: Buffer, options: IngestOptions): Promise<void> {
    const extractorName = options.extractorName ?? 'tika';

    try {
      const result = await extractorRegistry.extract(extractorName, buffer);

      const docEvidence = {
        kind: 'document' as const,
        text: result.text,
        metadata: result.metadata,
        source: {
          path: options.sourcePath,
          repo: options.sourceRepo,
          ingestedAt: new Date().toISOString()
        }
      };

      evidenceBus.emit(docEvidence);
      metricsCollector.increment('ingestion_docs_processed_total');
    } catch (error) {
      metricsCollector.increment('ingestion_errors_total');
      throw error;
    }
  }
}

export const ingestionService = new IngestionService();
