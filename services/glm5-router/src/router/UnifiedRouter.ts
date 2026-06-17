/**
 * Unified Router
 * filename: UnifiedRouter.ts
 * date: 2026-06-17
 * semver: 0.1.0
 *
 * Shared router for CIC, Rewrite Labs, and Chat Engine.
 * Routes tasks across three distinct modes but with shared infrastructure.
 */

import {
  RouterMode,
  UnifiedContextFrame,
  RoutingDecision,
  TaskType,
  ModelVariant,
  Scope,
  EditProtocol,
} from "../types/index.js";
import { LabsTaskType, LabsRoutingDecision, LabsProtocol } from "../types/labs-protocol.js";

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
 * Unified router for CIC, Rewrite Labs, and Chat Engine.
 * All three modes share the same GLM-5 fleet and routing logic.
 */
export class UnifiedRouter {
  constructor(
    private glm5Client: GLM5Client,
    private logger: Logger,
    private config?: { enable_labs?: boolean; enable_chat?: boolean; enable_cic?: boolean }
  ) {
    this.config = {
      enable_cic: true,
      enable_labs: true,
      enable_chat: true,
      ...config,
    };
  }

  /**
   * Route a request based on mode (cic | labs | chat)
   */
  async route(mode: RouterMode, envelope: unknown): Promise<RoutingDecision | LabsRoutingDecision> {
    switch (mode) {
      case "cic":
        if (!this.config.enable_cic) throw new Error("CIC mode not enabled");
        return this._routeCIC(envelope);

      case "labs":
        if (!this.config.enable_labs) throw new Error("Labs mode not enabled");
        return this._routeLabs(envelope);

      case "chat":
        if (!this.config.enable_chat) throw new Error("Chat mode not enabled");
        return this._routeChat(envelope);

      default:
        throw new Error(`Unknown router mode: ${mode}`);
    }
  }

  /**
   * CIC mode routing (internal development)
   */
  private _routeCIC(envelope: unknown): RoutingDecision {
    const env = envelope as { task_type?: TaskType; scope?: Scope };

    let model: ModelVariant;
    let reasoning_effort: "low" | "high" | "max";

    // CIC routing logic (same as CICRouter)
    switch (env.task_type) {
      case "dom_edit":
        model = env.scope === "local" ? "glm-5.1" : "glm-5.2";
        reasoning_effort = "high";
        break;

      case "code_edit":
        model = "glm-5.2";
        reasoning_effort = env.scope === "repo_scale" ? "max" : "high";
        break;

      case "refactor":
        model = "glm-5.2";
        reasoning_effort = env.scope === "repo_scale" ? "max" : "high";
        break;

      case "search":
        model = env.scope === "repo_scale" ? "glm-5.2" : "glm-5.1";
        reasoning_effort = "high";
        break;

      case "cic_task":
        model = "glm-5.1";
        reasoning_effort = "max";
        break;

      default:
        model = "glm-5.1";
        reasoning_effort = "high";
    }

    return {
      task_type: env.task_type || "cic_task",
      model,
      reasoning_effort,
      enable_thinking: false,
      context_mode: "short",
      prompt_pack_id: `cic_${env.task_type || "default"}`,
      should_call_torquequery: false,
    };
  }

  /**
   * Labs mode routing (external redesign business)
   */
  private _routeLabs(envelope: unknown): LabsRoutingDecision {
    const env = envelope as { task_type?: LabsTaskType };

    let model: ModelVariant;
    let reasoning_effort: "low" | "high" | "max";

    // Labs routing logic
    switch (env.task_type) {
      case "labs_discovery":
        model = "glm-5.1"; // Fast classification + scoring
        reasoning_effort = "high";
        break;

      case "labs_harvest":
        model = "glm-5.2"; // Long-context extraction
        reasoning_effort = "high";
        break;

      case "labs_redesign":
        model = "glm-5.2"; // Deep multi-page reasoning
        reasoning_effort = "max";
        break;

      case "labs_component_redesign":
        model = "glm-5.2"; // Design reasoning
        reasoning_effort = "high";
        break;

      case "labs_outreach":
        model = "glm-5.1"; // Fast email/pitch generation
        reasoning_effort = "high";
        break;

      case "labs_lead_score":
        model = "glm-5.1"; // Classification + scoring (fast)
        reasoning_effort = "high";
        break;

      case "labs_delivery":
        model = "glm-5.2"; // Code + asset generation
        reasoning_effort = "high";
        break;

      default:
        model = "glm-5.1";
        reasoning_effort = "high";
    }

    return {
      task_type: env.task_type || "labs_discovery",
      model,
      reasoning_effort,
      enable_thinking: false,
      context_mode: "long",
      prompt_pack_id: `labs_${env.task_type || "default"}`,
    };
  }

  /**
   * Chat Engine mode routing
   */
  private _routeChat(envelope: unknown): RoutingDecision {
    const env = envelope as { task_type?: TaskType; scope?: Scope };

    let model: ModelVariant;
    let reasoning_effort: "low" | "high" | "max";

    // Chat routing (optimized for interactive latency)
    switch (env.task_type) {
      case "dom_edit":
        model = "glm-5.1"; // Fast DOM edits
        reasoning_effort = "high";
        break;

      case "design_variant":
        model = "glm-5.2"; // Design reasoning
        reasoning_effort = "high";
        break;

      case "code_edit":
        model = "glm-5.2"; // Code generation
        reasoning_effort = "high";
        break;

      case "refactor":
        model = "glm-5.2";
        reasoning_effort = "high";
        break;

      case "search":
        model = "glm-5.1"; // Fast search results
        reasoning_effort = "high";
        break;

      default:
        model = "glm-5.1";
        reasoning_effort = "high";
    }

    return {
      task_type: env.task_type || "dom_edit",
      model,
      reasoning_effort,
      enable_thinking: false,
      context_mode: "short",
      prompt_pack_id: `chat_${env.task_type || "default"}`,
      should_call_torquequery: env.task_type === "search",
    };
  }

  /**
   * Assemble unified context frame
   */
  assembleContext(mode: RouterMode, envelope: unknown): UnifiedContextFrame {
    return {
      user_intent: (envelope as { user_message?: string }).user_message || "",
      mode,
      dom_context: undefined,
      code_context: undefined,
      design_context: undefined,
    };
  }

  /**
   * Execute a routed request
   */
  async execute(
    mode: RouterMode,
    decision: RoutingDecision | LabsRoutingDecision,
    context: UnifiedContextFrame,
    prompt: string
  ): Promise<EditProtocol | LabsProtocol | unknown> {
    const callId = this._generateCallId();

    this.logger.info(`Executing routed request`, {
      call_id: callId,
      mode,
      model: decision.model,
      task_type: decision.task_type,
    });

    try {
      const response = await this.glm5Client.call(decision.model, prompt, {
        reasoning_effort: decision.reasoning_effort,
        enable_thinking: decision.enable_thinking,
      });

      const parsed = JSON.parse(response);

      this.logger.debug(`Routed request complete`, {
        call_id: callId,
        action: (parsed as { action?: string }).action,
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

  private _generateCallId(): string {
    return `route_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

export { Logger, GLM5Client };
