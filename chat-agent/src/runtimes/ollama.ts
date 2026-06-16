import type { RuntimeAdapter, RuntimeStatus, CompleteParams, StreamParams } from './types';

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';

interface OllamaModel {
  name: string;
  details?: { parameter_size?: string };
}

async function ping(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    return res.ok;
  } catch {
    return false;
  }
}

export const ollamaAdapter: RuntimeAdapter = {
  async health(): Promise<RuntimeStatus> {
    return (await ping()) ? 'ok' : 'error';
  },

  async models() {
    try {
      const res = await fetch(`${OLLAMA_URL}/api/tags`);
      if (!res.ok) return [];
      const data = (await res.json()) as { models?: OllamaModel[] };
      return (data.models ?? []).map(m => ({
        id: `local:${m.name}`,
        name: m.name,
        runtime: 'ollama',
        size: m.details?.parameter_size
      }));
    } catch {
      return [];
    }
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

    if (!res.ok) throw new Error(`Ollama complete error: ${res.status}`);
    const data = (await res.json()) as { response?: string };
    return data.response ?? '';
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

    if (!res.ok || !res.body) throw new Error(`Ollama stream error: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const chunk = await reader.read();
      if (chunk.done) break;
      const text = decoder.decode(chunk.value, { stream: true });

      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line) as { done?: boolean; response?: string };
          if (obj.done) { onDone(); done = true; break; }
          if (obj.response) onToken(obj.response);
        } catch { /* ignore partial-line parse errors */ }
      }
    }
  },

  async embed(text: string): Promise<number[]> {
    const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'nomic-embed-text', prompt: text })
    });

    if (!res.ok) throw new Error(`Ollama embed error: ${res.status}`);
    const data = (await res.json()) as { embedding?: number[] };
    return data.embedding ?? [];
  }
};
