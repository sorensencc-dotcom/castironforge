import { Router } from 'express';
import type { RuntimeAdapter } from '../runtimes/types';
import { torqueAdapter } from '../runtimes/torque';
import { ollamaAdapter } from '../runtimes/ollama';
import { llamaCppAdapter } from '../runtimes/llamacpp';
import { rag } from '../rag/rag';
import { buildRagPrompt } from '../rag/promptBuilder';

export const chatAgentRouter = Router();

chatAgentRouter.get('/health', async (_req, res) => {
  try {
    const [torque, ollama, llamacpp] = await Promise.all([
      torqueAdapter.health(),
      ollamaAdapter.health(),
      llamaCppAdapter.health()
    ]);
    res.json({ torque, ollama, llamacpp });
  } catch {
    res.json({ torque: 'error', ollama: 'error', llamacpp: 'error' });
  }
});

chatAgentRouter.get('/models', async (_req, res) => {
  try {
    const [ollamaModels, llamaModels] = await Promise.all([
      ollamaAdapter.models(),
      llamaCppAdapter.models()
    ]);
    res.json({ models: [...ollamaModels, ...llamaModels] });
  } catch {
    res.status(500).json({ models: [] });
  }
});

chatAgentRouter.post('/chat', async (req, res) => {
  const { sessionId, model, message } = req.body as {
    sessionId: string;
    model: string;
    message: string;
  };

  const [chunks, runtime] = await Promise.all([
    rag.search(message).catch(() => []),
    Promise.resolve(resolveRuntime(model))
  ]);

  const prompt = buildRagPrompt(message, chunks);
  const response = await runtime.complete({ sessionId, model, message: prompt });

  res.json({ id: crypto.randomUUID(), message: response });
});

chatAgentRouter.get('/chat/stream', async (req, res) => {
  const { sessionId, model, message } = req.query as Record<string, string>;

  const [chunks, runtime] = await Promise.all([
    rag.search(message).catch(() => []),
    Promise.resolve(resolveRuntime(model))
  ]);

  const prompt = buildRagPrompt(message, chunks);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  await runtime.stream({
    sessionId,
    model,
    message: prompt,
    onToken: token => { res.write(`data: ${token}\n\n`); },
    onDone: () => {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  });
});

chatAgentRouter.post('/embed', async (req, res) => {
  const { model, text } = req.body as { model: string; text: string };
  const runtime = resolveRuntime(model);
  const embedding = await runtime.embed(text);
  res.json({ embedding });
});

chatAgentRouter.post('/search', async (req, res) => {
  const { query, topK } = req.body as { query: string; topK: number };
  const results = await rag.search(query, topK ?? 5);
  res.json({ results });
});

function resolveRuntime(model: string): RuntimeAdapter {
  if (model.startsWith('local:')) return ollamaAdapter;
  if (model.startsWith('cpu:')) return llamaCppAdapter;
  if (model.startsWith('torque:')) return torqueAdapter;
  throw new Error(`Unknown runtime for model: ${model}`);
}
