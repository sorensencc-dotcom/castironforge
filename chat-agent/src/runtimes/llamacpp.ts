import type { RuntimeAdapter, RuntimeStatus, CompleteParams, StreamParams } from './types';

const LLAMACPP_URL = process.env.LLAMACPP_URL ?? 'http://localhost:8080';

interface LlamaCppModel {
  id: string;
  name: string;
  size?: string;
}

async function ping(): Promise<boolean> {
  try {
    const res = await fetch(`${LLAMACPP_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export const llamaCppAdapter: RuntimeAdapter = {
  async health(): Promise<RuntimeStatus> {
    return (await ping()) ? 'ok' : 'error';
  },

  async models() {
    try {
      const res = await fetch(`${LLAMACPP_URL}/models`);
      if (!res.ok) return [];
      const data = (await res.json()) as { models?: LlamaCppModel[] };
      return (data.models ?? []).map(m => ({
        id: `cpu:${m.id}`,
        name: m.name,
        runtime: 'llamacpp',
        size: m.size
      }));
    } catch {
      return [];
    }
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

    if (!res.ok) throw new Error(`llama.cpp complete error: ${res.status}`);
    const data = (await res.json()) as { completion?: string };
    return data.completion ?? '';
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

    if (!res.ok || !res.body) throw new Error(`llama.cpp stream error: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const chunk = await reader.read();
      if (chunk.done) break;
      const text = decoder.decode(chunk.value, { stream: true });

      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        if (line === '[DONE]') { onDone(); done = true; break; }
        onToken(line);
      }
    }
  },

  async embed(text: string): Promise<number[]> {
    const res = await fetch(`${LLAMACPP_URL}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    if (!res.ok) throw new Error(`llama.cpp embed error: ${res.status}`);
    const data = (await res.json()) as { embedding?: number[] };
    return data.embedding ?? [];
  }
};
