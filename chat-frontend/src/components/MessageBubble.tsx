import React from 'react';
import type { ChatMessage } from '../types/chat';

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`px-4 py-2 rounded-lg max-w-[70%] ${
          isUser ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-200'
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
