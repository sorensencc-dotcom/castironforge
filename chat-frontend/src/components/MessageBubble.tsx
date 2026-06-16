import React from 'react';
import type { ChatMessage } from '../types/chat';

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end mb-6">
        <div className="max-w-[72%] px-4 py-3 rounded-2xl rounded-tr-sm bg-indigo-600 text-white text-sm leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700/60 flex items-center justify-center shrink-0 mt-0.5">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="2.5" fill="#6366f1"/>
          <path d="M2 10c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="#6366f1" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="max-w-[72%] text-sm text-zinc-200 leading-relaxed pt-1">
        {message.content || (
          <span className="inline-flex gap-1 items-center text-zinc-500">
            <span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        )}
      </div>
    </div>
  );
}
