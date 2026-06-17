import { Router } from 'express';
import { randomUUID } from 'crypto';
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
  const models = [];
  try {
    const ollamaModels = await ollamaAdapter.models().catch(() => []);
    models.push(...ollamaModels);
  } catch {}
  try {
    const llamaModels = await llamaCppAdapter.models().catch(() => []);
    models.push(...llamaModels);
  } catch {}
  res.json({ models });
});

chatAgentRouter.post('/chat', async (req, res) => {
  const { sessionId, model, message } = req.body as {
    sessionId: string;
    model: string;
    message: string;
  };

  let runtime: RuntimeAdapter;
  try {
    runtime = resolveRuntime(model);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }

  try {
    const chunks = await rag.search(message).catch(() => []);
    const prompt = buildRagPrompt(message, chunks);
    const response = await runtime.complete({ sessionId, model, message: prompt });
    res.json({ id: randomUUID(), message: response });
  } catch {
    res.status(500).json({ error: 'Inference failed' });
  }
});

chatAgentRouter.get('/chat/stream', async (req, res) => {
  const { sessionId, model, message } = req.query as Record<string, string>;

  let runtime: RuntimeAdapter;
  try {
    runtime = resolveRuntime(model);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }

  const chunks = await rag.search(message).catch(() => []);
  const prompt = buildRagPrompt(message, chunks);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
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
  } catch {
    res.write('data: [ERROR]\n\n');
    res.end();
  }
});

chatAgentRouter.post('/embed', async (req, res) => {
  const { model, text } = req.body as { model: string; text: string };
  let runtime: RuntimeAdapter;
  try {
    runtime = resolveRuntime(model);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }
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
  throw new Error(`Unknown runtime prefix for model: ${model}`);
}
