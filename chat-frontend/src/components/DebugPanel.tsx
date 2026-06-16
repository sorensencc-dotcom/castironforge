import React from 'react';

interface Props {
  isStreaming: boolean;
}

export function DebugPanel({ isStreaming }: Props) {
  return (
    <div className="p-4 text-neutral-400 text-sm border-t border-neutral-800 flex justify-between">
      <p>Streaming: {isStreaming ? 'yes' : 'no'}</p>
      <p>Tokens: —</p>
      <p>Latency: —</p>
      <p>RAG Chunks: —</p>
    </div>
  );
}
