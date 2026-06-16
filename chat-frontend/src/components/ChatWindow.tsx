import React, { useState } from 'react';
import { MessageBubble } from './MessageBubble';
import { useStreamingChat } from '../hooks/useStreamingChat';
import type { useChatSession } from '../hooks/useChatSession';

type Session = ReturnType<typeof useChatSession>;

interface Props {
  session: Session;
}

export function ChatWindow({ session }: Props) {
  const {
    sessionId,
    messages,
    addMessage,
    updateLastAssistantMessage,
    model,
    isStreaming,
    setIsStreaming
  } = session;

  const { send } = useStreamingChat({
    addMessage,
    updateLastAssistantMessage,
    setIsStreaming
  });

  const [input, setInput] = useState('');
  const [useStream, setUseStream] = useState(true);

  async function handleSend() {
    if (!input.trim()) return;
    await send({ sessionId, model, message: input }, useStream);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map(m => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>

      <div className="p-4 border-t border-neutral-800 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <input
            id="stream-toggle"
            type="checkbox"
            checked={useStream}
            onChange={e => setUseStream(e.target.checked)}
          />
          <label htmlFor="stream-toggle">Use streaming (SSE)</label>
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your local agent…"
            disabled={isStreaming}
          />
          <button
            onClick={() => void handleSend()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white disabled:bg-blue-900 transition-colors"
            disabled={isStreaming}
          >
            {isStreaming ? 'Streaming…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
