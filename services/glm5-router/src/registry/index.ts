/**
 * Tool Registry Index
 * filename: index.ts
 * date: 2026-06-17
 */

export * from "./types.js";
export * from "./ToolRegistry.js";
export * from "./ToolLoader.js";
export * from "./ToolRouter.js";

/**
 * Factory function to create and initialize a complete tool registry system
 */
export async function initializeToolRegistry(config: {
  staticDir?: string;
  moduleDir?: string;
  mcpManifest?: string;
  logger: {
    info(msg: string, meta?: unknown): void;
    error(msg: string, meta?: unknown): void;
    debug(msg: string, meta?: unknown): void;
  };
}) {
  const { ToolRegistry } = await import("./ToolRegistry.js");
  const { ToolLoader } = await import("./ToolLoader.js");
  const { ToolRouter } = await import("./ToolRouter.js");

  // Create registry and loader
  const registry = new ToolRegistry(config.logger);
  const loader = new ToolLoader({
    ...config,
    logger: config.logger,
  });

  // Load tools
  const tools = await loader.load();

  // Register all tools
  for (const tool of tools) {
    registry.register(tool);
  }

  // Create router
  const router = new ToolRouter(registry, config.logger);

  config.logger.info("Tool registry initialized", {
    totalTools: registry.getStats().totalTools,
  });

  return {
    registry,
    loader,
    router,
  };
}
