import type { RuntimeAdapter, RuntimeStatus, CompleteParams, StreamParams } from './types';

const TORQUE_URL = process.env.TORQUE_URL ?? 'http://localhost:9000';

async function ping(): Promise<boolean> {
  try {
    const res = await fetch(`${TORQUE_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export const torqueAdapter: RuntimeAdapter = {
  async health(): Promise<RuntimeStatus> {
    return (await ping()) ? 'ok' : 'error';
  },

  // TorqueQuery is retrieval-only — inference comes from Ollama/llama.cpp
  async models() {
    return [];
  },

  async complete(_params: CompleteParams): Promise<string> {
    throw new Error('torqueAdapter.complete: not supported — use ollamaAdapter or llamaCppAdapter');
  },

  async stream(_params: StreamParams): Promise<void> {
    throw new Error('torqueAdapter.stream: not supported — use ollamaAdapter or llamaCppAdapter');
  },

  async embed(_text: string): Promise<number[]> {
    throw new Error('torqueAdapter.embed: not supported — use ollamaAdapter or llamaCppAdapter');
  }
};
