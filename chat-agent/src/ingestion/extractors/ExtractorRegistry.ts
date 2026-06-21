import { TikaExtractor, ExtractionResult } from './TikaExtractor';

interface Extractor {
  extractFromBuffer(buf: Buffer): Promise<ExtractionResult>;
}

class ExtractorRegistry {
  private extractors = new Map<string, Extractor>();

  constructor() {
    this.register('tika', new TikaExtractor());
  }

  register(name: string, extractor: Extractor): void {
    this.extractors.set(name, extractor);
  }

  get(name: string): Extractor {
    const extractor = this.extractors.get(name);
    if (!extractor) {
      throw new Error(`Extractor not found: ${name}`);
    }
    return extractor;
  }

  async extract(extractorName: string, buffer: Buffer): Promise<ExtractionResult> {
    const extractor = this.get(extractorName);
    return extractor.extractFromBuffer(buffer);
  }
}

export const extractorRegistry = new ExtractorRegistry();
