/**
 * GLM-5 CIC Integration
 * Unified model routing, context assembly, and adapter layer
 */

export * from "./types/index.js";
export * from "./router/CICRouter.js";
export * from "./adapters/GLM5Client.js";
export * from "./adapters/TorqueQueryGLM5Adapter.js";
export * from "./prompts/PromptPacks.js";

/**
 * Integration factory
 * Creates all components needed for GLM-5 ↔ CIC integration
 */
export interface IntegrationFactory {
  router: { default: typeof import("./router/CICRouter.js").CICRouter };
  client: { default: typeof import("./adapters/GLM5Client.js").GLM5Client };
  adapter: { default: typeof import("./adapters/TorqueQueryGLM5Adapter.js").TorqueQueryGLM5Adapter };
  prompts: { default: typeof import("./prompts/PromptPacks.js").promptPackRegistry };
}
