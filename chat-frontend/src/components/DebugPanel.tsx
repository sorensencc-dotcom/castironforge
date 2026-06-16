import React from 'react';

export function DebugPanel() {
  return (
    <div className="p-4 text-neutral-400 text-sm border-t border-neutral-800">
      <p>Tokens: —</p>
      <p>Latency: —</p>
      <p>RAG Chunks: —</p>
    </div>
  );
}
