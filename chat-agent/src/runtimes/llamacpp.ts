import type { RuntimeAdapter, HealthStatus, RuntimeModel, CompleteParams, StreamParams } from './types';
import { LLAMACPP_URL } from './config';

interface LlamaCppHealthResponse {
  status: HealthStatus;
}

interface LlamaCppModel {
  id: string;
  name: string;
  size: string;
}

interface LlamaCppModelsResponse {
  models: LlamaCppModel[];
}

interface LlamaCppCompletionResponse {
  completion: string;
}

interface LlamaCppCompletionStreamChunk {
  token: string;
  done: boolean;
}

interface LlamaCppEmbeddingResponse {
  embedding: number[];
}

export const llamaCppAdapter: RuntimeAdapter = {
  async health(): Promise<HealthStatus> {
    try {
      const res = await fetch(`${LLAMACPP_URL}/health`);
      if (!res.ok) return 'error';
      const data = (await res.json()) as LlamaCppHealthResponse;
      return data.status;
    } catch {
      return 'error';
    }
  },

  async models(): Promise<RuntimeModel[]> {
    const res = await fetch(`${LLAMACPP_URL}/models`);
    if (!res.ok) return [];
    const data = (await res.json()) as LlamaCppModelsResponse;
    return data.models.map(m => ({
      id: `cpu:${m.id}`,
      name: m.name,
      runtime: 'llamacpp',
      size: m.size
    }));
  },

  async complete({ model, message }: CompleteParams): Promise<string> {
    const res = await fetch(`${LLAMACPP_URL}/completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model.replace(/^cpu:/, ''),
        prompt: message,
        stream: false
      })
    });

    if (!res.ok) throw new Error(`llama.cpp complete error: HTTP ${res.status}`);
    const data = (await res.json()) as LlamaCppCompletionResponse;
    return data.completion;
  },

  async stream({ model, message, onToken, onDone }: StreamParams): Promise<void> {
    const res = await fetch(`${LLAMACPP_URL}/completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model.replace(/^cpu:/, ''),
        prompt: message,
        stream: true
      })
    });

    if (!res.ok || !res.body) throw new Error(`llama.cpp stream error: HTTP ${res.status}`);

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
        let obj: LlamaCppCompletionStreamChunk;
        try {
          obj = JSON.parse(trimmed) as LlamaCppCompletionStreamChunk;
        } catch { continue; }

        if (obj.done) { onDone(); finished = true; break; }
        if (obj.token) onToken(obj.token);
      }
    }
  },

  async embed(text: string): Promise<number[]> {
    const res = await fetch(`${LLAMACPP_URL}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    if (!res.ok) throw new Error(`llama.cpp embed error: HTTP ${res.status}`);
    const data = (await res.json()) as LlamaCppEmbeddingResponse;
    return data.embedding;
  }
};
