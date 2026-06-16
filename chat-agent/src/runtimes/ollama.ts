import type { RuntimeAdapter, HealthStatus, RuntimeModel, CompleteParams, StreamParams } from './types';
import { OLLAMA_URL } from './config';

interface OllamaModelDetails {
  parameter_size?: string;
}

interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: OllamaModelDetails;
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

interface OllamaGenerateStreamChunk {
  model: string;
  created_at: string;
  response?: string;
  done: boolean;
}

interface OllamaEmbeddingResponse {
  embedding: number[];
}

export const ollamaAdapter: RuntimeAdapter = {
  async health(): Promise<HealthStatus> {
    try {
      const res = await fetch(`${OLLAMA_URL}/api/tags`);
      return res.ok ? 'ok' : 'error';
    } catch {
      return 'error';
    }
  },

  async models(): Promise<RuntimeModel[]> {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) return [];
    const data = (await res.json()) as OllamaTagsResponse;
    return data.models.map(m => ({
      id: `local:${m.name}`,
      name: m.name,
      runtime: 'ollama',
      size: m.details?.parameter_size
    }));
  },

  async complete({ model, message }: CompleteParams): Promise<string> {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model.replace(/^local:/, ''),
        prompt: message,
        stream: false
      })
    });

    if (!res.ok) throw new Error(`Ollama complete error: HTTP ${res.status}`);
    const data = (await res.json()) as OllamaGenerateResponse;
    return data.response;
  },

  async stream({ model, message, onToken, onDone }: StreamParams): Promise<void> {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model.replace(/^local:/, ''),
        prompt: message,
        stream: true
      })
    });

    if (!res.ok || !res.body) throw new Error(`Ollama stream error: HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let finished = false;

    while (!finished) {
      const chunk = await reader.read();
      if (chunk.done) break;

      const text = decoder.decode(chunk.value, { stream: true });
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let obj: OllamaGenerateStreamChunk;
        try {
          obj = JSON.parse(trimmed) as OllamaGenerateStreamChunk;
        } catch { continue; }

        if (obj.done) { onDone(); finished = true; break; }
        if (obj.response) onToken(obj.response);
      }
    }
  },

  async embed(text: string): Promise<number[]> {
    const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'nomic-embed-text', prompt: text })
    });

    if (!res.ok) throw new Error(`Ollama embed error: HTTP ${res.status}`);
    const data = (await res.json()) as OllamaEmbeddingResponse;
    return data.embedding;
  }
};
