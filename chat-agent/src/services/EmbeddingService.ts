import { getEnv } from '../runtimes/config';

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string;
  private model: string = 'text-embedding-3-large';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        input: text
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI embedding failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };
    return data.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        input: texts
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI batch embedding failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };

    return data.data
      .sort((a, b) => (a as any).index - (b as any).index)
      .map((d) => d.embedding);
  }
}

class LocalEmbeddingProvider implements EmbeddingProvider {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/v1/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'local',
        input: text
      })
    });

    if (!response.ok) {
      throw new Error(`Local embedding failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };
    return data.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.baseUrl}/v1/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'local',
        input: texts
      })
    });

    if (!response.ok) {
      throw new Error(`Local batch embedding failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };

    return data.data
      .sort((a, b) => (a as any).index - (b as any).index)
      .map((d) => d.embedding);
  }
}

export function createEmbeddingProvider(): EmbeddingProvider {
  const provider = getEnv('EMBEDDING_PROVIDER', 'openai');

  if (provider === 'local') {
    const localUrl = getEnv('EMBEDDING_LOCAL_URL', 'http://localhost:8000');
    return new LocalEmbeddingProvider(localUrl);
  }

  const openaiKey = getEnv('OPENAI_API_KEY', '');
  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY required when EMBEDDING_PROVIDER=openai');
  }

  return new OpenAIEmbeddingProvider(openaiKey);
}

let _provider: EmbeddingProvider | null = null;

export function initializeEmbeddingService(): void {
  _provider = createEmbeddingProvider();
}

export function getEmbeddingProvider(): EmbeddingProvider {
  if (!_provider) {
    _provider = createEmbeddingProvider();
  }
  return _provider;
}

export async function embed(text: string): Promise<number[]> {
  const provider = getEmbeddingProvider();
  return provider.embed(text);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const provider = getEmbeddingProvider();
  return provider.embedBatch(texts);
}

export function chunkText(text: string, chunkSize: number = 2000): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}
