/**
 * Claude refinement client — upgrades local-LLM drafts into training-grade
 * Q&A pairs in a single combined API call to minimize token spend.
 *
 * One call returns:
 *   { questions, multi_hop_questions, summary }
 *
 * Requires: ANTHROPIC_API_KEY in environment.
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

/**
 * Minimal single-turn text call — no structured output, no thinking.
 * Used by generate-dataset-llm.ts for direct question/summary generation.
 */
export async function claudeText(prompt: string, maxTokens = 512): Promise<string> {
  const resp = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: maxTokens,
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = resp.content.find(b => b.type === 'text');
  return block?.type === 'text' ? block.text.trim() : '';
}

const REFINE_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: { type: 'string' },
      description: 'Refined, precise questions answerable from the chunk.',
    },
    multi_hop_questions: {
      type: 'array',
      items: { type: 'string' },
      description: 'Questions that require connecting facts across chunks.',
    },
    summary: {
      type: 'string',
      description: 'Concise 1-3 sentence factual summary of the chunk.',
    },
  },
  required: ['questions', 'multi_hop_questions', 'summary'],
  additionalProperties: false,
} as const;

export type RefineResult = {
  questions: string[];
  multi_hop_questions: string[];
  summary: string;
  input_tokens: number;
  output_tokens: number;
};

export async function refineCombined(
  chunkText: string,
  draftQuestions: string[],
  draftSummary: string,
  relatedChunks: string[] = [],
): Promise<RefineResult> {
  const relatedSection =
    relatedChunks.length > 0
      ? `\n\nRelated context chunks (for multi-hop questions):\n${relatedChunks.map((c, i) => `[${i + 1}] ${c.slice(0, 300)}`).join('\n\n')}`
      : '';

  const prompt = `You are a training-data curator for a CIC (Cast Iron Forge) knowledge system.

Given a documentation chunk and draft Q&A material produced by a local LLM, your job is:
1. Rewrite the draft questions to be precise, specific, and answerable solely from the chunk.
2. Generate multi-hop questions that require connecting facts across the chunk and the related context.
3. Write a concise factual summary (1-3 sentences) of the chunk's key knowledge.

Rules:
- Questions must not be answerable without reading the chunk.
- Avoid yes/no questions. Prefer "How", "What", "Why", "When", "Which".
- Do not mention "this section", "this document", or "this chunk" in the questions.
- Summary must contain only facts stated in the chunk; no inference.

CHUNK:
${chunkText.slice(0, 1500)}${relatedSection}

DRAFT QUESTIONS (local LLM):
${draftQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

DRAFT SUMMARY (local LLM):
${draftSummary.slice(0, 400)}

Return valid JSON matching the schema exactly.`;

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: prompt }],
    output_config: {
      format: {
        type: 'json_schema',
        json_schema: {
          name: 'refine_result',
          schema: REFINE_SCHEMA,
        },
      },
    },
  });

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text block');
  }

  const parsed = JSON.parse(textBlock.text) as {
    questions: string[];
    multi_hop_questions: string[];
    summary: string;
  };

  return {
    questions: parsed.questions,
    multi_hop_questions: parsed.multi_hop_questions,
    summary: parsed.summary,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
  };
}
