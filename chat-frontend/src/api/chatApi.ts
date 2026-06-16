import type { ChatRequest, ChatMessage, HealthStatus, Model } from '../types/chat';

const BASE_URL = 'http://localhost:8000'; // CIC Chat Agent

export async function sendChatMessage(
  payload: ChatRequest
): Promise<ChatMessage> {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`Chat API error: ${res.status}`);
  }

  const data = (await res.json()) as { id?: string; message?: string };
  return {
    id: data.id ?? crypto.randomUUID(),
    role: 'assistant',
    content: data.message ?? '',
    timestamp: Date.now()
  };
}

export function streamChatMessage(
  payload: ChatRequest,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (err: unknown) => void
) {
  const params = new URLSearchParams({
    sessionId: payload.sessionId,
    model: payload.model,
    message: payload.message
  });
  const eventSource = new EventSource(`${BASE_URL}/chat/stream?${params.toString()}`);

  eventSource.onmessage = e => {
    if (e.data === '[DONE]') {
      eventSource.close();
      onDone();
      return;
    }
    onToken(e.data);
  };

  eventSource.onerror = err => {
    eventSource.close();
    onError(err);
  };

  return () => eventSource.close();
}

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json() as Promise<HealthStatus>;
}

export async function fetchModels(): Promise<Model[]> {
  const res = await fetch(`${BASE_URL}/models`);
  if (!res.ok) throw new Error(`Models fetch failed: ${res.status}`);
  const data = (await res.json()) as { models?: Model[] };
  return data.models ?? [];
}
