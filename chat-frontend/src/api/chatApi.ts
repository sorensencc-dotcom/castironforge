import type { ChatRequest, ChatMessage } from '../types/chat';

const BASE_URL = 'http://localhost:8000'; // change to your agent host

export async function sendChatMessage(
  payload: ChatRequest
): Promise<ChatMessage> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`Chat API error: ${res.status}`);
  }

  const data = await res.json();
  return {
    id: data.id ?? crypto.randomUUID(),
    role: 'assistant',
    content: data.content,
    timestamp: Date.now()
  };
}

// SSE streaming endpoint: /api/chat/stream
export function streamChatMessage(
  payload: ChatRequest,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (err: unknown) => void
) {
  const url = `${BASE_URL}/api/chat/stream`;
  const eventSource = new EventSource(
    `${url}?sessionId=${encodeURIComponent(payload.sessionId)}&model=${encodeURIComponent(
      payload.model
    )}&message=${encodeURIComponent(payload.message)}`
  );

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
