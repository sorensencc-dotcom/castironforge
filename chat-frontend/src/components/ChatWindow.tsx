import React, { useState } from 'react';
import { MessageBubble } from './MessageBubble';
import { useChatSession } from '../hooks/useChatSession';

export function ChatWindow() {
  const { messages, addMessage } = useChatSession();
  const [input, setInput] = useState('');

  function sendMessage() {
    if (!input.trim()) return;

    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    });

    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map(m => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>

      <div className="p-4 border-t border-neutral-800 flex gap-2">
        <input
          className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
        />
        <button
          onClick={sendMessage}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
