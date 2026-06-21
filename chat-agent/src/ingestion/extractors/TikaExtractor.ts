import { TIKA_URL } from '../../runtimes/config';
import { metricsCollector } from '../../utils/metricsCollector';

export interface ExtractionResult {
  type: 'document';
  mime: string;
  text: string;
  metadata: Record<string, string | string[]>;
}

export class TikaExtractor {
  async extractFromBuffer(buf: Buffer): Promise<ExtractionResult> {
    const timer = metricsCollector.start('tika_extraction');

    try {
      const [textResult, metadataResult] = await Promise.all([
        this.extractText(buf),
        this.extractMetadata(buf)
      ]);

      timer.end();
      metricsCollector.increment('tika_docs_extracted_total');

      return {
        type: 'document',
        mime: metadataResult['Content-Type'] ?? 'application/octet-stream',
        text: textResult,
        metadata: metadataResult
      };
    } catch (error) {
      timer.end();
      metricsCollector.increment('tika_errors_total');
      throw error;
    }
  }

  private async extractText(buf: Buffer): Promise<string> {
    const res = await fetch(`${TIKA_URL}/tika`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: buf
    });

    if (!res.ok) {
      throw new Error(`Tika text extraction failed: ${res.status} ${res.statusText}`);
    }

    return await res.text();
  }

  private async extractMetadata(buf: Buffer): Promise<Record<string, string | string[]>> {
    const res = await fetch(`${TIKA_URL}/meta`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: buf
    });

    if (!res.ok) {
      throw new Error(`Tika metadata extraction failed: ${res.status} ${res.statusText}`);
    }

    return await res.json();
  }
}
