/**
 * CIC Router
 * filename: CICRouter.ts
 * date: 2026-06-17
 * semver: 0.1.0
 *
 * Deterministic model routing and context assembly for CIC.
 * Routes chat requests, code edits, and agentic tasks to appropriate GLM-5 variants.
 */

import {
  ChatRequestEnvelope,
  RouterClassification,
  RoutingDecision,
  UnifiedContextFrame,
  RouterConfig,
  TaskType,
  ModelVariant,
  Scope,
  EditProtocol,
} from "../types/index.js";

interface Logger {
  info(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
  debug(msg: string, meta?: unknown): void;
}

interface GLM5Client {
  call(
    model: string,
    prompt: string,
    options: { reasoning_effort: string; enable_thinking: boolean }
  ): Promise<string>;
}

/**
 * Core router for CIC task classification and model selection.
 */
export class CICRouter {
  private config: RouterConfig;

  constructor(
    private glm5Client: GLM5Client,
    private logger: Logger,
    config?: Partial<RouterConfig>
  ) {
    this.config = {
      model_thresholds: {
        context_size_long: 65536, // 64k tokens
        context_size_very_long: 131072, // 128k tokens
      },
      default_reasoning_effort: "high",
      enable_thinking: false,
      ...config,
    };
  }

  /**
   * Classify a chat request and route to appropriate model.
   */
  async classify(envelope: ChatRequestEnvelope): Promise<RouterClassification> {
    const prompt = this._buildClassificationPrompt(envelope);

    try {
      const response = await this.glm5Client.call("glm-5.1", prompt, {
        reasoning_effort: "high",
        enable_thinking: false,
      });

      const classification = JSON.parse(response) as RouterClassification;

      this.logger.debug(`Classification for session ${envelope.session_id}`, {
        task_type: classification.task_type,
        scope: classification.scope,
        needs_search: classification.needs_search,
      });

      return classification;
    } catch (error) {
      this.logger.error(`Classification failed for ${envelope.session_id}`, { error });
      // Fallback to conservative classification
      return {
        task_type: "chat" in envelope ? "cic_task" : "code_edit",
        scope: "local",
        needs_search: false,
        needs_orchestrator: false,
        context_budget: "short",
        confidence: 0.0,
      };
    }
  }

  /**
   * Route a request based on classification.
   */
  route(classification: RouterClassification): RoutingDecision {
    const decision = this._makeRoutingDecision(classification);

    this.logger.debug(`Routing decision`, {
      task_type: classification.task_type,
      model: decision.model,
      reasoning_effort: decision.reasoning_effort,
    });

    return decision;
  }

  /**
   * Assemble unified context frame for GLM-5.
   */
  async assembleContext(envelope: ChatRequestEnvelope): Promise<UnifiedContextFrame> {
    return {
      user_intent: envelope.user_message,
      dom_context: envelope.dom_snapshot
        ? {
            element_tree: envelope.dom_snapshot.element_tree,
            active_selector: envelope.dom_snapshot.active_selector,
            styles: envelope.dom_snapshot.computed_styles,
          }
        : undefined,
      code_context: envelope.active_file
        ? {
            active_file: envelope.active_file,
            file_content: "", // Would be populated from file system
            component_tree: undefined,
          }
        : undefined,
      design_context: undefined, // Would be populated from design system
      cic_context: envelope.cic_state,
    };
  }

  /**
   * Execute a routed request.
   */
  async execute(
    decision: RoutingDecision,
    context: UnifiedContextFrame,
    prompt: string
  ): Promise<EditProtocol> {
    const callId = this._generateCallId();

    this.logger.info(`Executing routed request`, {
      call_id: callId,
      model: decision.model,
      task_type: decision.prompt_pack_id,
    });

    try {
      const response = await this.glm5Client.call(decision.model, prompt, {
        reasoning_effort: decision.reasoning_effort,
        enable_thinking: decision.enable_thinking,
      });

      const parsed = JSON.parse(response) as EditProtocol;

      this.logger.debug(`Routed request complete`, {
        call_id: callId,
        action: parsed.action,
      });

      return parsed;
    } catch (error) {
      this.logger.error(`Routed request failed`, {
        call_id: callId,
        error,
      });
      throw error;
    }
  }

  private _makeRoutingDecision(classification: RouterClassification): RoutingDecision {
    let model: ModelVariant;
    let reasoning_effort: "low" | "high" | "max";

    // Task-based routing
    switch (classification.task_type) {
      case "dom_edit":
        if (classification.scope === "local") {
          model = "glm-5.1";
          reasoning_effort = "high";
        } else {
          model = "glm-5.2";
          reasoning_effort = "high";
        }
        break;

      case "design_variant":
        model = "glm-5.2";
        reasoning_effort = "high";
        break;

      case "code_edit":
        if (classification.scope === "local") {
          model = "glm-5.2";
          reasoning_effort = "high";
        } else {
          model = "glm-5.2";
          reasoning_effort = "max";
        }
        break;

      case "refactor":
        model = "glm-5.2";
        reasoning_effort = classification.scope === "repo_scale" ? "max" : "high";
        break;

      case "search":
        model = classification.scope === "repo_scale" ? "glm-5.2" : "glm-5.1";
        reasoning_effort = "high";
        break;

      case "cic_task":
        model = "glm-5.1"; // Orchestrator decides internally
        reasoning_effort = "max";
        break;

      default:
        model = "glm-5.1";
        reasoning_effort = "high";
    }

    return {
      task_type: classification.task_type,
      model,
      reasoning_effort,
      enable_thinking: false,
      context_mode: classification.context_budget,
      prompt_pack_id: `${classification.task_type}_${model}`,
      should_call_torquequery: classification.needs_search,
    };
  }

  private _buildClassificationPrompt(envelope: ChatRequestEnvelope): string {
    return `You are a task classifier for a code intelligence system.
Classify the following chat message into a task type and analyze its scope.

Return ONLY valid JSON:
{
  "task_type": "dom_edit" | "design_variant" | "code_edit" | "refactor" | "search" | "cic_task",
  "scope": "local" | "multi_file" | "repo_scale",
  "needs_search": boolean,
  "needs_orchestrator": boolean,
  "context_budget": "short" | "long",
  "confidence": number
}

Message: "${envelope.user_message}"
Mode: ${envelope.mode}
Active file: ${envelope.active_file || "none"}
Active component: ${envelope.active_component || "none"}

Classify this message:
- dom_edit: Direct DOM/HTML modifications
- design_variant: Design system or CSS variable changes
- code_edit: Source code modifications (single or multi-file)
- refactor: Large architectural changes
- search: "Where is X?" or similar queries
- cic_task: Build fixes, multi-phase workflows, orchestration tasks

Return ONLY the JSON.`;
  }

  private _generateCallId(): string {
    return `route_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

export { Logger, GLM5Client };
