import { runtimeRegistry } from './registry';
import { ollamaAdapter } from './ollama';
import { llamaCppAdapter } from './llamacpp';
import { torqueAdapter } from './torque';
import { opensharingAdapter } from './opensharing';
import { databricksAdapter } from './databricks';

export async function initializeRuntimes(): Promise<void> {
  // Register default runtimes
  // Order matters: higher priority registered later (or explicit priority)
  runtimeRegistry.register('local', ollamaAdapter, 100);
  runtimeRegistry.register('cpu', llamaCppAdapter, 90);
  runtimeRegistry.register('sharing', opensharingAdapter, 85);
  runtimeRegistry.register('databricks', databricksAdapter, 75);
  runtimeRegistry.register('torque', torqueAdapter, 80);

  // Log available runtimes
  const health = await runtimeRegistry.getHealth();
  const models = await runtimeRegistry.getModels();

  console.log('[Runtime Registry] Initialized with prefixes:', runtimeRegistry.listPrefixes());
  console.log('[Runtime Registry] Health status:', health);
  console.log('[Runtime Registry] Available models:', models.length);
}
