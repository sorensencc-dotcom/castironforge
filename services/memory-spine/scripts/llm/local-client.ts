/**
 * Local LLM client — Ollama-compatible HTTP interface.
 *
 * Configure via environment:
 *   LOCAL_LLM_URL   default: http://localhost:11434
 *   LOCAL_LLM_MODEL default: mistral
 *
 * The generate() function posts to /api/generate and streams the response,
 * collecting the full text before returning. Set LOCAL_LLM_URL=mock to use
 * the built-in stub for offline testing.
 */

const BASE_URL = process.env.LOCAL_LLM_URL ?? 'http://localhost:11434';
const MODEL    = process.env.LOCAL_LLM_MODEL ?? 'mistral';

export type LocalGenResult = {
  text: string;
  prompt_tokens: number;
  completion_tokens: number;
};

export async function localGenerate(prompt: string): Promise<LocalGenResult> {
  if (BASE_URL === 'mock') return mockGenerate(prompt);

  const res = await fetch(`${BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, stream: false }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Local LLM error ${res.status}: ${body}`);
  }

  const json = (await res.json()) as {
    response: string;
    prompt_eval_count?: number;
    eval_count?: number;
  };

  return {
    text: json.response.trim(),
    prompt_tokens: json.prompt_eval_count ?? 0,
    completion_tokens: json.eval_count ?? 0,
  };
}

function mockGenerate(prompt: string): LocalGenResult {
  const firstLine = prompt.split('\n').find(l => l.trim()) ?? '';
  return {
    text: [
      'Q: What does this section describe?',
      `A: ${firstLine.slice(0, 120)}`,
    ].join('\n'),
    prompt_tokens: 0,
    completion_tokens: 0,
  };
}
