/**
 * Simple token counting utility
 *
 * Uses heuristic: ~1 token per 4 characters (approximate)
 * This is a rough estimate; actual token counts vary by model and tokenizer
 */

export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Rough approximation: 1 token ≈ 4 characters
  // For more accuracy, integrate with actual tokenizer (tiktoken, sentencepiece, etc.)
  return Math.ceil(text.length / 4);
}

export function countTokens(text: string): number {
  return estimateTokens(text);
}

export function estimateRequestTokens(message: string, context: string = ''): number {
  return estimateTokens(message + context);
}

export function estimateResponseTokens(response: string): number {
  return estimateTokens(response);
}
