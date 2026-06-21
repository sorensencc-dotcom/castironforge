/**
 * Embedding Service - Provider Abstraction
 *
 * Runtime-swappable embedding backends:
 * - OpenAI (default, production)
 * - Ollama (local, future)
 * - Other providers (extensible)
 */

import { getEnv } from '../runtimes/config';

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  dimensionality(): number;
}

/**
 * OpenAI Embedding Provider
 */
class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string;
  private model: string = 'text-embedding-3-large';
  private dims: number = 3072;

  constructor() {
    this.apiKey = getEnv('OPENAI_API_KEY', '');
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY environment variable not set');
    }
  }

  async embed(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Cannot embed empty text');
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        data: Array<{ embedding: number[] }>;
      };

      if (!data.data || data.data.length === 0) {
        throw new Error('No embedding returned from OpenAI');
      }

      return data.data[0].embedding;
    } catch (error) {
      throw new Error(`Failed to embed text: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: texts,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        data: Array<{ embedding: number[]; index: number }>;
      };

      // Sort by index to maintain order
      const sorted = data.data.sort((a, b) => a.index - b.index);
      return sorted.map((item) => item.embedding);
    } catch (error) {
      throw new Error(`Failed to embed batch: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  dimensionality(): number {
    return this.dims;
  }
}

/**
 * Ollama Embedding Provider (Local)
 */
class OllamaEmbeddingProvider implements EmbeddingProvider {
  private baseUrl: string;
  private model: string = 'nomic-embed-text';
  private dims: number = 768;

  constructor() {
    this.baseUrl = getEnv('OLLAMA_URL', 'http://localhost:11434');
  }

  async embed(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Cannot embed empty text');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status}`);
      }

      const data = (await response.json()) as { embedding: number[] };
      return data.embedding;
    } catch (error) {
      throw new Error(`Failed to embed text via Ollama: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // Ollama doesn't support batch embeddings, so embed sequentially
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }

  dimensionality(): number {
    return this.dims;
  }
}

/**
 * Select embedding provider based on configuration
 */
function selectEmbeddingProvider(): EmbeddingProvider {
  const provider = getEnv('EMBEDDING_PROVIDER', 'openai').toLowerCase();

  if (provider === 'ollama') {
    return new OllamaEmbeddingProvider();
  }

  // Default to OpenAI
  return new OpenAIEmbeddingProvider();
}

// Singleton instance
let instance: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (!instance) {
    instance = selectEmbeddingProvider();
    console.log(`[Embedding] Initialized ${instance.constructor.name}`);
  }
  return instance;
}

// Direct export for convenience
export const embeddingProvider = {
  embed: async (text: string) => getEmbeddingProvider().embed(text),
  embedBatch: async (texts: string[]) => getEmbeddingProvider().embedBatch(texts),
  dimensionality: () => getEmbeddingProvider().dimensionality(),
};
