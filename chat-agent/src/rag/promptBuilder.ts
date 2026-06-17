import type { SearchResult } from './rag';

export function buildRagPrompt(message: string, chunks: SearchResult[]): string {
  if (chunks.length === 0) return message;

  const context = chunks
    .map((c, i) => `[${i + 1}] (${c.source}, score: ${c.score.toFixed(3)})\n${c.text}`)
    .join('\n\n');

  return `Use the following context to answer the question. If the context does not contain enough information, say so.

Context:
${context}

Question: ${message}`;
}
