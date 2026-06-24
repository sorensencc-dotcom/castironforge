import { Router } from 'express';
import { randomUUID } from 'crypto';
import type { RuntimeAdapter } from '../runtimes/types';
import { runtimeRegistry } from '../runtimes/registry';
import { policyEnforcer } from '../middleware/policyGate';
import { rag } from '../rag/rag';
import { buildRagPrompt } from '../rag/promptBuilder';
import { estimateResponseTokens } from '../utils/tokenCounter';
import { tikaHealthCheck } from '../services/TikaHealthCheck';
import { getCICIntegration } from '../cic/CICIntegration';

export const chatAgentRouter = Router();

chatAgentRouter.get('/health', async (_req, res) => {
  try {
    const runtimeHealth = await runtimeRegistry.getHealth();
    const tikaStatus = await tikaHealthCheck.check();
    const cicIntegration = getCICIntegration();
    const cicHealth = cicIntegration.isAvailable() ? cicIntegration.getHealthStatus() : { cicAvailable: false };

    res.json({
      ...runtimeHealth,
      tika: tikaStatus,
      cic: cicHealth
    });
  } catch (err) {
    res.status(500).json({ error: 'Health check failed' });
  }
});

chatAgentRouter.get('/models', async (_req, res) => {
  try {
    const models = await runtimeRegistry.getModels();
    res.json({ models });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch models' });
  }
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

    // Track token usage
    const tokensUsed = estimateResponseTokens(response);
    policyEnforcer.recordTokens(sessionId, tokensUsed);

    res.json({
      id: randomUUID(),
      message: response,
      tokensUsed
    });
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

  let totalTokens = 0;

  try {
    await runtime.stream({
      sessionId,
      model,
      message: prompt,
      onToken: token => {
        totalTokens += estimateResponseTokens(token);
        res.write(`data: ${token}\n\n`);
      },
      onDone: () => {
        // Record total tokens for session
        policyEnforcer.recordTokens(sessionId, totalTokens);
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
  return runtimeRegistry.resolve(model);
}
