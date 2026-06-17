import React, { useState, useRef, useEffect } from 'react';
import { MessageBubble } from './MessageBubble';
import { useStreamingChat } from '../hooks/useStreamingChat';
import type { useChatSession } from '../hooks/useChatSession';

type Session = ReturnType<typeof useChatSession>;

interface Props {
  session: Session;
}

const SUGGESTIONS = [
  'Summarize the latest architecture docs',
  'What changed in the last release?',
  'Find all references to the ingestion pipeline',
  'Explain the multi-agent module design',
];

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
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || isStreaming) return;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await send({ sessionId, model, message: msg }, useStream);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full px-8 text-center gap-8">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-orange-600/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-4">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <path d="M11 2a9 9 0 100 18A9 9 0 0011 2z" fill="#f97316" fillOpacity="0.2"/>
                  <circle cx="11" cy="11" r="3" fill="#f97316"/>
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-stone-100 mb-1.5">How can I help?</h2>
              <p className="text-sm text-stone-500 max-w-xs leading-relaxed">
                Ask anything about your indexed docs, repos, and research assets.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-md">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => void handleSend(s)}
                  className="text-left px-4 py-3 rounded-xl border border-stone-800 hover:border-stone-700 bg-stone-900/60 hover:bg-stone-800/60 text-xs text-stone-500 hover:text-stone-300 transition-all leading-relaxed"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto px-6 py-8">
            {messages.map(m => (
              <MessageBubble key={m.id} message={m} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="shrink-0 px-6 pb-6 pt-2">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end gap-2 bg-stone-900 border border-stone-700/60 rounded-2xl px-4 py-3 focus-within:border-orange-500/40 focus-within:ring-1 focus-within:ring-orange-500/20 transition-all">
            <textarea
              ref={textareaRef}
              className="flex-1 bg-transparent text-sm text-stone-100 placeholder-stone-600 resize-none focus:outline-none leading-relaxed"
              rows={1}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask your local agent…"
              disabled={isStreaming}
            />
            <div className="flex items-center gap-2 shrink-0 self-end mb-0.5">
              <button
                onClick={() => setUseStream(v => !v)}
                className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                  useStream
                    ? 'bg-orange-600/15 text-orange-400 border-orange-500/30'
                    : 'text-stone-600 border-stone-700/50 hover:text-stone-400'
                }`}
                title={useStream ? 'Streaming on' : 'Streaming off'}
              >
                SSE
              </button>
              <button
                onClick={() => void handleSend()}
                disabled={!input.trim() || isStreaming}
                className="w-8 h-8 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:bg-stone-800 disabled:text-stone-600 text-white flex items-center justify-center transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M1.5 6.5h10M6.5 1.5l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
          <p className="text-center text-xs text-stone-700 mt-2">
            Local inference · No data leaves your machine
          </p>
        </div>
      </div>
    </div>
  );
}
